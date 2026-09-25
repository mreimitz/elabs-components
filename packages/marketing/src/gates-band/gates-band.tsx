import { Fragment, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/** One rule/command, exactly the shape `gates.json` (RM-090) already carries — never re-typed. */
export interface GatesBandGate {
  id: string;
  doc: string;
  category: string;
}

export interface GatesBandLabels {
  /** The band's heading, before the count. */
  heading: string;
}

export const DEFAULT_GATES_BAND_LABELS: GatesBandLabels = {
  heading: "Gates, not guidelines",
};

/** A group's rule count as it reads next to its category label, e.g. "34 rules". Overridable so
 * a host can localize the plural. */
export function defaultFormatGroupSummary(count: number): string {
  return `${count} rule${count === 1 ? "" : "s"}`;
}

/** Splits a gate's doc on its markdown backtick pairs and renders every paired run as real
 * `<code>` — a pure string split, never an HTML sink. An odd backtick count leaves the last one
 * unpaired: it (and the text after it) folds back into the trailing prose as a literal backtick,
 * so one stray backtick never flips the rest of the doc into code. */
function renderGateDoc(doc: string): ReactNode {
  const segments = doc.split("`");
  if (segments.length % 2 === 0) {
    const tail = segments.pop() ?? "";
    segments[segments.length - 1] += `\`${tail}`;
  }
  return segments.map((segment, index) => {
    // The segments are a fixed split of one immutable string, never reordered, so the position
    // alone is already unique and stable; the text rides along only so the key reads as content,
    // not a bare `.map` index (`no-index-key-reorderable`).
    const key = `${index}-${segment}`;
    return index % 2 === 1 ? (
      <code key={key} className="font-mono text-code text-foreground">
        {segment}
      </code>
    ) : (
      <Fragment key={key}>{segment}</Fragment>
    );
  });
}

export interface GatesBandProps {
  /** Every gate to render, already carrying its real `category` — grouping never re-categorises. */
  gates: readonly GatesBandGate[];
  /** The header count. Passed separately from `gates.length` (`counts.json.gates`) so the header
   * can never silently drift if a caller ever filters the list. */
  count: number;
  /** Category slug → display label (e.g. `{ stories: "Stories" }`); an unlisted category falls
   * back to its own slug, never invented. */
  categoryLabels?: Record<string, string>;
  /** Formats a group's visible rule count next to its category label. Defaults to
   * `defaultFormatGroupSummary` ("34 rules"). */
  formatGroupSummary?: (count: number) => string;
  labels?: Partial<GatesBandLabels>;
  /** A footnote the host renders under the grid (e.g. a link to `docs/GATES.md` on GitHub) — this
   * component embeds no URL of its own. */
  footer?: ReactNode;
  className?: string;
}

interface GatesBandGroup {
  category: string;
  label: string;
  gates: GatesBandGate[];
}

/** Groups in first-seen order (`gates.json` is already sorted by id) — never alphabetised by
 * category, which would silently reorder the grid every time a new category's first rule changes. */
function groupByCategory(
  gates: readonly GatesBandGate[],
  categoryLabels: Record<string, string>,
): GatesBandGroup[] {
  const order: string[] = [];
  const byCategory = new Map<string, GatesBandGate[]>();
  for (const gate of gates) {
    let bucket = byCategory.get(gate.category);
    if (!bucket) {
      bucket = [];
      byCategory.set(gate.category, bucket);
      order.push(gate.category);
    }
    bucket.push(gate);
  }
  return order.map((category) => ({
    category,
    label: categoryLabels[category] ?? category,
    gates: byCategory.get(category) ?? [],
  }));
}

/**
 * A generated rule catalogue in place of testimonials (concept §4.5): every check-rule/command in
 * `gates.json`, grouped by its own `category` field, each group behind a native `<details>`
 * disclosure closed by default (#587) — a category and its count are always visible; the rules
 * themselves are one click/Enter/Space away, never dumped inline. `<details>`/`<summary>` need no
 * JavaScript to open or close, so the catalogue stays reachable with JS off, and the component
 * stays fully server-safe — no hooks, no handlers, no `"use client"` — `@elabs-ai/components-
 * marketing` never gains a client boundary (maintainer decision, RM-089-decisions.md).
 */
export function GatesBand({
  gates,
  count,
  categoryLabels = {},
  formatGroupSummary = defaultFormatGroupSummary,
  labels: labelsProp,
  footer,
  className,
}: GatesBandProps) {
  const labels = { ...DEFAULT_GATES_BAND_LABELS, ...labelsProp };
  const groups = groupByCategory(gates, categoryLabels);
  return (
    <div data-slot="gates-band" className={cn("flex flex-col gap-6", className)}>
      <h3 className="text-subtitle text-foreground">
        {labels.heading} <span className="text-muted-foreground">({count})</span>
      </h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <details key={group.category} data-slot="gates-band-group" className="group/gate">
            {/* `flex` drops the native ::marker (and `list-none` + the WebKit pseudo keep Safari
                from drawing its own), so the cue is the CSS-drawn chevron below: it points to
                the inline end while closed and turns down once open — pure CSS on `[open]`, no
                hooks, works with JS off. Label + chevron inherit the summary's colour, which
                lifts to `foreground` on hover and while open. */}
            <summary
              data-slot="gates-band-summary"
              className="flex list-none items-center justify-between gap-2 rounded-sm py-1 text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground focus-ring group-open/gate:text-foreground motion-reduce:transition-none [&::-webkit-details-marker]:hidden"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  data-slot="gates-band-chevron"
                  className="size-1.5 shrink-0 -rotate-45 border-e-2 border-b-2 border-current transition-transform duration-fast ease-standard group-open/gate:rotate-45 motion-reduce:transition-none rtl:rotate-45 rtl:group-open/gate:-rotate-45"
                />
                <span data-slot="gates-band-label" className="text-eyebrow uppercase">
                  {group.label}
                </span>
              </span>
              <span className="text-caption text-muted-foreground tabular-nums">
                {formatGroupSummary(group.gates.length)}
              </span>
            </summary>
            <ul data-slot="gates-band-list" className="mt-2 flex flex-col gap-1.5 ps-4">
              {group.gates.map((gate) => (
                <li key={gate.id} data-slot="gates-band-item" className="text-body">
                  <code className="font-mono text-code text-foreground">{gate.id}</code>
                  <span className="text-muted-foreground"> — {renderGateDoc(gate.doc)}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      {footer ? (
        <div data-slot="gates-band-footer" className="text-caption text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
