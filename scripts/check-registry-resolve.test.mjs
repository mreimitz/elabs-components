/**
 * check-registry-resolve.test.mjs — self-test for the registry relative-import
 * resolution gate (round-2 fix for the registry-blocks unit).
 *
 * All fixtures are INLINE/virtual (hermetic — never real files), mirroring
 * validate-registry.test.mjs. A gate that can silently stop firing is worse
 * than none (quality-gates.md, "Self-tested gates").
 *
 * Run in CI: `node --test scripts/check-registry-resolve.test.mjs`
 * (`pnpm registry:resolve:check:test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findRelativeImports, checkItemResolution } from "./check-registry-resolve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── findRelativeImports ──────────────────────────────────────────────────────

test("findRelativeImports: extracts a same-dir and a sibling-dir import", () => {
  const src = `
    import { X } from "./data/x";
    import { Y } from "../data/y";
    import Z from "@elabs/components-ui";
  `;
  assert.deepEqual(findRelativeImports(src), ["./data/x", "../data/y"]);
});

test("findRelativeImports: ignores bare/alias specifiers", () => {
  const src = `import { cn } from "@/lib/utils";`;
  assert.deepEqual(findRelativeImports(src), []);
});

test("findRelativeImports: catches dynamic import() and require()", () => {
  const src = `const m = await import("./lazy"); const n = require("../shared");`;
  assert.deepEqual(findRelativeImports(src), ["./lazy", "../shared"]);
});

// ── checkItemResolution — virtual fixtures ──────────────────────────────────

function fakeFs(files) {
  // files: { [path]: source }
  return {
    readFile: (p) => {
      if (!(p in files)) throw new Error(`ENOENT: ${p}`);
      return files[p];
    },
    fileExists: (p) => p in files,
  };
}

test("FLAGS: the round-2 defect — ./data/x resolves at repo path but not at target", () => {
  // Repo tree: components/ and data/ are SIBLINGS under the block folder.
  // Import is `./data/x` (as if data/ were nested under components/).
  const item = {
    name: "stat-cards-01",
    files: [
      {
        path: "registry/blocks/stat-cards-01/components/spark-stat-cards.tsx",
        target: "components/stat-cards-01/spark-stat-cards.tsx",
      },
      {
        path: "registry/blocks/stat-cards-01/data/spark-series.ts",
        target: "data/stat-cards-01/spark-series.ts", // sibling top-level `data/`
      },
    ],
  };
  const fs = fakeFs({
    "registry/blocks/stat-cards-01/components/spark-stat-cards.tsx":
      'import { x } from "./data/spark-series";',
    "registry/blocks/stat-cards-01/data/spark-series.ts": "export const x = 1;",
  });
  const violations = checkItemResolution(item, fs);
  assert.ok(violations.length >= 2, "expected both a repo-side and install-side violation");
  assert.ok(violations.some((v) => /REPO tree/.test(v)));
  assert.ok(violations.some((v) => /INSTALL tree/.test(v)));
});

test("PASSES: data/ nested under components/ in BOTH the repo tree and the target", () => {
  const item = {
    name: "stat-cards-01",
    files: [
      {
        path: "registry/blocks/stat-cards-01/components/spark-stat-cards.tsx",
        target: "components/stat-cards-01/spark-stat-cards.tsx",
      },
      {
        path: "registry/blocks/stat-cards-01/components/data/spark-series.ts",
        target: "components/stat-cards-01/data/spark-series.ts",
      },
    ],
  };
  const fs = fakeFs({
    "registry/blocks/stat-cards-01/components/spark-stat-cards.tsx":
      'import { x } from "./data/spark-series";',
    "registry/blocks/stat-cards-01/components/data/spark-series.ts": "export const x = 1;",
  });
  assert.deepEqual(checkItemResolution(item, fs), []);
});

test("PASSES: ../data/ siblings in the repo tree, with a target that mirrors it", () => {
  const item = {
    name: "example",
    files: [
      {
        path: "registry/blocks/example/components/widget.tsx",
        target: "components/example/components/widget.tsx",
      },
      {
        path: "registry/blocks/example/data/series.ts",
        target: "components/example/data/series.ts",
      },
    ],
  };
  const fs = fakeFs({
    "registry/blocks/example/components/widget.tsx": 'import { s } from "../data/series";',
    "registry/blocks/example/data/series.ts": "export const s = 1;",
  });
  assert.deepEqual(checkItemResolution(item, fs), []);
});

test("does not require an extension on the import specifier", () => {
  const item = {
    name: "example",
    files: [
      { path: "registry/blocks/example/components/a.tsx", target: "components/example/a.tsx" },
      {
        path: "registry/blocks/example/components/b.ts",
        target: "components/example/b.ts",
      },
    ],
  };
  const fs = fakeFs({
    "registry/blocks/example/components/a.tsx": 'import { b } from "./b";',
    "registry/blocks/example/components/b.ts": "export const b = 1;",
  });
  assert.deepEqual(checkItemResolution(item, fs), []);
});

test("ignores items with no files (e.g. would-be theme items)", () => {
  assert.deepEqual(checkItemResolution({ name: "x", files: [] }, fakeFs({})), []);
});

// ── CLI: the REAL repo currently passes the gate ────────────────────────────

test("the REAL repo currently passes registry:resolve:check (CLI run)", () => {
  const out = execFileSync("node", [path.join(HERE, "check-registry-resolve.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✓ registry:resolve:check OK/);
});
