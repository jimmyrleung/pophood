import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadLabels: vi.fn<() => Promise<{ labels: Record<string, string>; problem: string | null }>>(),
  setLabel: vi.fn<(key: string, label: string | null) => Promise<void>>(),
}));

vi.mock("./commands", () => ({ loadLabels: mocks.loadLabels, setLabel: mocks.setLabel }));

const { createLabelStore } = await import("./labels");

const key = "/lpc/it8696e/0/fan/4|Fan #5";

afterEach(() => {
  vi.clearAllMocks();
});

async function started(labels: Record<string, string> = {}) {
  mocks.loadLabels.mockResolvedValueOnce({ labels, problem: null });
  const store = createLabelStore();
  await store.start();
  return store;
}

describe("label store", () => {
  it("maps the loaded labels and notifies once", async () => {
    mocks.loadLabels.mockResolvedValueOnce({ labels: { [key]: "CPU fan" }, problem: null });
    const store = createLabelStore();
    const listener = vi.fn();
    store.subscribe(listener);

    await store.start();

    expect(store.getSnapshot().map.get(key)).toBe("CPU fan");
    expect(store.getSnapshot().loadError).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps a load problem, and a rejected load, as loadError", async () => {
    mocks.loadLabels.mockResolvedValueOnce({ labels: {}, problem: "labels.json could not be used" });
    const withProblem = createLabelStore();
    await withProblem.start();
    expect(withProblem.getSnapshot().map.size).toBe(0);
    expect(withProblem.getSnapshot().loadError).toBe("labels.json could not be used");

    mocks.loadLabels.mockRejectedValueOnce("no core");
    const rejected = createLabelStore();
    await rejected.start();
    expect(rejected.getSnapshot().map.size).toBe(0);
    expect(rejected.getSnapshot().loadError).toBe("no core");
  });

  it("trims the text before it saves", async () => {
    const store = await started();
    mocks.setLabel.mockResolvedValueOnce(undefined);

    await store.save(key, "  Rear  ", "Fan #5");

    expect(mocks.setLabel).toHaveBeenCalledTimes(1);
    expect(mocks.setLabel).toHaveBeenLastCalledWith(key, "Rear");
    expect(store.getSnapshot().map.get(key)).toBe("Rear");
  });

  it("clears the label for empty text and for the default name", async () => {
    const store = await started({ [key]: "Rear" });
    mocks.setLabel.mockResolvedValue(undefined);

    await store.save(key, "", "Fan #5");
    expect(mocks.setLabel).toHaveBeenLastCalledWith(key, null);
    expect(mocks.setLabel).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().map.has(key)).toBe(false);

    await store.save(key, "Rear", "Fan #5");
    expect(store.getSnapshot().map.get(key)).toBe("Rear");

    await store.save(key, " Fan #5 ", "Fan #5");
    expect(mocks.setLabel).toHaveBeenLastCalledWith(key, null);
    expect(mocks.setLabel).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot().map.has(key)).toBe(false);
  });

  it("rejects, and changes nothing, when the core refuses the save", async () => {
    const store = await started({ [key]: "Rear" });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    mocks.setLabel.mockRejectedValueOnce("could not write X");

    await expect(store.save(key, "Other", "Fan #5")).rejects.toBe("could not write X");

    expect(store.getSnapshot()).toBe(before);
    expect(store.getSnapshot().map.get(key)).toBe("Rear");
    expect(listener).not.toHaveBeenCalled();
  });
});
