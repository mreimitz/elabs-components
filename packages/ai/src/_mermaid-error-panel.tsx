"use client";

/**
 * The `errorComponent` Streamdown renders in place of a Mermaid diagram that
 * failed (issue #33). Streamdown hands back the render failure as a plain
 * STRING (`MermaidErrorComponentProps.error`, already reduced from whatever
 * was thrown), so this distinguishes two different failures by matching that
 * string rather than the original error object:
 *
 * - **The optional `mermaid` peer is not installed.** This is a CAPABILITY
 *   GAP, not something wrong with the diagram or the app — the same class as
 *   `@elabs-ai/components-viewer`'s `parser-missing`
 *   (@.claude/rules/viewer-components.md "A capability gap is not a
 *   failure"). Renders the neutral `StatePanel kind="empty"`, naming the
 *   package to install, announced `role="status"`, with no retry action
 *   (re-installing a dependency does not happen by clicking a button in the
 *   page).
 * - **Anything else is a genuine render/syntax failure** — a real error, so
 *   it gets `StatePanel kind="error"` (`role="alert"`, set internally by
 *   `StatePanel`) wired to Streamdown's own `retry()`, which increments the
 *   render attempt and re-runs the diagram.
 */
import { Button, StatePanel, isModuleNotFoundMessage, useLocale } from "@elabs-ai/components-ui";
import { EyeOffIcon } from "lucide-react";

export interface MermaidErrorPanelProps {
  chart: string;
  error: string;
  retry: () => void;
}

export function MermaidErrorPanel({ error, retry }: MermaidErrorPanelProps) {
  const { t } = useLocale();

  if (isModuleNotFoundMessage(error)) {
    const feature = t("ai.mermaid.feature");
    return (
      <div className="my-4" role="status" aria-live="polite">
        <StatePanel
          kind="empty"
          // A dashed edge invites a drop; this panel accepts nothing. Solid —
          // mirrors `@elabs-ai/components-viewer`'s `FileViewerError`.
          className="border-solid"
          icon={<EyeOffIcon aria-hidden="true" />}
          title={t("ai.error.engineMissing", { feature })}
          description={t("ai.error.engineMissingBody", { feature, packages: "mermaid" })}
        />
      </div>
    );
  }

  return (
    <div className="my-4">
      <StatePanel
        kind="error"
        title={t("ai.mermaid.renderError")}
        description={error}
        actions={
          <Button size="sm" variant="outline" onClick={retry}>
            {t("ai.error.retry")}
          </Button>
        }
      />
    </div>
  );
}
