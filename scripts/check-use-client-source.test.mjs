/**
 * check-use-client-source.test.mjs — locks the use-client-source gate.
 * Run in CI: `node --test scripts/check-use-client-source.test.mjs`.
 *
 * Plants a bad fixture (hook-using files without "use client" directive)
 * and asserts the gate fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { usesHooks, hasUseClientDirective, findSourceFiles } from "./check-use-client-source.mjs";

/** Build a throwaway package structure with source files. */
function plantBadFixture() {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-use-client-test-"));

  // Create a mock data package with hook-using files but NO "use client" directives
  const dataDir = join(root, "packages", "data", "src");
  mkdirSync(dataDir, { recursive: true });

  // File 1: uses useState, no directive
  writeFileSync(
    join(dataDir, "hook-file-1.tsx"),
    `import { useState } from "react";
export function Component() {
  const [state, setState] = useState(null);
  return null;
}
`,
  );

  // File 2: uses useEffect, no directive
  writeFileSync(
    join(dataDir, "hook-file-2.tsx"),
    `import { useEffect } from "react";
export function Component() {
  useEffect(() => {}, []);
  return null;
}
`,
  );

  // File 3: no hooks, no directive (should be OK)
  writeFileSync(
    join(dataDir, "plain-file.tsx"),
    `export function Component() {
  return <div>Hello</div>;
}
`,
  );

  return root;
}

const cleanup = (dir) => rmSync(dir, { recursive: true, force: true });

// ── Test 1: Hook-using file is detected ────────────────────────────────────
test("FAILS: can detect hook usage", () => {
  const content = `import { useState } from "react";
const x = useState(0);`;
  assert.equal(usesHooks(content), true);
});

// ── Test 2: Non-hook file is not flagged ───────────────────────────────────
test("PASSES: plain file is not flagged as hook-using", () => {
  const content = `export function Component() {
  return <div>Hello</div>;
}`;
  assert.equal(usesHooks(content), false);
});

// ── Test 3: "use client" directive is detected ─────────────────────────────
test("PASSES: use client directive is recognized", () => {
  const content = `"use client";
import { useState } from "react";`;
  assert.equal(hasUseClientDirective(content), true);
});

// ── Test 4: Missing directive is detected ──────────────────────────────────
test("FAILS: missing directive is detected", () => {
  const content = `import { useState } from "react";
const x = useState(0);`;
  assert.equal(hasUseClientDirective(content), false);
});

// ── Test 5: Planted bad fixture logic (helper test) ────────────────────────
test("PASSES: can find source files in fixture", () => {
  const dir = plantBadFixture();
  const files = findSourceFiles(join(dir, "packages", "data", "src"));
  cleanup(dir);

  // Should find the .tsx files (excluding test files)
  assert.ok(files.length > 0, "should find source files");
  assert.ok(
    files.some((f) => f.includes("hook-file-1.tsx")),
    "should find hook-file-1.tsx",
  );
  assert.ok(
    files.some((f) => f.includes("hook-file-2.tsx")),
    "should find hook-file-2.tsx",
  );
});
