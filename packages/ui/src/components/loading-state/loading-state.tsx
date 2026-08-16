/**
 * @deprecated Use `StatePanel kind="loading"` from `@elabs/components-ui` instead.
 * This wrapper is kept for back-compat and will be removed in a future release.
 */
import { type ReactNode } from "react";
import { StatePanel } from "../state-panel/state-panel";

export interface LoadingStateProps {
  /** Accessible status label. Defaults to "Loading…". */
  label?: ReactNode;
  /** Visual size of the spinner. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** @deprecated Use `<StatePanel kind="loading" />` instead. */
export function LoadingState({ label = "Loading…", size = "md", className }: LoadingStateProps) {
  return (
    <StatePanel
      kind="loading"
      loadingLabel={typeof label === "string" ? label : undefined}
      size={size}
      className={className}
    />
  );
}
