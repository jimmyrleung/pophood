import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, effectiveTheme, readOverride, systemTheme, toggleTheme, watchSystemTheme, writeOverride } from "./theme";

let systemDark = true;
const changeListeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: systemDark,
    media: query,
    addEventListener: (_: string, listener: () => void) => changeListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => changeListeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  systemDark = true;
  changeListeners.clear();
  localStorage.clear();
  writeOverride(null); // also drops the in-memory fallback a failed write may have left
  installMatchMedia();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("theme (UT-26)", () => {
  it("follows the system theme by default", () => {
    systemDark = false;
    expect(applyTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    systemDark = true;
    expect(applyTheme()).toBe("dark");
  });

  it("toggling away from the system theme stores an override", () => {
    systemDark = true;
    expect(toggleTheme()).toBe("light");
    expect(readOverride()).toBe("light");
    expect(localStorage.getItem("pophood.theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggling back to the system theme clears the override", () => {
    systemDark = true;
    toggleTheme();
    expect(toggleTheme()).toBe("dark");
    expect(readOverride()).toBeNull();
    expect(localStorage.getItem("pophood.theme")).toBeNull();
  });

  it("a stored override wins over the system theme", () => {
    localStorage.setItem("pophood.theme", "light");
    systemDark = true;
    expect(effectiveTheme()).toBe("light");
    expect(systemTheme()).toBe("dark");
  });

  it("ignores a garbage stored value", () => {
    localStorage.setItem("pophood.theme", "purple");
    expect(readOverride()).toBeNull();
    expect(effectiveTheme()).toBe("dark");
  });

  it("tolerates localStorage throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readOverride()).toBeNull();
    expect(() => toggleTheme()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("works without matchMedia (dark)", () => {
    // @ts-expect-error simulating an environment without matchMedia
    delete window.matchMedia;
    expect(systemTheme()).toBe("dark");
    expect(() => watchSystemTheme()()).not.toThrow();
  });

  it("re-applies on a system change only while there is no override", () => {
    const stop = watchSystemTheme();
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");

    systemDark = false;
    changeListeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe("light");

    localStorage.setItem("pophood.theme", "light");
    systemDark = true;
    changeListeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe("light");

    stop();
    expect(changeListeners.size).toBe(0);
  });
});
