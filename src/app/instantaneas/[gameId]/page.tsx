import { notFound, redirect } from "next/navigation";
import { InstantGameClient } from "@/features/product/instant-game-client";
import { SAPYAITE_PATH } from "@/features/product/product-links";
import { getInstantGame, INSTANT_GAMES } from "@/lib/product/catalog";

export function generateStaticParams() {
  return INSTANT_GAMES.map((game) => ({ gameId: game.id }));
}

export default async function InstantGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  if (gameId === "sapyaite") redirect(SAPYAITE_PATH);
  const game = getInstantGame(gameId);
  if (!game) notFound();
  return <InstantGameClient game={game} />;
}
