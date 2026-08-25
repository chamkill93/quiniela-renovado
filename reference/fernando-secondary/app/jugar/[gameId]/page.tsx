import { notFound } from "next/navigation";
import { BetBuilder } from "@/components/BetBuilder";
import { InstantGamePlay } from "@/components/InstantGamePlay";
import { findGame, draws, instants } from "@/lib/data";

export function generateStaticParams() {
  return [...draws, ...instants].map((g) => ({ gameId: g.id }));
}

export default async function JugarPage({ params }: PageProps<"/jugar/[gameId]">) {
  const { gameId } = await params;
  const found = findGame(gameId);
  if (!found) notFound();

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-3 pt-5 pb-10 sm:px-4 sm:pt-6 sm:pt-7 sm:pt-8">
      <div className="mt-1 sm:mt-2">
        {found.kind === "instant" ? (
          <InstantGamePlay game={found.game} />
        ) : (
          <BetBuilder
            title={found.game.name}
            subtitle={`Sorteo de las ${found.game.time}`}
          />
        )}
      </div>
    </main>
  );
}
