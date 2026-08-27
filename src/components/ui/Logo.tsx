import { useId, type HTMLAttributes } from "react";

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
  const id = useId().replace(/:/g, "");
  const letters = `logo-letters-${id}`;
  const ring = `logo-ring-${id}`;
  const artwork = "/assets/brand/quinie-la-original-hd.png";

  return (
    <span
      {...props}
      className={`q-logo q-logo--${size} q-logo--surface-${surface} ${className}`.trim()}
      role={role}
      aria-label={ariaLabel}
    >
      <span className="q-logo__plate" aria-hidden="true">
        <svg className="q-logo__image" viewBox="0 0 1919 820" fill="none" focusable="false" aria-hidden="true">
          <defs>
            {/* Both themes reuse one HD silhouette, so switching colors cannot move
                the lettering. Channel masks remove the white source background,
                including letter counters, without recoloring the red brand ring. */}
            <filter id={`${letters}-filter`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="-1.1111 0 0 0 1.0556  -1.1111 0 0 0 1.0556  -1.1111 0 0 0 1.0556  0 0 0 1 0" />
            </filter>
            <filter id={`${ring}-filter`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="1.1111 -1.1111 0 0 -0.0556  1.1111 -1.1111 0 0 -0.0556  1.1111 -1.1111 0 0 -0.0556  0 0 0 1 0" />
            </filter>
            <mask id={letters} maskUnits="userSpaceOnUse" x="0" y="0" width="1919" height="820" style={{ maskType: "luminance" }}>
              <image href={artwork} width="1919" height="820" filter={`url(#${letters}-filter)`} />
            </mask>
            <mask id={ring} maskUnits="userSpaceOnUse" x="0" y="0" width="1919" height="820" style={{ maskType: "luminance" }}>
              <image href={artwork} width="1919" height="820" filter={`url(#${ring}-filter)`} />
            </mask>
          </defs>
          <rect className="q-logo__letters" width="1919" height="820" mask={`url(#${letters})`} />
          <rect className="q-logo__ring" width="1919" height="820" fill="#e6243c" mask={`url(#${ring})`} />
        </svg>
      </span>
    </span>
  );
}
