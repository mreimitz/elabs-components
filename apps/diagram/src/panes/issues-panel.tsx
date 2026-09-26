import { Fragment, useId } from "react";
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

/**
 * A message's straight-quoted segments are syntax or ids — `"vpc"`, `"a -> b"`, `"parent:"`,
 * and the ui definition validator's `"direction" must be one of "LR", "TB".` — so they are
 * set as inline code in the `text-code` role, without the quote marks (wave-2 review m5).
 * Monospace also drops the body font's contextual alternates, which drew `->` as an arrow
 * the parser rejects. Monaco's markers keep the plain text.
 */
const QUOTED = /"([^"\n]*)"/g;

/** Quotes left in prose become curly: opening after a start or a space, closing otherwise. */
function curly(prose: string): string {
  return prose
    .replace(/(^|[\s([{])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s([{])'/g, "$1‘")
    .replace(/'/g, "’");
}

interface MessagePart {
  code: boolean;
  text: string;
  /** Offset in the message: a stable key for the part. */
  at: number;
}

function messageParts(message: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const m of message.matchAll(QUOTED)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ code: false, text: curly(message.slice(last, at)), at: last });
    // An empty quoted value keeps its quotes: an empty code span would read as nothing.
    parts.push({ code: true, text: m[1] || m[0], at });
    last = at + m[0].length;
  }
  if (last < message.length)
    parts.push({ code: false, text: curly(message.slice(last)), at: last });
  return parts;
}

// P4: library gap — ui definition validator pre-quotes path and values into `message`
// (packages/ui/src/lib/definition/validate.ts:31-37) instead of returning them as fields;
// this parses them back out. See docs/findings/DG-09-definition-gaps.md.
/** One issue message, typeset: ids and syntax as code, curly quotes in prose. */
export function IssueMessage({ message }: { message: string }) {
  return (
    <>
      {messageParts(message).map((part) =>
        part.code ? (
          <code key={part.at} className="font-mono text-code">
            {part.text}
          </code>
        ) : (
          <Fragment key={part.at}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

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
        // grows to the longest message and defeats the line clamp; a max-height box instead.
        // See docs/findings/DG-12-editor-integration.md.
        <div className="max-h-40 overflow-y-auto">
          <ul className="flex flex-col py-1">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.path}-${index}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  // Wraps when narrow: the message needs 10rem, else it takes its own line
                  // (at 390 px the editor is ~155 px wide), and the location follows.
                  className="h-auto w-full min-w-0 flex-wrap items-baseline justify-start gap-x-2 gap-y-0.5 rounded-none px-3 py-1 text-start"
                  onClick={() => onReveal(issue)}
                >
                  <StatusBadge status={SEVERITY_STATUS[issue.severity]} size="sm" />
                  <span className="line-clamp-2 min-w-0 flex-1 basis-40 break-words whitespace-normal">
                    <IssueMessage message={issue.message} />
                  </span>
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
