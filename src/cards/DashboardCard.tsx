import { CpuCard } from "./CpuCard";
import { DiskCard } from "./DiskCard";
import type { CardModel } from "./fields";
import { GpuCard } from "./GpuCard";
import { MemoryCard } from "./MemoryCard";
import { MotherboardCard } from "./MotherboardCard";
import { PlaceholderCard } from "./PlaceholderCard";

interface Props {
  card: CardModel;
  nowMs: number;
  onOpen: (cardId: string) => void;
}

export function DashboardCard({ card, nowMs, onOpen }: Props) {
  if (card.variant !== "normal") return <PlaceholderCard card={card} />;
  switch (card.kind) {
    case "cpu":
      return <CpuCard card={card} nowMs={nowMs} onOpen={onOpen} />;
    case "memory":
      return <MemoryCard card={card} nowMs={nowMs} onOpen={onOpen} />;
    case "gpu":
      return <GpuCard card={card} nowMs={nowMs} onOpen={onOpen} />;
    case "disk":
      return <DiskCard card={card} nowMs={nowMs} onOpen={onOpen} />;
    case "motherboard":
      return <MotherboardCard card={card} onOpen={onOpen} />;
  }
}
