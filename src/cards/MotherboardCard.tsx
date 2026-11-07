import { useLabels } from "../sensors/labels";
import { Card, NotReported } from "./CardParts";
import type { CardModel } from "./fields";

interface Props {
  card: CardModel;
  onOpen: (cardId: string) => void;
}

/** A fan list with a bar per fan and no sparkline (the chosen mockup draws none; the history is in the drill-down). */
export function MotherboardCard({ card, onOpen }: Props) {
  const fans = card.fans;
  const { map } = useLabels();
  return (
    <Card card={card} onOpen={onOpen} linkText="Name your fans">
      <div className="fans">
        {fans?.rows.map((row) => (
          <div className="fan" key={row.key}>
            <div className="fan__top">
              <span className="fan__name">{map.get(row.key) ?? row.name}</span>
              {row.cell.kind === "value" ? (
                <span className="fan__value">
                  {row.cell.value}
                  <span className="unit"> {row.cell.unit}</span>
                </span>
              ) : (
                <NotReported />
              )}
            </div>
            <div className="bar" aria-hidden="true">
              <div className="bar__fill bar__fill--accent" style={{ width: `${Math.round(row.fraction * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {fans?.footer && <p className="card__footer">{fans.footer}</p>}
    </Card>
  );
}
