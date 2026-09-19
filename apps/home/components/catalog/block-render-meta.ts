/**
 * Which registry blocks the site renders natively (from its copy under `components/blocks/`)
 * instead of embedding their Storybook story. Plain data so a server component can read it; the
 * renders themselves live in `block-renders.tsx`.
 *
 * `stage` says how the block wants its box: `flow` takes its own height, `fill` needs one
 * (a map, a canvas, a wall).
 */
export type BlockStage = "flow" | "fill";

const BLOCKS = {
  "command-center-revenue-01": "flow",
  "command-center-live-ops-01": "flow",
  "command-center-market-tape-01": "flow",
  "command-center-launch-plan-01": "flow",
  "geo-network-map-01": "fill",
  "geo-fleet-tracker-01": "fill",
  "infographic-journey-flow-01": "flow",
  "infographic-profile-compare-01": "flow",
  "infographic-dependency-web-01": "flow",
  "agent-run-review-01": "flow",
} as const satisfies Record<string, BlockStage>;

export type NativeBlockName = keyof typeof BLOCKS;
export const NATIVE_BLOCKS: Record<NativeBlockName, BlockStage> = BLOCKS;

export const isNativeBlock = (name: string | null | undefined): name is NativeBlockName =>
  Boolean(name && name in NATIVE_BLOCKS);
