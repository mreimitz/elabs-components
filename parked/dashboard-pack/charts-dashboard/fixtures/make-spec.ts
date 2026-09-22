/**
 * `makeSpec` — a builder for one-off test/story specs, based on the `minimal` fixture
 * (RM-077). Shallow-overrides top-level `DashboardSpec` fields; pass a full `tiles` array to
 * replace the default single tile.
 */
import { minimalSpec } from "./minimal";
import type { DashboardSpec } from "../core/spec";

export function makeSpec(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return { ...minimalSpec, ...overrides };
}
