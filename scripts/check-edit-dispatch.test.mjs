// check-edit-dispatch.test.mjs — self-test for .claude/hooks/post-edit-dispatch.sh
// -----------------------------------------------------------------------------
// The dispatcher replaces ten separate PostToolUse(Write|Edit) hook entries with
// one entrypoint that routes by path. A routing bug would silently stop a gate
// from firing (worse than no dispatcher), so this test plants fixture paths and
// asserts the EXACT set of sub-hooks the dispatcher would invoke — driven by the
// dispatcher's DISPATCH_DRY_RUN mode (prints the route set, runs nothing).
//
// Run: node --test scripts/check-edit-dispatch.test.mjs   (pnpm dispatch:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DISPATCH = path.resolve(HERE, "../.claude/hooks/post-edit-dispatch.sh");

/** Return the sorted set of sub-hook script names the dispatcher routes `filePath` to. */
function routes(filePath) {
  const input = JSON.stringify({ tool_input: { file_path: filePath } });
  const out = execFileSync("bash", [DISPATCH], {
    input,
    env: { ...process.env, DISPATCH_DRY_RUN: "1" },
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

const eq = (filePath, expected) => assert.deepEqual(routes(filePath), [...expected].sort());

test("plain markdown → format only", () => {
  eq("/repo/docs/NOTES.md", ["format-after-edit.sh"]);
});

test("ui component .tsx → format + boundaries + component-registration", () => {
  eq("/repo/packages/ui/src/components/button/button.tsx", [
    "format-after-edit.sh",
    "validate-component-boundaries.sh",
    "check-component-registered.sh",
  ]);
});

test("ui component story → format + mock-masking (NOT component-registration's source path, NOT boundaries)", () => {
  // .stories.tsx is not packages/*/src/*.tsx-without-suffix for boundaries? boundaries matches *.tsx too,
  // so a story under src DOES hit boundaries; assert the real, full set.
  eq("/repo/packages/ui/src/components/button/button.stories.tsx", [
    "format-after-edit.sh",
    "validate-component-boundaries.sh",
    "check-component-registered.sh",
    "check-mock-masking.sh",
  ]);
});

test("ai source .tsx → format + boundaries + ai-types-only", () => {
  eq("/repo/packages/ai/src/conversation.tsx", [
    "format-after-edit.sh",
    "validate-component-boundaries.sh",
    "check-ai-sdk-types-only.sh",
  ]);
});

test("ai TEST file does NOT route to ai-types-only (mirrors sub-hook guard)", () => {
  eq("/repo/packages/ai/src/conversation.test.tsx", [
    "format-after-edit.sh",
    "validate-component-boundaries.sh",
    "check-mock-masking.sh",
  ]);
});

test("charts source → format + boundaries + charts-reuse", () => {
  eq("/repo/packages/charts/src/chart-frame/chart-frame.tsx", [
    "format-after-edit.sh",
    "validate-component-boundaries.sh",
    "check-charts-reuse.sh",
  ]);
});

test("themes.css → format + theme-parity + tokens-fresh", () => {
  eq("/repo/packages/tokens/src/themes.css", [
    "format-after-edit.sh",
    "check-theme-parity.sh",
    "check-tokens-fresh.sh",
  ]);
});

test("DTCG token json → format + tokens-fresh (NOT theme-parity)", () => {
  eq("/repo/packages/tokens/tokens/color.tokens.json", [
    "format-after-edit.sh",
    "check-tokens-fresh.sh",
  ]);
});

test("package.json → format + package-registration", () => {
  eq("/repo/packages/ui/package.json", ["format-after-edit.sh", "check-package-registered.sh"]);
});

test(".claude artifact → format + claude-artifact validator", () => {
  eq("/repo/.claude/settings.json", ["format-after-edit.sh", "validate-claude-artifacts.sh"]);
});

// #206 — .mjs/.cjs are real Prettier targets that CI's format:check covers; the
// edit-time hook must format them too, and they must stay format-ONLY (the
// source-only gates — boundaries / charts-reuse / ai-types-only — are
// intentionally scoped to .ts/.tsx and must NOT fire for .mjs).
test("plain .mjs script → format only", () => {
  eq("/repo/scripts/check-foo.mjs", ["format-after-edit.sh"]);
});

test(".mjs self-test file → format only (NOT mock-masking; .test.mjs is not in that glob)", () => {
  eq("/repo/scripts/check-foo.test.mjs", ["format-after-edit.sh"]);
});

test(".cjs config → format only", () => {
  eq("/repo/some.config.cjs", ["format-after-edit.sh"]);
});

test("generated/vendored paths route to nothing", () => {
  eq("/repo/packages/ui/dist/index.js", []);
  eq("/repo/node_modules/x/index.ts", []);
});

test("non-formattable, unmatched extension routes to nothing", () => {
  eq("/repo/some/file.lockb", []);
});
