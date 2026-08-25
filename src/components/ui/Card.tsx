import type { HTMLAttributes } from "react";

export type CardVariant = "default" | "flat" | "elevated" | "accent";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "section" | "div";
  variant?: CardVariant;
  interactive?: boolean;
}

export function Card({
  as: Component = "div",
  variant = "default",
  interactive = false,
  className = "",
  ...props
}: CardProps) {
  const classes = [
    "q-card",
    variant !== "default" ? `q-card--${variant}` : "",
    interactive ? "q-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Component {...props} className={classes} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`q-card__header ${className}`.trim()} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={`q-card__title ${className}`.trim()} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={`q-card__description ${className}`.trim()} />;
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`q-card__content ${className}`.trim()} />;
}

export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`q-card__footer ${className}`.trim()} />;
}
