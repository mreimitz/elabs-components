/**
 * Browser-only measurement helpers for `*.stories.tsx` play functions.
 *
 * Reachable across the workspace as `@elabs-ai/components-flow/test`, because
 * the composing packages owe the SAME canvas invariants and re-deriving this
 * DOM arithmetic per package is how two canvases end up disagreeing about what
 * "connected" means.
 *
 * **Deliberately source-only.** The `./test` key exists in `package.json`'s
 * `exports` but NOT in `publishConfig.exports` and NOT as a `tsup` entry, so it
 * resolves for workspace consumers and does not exist in a published tarball:
 * this is test scaffolding, not public API, and it must not turn up in a
 * consumer's autocomplete. The `/test` suffix is also what keeps it out of
 * `brand-ui.manifest.json` (`readSubpathBarrels` skips any subpath ending in
 * `/test`), so no agent can mistake a measurement helper for a component.
 */
export {
  edgePaths,
  endpointsOffHandles,
  handleDots,
  pathEndpoints,
  type HandleDot,
  type ScreenPoint,
} from "./edge-anchors";
export {
  canvasSignature,
  framingMisses,
  handlesOffCard,
  labelsOverNodes,
  miniMapNodeCount,
  nodePlacements,
  nodesOutsidePane,
  viewportZoom,
  waitForSettledCanvas,
  type NodePlacement,
} from "./canvas-framing";
