import type { ReactNode } from "react";
import { LockIcon } from "../icons/Icons";
import type { CardModel, Cell, FieldModel, HeroModel, LockLabel } from "./fields";

/** A locked value: the lock and its label, never a number. */
export function LockedValue({ label, small }: { label: LockLabel; small?: boolean }) {
  return (
    <span className={small ? "locked locked--small" : "locked"}>
      <LockIcon size={13} />
      {label}
    </span>
  );
}

/** A reading the helper has no value for (and that isn't locked). */
export function NotReported() {
  return (
    <span className="not-reported" title="Not reported">
      —
    </span>
  );
}

function Value({ cell, className }: { cell: Cell; className: string }) {
  if (cell.kind === "locked") return <LockedValue label={cell.label} />;
  if (cell.kind === "none") return <NotReported />;
  return (
    <span className={className}>
      {cell.value}
      {cell.unit !== "" && <span className="unit"> {cell.unit}</span>}
    </span>
  );
}

export function Hero({ hero }: { hero: HeroModel }) {
  return (
    <div className="hero">
      {hero.cell.kind === "value" ? (
        <>
          <span className="hero__value">{hero.cell.value}</span>
          {hero.cell.unit !== "" && <span className="hero__unit">{hero.cell.unit}</span>}
        </>
      ) : (
        <Value cell={hero.cell} className="hero__value" />
      )}
      {hero.label !== null && <span className="hero__label">{hero.label}</span>}
    </div>
  );
}

/** The Disk card's two 28 px heroes, side by side. */
export function Heroes({ heroes }: { heroes: HeroModel[] }) {
  return (
    <div className="heroes">
      {heroes.map((hero, i) => (
        <span key={i} className="heroes__item">
          {hero.cell.kind === "value" ? (
            <>
              <span className="heroes__value">{hero.cell.value}</span> <span className="unit">{hero.cell.unit}</span>
            </>
          ) : (
            <Value cell={hero.cell} className="heroes__value" />
          )}
        </span>
      ))}
    </div>
  );
}

export function Field({ field, children }: { field: FieldModel; children?: ReactNode }) {
  return (
    <div className="field">
      <span className="field__label">{field.label}</span>
      <Value cell={field.cell} className="field__value" />
      {field.bar !== undefined && (
        <div className="bar" aria-hidden="true">
          <div className="bar__fill bar__fill--muted" style={{ width: `${Math.round(field.bar * 100)}%` }} />
        </div>
      )}
      {children}
    </div>
  );
}

export function Fields({ fields }: { fields: FieldModel[] }) {
  return (
    <div className="fields">
      {fields.map((field) => (
        <Field key={field.id} field={field} />
      ))}
    </div>
  );
}

interface CardProps {
  card: CardModel;
  onOpen: (cardId: string) => void;
  children: ReactNode;
}

/**
 * A card. The whole card opens the drill-down when clicked; "All sensors" is the keyboard target (the article itself
 * isn't focusable, so Tab doesn't stop twice).
 */
export function Card({ card, onOpen, children }: CardProps) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <article className="card card--clickable" onClick={() => onOpen(card.id)}>
      <header className="card__header">
        <div>
          <div className="card__kind">{card.kindLabel}</div>
          <div className="card__title">{card.title}</div>
        </div>
        <button
          type="button"
          className="card__link"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(card.id);
          }}
        >
          All sensors
        </button>
      </header>
      {children}
    </article>
  );
}
