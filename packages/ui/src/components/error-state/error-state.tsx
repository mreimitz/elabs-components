/**
 * @deprecated Use `StatePanel kind="error"` from `@qlik-coe-emea/qlabs-components-ui` instead.
 * This wrapper is kept for back-compat and will be removed in a future release.
 */
import { type ReactNode } from "react";
import { StatePanel } from "../state-panel/state-panel";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Optional retry / support actions. */
  actions?: ReactNode;
  className?: string;
}

/** @deprecated Use `<StatePanel kind="error" />` instead. */
export function ErrorState({ title, description, actions, className }: ErrorStateProps) {
  return (
    <StatePanel
      kind="error"
      title={title}
      description={description}
      actions={actions}
      className={className}
    />
  );
}
