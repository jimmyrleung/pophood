import { Sparkline } from "../charts/Sparkline";
import { Card, Fields, Heroes } from "./CardParts";
import type { CardModel } from "./fields";

interface Props {
  card: CardModel;
  nowMs: number;
  onOpen: (cardId: string) => void;
}

export function DiskCard({ card, nowMs, onOpen }: Props) {
  return (
    <Card card={card} onOpen={onOpen}>
      <Heroes heroes={card.heroes} />
      {card.spark && <Sparkline spark={card.spark} nowMs={nowMs} variant="disk" />}
      <Fields fields={card.fields} />
    </Card>
  );
}
