import { notFound } from "next/navigation";
import { TraditionalGameClient } from "@/features/product/traditional-game-client";
import { getTraditionalGame, TRADITIONAL_GAMES } from "@/lib/product/catalog";

export function generateStaticParams() {
  return TRADITIONAL_GAMES.map((game) => ({ gameId: game.id }));
}

export default async function TraditionalGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = getTraditionalGame(gameId);
  if (!game) notFound();
  return <TraditionalGameClient game={game} />;
}
