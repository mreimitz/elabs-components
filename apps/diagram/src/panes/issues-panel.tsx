import { useId } from "react";
import { CircleX, Info, TriangleAlert } from "lucide-react";
import { Button, StatusBadge, Text, type CustomStatus } from "@elabs-ai/components-ui";
import type { ArchIssueSeverity } from "../spec/dialect";
import type { DiagramIssue } from "../state/compile-text";

/** The panel's strings, in one place (`conventions/i18n-strings`). */
const ISSUES_LABELS = {
  heading: "Problems",
  none: "No problems.",
  line: (line: number, col: number) => `Line ${line}, column ${col}`,
} as const;

/**
 * Severity as label + glyph + tone, never colour alone (conventions → WCAG 1.4.1). A
 * `CustomStatus`: the seven canonical statuses are run states, not severities.
 */
export const SEVERITY_STATUS: Record<ArchIssueSeverity, CustomStatus> = {
  error: { label: "Error", tone: "destructive", icon: CircleX },
  warning: { label: "Warning", tone: "warning", icon: TriangleAlert },
  info: { label: "Info", tone: "info", icon: Info },
};

export interface IssuesPanelProps {
  issues: readonly DiagramIssue[];
  /** Move the editor's cursor to the issue and focus the editor. */
  onReveal: (issue: DiagramIssue) => void;
}

/**
 * DG-12 — every issue from every stage (DG-10's one list), in text order. Each row is a
 * button: activating it puts the editor's cursor on the issue.
 */
export function IssuesPanel({ issues, onReveal }: IssuesPanelProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-col border-t">
      <Text as="div" id={headingId} variant="caption" tone="muted" className="px-3 pt-1.5">
        {ISSUES_LABELS.heading}
      </Text>
      {issues.length === 0 ? (
        <Text as="p" variant="caption" tone="muted" className="px-3 pb-1.5">
          {ISSUES_LABELS.none}
        </Text>
      ) : (
        // P4: library gap — ui `ScrollArea` wraps content in Radix's `display: table` div, which
        // grows to the longest message and defeats `truncate`; a max-height box instead.
        // See docs/findings/DG-12-editor-integration.md.
        <div className="max-h-40 overflow-y-auto">
          <ul className="flex flex-col py-1">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.path}-${index}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full min-w-0 justify-start gap-2 rounded-none px-3 py-1 text-start"
                  onClick={() => onReveal(issue)}
                >
                  <StatusBadge status={SEVERITY_STATUS[issue.severity]} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{issue.message}</span>
                  {issue.range ? (
                    <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
                      {ISSUES_LABELS.line(issue.range.start.line, issue.range.start.col)}
                    </span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
