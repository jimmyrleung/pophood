import { useState } from "react";
import { DetailChart } from "../charts/LineChart";
import { formatParts, formatSensor, NOT_REPORTED } from "../cards/format";
import { componentName, componentScope, drillSections, groupLabel, cleanName } from "../cards/fields";
import { MAX_LABEL_LENGTH, useLabels, useLabelStore } from "../sensors/labels";
import type { UiFrame, UiSensor } from "../sensors/protocol";
import { useFrame, useSensorStatus, useSeriesList } from "../sensors/store";
import { LockedValue } from "../cards/CardParts";
import { StatusBanner } from "../shell/StatusBanner";

/** A group of more than this many rows may continue in the next column; a smaller one never splits. */
const SPLIT_ABOVE = 8;

interface Props {
  cardId: string;
  /** Back to the Dashboard. */
  onBack: () => void;
}

function Breadcrumb({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <button type="button" className="breadcrumb__link" onClick={onBack}>
        Dashboard
      </button>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

function RenameForm({ sensor, label }: { sensor: UiSensor; label: string | undefined }) {
  const store = useLabelStore();
  const { loadError } = useLabels();
  const [draft, setDraft] = useState(label ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(text: string, verb: "saved" | "reset") {
    try {
      await store.save(sensor.key, text, sensor.name);
      const trimmed = text.trim();
      setDraft(trimmed === sensor.name ? "" : trimmed);
      setError(null);
    } catch (reason) {
      setError(`The name wasn't ${verb}: ${String(reason)}`);
    }
  }

  return (
    <form
      className="rename"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft, "saved");
      }}
    >
      <label className="rename__label" htmlFor="rename-input">
        Display name
      </label>
      <input
        id="rename-input"
        className="rename__input"
        type="text"
        maxLength={MAX_LABEL_LENGTH}
        value={draft}
        placeholder={sensor.name}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" className="btn btn--accent">
        Save name
      </button>
      <button type="button" className="btn btn--secondary" disabled={label === undefined} onClick={() => void save("", "reset")}>
        Reset to “{sensor.name}”
      </button>
      <span className="rename__caption">Shows on the dashboard and in this list. Saved on this PC only.</span>
      {loadError !== null && <p className="rename__error">Names saved earlier couldn't be read: {loadError}</p>}
      {error !== null && (
        <p className="rename__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function SensorDetail({
  sensor,
  label,
  frame,
  stale,
}: {
  sensor: UiSensor;
  label: string | undefined;
  frame: UiFrame;
  stale: boolean;
}) {
  const shown = label ?? sensor.name;
  const series = useSeriesList([sensor.key])[0];
  let min: number | null = null;
  let max: number | null = null;
  for (const value of series?.v ?? []) {
    if (value === null) continue;
    if (min === null || value < min) min = value;
    if (max === null || value > max) max = value;
  }
  const unit = formatParts(sensor.type, 0).unit;
  const now = formatParts(sensor.type, stale ? null : sensor.value);

  return (
    <section className="detail" aria-label="Sensor detail">
      <div className="detail__top">
        <div className="detail__title">
          <div className="detail__group">{groupLabel(sensor.type)}</div>
          <div className="detail__heading">
            <h2 className="detail__name">{shown}</h2>
            <span className="detail__id">{sensor.id}</span>
          </div>
        </div>
        <div className="detail__now">
          <div className="detail__value">
            {now.value}
            {now.unit !== "" && <span className="unit"> {now.unit}</span>}
          </div>
          <div className="detail__caption">now · refreshes every second</div>
        </div>
        <dl className="stats">
          <div className="stats__box">
            <dt>Min (10 min)</dt>
            <dd>{formatSensor(sensor.type, min)}</dd>
          </div>
          <div className="stats__box">
            <dt>Max (10 min)</dt>
            <dd>{formatSensor(sensor.type, max)}</dd>
          </div>
          <div className="stats__box">
            <dt>Unit</dt>
            <dd>{unit === "" ? NOT_REPORTED : unit}</dd>
          </div>
        </dl>
      </div>
      <DetailChart seriesKey={sensor.key} label={`${shown} over the last 10 minutes`} nowMs={frame.t} />
      <RenameForm key={sensor.key} sensor={sensor} label={label} />
    </section>
  );
}

/** The drill-down for one card: every sensor in its scope, grouped into cards, with live values and a detail panel. */
export function SensorList({ cardId, onBack }: Props) {
  const { frame, stale } = useFrame();
  const status = useSensorStatus();
  const labels = useLabels();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (frame === null) {
    return (
      <>
        <Breadcrumb name="Sensors" onBack={onBack} />
        <header>
          <h1 className="page-title">Sensors</h1>
          <p className="page-sub">No sensor data yet.</p>
        </header>
      </>
    );
  }

  const name = componentName(frame, cardId);
  const scope = componentScope(frame, cardId);
  const sections = drillSections(frame, scope, status);
  const groups = sections.flatMap((section) => section.groups);
  const count = groups.reduce((n, group) => n + group.sensors.length, 0);
  // The first row is selected on open, and again if the selected sensor leaves the frame or its group locks.
  const rows = groups.filter((group) => group.lock === null).flatMap((group) => group.sensors);
  const selected = rows.find((s) => s.key === selectedKey) ?? rows[0];
  const hardwareNames = scope
    .map((id) => frame.hardware.find((h) => h.id === id))
    .filter((h) => h !== undefined)
    .map((h) => cleanName(h.name));
  const subline = [...hardwareNames, `${count} ${count === 1 ? "sensor" : "sensors"}`];
  if (cardId === "motherboard") subline.push("generic names until you rename them");

  return (
    <>
      <Breadcrumb name={name} onBack={onBack} />
      <header>
        <h1 className="page-title">{name} sensors</h1>
        <p className="page-sub">{subline.join(" · ")}</p>
      </header>

      <StatusBanner />

      <div className="drill__detail">
        {selected ? (
          <SensorDetail sensor={selected} label={labels.map.get(selected.key)} frame={frame} stale={stale} />
        ) : (
          <section className="detail" aria-label="Sensor detail">
            <p className="detail__caption">This component has no sensors in the current frame.</p>
          </section>
        )}
      </div>

      <section className="drill__list" aria-label="Sensor list">
        {sections.map((section, index) => {
          // A card title sits one level under the nearest heading: the page's h1, or the hardware's h2 (Memory).
          const Title = section.heading === null ? "h2" : "h3";
          return (
            <div key={section.heading ?? index} className="drill__section">
              {section.heading !== null && <h2 className="drill__heading">{section.heading}</h2>}
              <div className="drill__columns">
                {section.groups.map((group) => (
                  <div
                    key={group.type}
                    className={group.lock === null && group.sensors.length > SPLIT_ABOVE ? "group group--split" : "group"}
                  >
                    <Title className="group__title">
                      {group.label} · {group.sensors.length}
                    </Title>
                    {group.lock !== null ? (
                      <div className="group__lock">
                        <LockedValue label={group.lock} />
                      </div>
                    ) : (
                      group.sensors.map((sensor) => {
                        const value = stale ? null : sensor.value;
                        const muted = value === null || (sensor.type === "Fan" && value === 0);
                        return (
                          <button
                            key={sensor.key}
                            type="button"
                            className={sensor.key === selected?.key ? "row row--selected" : "row"}
                            aria-pressed={sensor.key === selected?.key}
                            onClick={() => setSelectedKey(sensor.key)}
                          >
                            <span className="row__name">
                              {labels.map.get(sensor.key) ?? sensor.name}
                              {labels.map.has(sensor.key) && <span className="row__default"> · {sensor.name}</span>}
                            </span>
                            <span className={muted ? "row__value row__value--muted" : "row__value"}>
                              {formatSensor(sensor.type, value)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
