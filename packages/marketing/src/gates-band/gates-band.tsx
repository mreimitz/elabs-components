import { type ReactNode } from "react";
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

export interface GatesBandProps {
  /** Every gate to render, already carrying its real `category` — grouping never re-categorises. */
  gates: readonly GatesBandGate[];
  /** The header count. Passed separately from `gates.length` (`counts.json.gates`) so the header
   * can never silently drift if a caller ever filters the list. */
  count: number;
  /** Category slug → display label (e.g. `{ stories: "Stories" }`); an unlisted category falls
   * back to its own slug, never invented. */
  categoryLabels?: Record<string, string>;
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
 * `gates.json`, grouped by its own `category` field. Fully server-safe — no hooks, no handlers, no
 * `"use client"` — `@elabs-ai/components-marketing` never gains a client boundary (maintainer
 * decision, RM-089-decisions.md).
 */
export function GatesBand({
  gates,
  count,
  categoryLabels = {},
  labels: labelsProp,
  footer,
  className,
}: GatesBandProps) {
  const labels = { ...DEFAULT_GATES_BAND_LABELS, ...labelsProp };
  const groups = groupByCategory(gates, categoryLabels);
  return (
    <div data-slot="gates-band" className={cn("flex flex-col gap-6", className)}>
      <h3 className="text-title text-foreground">
        {labels.heading} <span className="text-muted-foreground">({count})</span>
      </h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.category} data-slot="gates-band-group" className="flex flex-col gap-2">
            <h4 className="text-caption font-medium text-muted-foreground uppercase">
              {group.label}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {group.gates.map((gate) => (
                <li key={gate.id} data-slot="gates-band-item" className="text-body">
                  <code className="text-code text-foreground">{gate.id}</code>
                  <span className="text-muted-foreground"> — {gate.doc}</span>
                </li>
              ))}
            </ul>
          </div>
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
