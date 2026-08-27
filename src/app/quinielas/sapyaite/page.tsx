import { notFound } from "next/navigation";
import { InstantGameClient } from "@/features/product/instant-game-client";
import { getInstantGame } from "@/lib/product/catalog";

export default function SapyaitePage() {
  const game = getInstantGame("sapyaite");
  if (!game) notFound();
  return <InstantGameClient game={game} />;
}
