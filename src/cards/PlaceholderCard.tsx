import { LockIcon } from "../icons/Icons";
import type { CardModel } from "./fields";

/**
 * A dashed card for something this mode can't read ("Needs full sensors", "Needs PawnIO"), or a solid empty card
 * ("No GPU detected"). Neither can be opened.
 */
export function PlaceholderCard({ card }: { card: CardModel }) {
  if (card.variant === "placeholder") {
    return (
      <article className="card card--placeholder">
        <div className="card__kind">{card.kindLabel}</div>
        <div className="placeholder__lock">
          <LockIcon className="icon--muted" />
          {card.lock}
        </div>
        {card.note && <p className="placeholder__note">{card.note}</p>}
      </article>
    );
  }
  return (
    <article className="card card--empty">
      <div className="card__kind">{card.kindLabel}</div>
      <div className="placeholder__lock">{card.title}</div>
      {card.note && <p className="placeholder__note">{card.note}</p>}
    </article>
  );
}
