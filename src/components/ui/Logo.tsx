import Image from "next/image";
import type { HTMLAttributes } from "react";

export interface LogoProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: "sm" | "md" | "lg";
}

export function Logo({ size = "md", className = "", ...props }: LogoProps) {
  return (
    <span {...props} className={`q-logo q-logo--${size} ${className}`.trim()}>
      <span className="q-logo__plate">
        <Image
          className="q-logo__image"
          src="/assets/brand/logo_quiniela_original.png"
          alt="quinie.LA"
          width={185}
          height={89}
          draggable={false}
          priority
        />
      </span>
    </span>
  );
}
