import { Sparkline } from "../charts/Sparkline";
import { Card, Field, Hero } from "./CardParts";
import type { CardModel } from "./fields";

interface Props {
  card: CardModel;
  nowMs: number;
  onOpen: (cardId: string) => void;
}

/** One row of fields, plus the inferred OC-profile chip and its caption when the SPD data is there (full sensors only). */
export function MemoryCard({ card, nowMs, onOpen }: Props) {
  return (
    <Card card={card} onOpen={onOpen}>
      {card.hero && <Hero hero={card.hero} />}
      {card.spark && <Sparkline spark={card.spark} nowMs={nowMs} />}
      <div className="fields">
        {card.fields.map((field) => (
          <Field key={field.id} field={field} />
        ))}
        {card.oc && (
          <div className="field">
            <span className="field__label">OC profile</span>
            <span className="chip">{card.oc.chip}</span>
          </div>
        )}
      </div>
      {card.oc && <p className="card__caption">{card.oc.caption}</p>}
    </Card>
  );
}
