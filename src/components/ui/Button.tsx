import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonVisualProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVisualProps {}

function buttonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  className?: string,
  link = false,
) {
  const base = link ? "q-button-link" : "q-button";
  return [
    base,
    `${base}--${variant}`,
    `${base}--${size}`,
    fullWidth ? `${base}--full` : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    loading = false,
    disabled,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, size, fullWidth, className)}
    >
      {loading ? <span className="q-button__spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
});

export interface ButtonLinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    Omit<ButtonVisualProps, "loading"> {
  disabled?: boolean;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    disabled = false,
    className,
    children,
    href,
    onClick,
    tabIndex,
    ...props
  },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <a
      {...props}
      ref={ref}
      href={disabled ? undefined : href}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      onClick={handleClick}
      className={buttonClassName(variant, size, fullWidth, className, true)}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </a>
  );
});
