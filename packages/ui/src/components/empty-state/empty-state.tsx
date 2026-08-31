/**
 * @deprecated Use `StatePanel kind="empty"` from `@elabs-ai/components-ui` instead.
 * This wrapper is kept for back-compat and will be removed in a future release.
 */
import { type ReactNode } from "react";
import { StatePanel } from "../state-panel/state-panel";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /**
   * Optional icon shown above the title, clamped to a fixed 40×40 (this
   * wrapper only ever forwards `icon` to `StatePanel`, never `illustration`
   * — for a larger, unclamped illustration use
   * `StatePanel kind="empty" illustration={...}` directly).
   */
  icon?: ReactNode;
  /** Primary/secondary actions. */
  actions?: ReactNode;
  className?: string;
}

/** @deprecated Use `<StatePanel kind="empty" />` instead. */
export function EmptyState({ title, description, icon, actions, className }: EmptyStateProps) {
  return (
    <StatePanel
      kind="empty"
      title={title}
      description={description}
      icon={icon}
      actions={actions}
      className={className}
    />
  );
}
