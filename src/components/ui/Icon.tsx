import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type IconName =
  | "home"
  | "rules"
  | "sound"
  | "theme"
  | "user"
  | "wallet"
  | "head"
  | "prize"
  | "invert"
  | "redoblona"
  | "mega"
  | "bolt"
  | "poa"
  | "pyae"
  | "petei"
  | "mokoi"
  | "mbohapy"
  | "poa5"
  | "poa10"
  | "racha5"
  | "ticket"
  | "settings"
  | "sun"
  | "moon"
  | "close"
  | "check"
  | "info"
  | "warning"
  | "error"
  | "bell"
  | "chevronRight"
  | "arrowLeft"
  | "plus"
  | "minus"
  | "empty";

const assetIcons: Partial<Record<IconName, string>> = {
  home: "/assets/icons/ui/home.svg",
  rules: "/assets/icons/ui/rules.svg",
  sound: "/assets/icons/ui/sound.svg",
  theme: "/assets/icons/ui/theme.svg",
  user: "/assets/icons/ui/user.svg",
  wallet: "/assets/icons/ui/wallet.svg",
  head: "/assets/icons/game/head.svg",
  prize: "/assets/icons/game/prize.svg",
  invert: "/assets/icons/game/invert.svg",
  redoblona: "/assets/icons/game/redoblona.svg",
  mega: "/assets/icons/game/mega.svg",
  bolt: "/assets/icons/game/bolt.svg",
  poa: "/assets/icons/game/poa.svg",
  pyae: "/assets/icons/game/pyae.svg",
  petei: "/assets/icons/game/petei.svg",
  mokoi: "/assets/icons/game/mokoi.svg",
  mbohapy: "/assets/icons/game/mbohapy.svg",
  poa5: "/assets/icons/game/poa5.svg",
  poa10: "/assets/icons/game/poa10.svg",
  racha5: "/assets/icons/game/racha5.svg",
};

const lineIcons: Partial<Record<IconName, ReactNode>> = {
  ticket: (
    <>
      <path d="M5 4.5h14v4a2.5 2.5 0 0 0 0 5v4H5v-4a2.5 2.5 0 0 0 0-5z" />
      <path d="M9 8v6M12 8v6M15 8v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3.1 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" />
    </>
  ),
  moon: <path d="M20 15.3A8 8 0 0 1 8.7 4a8.2 8.2 0 1 0 11.3 11.3Z" />,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v5M12 7.5h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4.2 2.8 17.5a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 16.5h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9Z" />
      <path d="M9.5 20a3 3 0 0 0 5 0" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  arrowLeft: <path d="m11 5-7 7 7 7M4 12h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  empty: (
    <>
      <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z" />
      <path d="m5 7.5 7 3.5 7-3.5M12 11v9" />
    </>
  ),
};

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  name: IconName;
  size?: number | string;
  title?: string;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 20,
  title,
  strokeWidth = 1.9,
  className = "",
  style,
  ...props
}: IconProps) {
  const asset = assetIcons[name];
  const iconStyle = {
    ...style,
    "--q-icon-size": typeof size === "number" ? `${size}px` : size,
  } as CSSProperties;

  if (asset) {
    const maskStyle = { "--q-icon-url": `url("${asset}")` } as CSSProperties;
    return (
      <span
        {...props}
        className={`q-icon ${className}`.trim()}
        style={iconStyle}
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      >
        <span className="q-icon__mask" style={maskStyle} />
      </span>
    );
  }

  return (
    <span
      {...props}
      className={`q-icon ${className}`.trim()}
      style={iconStyle}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {lineIcons[name]}
      </svg>
    </span>
  );
}
