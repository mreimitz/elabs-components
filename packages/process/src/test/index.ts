/**
 * `@elabs-ai/components-process/test` — jsdom-safe test doubles for the process package's
 * view components (issue #228 / RM-053).
 *
 * Mirrors `@elabs-ai/components-charts/src/test/index.ts` (issue #364): a `vi.mock`-swappable
 * subpath so a consumer's test can render process views without the real
 * flow/charts-composed engine underneath them. See `contract.ts`'s header for why the doubles
 * exported here carry an explicit `Double` suffix rather than the real component names.
 *
 * Deliberately excluded from the agent-facing manifest — `readSubpathBarrels` denies any
 * `/test` subpath (see `@elabs-ai/components-charts`'s identical exclusion), because these are
 * test infrastructure, not a build-with surface.
 */

// Contract engine
export {
  assertProcessContract,
  buildProcessDoublePayload,
  ProcessContractError,
  readProcessDoubleProps,
} from "./contract";
export type { ProcessContractSpec, ProcessDoublePayload, ProcessSelection } from "./contract";

// Doubles
export { ProcessKpiStripDouble, ProcessMapDouble, VariantExplorerDouble } from "./doubles";
export type {
  ProcessKpiStripDoubleProps,
  ProcessMapDoubleProps,
  VariantExplorerDoubleProps,
} from "./doubles";

// Fixture helper
export { withProcessFixture } from "./primitives";
export type { ProcessFixture } from "./primitives";
