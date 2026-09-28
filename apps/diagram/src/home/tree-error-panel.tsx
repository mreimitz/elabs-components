/**
 * DG-23 review (F4) — the workspace tree failed to load. Recent, Folders and Components all read
 * from the same tree, so each shows this instead of spinning forever; the sidebar's own tree
 * shows the same failure the same way (`shell/workspace-tree.tsx`'s `TreeLoadError`).
 */
import { useState } from "react";
import { Button, StatePanel } from "@elabs-ai/components-ui";
import { workspaceActions } from "../workspace/workspace-store";

/** In one place (`conventions/i18n-strings`); matches the sidebar tree's own wording. */
const TREE_ERROR_LABELS = {
  title: "Could not load the workspace",
  hint: "The dev server did not answer.",
  retry: "Retry",
  retrying: "Retrying…",
} as const;

export interface TreeErrorPanelProps {
  message: string;
}

export function TreeErrorPanel({ message }: TreeErrorPanelProps) {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    workspaceActions.refreshTree().finally(() => setRetrying(false));
  };
  return (
    <StatePanel
      kind="error"
      titleAs="h3"
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
