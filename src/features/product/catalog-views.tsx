"use client";

import Link from "next/link";

import { useProduct } from "@/providers/product-provider";

import { CatalogGameCard } from "./catalog-game-card";
import {
  mapCatalogGames,
  mapPublishedResults,
  type CatalogFamily,
} from "./product-view-mappers";
import {
  RemoteEmptyState,
  RemoteErrorState,
  RemoteLoadingState,
  RemoteUnauthorizedState,
} from "./remote-view-state";
import { SectionHeader } from "./section-header";
import styles from "./product.module.css";

function unavailableCatalogState({
  loading,
  unauthorized,
  error,
  onRetry,
}: {
  loading: boolean;
  unauthorized: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) return <RemoteLoadingState label="Cargando catálogo del backoffice…" />;
  if (unauthorized) {
    return <RemoteUnauthorizedState message="Iniciá sesión para recibir el catálogo habilitado por el backoffice." />;
  }
  if (error) return <RemoteErrorState message={error} onRetry={onRetry} />;
  return <RemoteEmptyState message="El backoffice no publicó un catálogo disponible." />;
}

export function CatalogPageClient({
  family,
  eyebrow,
  title,
  description,
  limit,
}: {
  family: CatalogFamily;
  eyebrow: string;
  title: string;
  description: string;
  limit: number;
}) {
  const { catalog, loading, error, unauthorized, refresh } = useProduct();
  const games = catalog ? mapCatalogGames(catalog, family, limit) : [];
  const isInstant = family === "instant";

  return (
    <main className={styles.page}>
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      {!catalog ? unavailableCatalogState({ loading, unauthorized, error, onRetry: () => void refresh() }) : (
        <>
          {error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
          {games.length === 0 ? (
            <RemoteEmptyState message="No hay juegos habilitados por el backoffice en este momento." />
          ) : (
            <div
              className={styles.gameGrid}
              data-testid={isInstant ? "instant-games-grid" : undefined}
            >
              {games.map((game, index) => (
                <CatalogGameCard
                  eager={index < 3}
                  game={game}
                  key={game.id}
                  testId={isInstant ? "instant-game-card" : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function formatPublishedAt(value: string | null) {
  if (!value) return "Publicado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Publicado";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Asuncion",
  }).format(date);
}

export function HomeRemoteSections() {
  const { catalog, results, loading, error, unauthorized, refresh } = useProduct();

  if (!catalog) {
    return (
      <section aria-label="Contenido del backoffice">
        {unavailableCatalogState({ loading, unauthorized, error, onRetry: () => void refresh() })}
      </section>
    );
  }

  const draws = mapPublishedResults(catalog, results, "DRAW", 4);
  const instantGames = mapCatalogGames(catalog, "instant", 6);
  const megaloto = mapCatalogGames(catalog, "traditional").find(
    (game) => game.id === "megaloto",
  );

  return (
    <>
      {error ? <RemoteErrorState message={error} onRetry={() => void refresh()} /> : null}
      <section aria-label="Sorteos publicados">
        <SectionHeader
          description="Publicaciones recibidas directamente desde el servicio operativo."
          eyebrow="Resultados recientes"
          headingLevel={2}
          href="/resultados"
          linkLabel="Ver resultados"
          title="Sorteos publicados"
        />
        {draws.length === 0 ? (
          <RemoteEmptyState message="Todavía no hay sorteos publicados por el backoffice." />
        ) : (
          <div className={styles.drawGrid}>
            {draws.map((draw) => (
              <article className={styles.drawCard} data-tone={draw.tone} key={draw.id}>
                <span>{draw.label}</span>
                <strong>{draw.result}</strong>
                <div className={styles.drawMeta}>
                  <span>{formatPublishedAt(draw.occurredAt)}</span>
                  <span>Publicado</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Instantáneas habilitadas">
        <SectionHeader
          description="El catálogo, los nombres y las condiciones visibles provienen del backoffice."
          eyebrow="Resultado al momento"
          headingLevel={2}
          href="/instantaneas"
          linkLabel="Ver las 9"
          title="Instantáneas habilitadas"
        />
        {instantGames.length === 0 ? (
          <RemoteEmptyState message="No hay Instantáneas habilitadas en este momento." />
        ) : (
          <div className={styles.gameGrid}>
            {instantGames.map((game, index) => (
              <CatalogGameCard eager={index < 3} game={game} key={game.id} />
            ))}
          </div>
        )}
      </section>

      {megaloto ? (
        <section aria-labelledby="mega-title" className={styles.megaBanner}>
          <div>
            <p className={styles.eyebrow}>{megaloto.eyebrow}</p>
            <h2 id="mega-title">{megaloto.name}</h2>
            <p>{megaloto.description}</p>
            <Link className={styles.primaryButton} href={megaloto.href}>Elegir números</Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
