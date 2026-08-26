"use client";

import { useId } from "react";

const ICON_KEY_ALIASES: Readonly<Record<string, string>> = {
  prize: "prizes",
  mega: "megaloto",
  bolt: "pyae",
  one: "petei",
  two: "mokoi",
  three: "mbohapy",
};

export function GameIcon({ gameId, className }: { gameId: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const disc = `${id}-disc`;
  const metal = `${id}-metal`;
  const red = `${id}-red`;
  const glow = `${id}-glow`;
  const glyphId = ICON_KEY_ALIASES[gameId] ?? gameId;

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={disc} cx="36%" cy="28%" r="78%">
          <stop offset="0" stopColor="#34363b" />
          <stop offset="0.48" stopColor="#111318" />
          <stop offset="1" stopColor="#030405" />
        </radialGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c7c9cc" />
          <stop offset="1" stopColor="#696d74" />
        </linearGradient>
        <linearGradient id={red} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4a50" />
          <stop offset="0.5" stopColor="#e30613" />
          <stop offset="1" stopColor="#7c0008" />
        </linearGradient>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <circle cx="48" cy="48" r="45" fill={`url(#${disc})`} stroke="#3b3e44" strokeWidth="1.5" />
      <circle cx="48" cy="48" r="39.5" fill="none" stroke="rgba(255,255,255,.12)" />
      <path d="M13 52a36 36 0 0 1 7-23" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeWidth="5" />
      <path d="M74 19a36 36 0 0 1 9 16" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeWidth="5" />
      <path d="M77 75a36 36 0 0 1-16 8" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeWidth="5" />
      <ellipse cx="38" cy="18" rx="19" ry="4" fill="rgba(255,255,255,.08)" transform="rotate(-18 38 18)" />

      <g filter={`url(#${glow})`}>
        <GameGlyph gameId={glyphId} metal={metal} red={red} />
      </g>
    </svg>
  );
}

