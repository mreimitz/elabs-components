"use client";

/**
 * The `:::iterate` / `:::pivot` directive bridge — turns a directive context
 * (attributes + the captured raw body template) into an `IterationSpec`, and
 * renders an `IterationBlock` with a recursion guard so a self-referential
 * template can't loop forever (the transclusion depth-cap precedent).
 */
import { createContext, useContext, type ReactNode } from "react";

import {
  IterationBlock,
  type EvaluateIteration,
  type InterpolateTemplate,
  type IterationLayout,
  type IterationSpec,
} from "./iteration";

/** Max nesting depth for `:::iterate` inside an iterated cell. */
export const MAX_ITERATION_DEPTH = 3;

/** Current iteration nesting depth; 0 = top-level document. */
const IterationDepthContext = createContext(0);

const DEFAULT_LAYOUT: Record<"iterate" | "pivot", IterationLayout> = {
  iterate: "stacked",
  pivot: "matrix",
};

const LAYOUTS = new Set<IterationLayout>(["stacked", "grid", "matrix", "bento"]);

/** Build an `IterationSpec` from a directive's name + attributes + raw body. */
export function specFromDirective(
  name: "iterate" | "pivot",
  attributes: Record<string, string>,
  rawBody: string | undefined,
): IterationSpec {
  const kind = name;
  const layoutAttr = attributes.layout as IterationLayout | undefined;
  const layout = layoutAttr && LAYOUTS.has(layoutAttr) ? layoutAttr : DEFAULT_LAYOUT[kind];
  const columns = attributes.columns ? Number(attributes.columns) || undefined : undefined;
  return {
    kind,
    layout,
    template: rawBody ?? "",
    as: attributes.as?.trim() || "item",
    source: attributes.source,
    rows: attributes.rows,
    cols: attributes.cols,
    columns,
    attributes,
  };
}

export interface IterationDirectiveProps {
  spec: IterationSpec;
  evaluate: EvaluateIteration;
  interpolate?: InterpolateTemplate;
  /** Render one cell's resolved markdown → node (a nested `MarkdownPreview`). */
  renderCell: (markdown: string) => ReactNode;
}

/**
 * Renders an `IterationBlock` one nesting level deeper, refusing to recurse past
 * {@link MAX_ITERATION_DEPTH}. Cells (which mount nested `MarkdownPreview`s) read
 * the incremented depth, so a nested `:::iterate` is bounded.
 */
export function IterationDirective({
  spec,
  evaluate,
  interpolate,
  renderCell,
}: IterationDirectiveProps) {
  const depth = useContext(IterationDepthContext);
  if (depth >= MAX_ITERATION_DEPTH) {
    return (
      <div className="my-4 text-meta text-muted-foreground italic" data-iteration-too-deep="">
        Iteration nested too deep — skipped.
      </div>
    );
  }
  return (
    <IterationDepthContext.Provider value={depth + 1}>
      <IterationBlock
        spec={spec}
        evaluate={evaluate}
        interpolate={interpolate}
        render={renderCell}
      />
    </IterationDepthContext.Provider>
  );
}
