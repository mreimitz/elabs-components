#!/usr/bin/env node
/**
 * check-unbounded-output.test.mjs — self-test for the `warn-unbounded-output.sh`
 * PreToolUse(Bash) hook.
 *
 * The hook is warn-only, so it cannot fail a build — which is exactly why it needs
 * a test: a warn-only hook that silently stops matching is indistinguishable from a
 * clean repo. This plants real hook payloads and asserts BOTH directions:
 *
 *   1. it warns on the unbounded shapes it exists to catch (bare `cat`, full-patch
 *      git dumps, whole-JSON `jq .`, unbounded recursive listings);
 *   2. it stays SILENT on every bounded form (head/tail/wc, `--stat`, a jq selector,
 *      a redirect to a file) — a noisy hook gets disabled, which is the same
 *      failure as a dead one;
 *   3. it is still REGISTERED in `.claude/settings.json` — an unregistered hook
 *      never fires (the `session-cadence-nudge` lesson, .claude/rules/quality-gates.md).
 *
 * Run: `pnpm bash-output:check:test`
 * Dependency-free; locates the repo relative to this file (cwd-independent).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const HOOK = join(REPO_ROOT, ".claude/hooks/warn-unbounded-output.sh");
const SETTINGS = join(REPO_ROOT, ".claude/settings.json");

/**
 * Run the hook with a Bash tool payload and return what it wrote to STDERR
 * (the hook's warning channel — stdout stays empty, exit is always 0).
 */
function runHook(command) {
  const payload = JSON.stringify({ tool_name: "Bash", tool_input: { command } });
  const res = spawnSync("bash", [HOOK], { input: payload, encoding: "utf8" });
  assert.equal(res.status, 0, `the hook must never block (exit 0); got ${res.status}`);
  return res.stderr ?? "";
}

const WARNS = [
  ["a bare cat", "cat packages/ui/src/index.ts"],
  ["a full-patch git log", "git log -p"],
  ["an unbounded git diff", "git diff"],
  ["a whole-JSON jq dump", "jq . brand-ui.manifest.json"],
  ["an unbounded recursive find", "find . -name '*.tsx'"],
];

const SILENT = [
  ["head -c", "head -c 2000 packages/ui/src/index.ts"],
  ["cat piped to head", "cat foo.json | head -20"],
  ["git diff --stat", "git diff --stat"],
  ["git log --oneline", "git log --oneline -5"],
  ["a jq selector", "jq .components brand-ui.manifest.json"],
  ["a redirect to a file", "node scripts/x.mjs > /tmp/out.json"],
  ["find with -maxdepth", "find . -maxdepth 2 -name '*.tsx'"],
  ["an ordinary pnpm script", "pnpm typecheck"],
  ["an empty command", ""],
];

test("the hook exists and is executable", () => {
  assert.ok(existsSync(HOOK), `${HOOK} is missing — the hook was deleted or moved`);
});

for (const [label, command] of WARNS) {
  test(`warns on ${label}`, () => {
    const out = runHook(command);
    assert.match(
      out,
      /unbounded output/,
      `expected a warning for: ${command}\ngot: ${JSON.stringify(out)}`,
    );
  });
}

for (const [label, command] of SILENT) {
  test(`stays silent on ${label}`, () => {
    const out = runHook(command);
    assert.equal(out.trim(), "", `expected silence for: ${command}\ngot: ${JSON.stringify(out)}`);
  });
}

test("the hook is registered as a PreToolUse(Bash) hook in .claude/settings.json", () => {
  const settings = JSON.parse(readFileSync(SETTINGS, "utf8"));
  const bash = (settings.hooks?.PreToolUse ?? []).filter((e) => e.matcher === "Bash");
  const commands = bash.flatMap((e) => (e.hooks ?? []).map((h) => h.command ?? ""));
  assert.ok(
    commands.some((c) => c.includes("warn-unbounded-output.sh")),
    "warn-unbounded-output.sh is not registered in .claude/settings.json — an unregistered hook never fires",
  );
});
