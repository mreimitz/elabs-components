import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * #286 tripwire. React Flow's `BaseEdge` ships with a focus indicator that any
 * inline `stroke` silently disables — which is how every brand edge in this
 * package came to have no keyboard focus indicator at all. `FlowEdgePath` is
 * the repair, and this test is what stops the next edge type from reaching past
 * it: a custom edge that imports `BaseEdge` directly is, by construction, an
 * edge with no focus indicator.
 *
 * A component that genuinely needs the primitive can extend `FlowEdgePath`
 * instead — that is the one place the import is allowed.
 */
// The jsdom environment gives `import.meta.url` an http: scheme, so resolve
// from the Vitest root (this package) instead.
const SRC = join(process.cwd(), "src");
const ALLOWED = new Set(["flow-edge-path/flow-edge-path.tsx"]);

function walk(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const abs = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) return walk(abs, rel);
    if (!/\.tsx?$/.test(entry) || /\.(test|stories)\.tsx?$/.test(entry)) return [];
    return [rel];
  });
}

describe("no edge type reaches past FlowEdgePath (#286)", () => {
  it("imports BaseEdge from @xyflow/react in exactly one shipped module", () => {
    const offenders = walk(SRC).filter((rel) => {
      if (ALLOWED.has(rel)) return false;
      const source = readFileSync(join(SRC, rel), "utf8");
      // Only an IMPORT counts — prose mentioning the name in a doc comment does not.
      return /import\s+[^;]*\bBaseEdge\b[^;]*from\s+["']@xyflow\/react["']/s.test(source);
    });
    expect(
      offenders,
      `These modules import React Flow's BaseEdge directly, so their edges have no keyboard ` +
        `focus indicator (#286). Draw through FlowEdgePath instead: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
