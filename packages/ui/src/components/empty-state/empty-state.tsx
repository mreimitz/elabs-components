/**
 * @deprecated Use `StatePanel kind="empty"` from `@qlik-coe-emea/qlabs-components-ui` instead.
 * This wrapper is kept for back-compat and will be removed in a future release.
 */
import { type ReactNode } from "react";
import { StatePanel } from "../state-panel/state-panel";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Optional icon/illustration shown above the title. */
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
