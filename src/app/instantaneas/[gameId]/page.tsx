import { notFound } from "next/navigation";
import { InstantGameClient } from "@/features/product/instant-game-client";
import { getInstantGame, INSTANT_GAMES } from "@/lib/product/catalog";

export function generateStaticParams() {
  return INSTANT_GAMES.map((game) => ({ gameId: game.id }));
}

export default async function InstantGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = getInstantGame(gameId);
  if (!game) notFound();
  return <InstantGameClient game={game} />;
}
