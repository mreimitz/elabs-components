/**
 * `markdown-iteration` — the `:::iterate` / `:::pivot` repeater for
 * `MarkdownPreview`. Enabled by the `evaluateIteration` prop (the calc/citation
 * precedent — *the library renders, the app computes*); the standalone
 * `IterationBlock` + the public contract types are exported for direct use.
 */
export {
  IterationBlock,
  defaultInterpolate,
  type EvaluateIteration,
  type InterpolateTemplate,
  type IterationBlockProps,
  type IterationCell,
  type IterationData,
  type IterationLayout,
  type IterationSpec,
} from "./iteration";

export {
  IterationDirective,
  specFromDirective,
  MAX_ITERATION_DEPTH,
  type IterationDirectiveProps,
} from "./directive";