function GameGlyph({ gameId, metal, red }: { gameId: string; metal: string; red: string }) {
  if (gameId === "head") {
    return (
      <>
        <path d="M28 69c4-5 6-9 6-14 0-3-4-5-4-11 0-13 9-22 22-22 11 0 19 6 22 16l-8 4v10c0 6-4 10-10 10h-6v9" fill="none" stroke={`url(#${metal})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        <text x="49" y="52" fill={`url(#${red})`} fontFamily="Arial, sans-serif" fontSize="31" fontWeight="900" textAnchor="middle">?</text>
      </>
    );
  }

  if (gameId === "prizes") {
    return (
      <>
        <NumberBall number="3" cx={45} cy={51} r={22} metal={metal} />
        <path d="M58 26l3 6 7-1-5 5 3 6-7-3-5 5 1-8-6-3 7-1z" fill={`url(#${red})`} />
        <circle cx="69" cy="48" r="3" fill="#ff4a50" />
      </>
    );
  }

  if (gameId === "invert") {
    return (
      <>
        <NumberBall number="3" cx={47} cy={49} r={19} metal={metal} />
        <path d="M24 45a25 25 0 0 1 36-19l3-7 8 15-17 2 5-6" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        <path d="M71 53a25 25 0 0 1-37 18l-2 7-9-15 17-1-5 6" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
      </>
    );
  }

  if (gameId === "redoblona") {
    return (
      <>
        <NumberBall number="3" cx={38} cy={43} r={17} metal={metal} />
        <NumberBall number="3" cx={58} cy={58} r={17} metal={metal} />
        <path d="M25 65L69 26M60 25h10v10M26 56v10h10" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </>
    );
  }

  if (gameId === "megaloto") {
    return (
      <>
        <path d="M26 38l10 7 12-18 12 18 11-7-5 27H31z" fill={`url(#${red})`} stroke="#ff8589" strokeLinejoin="round" strokeWidth="1.5" />
        <circle cx="48" cy="27" r="4" fill={`url(#${metal})`} />
        <circle cx="26" cy="37" r="4" fill={`url(#${metal})`} />
        <circle cx="71" cy="37" r="4" fill={`url(#${metal})`} />
        <circle cx="39" cy="57" r="6" fill={`url(#${metal})`} />
        <circle cx="56" cy="57" r="6" fill={`url(#${metal})`} />
        <text x="39" y="60" fill="#14161a" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="900" textAnchor="middle">8</text>
        <text x="56" y="60" fill="#14161a" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="900" textAnchor="middle">21</text>
      </>
    );
  }

  if (gameId === "pyae") {
    return <path d="M50 19L27 53h17l-4 25 29-40H52z" fill={`url(#${metal})`} stroke={`url(#${red})`} strokeLinejoin="round" strokeWidth="3" />;
  }

  if (gameId === "poa5" || gameId === "poa10") {
    const label = gameId === "poa5" ? "5" : "10";
    return (
      <>
        <circle cx="35" cy="50" r="14" fill={`url(#${metal})`} stroke="#83878e" strokeWidth="2" />
        <circle cx="52" cy="43" r="14" fill={`url(#${metal})`} stroke="#83878e" strokeWidth="2" />
        <circle cx="58" cy="61" r="14" fill={`url(#${metal})`} stroke="#83878e" strokeWidth="2" />
        <rect x="24" y="28" width="31" height="22" rx="8" fill={`url(#${red})`} transform="rotate(-8 24 28)" />
        <text x="39" y="44" fill="#fff" fontFamily="Arial, sans-serif" fontSize={label === "10" ? 15 : 18} fontWeight="900" textAnchor="middle">{label}</text>
        <circle cx="35" cy="50" r="4" fill="#111318" />
        <circle cx="52" cy="43" r="4" fill="#111318" />
        <circle cx="58" cy="61" r="4" fill="#111318" />
      </>
    );
  }

  if (gameId === "racha5") {
    return (
      <>
        <path d="M24 58a27 27 0 0 1 47-17l3-8 6 17-18-1 7-5" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        {[29, 39, 49, 59, 69].map((x, index) => (
          <circle cx={x} cy={57 + Math.abs(49 - x) * 0.12} fill={index % 2 ? `url(#${red})` : `url(#${metal})`} key={x} r="7" />
        ))}
        <text x="49" y="82" fill="#fff" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="900" textAnchor="middle">5</text>
      </>
    );
  }

  if (gameId === "mokoi") {
    return (
      <>
        <NumberBall number="1" cx={39} cy={45} r={18} metal={metal} />
        <NumberBall number="2" cx={57} cy={59} r={18} metal={metal} />
        <path d="M24 66a30 30 0 0 0 49-8l5 6 1-17-16 6 7 2" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </>
    );
  }

  if (gameId === "mbohapy") {
    return (
      <>
        <NumberBall number="1" cx={35} cy={43} r={15} metal={metal} />
        <NumberBall number="2" cx={58} cy={43} r={15} metal={metal} />
        <NumberBall number="3" cx={47} cy={62} r={15} metal={metal} />
        <path d="M22 65a32 32 0 0 0 51 4" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeWidth="4" />
      </>
    );
  }

  if (gameId === "petei") {
    return (
      <>
        <path d="M27 35l22-12 21 14-3 28-25 9-18-18z" fill={`url(#${metal})`} stroke="#7e8289" strokeLinejoin="round" strokeWidth="2" />
        <text x="47" y="58" fill="#111318" fontFamily="Arial, sans-serif" fontSize="29" fontWeight="950" textAnchor="middle">1</text>
        <path d="M24 31l-8 8 9 2M69 24l8 5-8 5" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </>
    );
  }

  const number = gameId === "poa" ? "2" : "3";
  return (
    <>
      <NumberBall number={number} cx={47} cy={49} r={21} metal={metal} />
      <path d="M22 59a29 29 0 0 0 48 9l5 6 2-17-17 5 7 3" fill="none" stroke={`url(#${red})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
      <path d="M25 29l5 2 2 5 2-5 5-2-5-2-2-5-2 5z" fill={`url(#${red})`} />
    </>
  );
}

function NumberBall({ number, cx, cy, r, metal }: { number: string; cx: number; cy: number; r: number; metal: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} fill={`url(#${metal})`} r={r} stroke="#858990" strokeWidth="2" />
      <ellipse cx={cx - r * 0.25} cy={cy - r * 0.35} fill="rgba(255,255,255,.68)" rx={r * 0.42} ry={r * 0.2} transform={`rotate(-24 ${cx} ${cy})`} />
      <text dominantBaseline="central" fill="#15171b" fontFamily="Arial, sans-serif" fontSize={r * 1.16} fontWeight="950" textAnchor="middle" x={cx} y={cy + 1}>{number}</text>
    </g>
  );
}
