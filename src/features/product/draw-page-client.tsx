"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useProduct } from "@/providers/product-provider";

import {
  getDrawPageCountdown,
  selectDrawPageResults,
  selectDrawPageSchedule,
  type DrawPageDefinition,
} from "./draw-page-data";
import styles from "./draw-page.module.css";

interface DrawPageClientProps {
  definition: DrawPageDefinition;
  streamUrl: string | null;
}

type DrawIconStyle = CSSProperties & {
  "--draw-page-icon-dark": string;
  "--draw-page-icon-light": string;
};

function useCurrentTime() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="m11 5-7 7 7 7M4 12h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect
        fill="none"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
        width="18"
        x="3"
        y="5"
      />
      <path
        d="M7 3v4m10-4v4M3 10h18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StreamPlaceholder({ drawName }: { drawName: string }) {
  return (
    <div className={styles.streamPlaceholder} data-testid="draw-stream-placeholder">
      <span aria-hidden="true" className={styles.streamMachine}>
        <span className={styles.streamMachineScreen}>
          <i />
          <i />
          <i />
        </span>
      </span>
      <strong>Transmisión disponible al inicio del sorteo</strong>
      <span>
        La señal de {drawName} aparecerá aquí únicamente cuando el operador
        publique una fuente autorizada.
      </span>
    </div>
  );
}

function DataStatus({
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
  if (loading) {
    return (
      <div className={styles.dataStatus} role="status">
        <span aria-hidden="true" className={styles.loadingLine} />
        Consultando la programación del backoffice…
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className={styles.dataStatus} role="status">
        <span>Iniciá sesión para consultar la programación disponible.</span>
        <Link className={styles.statusLink} href="/cuenta">
          Ir a mi cuenta
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dataError} role="alert">
        <span>{error}</span>
        <button onClick={onRetry} type="button">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dataStatus} role="status">
      Este sorteo no está publicado por el backoffice en este momento.
    </div>
  );
}

