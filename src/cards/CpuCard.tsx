import { Sparkline } from "../charts/Sparkline";
import { Card, Fields, Hero } from "./CardParts";
import type { CardModel } from "./fields";

interface Props {
  card: CardModel;
  nowMs: number;
  onOpen: (cardId: string) => void;
}

export function CpuCard({ card, nowMs, onOpen }: Props) {
  return (
    <Card card={card} onOpen={onOpen}>
      {card.hero && <Hero hero={card.hero} />}
      {card.spark && <Sparkline spark={card.spark} nowMs={nowMs} />}
      <Fields fields={card.fields} />
    </Card>
  );
}
