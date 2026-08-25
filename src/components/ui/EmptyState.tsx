import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon = "empty",
  action,
  className = "",
  ...props
}: EmptyStateProps) {
  return (
    <div {...props} className={`q-empty ${className}`.trim()}>
      <div>
        <span className="q-empty__icon" aria-hidden="true">
          <Icon name={icon} size={28} />
        </span>
        <h3 className="q-empty__title">{title}</h3>
        {description ? <p className="q-empty__description">{description}</p> : null}
        {action ? <div className="q-empty__action">{action}</div> : null}
      </div>
    </div>
  );
}

export const Empty = EmptyState;
