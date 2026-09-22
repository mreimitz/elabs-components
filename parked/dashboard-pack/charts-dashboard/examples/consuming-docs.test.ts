/**
 * Typecheck-only check for `docs/CONSUMING.md`'s "Dashboard surface" §6 code (RM-085, #433,
 * acceptance: "the CONSUMING section's code compiles as a typecheck-only snippet"). Neither
 * `docs/examples/**` nor RM-058's own worked example is typechecked by any gate today, so this
 * mirrors the section's two snippets verbatim through the PUBLISHED subpath specifiers (not a
 * relative import) and lets `pnpm --filter @elabs-ai/components-charts typecheck` catch drift —
 * the runtime assertions below are a bonus, not the point.
 */
import { describe, expect, it, vi } from "vitest";

// docs/CONSUMING.md §6, snippet 1 — "Import from the subpath, not the package root."
import {
  DashboardProvider,
  DashboardSheet,
  createLocalSelectionDriver,
  createTileRegistry,
} from "@elabs-ai/components-charts/dashboard";
import type * as DashboardTestDouble from "@elabs-ai/components-charts/dashboard/test";

describe("CONSUMING.md §6 dashboard snippets stay real", () => {
  it("snippet 1: the subpath exports every named import", () => {
    // `DashboardProvider`/`DashboardSheet` are `forwardRef` components — objects, not
    // functions — so this checks presence, the same thing the real import statement above
    // already proved at compile time.
    expect(DashboardProvider).toBeDefined();
    expect(DashboardSheet).toBeDefined();
    expect(createLocalSelectionDriver).toBeTypeOf("function");
    expect(createTileRegistry).toBeTypeOf("function");
  });

  it("snippet 4: the test double subpath is mockable in place of the real barrel", async () => {
    // docs/CONSUMING.md §6, snippet 4 — verbatim, except the factory is inlined so this file
    // stays a plain assertion rather than a `vi.mock` hoisted to module scope.
    const double = await vi.importActual<typeof DashboardTestDouble>(
      "@elabs-ai/components-charts/dashboard/test",
    );
    expect(double.DashboardSheet).toBeDefined();
  });
});