export function DrawPageClient({
  definition,
  streamUrl,
}: DrawPageClientProps) {
  const {
    catalog,
    results,
    loading,
    error,
    unauthorized,
    refresh,
  } = useProduct();
  const now = useCurrentTime();
  const schedule = useMemo(
    () =>
      catalog
        ? selectDrawPageSchedule(catalog.draws, definition)
        : null,
    [catalog, definition],
  );
  const history = useMemo(
    () => selectDrawPageResults(results, definition.drawId),
    [definition.drawId, results],
  );
  const latestResult = history[0] ?? null;
  const countdown =
    schedule && now !== null
      ? getDrawPageCountdown(schedule.drawsAt, now)
      : null;
  const iconStyle: DrawIconStyle = {
    "--draw-page-icon-dark": `url("/assets/quinie-home-v3/draws/dark/${definition.iconSlug}.webp")`,
    "--draw-page-icon-light": `url("/assets/quinie-home-v3/draws/light/${definition.iconSlug}.webp")`,
  };

  return (
    <main className={styles.page} data-draw-id={definition.drawId} data-testid="draw-page">
      <Link className={styles.backLink} href="/">
        <BackIcon />
        Volver al inicio
      </Link>

      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <span
            aria-label={`Sorteo ${definition.name}`}
            className={styles.drawIcon}
            data-draw-icon={definition.drawId}
            data-draw-icon-slug={definition.iconSlug}
            role="img"
            style={iconStyle}
          />
          <div>
            <p className={styles.eyebrow}>Quiniela online · Paraguay</p>
            <h1>{definition.name}</h1>
            <p className={styles.headerDescription}>
              Programación y resultados publicados por el servicio operativo.
            </p>
          </div>
        </div>

        <div className={styles.scheduleSummary} aria-label="Programación del sorteo">
          <span className={styles.scheduleIcon}>
            <CalendarIcon />
          </span>
          {schedule ? (
            <>
              <span>
                <small>Fecha</small>
                <strong>{schedule.dateLabel}</strong>
              </span>
              <span>
                <small>Horario</small>
                <strong>{schedule.timeLabel}</strong>
              </span>
            </>
          ) : (
            <span>
              <small>Programación</small>
              <strong>No disponible</strong>
            </span>
          )}
        </div>
      </header>

      {error && catalog ? (
        <div className={styles.dataError} role="alert">
          <span>{error}</span>
          <button onClick={() => void refresh()} type="button">
            Reintentar
          </button>
        </div>
      ) : null}

      {!schedule ? (
        <DataStatus
          error={error}
          loading={loading}
          onRetry={() => void refresh()}
          unauthorized={unauthorized}
        />
      ) : null}

      <div className={styles.primaryGrid}>
        <section aria-labelledby="draw-stream-title" className={styles.streamCard}>
          <div className={styles.cardHeading}>
            <div>
              <p>Señal oficial</p>
              <h2 id="draw-stream-title">Zona de transmisión</h2>
            </div>
            <span
              className={styles.secureSource}
              data-ready={streamUrl ? "true" : "false"}
            >
              {streamUrl ? "Fuente autorizada" : "Sin señal configurada"}
            </span>
          </div>

          {streamUrl ? (
            <div className={styles.streamFrame} data-testid="draw-stream-frame">
              <iframe
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                src={streamUrl}
                title={`Transmisión autorizada del sorteo ${definition.name}`}
              />
            </div>
          ) : (
            <StreamPlaceholder drawName={definition.name} />
          )}
        </section>

        <aside aria-label="Datos del sorteo" className={styles.sideColumn}>
          <section className={styles.detailCard}>
            <p className={styles.cardEyebrow}>Próximo sorteo</p>
            <h2>Cuenta regresiva</h2>
            {countdown?.state === "upcoming" ? (
              <div
                aria-label={`Faltan ${countdown.hours} horas, ${countdown.minutes} minutos y ${countdown.seconds} segundos`}
                className={styles.countdown}
                role="timer"
              >
                {[
                  [countdown.hours, "Horas"],
                  [countdown.minutes, "Min"],
                  [countdown.seconds, "Seg"],
                ].map(([value, label]) => (
                  <span key={label}>
                    <strong>{value}</strong>
                    <small>{label}</small>
                  </span>
                ))}
              </div>
            ) : countdown?.state === "elapsed" ? (
              <p className={styles.honestState} role="status">
                Horario alcanzado · aguardando publicación oficial.
              </p>
            ) : (
              <p className={styles.honestState} role="status">
                {schedule
                  ? "Calculando cuenta regresiva…"
                  : "Horario todavía no disponible."}
              </p>
            )}
            {schedule?.closingTimeLabel ? (
              <p className={styles.closingTime}>
                Cierre de venta: <strong>{schedule.closingTimeLabel}</strong>
              </p>
            ) : null}
          </section>

          <section className={styles.detailCard}>
            <p className={styles.cardEyebrow}>Publicación oficial</p>
            <h2>Último resultado</h2>
            {latestResult ? (
              <div className={styles.latestResult} data-result-value={latestResult.value}>
                <strong>{latestResult.value}</strong>
                <span>{latestResult.occurredLabel}</span>
                {latestResult.label ? <small>{latestResult.label}</small> : null}
              </div>
            ) : (
              <div className={styles.resultUnavailable} role="status">
                <strong>---</strong>
                <span>
                  Todavía no existe un resultado publicado para este sorteo.
                </span>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section aria-labelledby="draw-history-title" className={styles.historySection}>
        <div className={styles.historyHeading}>
          <div>
            <p className={styles.cardEyebrow}>Resultados verificados</p>
            <h2 id="draw-history-title">Historial reciente</h2>
          </div>
          <Link href="/resultados">
            Ver todos los resultados <span aria-hidden="true">→</span>
          </Link>
        </div>

        {history.length > 0 ? (
          <div className={styles.historyGrid}>
            {history.map((result) => (
              <article className={styles.historyItem} key={result.id}>
                <span>{result.label ?? "Resultado oficial"}</span>
                <strong>{result.value}</strong>
                <time dateTime={result.occurredAt}>{result.occurredLabel}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyHistory} role="status">
            No hay resultados históricos publicados para {definition.name}.
          </div>
        )}
      </section>

      <aside className={styles.responsible}>
        <span aria-label="Solo mayores de 18 años" className={styles.ageMark}>
          18+
        </span>
        <div>
          <strong>Juego responsable</strong>
          <p>Jugá solo si sos mayor de edad y establecé tus propios límites.</p>
        </div>
        <Link href="/legal/juego-responsable">Más información</Link>
      </aside>
    </main>
  );
}
