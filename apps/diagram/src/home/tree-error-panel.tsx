/**
 * DG-23 — the workspace tree failed to load. Home renders one of these for the whole page (Recent,
 * Folders and Components all read the same tree, so one banner replaces the three); the template
 * picker renders its own when it is the only thing open; the sidebar's own tree shows the same
 * failure the same way (`shell/workspace-tree.tsx`'s `TreeLoadError`).
 */
import { useState } from "react";
import { Button, StatePanel } from "@elabs-ai/components-ui";
import { workspaceActions } from "../workspace/workspace-store";

/** The Home and template-picker failure labels, in one place. */
const TREE_ERROR_LABELS = {
  title: "Could not load the workspace",
  hint: "The workspace could not be read from the dev server.",
  retry: "Retry",
  retrying: "Retrying…",
} as const;

export interface TreeErrorPanelProps {
  message: string;
  /** `h3` (default) inside the template picker dialog; `h2` when Home renders this at page
   *  level, so it sits directly under the page's own `h1` instead of skipping a level. */
  titleAs?: "h2" | "h3";
  /** Called once a retry's `refreshTree()` resolves — Home uses it to move focus onto the
   *  Recent heading instead of leaving it to drop to `<body>` when this panel unmounts. */
  onRecovered?: () => void;
}

export function TreeErrorPanel({ message, titleAs = "h3", onRecovered }: TreeErrorPanelProps) {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    workspaceActions
      .refreshTree()
      .then(
        () => onRecovered?.(),
        () => undefined,
      )
      .finally(() => setRetrying(false));
  };
  return (
    <StatePanel
      kind="error"
      titleAs={titleAs}
      title={TREE_ERROR_LABELS.title}
      description={
        <>
          {TREE_ERROR_LABELS.hint}
          {message ? <span className="mt-1 block text-meta">{message}</span> : null}
        </>
      }
      actions={
        // `aria-disabled`, not `disabled`: focus stays on the button while it retries.
        <Button size="sm" variant="outline" aria-disabled={retrying} onClick={retry}>
          {retrying ? TREE_ERROR_LABELS.retrying : TREE_ERROR_LABELS.retry}
        </Button>
      }
    />
  );
}
