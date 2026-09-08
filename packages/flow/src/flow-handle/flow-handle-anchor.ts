/**
 * The class every React Flow `<Handle>` in this package carries — and the one a
 * consumer's own custom node must carry too.
 *
 * A connector dot is a MEASUREMENT ANCHOR, not a moving part. React Flow measures
 * `handleBounds` from the DOM exactly once per layout change (`updateNodeInternals`,
 * fired from the effect that sees `sourcePosition`/`targetPosition` change) and then
 * draws every edge endpoint from that stored number until something invalidates it.
 * So a dot that is still ON ITS WAY to its new side when that measurement is taken is
 * measured at the wrong place — permanently, because nothing measures again.
 *
 * That is not hypothetical, and it is not only about author-written transitions:
 *
 * - `@elabs-ai/components-tokens`' reduced-motion backstop (`themes.css`, MOTION GATE)
 *   sets `transition-duration: 0.01ms !important` on `*` so third-party engines that
 *   ignore the `--t-*` tokens (Monaco, `@xyflow/react`, Streamdown) cannot animate.
 *   `transition-property` is left at its initial value, `all` — so under
 *   `prefers-reduced-motion: reduce` that rule does not remove a transition from a
 *   handle, it CREATES one: every geometric property of every element becomes
 *   transitioned, for one frame.
 * - One frame is all it takes. Measured on `ProcessMap direction="LR"`: at the commit
 *   that flips the handles from top/bottom to left/right, the dot's computed box was
 *   still the OLD one (`getAnimations()` on it returned live `left`+`top`+`transform`
 *   transitions), React Flow measured `{ x: 164, y: 45.5 }` where the settled DOM has
 *   `{ x: 172, y: 37.5 }`, and every edge on the map then terminated up to 67 px away
 *   from the dot it points at — for reduced-motion readers only, forever.
 *
 * `transition-property: none` is the fix at the right layer: it costs nothing under
 * normal motion (no rule animates a handle there anyway) and it makes the reposition
 * synchronous, so whenever React Flow measures, it measures the settled dot.
 *
 * The literal is written out here rather than assembled, because Tailwind extracts
 * candidates from source TEXT: this file is scanned, so the utility is emitted, and
 * components may interpolate the constant freely.
 */
export const FLOW_HANDLE_ANCHOR_CLASS = "transition-none";
