import Image from "next/image";
import type { HTMLAttributes } from "react";

export interface LogoProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: "sm" | "md" | "lg";
  surface?: "auto" | "dark" | "light";
}

export function Logo({
  size = "md",
  surface = "auto",
  className = "",
  role = "img",
  "aria-label": ariaLabel = "quinie.LA",
  ...props
}: LogoProps) {
  return (
    <span
      {...props}
      className={`q-logo q-logo--${size} q-logo--surface-${surface} ${className}`.trim()}
      role={role}
      aria-label={ariaLabel}
    >
      <span className="q-logo__plate" aria-hidden="true">
        <Image
          className="q-logo__image q-logo__image--on-dark"
          src="/assets/brand/quinie-la-on-dark.svg"
          alt=""
          width={530}
          height={180}
          draggable={false}
          priority
        />
        <Image
          className="q-logo__image q-logo__image--on-light"
          src="/assets/brand/quinie-la-on-light.svg"
          alt=""
          width={530}
          height={180}
          draggable={false}
          priority
        />
      </span>
    </span>
  );
}
