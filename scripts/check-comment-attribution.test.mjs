// check-comment-attribution.test.mjs — self-test for the comment-attribution
// gate + hook (#78).
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none
// (.claude/rules/quality-gates.md ▸ "Self-tested gates"). This plants the exact
// shapes the incident and the issue's own test table name and asserts the
// guard REFUSES each of them, then drives the SHELL hook end to end (the
// `check-merge-readiness.test.mjs` pattern) and asserts the hook is still
// registered in `.claude/settings.json`.
//
// Run: node --test scripts/check-comment-attribution.test.mjs
// (`pnpm attribution:comments:check:test`)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  MARKER,
  BLOCKQUOTE_PHRASE,
  DEFAULT_ISSUE,
  hasMarker,
  render,
} from "./lib/comment-attribution.mjs";
import {
  shellSplit,
  isUninspectableBashCommand,
  findFlagValues,
  matchBashPostingShape,
  resolveBashBody,
  resolveMcpBody,
  evaluateHookPayload,
  POSTING_RE,
  HELPER_REFERENCE_RE,
  findUnguardedPostingSites,
  scannedFilesRung2,
  findWiringViolations,
  findGhCandidates,
  apiEndpointPostsProse,
  helpFlagIsFree,
} from "./check-comment-attribution.mjs";
import { parseShellCommands } from "./lib/shell-command-parse.mjs";
import { buildBody, main as postMain, parseArgs } from "./post-issue-comment.mjs";

/**
 * Quote a string for a real double-quoted shell word. `JSON.stringify` is NOT
 * a shell quoter: the marker banner contains backticks (`` `close-issues` ``),
 * which bash would run as command substitution — the gate is right to refuse
 * that, so the tests must spell the safe form.
 * @param {string} text
 */
function shq(text) {
  return `"${text.replace(/(["\\`$])/g, "\\$1")}"`;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const HOOK = path.join(REPO_ROOT, ".claude", "hooks", "gate-comment-attribution.sh");
const GATE = path.join(HERE, "check-comment-attribution.mjs");

let TMP;
test.before(() => {
  TMP = mkdtempSync(path.join(tmpdir(), "comment-attribution-test-"));
});
test.after(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// ── Rung 1 — marker validation (both halves required) ───────────────────────

test("rung 1: an unmarked body has no marker", () => {
  assert.equal(hasMarker("just a plain comment, no banner"), false);
  assert.equal(hasMarker(""), false);
  assert.equal(hasMarker(undefined), false);
});

test("rung 1: the HTML comment alone is not enough (invisible to the human reader)", () => {
  assert.equal(hasMarker(`${MARKER}\nSome text with no visible banner.`), false);
});

test("rung 1: the blockquote alone is not enough (no machine-checkable anchor)", () => {
  assert.equal(hasMarker(`> 🤖 ${BLOCKQUOTE_PHRASE} — drafted by an automated run.`), false);
});

test("rung 1: both halves together pass", () => {
  const body = render("close-issues", 78);
  assert.ok(body.includes(MARKER));
  assert.ok(body.includes(BLOCKQUOTE_PHRASE));
  assert.equal(hasMarker(body), true);
});

test("rung 1: render() names the command and the issue", () => {
  const body = render("session-retro", 42);
  assert.match(body, /session-retro/);
  assert.match(body, /#42/);
});

// ── Bash command parsing (the hook's extraction logic) ───────────────────────

test("shellSplit: handles single and double quotes", () => {
  assert.deepEqual(shellSplit(`gh issue comment 26 --body "hello world"`), [
    "gh",
    "issue",
    "comment",
    "26",
    "--body",
    "hello world",
  ]);
  assert.deepEqual(shellSplit(`gh issue comment 26 -b 'a b c'`), [
    "gh",
    "issue",
    "comment",
    "26",
    "-b",
    "a b c",
  ]);
});

test("isUninspectableBashCommand: flags heredocs and piped-into-gh bodies", () => {
  assert.equal(
    isUninspectableBashCommand(`gh issue comment 26 --body "$(cat <<'EOF'\nhi\nEOF\n)"`),
    true,
  );
  assert.equal(
    isUninspectableBashCommand(`cat draft.md | gh issue comment 26 --body-file -`),
    true,
  );
  assert.equal(isUninspectableBashCommand(`gh issue comment 26 --body-file /tmp/x.md`), false);
});

test("matchBashPostingShape: recognizes every posting shape and ignores read-only gh calls", () => {
  assert.equal(
    matchBashPostingShape(shellSplit("gh issue comment 26 --body hi")),
    "gh issue comment",
  );
  assert.equal(
    matchBashPostingShape(shellSplit("gh issue close 26 --comment hi")),
    "gh issue close --comment",
  );
  assert.equal(
    matchBashPostingShape(shellSplit("gh issue close 26")),
    null,
    "close without --comment is not a posting call",
  );
  assert.equal(
    matchBashPostingShape(shellSplit("gh issue create --title x --body hi")),
    "gh issue create",
  );
  assert.equal(matchBashPostingShape(shellSplit("gh pr comment 12 --body hi")), "gh pr comment");
  assert.equal(
    matchBashPostingShape(shellSplit("gh pr review 12 --body hi")),
    "gh pr review --body",
  );
  assert.equal(matchBashPostingShape(shellSplit("gh pr review 12 --approve")), null);
  assert.equal(matchBashPostingShape(shellSplit("gh issue view 26 --json comments")), null);
  assert.equal(matchBashPostingShape(shellSplit("gh issue list --state open")), null);
  assert.equal(matchBashPostingShape(shellSplit("gh api repos/:owner/:repo")), null);
});

// ── Fix round 1 (#78) — the `=`-form / short-flag / cluster bypass ──────────
// An independent validator found the original matcher only recognized
// `--flag value` (space-separated), so `gh issue close --comment="…"` and
// `gh pr review --body="…"` sailed through with exit 0 — a live, trivially
// reachable bypass, not a hypothetical. These lock every shape the fixed
// `findFlagValues()` now claims to handle (see the module header comment's
// HANDLED/NOT HANDLED enumeration) so this exact regression cannot return.

test("findFlagValues: long flag, `--flag value` and `--flag=value`", () => {
  const specs = [{ long: "--comment", short: "-c" }];
  assert.deepEqual(findFlagValues(["--comment", "hi"], specs), [{ value: "hi" }]);
  assert.deepEqual(findFlagValues(["--comment=hi"], specs), [{ value: "hi" }]);
});

test("findFlagValues: short flag, space / equals / attached (no separator)", () => {
  const specs = [{ long: "--comment", short: "-c" }];
  assert.deepEqual(findFlagValues(["-c", "hi"], specs), [{ value: "hi" }]);
  assert.deepEqual(findFlagValues(["-c=hi"], specs), [{ value: "hi" }]);
  assert.deepEqual(findFlagValues(["-chi"], specs), [{ value: "hi" }]);
});

test("findFlagValues: short-flag CLUSTER — boolean shorthands ahead of a value shorthand", () => {
  // gh pr review: -c is a BOOLEAN (review type) on this subcommand, -b takes
  // the body value. `-cb"text"` == `-c -b "text"` per real pflag semantics.
  const bodySpecs = [{ long: "--body", short: "-b" }];
  const boolShorthands = ["a", "c", "r"];
  assert.deepEqual(findFlagValues(["-cbhi"], bodySpecs, boolShorthands), [{ value: "hi" }]);
  assert.deepEqual(findFlagValues(["-cb=hi"], bodySpecs, boolShorthands), [{ value: "hi" }]);
  assert.deepEqual(findFlagValues(["-cb", "hi"], bodySpecs, boolShorthands), [{ value: "hi" }]);
  assert.deepEqual(findFlagValues(["-acrb", "hi"], bodySpecs, boolShorthands), [{ value: "hi" }]);
});

test("findFlagValues: does NOT guess past a character it doesn't recognize", () => {
  // `-x` is neither a declared bool shorthand nor a declared value shorthand
  // here — the walk must stop, not fall through to a later char.
  const bodySpecs = [{ long: "--body", short: "-b" }];
  assert.deepEqual(findFlagValues(["-xb", "hi"], bodySpecs, ["a", "c", "r"]), []);
});

test("matchBashPostingShape: recognizes the `=`-form bypass shapes from the #78 fix-round-1 verdict", () => {
  assert.equal(
    matchBashPostingShape(shellSplit(`gh issue close 26 --comment="unmarked text"`)),
    "gh issue close --comment",
  );
  assert.equal(
    matchBashPostingShape(shellSplit(`gh pr review 12 --body="unmarked text"`)),
    "gh pr review --body",
  );
});

test("matchBashPostingShape: recognizes gh pr review's short/file forms the original matcher missed entirely", () => {
  // -b (short, space) was never in review's old requireAnyFlag list at all —
  // an omission bug independent of the `=`-form finding.
  assert.equal(matchBashPostingShape(shellSplit(`gh pr review 12 -b "hi"`)), "gh pr review --body");
  // --body-file / -F were never recognized as review posting flags at all.
  assert.equal(
    matchBashPostingShape(shellSplit(`gh pr review 12 --body-file x.md`)),
    "gh pr review --body",
  );
  assert.equal(matchBashPostingShape(shellSplit(`gh pr review 12 -F x.md`)), "gh pr review --body");
});

test("matchBashPostingShape: recognizes attached short flags and short-flag clusters", () => {
  assert.equal(
    matchBashPostingShape(shellSplit(`gh issue close 26 -c"unmarked text"`)),
    "gh issue close --comment",
    'attached short form -c"text"',
  );
  assert.equal(
    matchBashPostingShape(shellSplit(`gh pr review 12 -cb"unmarked text"`)),
    "gh pr review --body",
    "cluster: -c (bool, review-type) + -b (value) in one token",
  );
  assert.equal(
    matchBashPostingShape(shellSplit(`gh issue comment 26 -eb"unmarked text"`)),
    "gh issue comment",
    "cluster: -e (bool, editor) + -b (value) in one token",
  );
});

test("matchBashPostingShape: flags in ANY position relative to the issue/PR number", () => {
  assert.equal(
    matchBashPostingShape(shellSplit(`gh issue close --comment "hi" 26`)),
    "gh issue close --comment",
  );
  assert.equal(
    matchBashPostingShape(shellSplit(`gh pr review --body "hi" 12`)),
    "gh pr review --body",
  );
});

test("resolveBashBody: reads the value from every equals/attached/cluster form", () => {
  assert.equal(resolveBashBody(`gh issue close 26 --comment="no marker"`).body, "no marker");
  assert.equal(resolveBashBody(`gh issue close 26 -c="no marker"`).body, "no marker");
  assert.equal(resolveBashBody(`gh issue close 26 -c"no marker"`).body, "no marker");
  assert.equal(resolveBashBody(`gh pr review 12 --body="no marker"`).body, "no marker");
  assert.equal(resolveBashBody(`gh pr review 12 -b "no marker"`).body, "no marker");
  assert.equal(resolveBashBody(`gh pr review 12 -cb"no marker"`).body, "no marker");
});

test("resolveBashBody: reads a --body-file/-F path given in `=`-form (previously wrongly blocked, not bypassed)", () => {
  const file = path.join(TMP, "eq-marked.md");
  writeFileSync(file, render("close-issues", 78), "utf8");
  const r = resolveBashBody(`gh issue comment 26 --body-file=${file}`);
  assert.equal(r.uninspectable, false);
  assert.ok(hasMarker(r.body));
});

test("resolveBashBody: -F=- (equals-form stdin) is still refused as uninspectable", () => {
  const r = resolveBashBody(`gh issue comment 26 -F=-`);
  assert.equal(r.uninspectable, true);
});

test("evaluateHookPayload: BLOCKS every #78 fix-round-1 verdict PoC, reproduced exactly", () => {
  for (const command of [
    `gh issue close 26 --comment="This is my unmarked ruling as maintainer, closing for good."`,
    `gh pr review 12 --body="unmarked review text"`,
  ]) {
    const v = evaluateHookPayload({ tool_name: "Bash", tool_input: { command } });
    assert.equal(v.verdict, "block", command);
  }
});

test("evaluateHookPayload: BLOCKS gh pr review's -b/--body-file/-F shapes the original matcher never even recognized", () => {
  for (const command of [
    `gh pr review 12 -b "no marker"`,
    `gh pr review 12 --body-file /tmp/does-not-need-to-exist-for-this-shape-check.md`,
  ]) {
    const v = evaluateHookPayload({ tool_name: "Bash", tool_input: { command } });
    // The first is checked for shape-recognition + block; the second may
    // resolve as uninspectable-safe-block OR content-block depending on file
    // existence, but must never silently ALLOW.
    assert.notEqual(v.verdict, "allow", command);
  }
});

test("evaluateHookPayload: ALLOWS the same equals-form calls once marked", () => {
  const body = render("close-issues", 78);
  const v1 = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh issue close 26 --comment=${shq(body)}` },
  });
  assert.equal(v1.verdict, "allow");
  const v2 = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh pr review 12 --body=${shq(body)}` },
  });
  assert.equal(v2.verdict, "allow");
});

test("resolveBashBody: reads an inline --body/-b/--comment/-c value", () => {
  const r = resolveBashBody(`gh issue comment 26 --body "no marker here"`);
  assert.equal(r.uninspectable, false);
  assert.equal(r.body, "no marker here");
});

test("resolveBashBody: reads a --body-file/-F path from disk", () => {
  const file = path.join(TMP, "marked.md");
  writeFileSync(file, render("close-issues", 78), "utf8");
  const r = resolveBashBody(`gh issue comment 26 --body-file ${file}`);
  assert.equal(r.uninspectable, false);
  assert.ok(hasMarker(r.body));
});

test("resolveBashBody: refuses -F - (stdin) as uninspectable", () => {
  const r = resolveBashBody(`gh issue comment 26 -F -`);
  assert.equal(r.uninspectable, true);
});

test("resolveBashBody: refuses a heredoc body as uninspectable", () => {
  const r = resolveBashBody(`gh issue comment 26 --body "$(cat <<'EOF'\nhi\nEOF\n)"`);
  assert.equal(r.uninspectable, true);
});

test("resolveMcpBody: reads the MCP tool_input.body field", () => {
  assert.deepEqual(resolveMcpBody({ body: "hello" }), { uninspectable: false, body: "hello" });
  assert.deepEqual(resolveMcpBody({}), { uninspectable: false, body: null });
});

// ── evaluateHookPayload — the pure decision the hook wraps ───────────────────

test("evaluateHookPayload: BLOCKS an unmarked gh issue comment", () => {
  const v = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 -b "no marker"` },
  });
  assert.equal(v.verdict, "block");
  assert.match(v.reason, /gh issue comment/);
});

test("evaluateHookPayload: BLOCKS gh issue close --comment when unmarked", () => {
  const v = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh issue close 26 --comment "no marker"` },
  });
  assert.equal(v.verdict, "block");
});

test("evaluateHookPayload: ALLOWS a marker-carrying --body-file", () => {
  const file = path.join(TMP, "marked2.md");
  writeFileSync(file, render("close-issues", 78), "utf8");
  const v = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 --body-file ${file}` },
  });
  assert.equal(v.verdict, "allow");
});

test("evaluateHookPayload: BLOCKS an uninspectable -F - body", () => {
  const v = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 -F -` },
  });
  assert.equal(v.verdict, "block");
  assert.match(v.reason, /uninspectable|cannot be inspected/i);
});

test("evaluateHookPayload: non-posting gh commands are untouched", () => {
  for (const command of [
    "gh issue view 26 --json comments",
    "gh issue list --state open",
    "gh api repos/:owner/:repo/issues",
    "git status",
  ]) {
    const v = evaluateHookPayload({ tool_name: "Bash", tool_input: { command } });
    assert.equal(v.verdict, "allow", command);
  }
});

test("evaluateHookPayload: BLOCKS mcp__github__add_issue_comment and mcp__github__create_issue when unmarked", () => {
  for (const tool_name of ["mcp__github__add_issue_comment", "mcp__github__create_issue"]) {
    const v = evaluateHookPayload({ tool_name, tool_input: { body: "no marker" } });
    assert.equal(v.verdict, "block", tool_name);
  }
});

test("evaluateHookPayload: ALLOWS the MCP tools when the body carries both marker halves", () => {
  for (const tool_name of ["mcp__github__add_issue_comment", "mcp__github__create_issue"]) {
    const v = evaluateHookPayload({
      tool_name,
      tool_input: { body: `Looks good.\n\n${render("file-issue", 78)}` },
    });
    assert.equal(v.verdict, "allow", tool_name);
  }
});

test("regression lock (#78): the exact machine-drafted body that triggered this issue is rejected", () => {
  // Committed verbatim from `.claude/scratch/close-issues/20260830-195822/comments/adj-26.md`
  // (scratch itself is gitignored and per-machine, so the fixture is copied here) —
  // the comment cited as "the maintainer's own comments" in triage-26.json. It
  // must never be postable again unmarked.
  const body = readFileSync(
    path.join(HERE, "fixtures", "comment-attribution", "adj-26-unmarked.md"),
    "utf8",
  );
  assert.equal(hasMarker(body), false);
  const v = evaluateHookPayload({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 --body ${shq(body)}` },
  });
  assert.equal(v.verdict, "block");
});

// ── Rung 2 — call-site coverage (does a posting instruction cite the helper?) ─

test("rung 2: POSTING_RE recognizes every named posting shape", () => {
  for (const line of [
    "gh issue comment 26 --body-file x.md",
    "gh issue close 26 --comment 'done'",
    "gh issue create --title x --body y",
    "gh pr comment 12 --body y",
    "gh pr review 12 --body y",
    "mcp__github__add_issue_comment",
    "mcp__github__create_issue",
  ]) {
    assert.ok(POSTING_RE.test(line), `should match: ${line}`);
  }
});

test("rung 2: POSTING_RE also recognizes the `=`-form and gh pr review's -b/-F/--body-file (#78 fix round 1)", () => {
  for (const line of [
    `gh issue close 26 --comment="done"`,
    `gh issue close 26 -c="done"`,
    `gh pr review 12 --body="done"`,
    "gh pr review 12 -b done",
    "gh pr review 12 --body-file x.md",
    "gh pr review 12 -F x.md",
  ]) {
    assert.ok(POSTING_RE.test(line), `should match: ${line}`);
  }
});

test("rung 2: FLAGS a file naming a posting call with no helper reference", () => {
  const hits = findUnguardedPostingSites([
    {
      file: ".claude/commands/fake.md",
      content: 'Post the result with `gh issue comment <n> --body "..."`.',
    },
  ]);
  assert.deepEqual(hits, [".claude/commands/fake.md"]);
});

test("rung 2: PASSES the same file once it references the helper", () => {
  const hits = findUnguardedPostingSites([
    {
      file: ".claude/commands/fake.md",
      content:
        "Post the result with `node scripts/post-issue-comment.mjs <n> --command fake --body-file <path>`, never raw `gh issue comment`.",
    },
  ]);
  assert.deepEqual(hits, []);
});

test("rung 2: PASSES a file referencing only the rule/marker name, not the helper file", () => {
  const hits = findUnguardedPostingSites([
    {
      file: ".claude/commands/fake2.md",
      content: "`gh issue comment` bodies must carry the machine-attribution marker (#78).",
    },
  ]);
  assert.deepEqual(hits, []);
});

test("rung 2: does not flag a file with no posting instruction at all", () => {
  const hits = findUnguardedPostingSites([
    { file: ".claude/commands/unrelated.md", content: "Run `gh issue view 26 --json state`." },
  ]);
  assert.deepEqual(hits, []);
});

test("rung 2: HELPER_REFERENCE_RE matches the documented escape hatch too", () => {
  assert.ok(HELPER_REFERENCE_RE.test("Override with ALLOW_UNATTRIBUTED_COMMENT=1."));
});

test("rung 2: the real repo's current command docs all reference the helper/rule", () => {
  const hits = findUnguardedPostingSites(scannedFilesRung2(REPO_ROOT));
  assert.deepEqual(hits, []);
});

// ── Wiring — the hook and the self-test must stay plugged in ────────────────

test("the hook is registered in .claude/settings.json and self-tested in gates.yml", () => {
  const violations = findWiringViolations({
    settings: readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"),
    gatesYml: readFileSync(path.join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8"),
  });
  assert.deepEqual(violations, []);
});

test("the wiring check itself can fail when the hook is unregistered", () => {
  const violations = findWiringViolations({ settings: "{}", gatesYml: "jobs: {}" });
  assert.equal(violations.length, 2);
});

// ── The gate CLI, end to end ─────────────────────────────────────────────────

test("CLI: `--body <file>` mode exits 0 on a marked file, 1 on an unmarked one", () => {
  const marked = path.join(TMP, "cli-marked.md");
  const unmarked = path.join(TMP, "cli-unmarked.md");
  writeFileSync(marked, render(), "utf8");
  writeFileSync(unmarked, "no marker at all", "utf8");

  const ok = spawnSync("node", [GATE, "--body", marked], { encoding: "utf8" });
  assert.equal(ok.status, 0);

  const bad = spawnSync("node", [GATE, "--body", unmarked], { encoding: "utf8" });
  assert.equal(bad.status, 1);
});

test("CLI: default mode (rung 2) passes on the real repo tree", () => {
  const out = spawnSync("node", [GATE], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

// ── The shell hook, end to end (real PreToolUse JSON on stdin) ───────────────

function runHook(payload, env = {}) {
  return spawnSync("bash", [HOOK], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT, ...env },
  });
}

test("hook: gh issue comment with an inline unmarked body -> exit 2", () => {
  const r = runHook({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 -b "no marker"` },
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /comment-attribution gate/);
});

test("hook: gh issue comment --body-file <unmarked file> -> exit 2", () => {
  const file = path.join(TMP, "hook-unmarked.md");
  writeFileSync(file, "no marker here", "utf8");
  const r = runHook({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 --body-file ${file}` },
  });
  assert.equal(r.status, 2);
});

test("hook: gh issue comment -F - (uninspectable) -> exit 2", () => {
  const r = runHook({ tool_name: "Bash", tool_input: { command: `gh issue comment 26 -F -` } });
  assert.equal(r.status, 2);
});

test("hook: gh issue close --comment with an unmarked body -> exit 2", () => {
  const r = runHook({
    tool_name: "Bash",
    tool_input: { command: `gh issue close 26 --comment "no marker"` },
  });
  assert.equal(r.status, 2);
});

test("hook: gh issue comment --body-file <marked file> -> exit 0", () => {
  const file = path.join(TMP, "hook-marked.md");
  writeFileSync(file, render("close-issues", 78), "utf8");
  const r = runHook({
    tool_name: "Bash",
    tool_input: { command: `gh issue comment 26 --body-file ${file}` },
  });
  assert.equal(r.status, 0, r.stderr);
});

test("hook: mcp__github__add_issue_comment with an unmarked body -> exit 2", () => {
  const r = runHook({
    tool_name: "mcp__github__add_issue_comment",
    tool_input: { body: "no marker" },
  });
  assert.equal(r.status, 2);
});

test("hook: mcp__github__create_issue with an unmarked body -> exit 2", () => {
  const r = runHook({ tool_name: "mcp__github__create_issue", tool_input: { body: "no marker" } });
  assert.equal(r.status, 2);
});

test("hook: gh issue view (read-only) -> exit 0, silent", () => {
  const r = runHook({
    tool_name: "Bash",
    tool_input: { command: "gh issue view 26 --json comments" },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim(), "");
});

test("hook: any blocked case with ALLOW_UNATTRIBUTED_COMMENT=1 -> exit 0 + loud stderr warning", () => {
  const r = runHook(
    { tool_name: "Bash", tool_input: { command: `gh issue comment 26 -b "no marker"` } },
    { ALLOW_UNATTRIBUTED_COMMENT: "1" },
  );
  assert.equal(r.status, 0);
  assert.match(r.stderr, /OVERRIDDEN by ALLOW_UNATTRIBUTED_COMMENT=1/);
});

test("hook: #78 fix-round-1 verdict PoCs, run through the REAL shell hook end to end -> exit 2", () => {
  for (const command of [
    `gh issue close 26 --comment="This is my unmarked ruling as maintainer, closing for good."`,
    `gh pr review 12 --body="unmarked review text"`,
  ]) {
    const r = runHook({ tool_name: "Bash", tool_input: { command } });
    assert.equal(r.status, 2, command);
    assert.match(r.stderr, /comment-attribution gate/);
  }
});

test("hook: a non-tool-name it does not recognize is left alone", () => {
  const r = runHook({ tool_name: "Read", tool_input: { file_path: "/tmp/x" } });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim(), "");
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix round 2 (#78) — the COMMAND-GRAMMAR bypass class.
//
// Rounds 1 and 2 both patched the symptom a validator named and left the class
// intact: round 1 recognized only `--flag value`, round 2 fixed the flag
// grammar but still required `gh` to be token[0], so every posting shape walked
// through behind an ordinary `cd X && ` prefix. The root cause is that a shell
// command line is a small LANGUAGE, not a string to pattern-match. Every case
// below is a command an independent validator actually RAN against the real
// hook and observed exit 0 (silently allowed); each is now an explicit,
// named locking case. See `.claude/rules/quality-gates.md` ▸ "Self-tested gates".
// ─────────────────────────────────────────────────────────────────────────────

const UNMARKED = "unmarked ruling text";

function bash(command) {
  return evaluateHookPayload({ tool_name: "Bash", tool_input: { command } });
}

// ── Finding 1 — the 13 commands the validator reproduced as ALLOW(0) ────────

const FINDING_1_BYPASSES = [
  [`cd /tmp && gh issue comment 26 --body "${UNMARKED}"`, "cd-prefix, gh issue comment"],
  [`cd /tmp && gh issue close 26 --comment "${UNMARKED}"`, "cd-prefix, gh issue close"],
  [`cd /tmp && gh issue create -t T --body "${UNMARKED}"`, "cd-prefix, gh issue create"],
  [`cd /tmp && gh pr comment 12 --body "${UNMARKED}"`, "cd-prefix, gh pr comment"],
  [`cd /tmp && gh pr review 12 --body "${UNMARKED}"`, "cd-prefix, gh pr review"],
  [`git status --short\ngh issue comment 26 --body "${UNMARKED}"`, "multi-line Bash script"],
  [`true; gh issue comment 26 --body "${UNMARKED}"`, "semicolon-chained"],
  [`(gh issue comment 26 --body "${UNMARKED}")`, "subshell"],
  [`GH_HOST=github.com gh issue comment 26 --body "${UNMARKED}"`, "env-var prefix"],
  [`/opt/homebrew/bin/gh issue comment 26 --body "${UNMARKED}"`, "absolute path to gh"],
  [`gh issue view 26 && gh issue comment 26 --body "${UNMARKED}"`, "chained after a read call"],
  [`gh --repo mreimitz/brand-ui issue comment 26 --body "${UNMARKED}"`, "gh global --repo"],
  [`gh -R mreimitz/brand-ui issue comment 26 --body "${UNMARKED}"`, "gh global -R"],
];

test("#78 fix-round-2 verdict Finding 1: every prefixed/positional bypass BLOCKS (pure)", () => {
  for (const [command, label] of FINDING_1_BYPASSES) {
    assert.equal(bash(command).verdict, "block", `${label}: ${command}`);
  }
});

test("#78 fix-round-2 verdict Finding 1: the same 13, through the REAL shell hook -> exit 2", () => {
  for (const [command, label] of FINDING_1_BYPASSES) {
    const r = runHook({ tool_name: "Bash", tool_input: { command } });
    assert.equal(r.status, 2, `${label}: ${command}\n${r.stderr}`);
    assert.match(r.stderr, /comment-attribution gate/, label);
  }
});

// ── Finding 2 — repeated flags: the checker read the FIRST, gh uses the LAST ─

test("#78 fix-round-2 verdict Finding 2: a repeated --body-file (marked then unmarked) BLOCKS", () => {
  const marked = path.join(TMP, "dup-marked.md");
  const unmarked = path.join(TMP, "dup-unmarked.md");
  writeFileSync(marked, render("close-issues", 78), "utf8");
  writeFileSync(unmarked, UNMARKED, "utf8");
  const command = `gh issue comment 26 --body-file ${marked} --body-file ${unmarked}`;
  assert.equal(bash(command).verdict, "block", command);
  assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2);
});

test("#78 fix-round-2 verdict Finding 2: a repeated --body (marked then unmarked) BLOCKS", () => {
  const command = `gh issue comment 26 --body ${shq(render("close-issues", 78))} --body ${shq(UNMARKED)}`;
  assert.equal(bash(command).verdict, "block", command);
  assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2);
});

// ── Finding 3 — only the FIRST posting call in a command line was inspected ──

test("#78 fix-round-2 verdict Finding 3: a SECOND posting call after a marked one BLOCKS", () => {
  const banner = shq(render("close-issues", 78));
  const command = `gh issue comment 26 --body ${banner} ; gh issue comment 26 --body ${shq(UNMARKED)}`;
  assert.equal(bash(command).verdict, "block", command);
  assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2);
});

test("#78 fix-round-2 verdict Finding 3: `-F <marked> && … --body <unmarked>` BLOCKS", () => {
  const marked = path.join(TMP, "chain-marked.md");
  writeFileSync(marked, render("close-issues", 78), "utf8");
  const command = `gh issue comment 26 -F ${marked} && gh issue comment 26 --body ${shq(UNMARKED)}`;
  assert.equal(bash(command).verdict, "block", command);
  assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2);
});

// ── Finding 4 — the override in the form the docs imply (an inline prefix) ───

test("#78 fix-round-2 verdict Finding 4: an INLINE ALLOW_UNATTRIBUTED_COMMENT=1 prefix overrides LOUDLY", () => {
  const command = `ALLOW_UNATTRIBUTED_COMMENT=1 gh issue comment 26 --body "${UNMARKED}"`;
  const r = runHook({ tool_name: "Bash", tool_input: { command } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /OVERRIDDEN by ALLOW_UNATTRIBUTED_COMMENT=1/);
});

test("#78 fix-round-2 verdict Finding 4: an inline ALLOW_UNATTRIBUTED_COMMENT=0 does NOT override", () => {
  const command = `ALLOW_UNATTRIBUTED_COMMENT=0 gh issue comment 26 --body "${UNMARKED}"`;
  assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2);
});

// ── Finding 5 — `gh api` POST is a real posting channel ─────────────────────

test("#78 fix-round-2 verdict Finding 5: `gh api -X POST …/comments -f body=<unmarked>` BLOCKS", () => {
  const command = `gh api -X POST repos/o/r/issues/26/comments -f body='${UNMARKED}'`;
  assert.equal(bash(command).verdict, "block", command);
  assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2);
});

test("#78 fix-round-2 verdict Finding 5: the same `gh api` POST with a marked body is ALLOWED", () => {
  const command = `gh api -X POST repos/o/r/issues/26/comments -f body=${shq(render("close-issues", 78))}`;
  assert.equal(bash(command).verdict, "allow", command);
});

test("#78 fix-round-2 verdict Finding 5: read-only `gh api` calls stay untouched", () => {
  for (const command of [
    "gh api repos/:owner/:repo/issues",
    "gh api repos/:owner/:repo/branches/main/protection",
    "gh api repos/o/r/issues/26/comments --jq '.[].body'",
    "gh api -X POST repos/o/r/issues/26/lock",
  ]) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});

// ── Finding 7 — the refusal must SHOW the marker text ───────────────────────

test("#78 fix-round-2 verdict Finding 7: the refusal message contains the literal marker bytes", () => {
  const v = bash(`gh issue comment 26 --body "${UNMARKED}"`);
  assert.equal(v.verdict, "block");
  assert.ok(v.reason.includes(MARKER), "HTML-comment half must be quoted verbatim");
  assert.ok(v.reason.includes(BLOCKQUOTE_PHRASE), "blockquote half must be quoted verbatim");
});

// ── The class, not just the named instances: further shell grammar ───────────

test("#78 class: shell grammar beyond the reported cases still BLOCKS", () => {
  const marked = path.join(TMP, "class-marked.md");
  writeFileSync(marked, render("close-issues", 78), "utf8");
  const cases = [
    [`bash -c 'gh issue comment 26 --body "${UNMARKED}"'`, "bash -c"],
    // The round-5 finding lived exactly here: `-c` clustered with any other
    // short flag hid the whole script, and this is the test that goes red when
    // the nested re-parse stops seeing it. The full grammar is exercised by
    // "every script-introducing option spelling still BLOCKS" below.
    [`bash -lc 'gh issue comment 26 --body "${UNMARKED}"'`, "bash -lc"],
    [`bash -euxc 'gh issue comment 26 --body "${UNMARKED}"'`, "bash -euxc"],
    [`sh -ec 'gh issue comment 26 --body "${UNMARKED}"'`, "sh -ec"],
    [`zsh -ic 'gh issue comment 26 --body "${UNMARKED}"'`, "zsh -ic"],
    [`nohup bash -lc 'gh issue comment 26 --body "${UNMARKED}"'`, "wrapped -lc"],
    [`env -S 'gh issue comment 26 --body "${UNMARKED}"'`, "env -S"],
    [`env -S'gh issue comment 26 --body "${UNMARKED}"'`, "env -S attached"],
    [`ssh localhost 'gh issue comment 26 --body "${UNMARKED}"'`, "ssh operand"],
    [`bash <<< 'gh issue comment 26 --body "${UNMARKED}"'`, "herestring"],
    [`eval "gh issue comment 26 --body '${UNMARKED}'"`, "eval"],
    [`OUT=$(gh issue comment 26 --body '${UNMARKED}')`, "command substitution"],
    [`echo $(gh pr comment 12 --body '${UNMARKED}')`, "bare command substitution"],
    [`cd /tmp \\\n  && gh issue comment 26 --body '${UNMARKED}'`, "line continuation"],
    [`if true; then gh issue comment 26 --body '${UNMARKED}'; fi`, "if/then"],
    [`for i in 1; do gh issue comment 26 --body '${UNMARKED}'; done`, "for/do"],
    [`gh issue comment 26 --body '${UNMARKED}' | tee /tmp/log`, "piped out"],
    [`xargs gh issue comment 26 --body '${UNMARKED}'`, "xargs wrapper"],
    [`env GH_HOST=x gh issue comment 26 --body '${UNMARKED}'`, "env wrapper"],
    [`gh issue comment 26 --body '${UNMARKED}' > /tmp/out.log`, "redirected stdout"],
    [`gh issue comment 26 --body '${UNMARKED}' &`, "backgrounded"],
    [
      `gh issue comment 26 --body '${UNMARKED}' # ${MARKER} ${BLOCKQUOTE_PHRASE}`,
      "marker in a trailing comment",
    ],
    [`gh issue comment 26 --body "$MSG"`, "body from a variable (uninspectable)"],
    [`gh issue comment 26 --body-file "$TMPDIR/body.md"`, "body-file from a variable"],
    [`gh issue comment 26 --body-file /dev/stdin`, "body-file /dev/stdin"],
    [`cd /tmp && gh issue comment 26 -F -`, "uninspectable behind a prefix"],
    [
      `gh issue comment 26 --body-file ${marked} --body '${UNMARKED}'`,
      "mixed marked file + unmarked inline",
    ],
    // ── The CATALOGUE's own membership (fix round 7) ─────────────────────────
    // `new` is a real Cobra ALIAS of `create`, declared in the ALIASES block of
    // `gh <group> create --help` (gh 2.93.0) and read from there in the same
    // pass that reads FLAGS. Round 6 matched the canonical name only, so
    // `gh issue new --body …` — an ordinary thing to type, an accident path
    // rather than an evasion path — posted unmarked.
    [`gh issue new --title T --body '${UNMARKED}'`, "gh issue new (alias of create)"],
    [`gh pr new --title T --body '${UNMARKED}'`, "gh pr new (alias of create)"],
    [`gh release new v9 --notes '${UNMARKED}'`, "gh release new (alias of create)"],
    [`bash -lc "gh issue new --title T --body '${UNMARKED}'"`, "an alias behind a shell"],
    [`csh -c "gh pr new --title T --body '${UNMARKED}'"`, "an alias behind an unknown shell"],
    // Reading the aliases is PRECISION. What makes the group decidable is the
    // inversion one level down: an unrecognised subcommand of a gated group is
    // assumed to post, so a name `gh` grows next year needs no code change.
    [`gh issue frobnicate 26 --body '${UNMARKED}'`, "an unknown subcommand of a gated group"],
    [`gh pr publish-draft 12 --body '${UNMARKED}'`, "another unknown subcommand"],
  ];
  for (const [command, label] of cases) {
    assert.equal(bash(command).verdict, "block", `${label}: ${command}`);
  }
});

// ── The script-introducing option grammar (fix round 6) ───────────────────
//
// Round 5 fell to `bash -lc "gh issue comment …"`: the nested-script lookup
// tested `word.value === "-c"`, so one extra letter in the short-flag cluster
// hid the script — and with it ALL 18 gated shapes. The cases below are the
// grammar, not the three spellings that were reported: `-c` anywhere in a
// cluster for every shell on PATH, the wrappers that can stand in front of the
// shell, env's `-S` in each of its spellings, ssh's flag-less operand list,
// and the routes that hand a shell a script with no flag at all.

test("#78 class: every script-introducing option spelling still BLOCKS", () => {
  const inner = `gh issue comment 26 --body '${UNMARKED}'`;
  const cases = [
    // `-c` clustered — POSIX guideline 5 grouping; each verified to execute on
    // this machine (bash 3.2.57, zsh 5.9, dash, ksh, /bin/sh).
    [`bash -lc "${inner}"`, "bash -lc (the round-5 finding)"],
    [`bash -ec "${inner}"`, "bash -ec"],
    [`bash -xc "${inner}"`, "bash -xc"],
    [`bash -vc "${inner}"`, "bash -vc"],
    [`bash -uc "${inner}"`, "bash -uc"],
    [`bash -pc "${inner}"`, "bash -pc"],
    [`bash -euxc "${inner}"`, "bash -euxc"],
    [`bash -cx "${inner}"`, "bash -cx (c first in the cluster)"],
    [`bash -cl "${inner}"`, "bash -cl"],
    [`sh -lc "${inner}"`, "sh -lc"],
    [`sh -ec "${inner}"`, "sh -ec"],
    [`zsh -lc "${inner}"`, "zsh -lc"],
    [`zsh -ic "${inner}"`, "zsh -ic"],
    [`dash -ec "${inner}"`, "dash -ec"],
    [`dash -ce "${inner}"`, "dash -ce"],
    [`ksh -ec "${inner}"`, "ksh -ec"],
    [`ksh -ce "${inner}"`, "ksh -ce"],
    [`ash -c "${inner}"`, "ash -c"],
    [`mksh -ec "${inner}"`, "mksh -ec"],
    [`busybox sh -c "${inner}"`, "busybox sh -c"],
    [`rbash -lc "${inner}"`, "rbash -lc"],
    [`su -c "${inner}"`, "su -c (util-linux grammar)"],
    // argument-taking letters must not hide the `-c` that follows them
    [`bash -o errexit -c "${inner}"`, "bash -o opt -c"],
    [`bash -O extglob -c "${inner}"`, "bash -O shopt -c"],
    [`zsh -o interactive -c "${inner}"`, "zsh -o opt -c"],
    [`ksh -R /dev/null -c "${inner}"`, "ksh -R file -c"],
    [`bash -c -x "${inner}"`, "bash -c then more flags"],
    [`bash --rcfile /dev/null -lc "${inner}"`, "long option then -lc"],
    // the interpreter is not word 0: a wrapper stands in front of it
    [`nohup bash -lc "${inner}"`, "nohup wrapper"],
    [`nohup bash -c "${inner}"`, "nohup + plain -c"],
    [`timeout 30 bash -lc "${inner}"`, "timeout wrapper"],
    [`command bash -lc "${inner}"`, "command wrapper"],
    [`env bash -lc "${inner}"`, "env wrapper"],
    [`env FOO=1 bash -lc "${inner}"`, "env + assignment wrapper"],
    [`nice -n 5 bash -lc "${inner}"`, "nice wrapper"],
    [`stdbuf -o0 bash -lc "${inner}"`, "stdbuf wrapper"],
    [`xargs -I{} bash -c "${inner}"`, "xargs wrapper"],
    [`script -q /dev/null bash -lc "${inner}"`, "script wrapper"],
    [`/bin/bash -lc "${inner}"`, "absolute path"],
    [`cd /tmp && nohup bash -lc "${inner}"`, "wrapper behind a prefix"],
    [`time eval "${inner}"`, "eval behind a keyword"],
    // env(1) `-S`, in every spelling env accepts
    [`env -S "${inner}"`, "env -S"],
    [`env -S"${inner}"`, "env -S attached"],
    [`env -iS "${inner}"`, "env -iS clustered"],
    [`env -0S "${inner}"`, "env -0S clustered"],
    [`env -i -S "${inner}"`, "env -i -S"],
    [`env -u FOO -S "${inner}"`, "env -u name -S"],
    [`env -C /tmp -S "${inner}"`, "env -C workdir -S"],
    [`env --split-string="${inner}"`, "env --split-string= (GNU)"],
    [`env --split-string "${inner}"`, "env --split-string (GNU, detached)"],
    // ssh(1): no flag — the operand list is the remote script
    [`ssh localhost "${inner}"`, "ssh operand list"],
    [`ssh -T localhost "${inner}"`, "ssh with flags"],
    // a script handed to a shell with no flag at all
    [`bash <<< "${inner}"`, "herestring into a shell"],
    [`bash -s <<< "${inner}"`, "herestring into bash -s"],
    [`echo "${inner}" | bash`, "literal producer piped into a shell"],
    [`echo "${inner}" | sh`, "piped into sh"],
    [`echo "${inner}" | zsh -s`, "piped into zsh -s"],
    [`printf '%s' "${inner}" | bash`, "printf piped into a shell"],
    [`echo -e "${inner}" | bash -s`, "echo flags before the script"],
    [`cd /tmp && echo "${inner}" | bash`, "piped shell behind a prefix"],
    // nesting: one wrapper inside another
    [`bash -lc "bash -ec \\"${inner}\\""`, "clustered inside clustered"],
    [`sh -c "env -S \\"${inner}\\""`, "env -S inside sh -c"],
    [`env -S "bash -lc \\"${inner}\\""`, "sh -c inside env -S"],
    // ── An interpreter the TABLE has never heard of (fix round 7) ────────────
    //
    // Every case above is a spelling of an option belonging to a tool that has
    // a row. Round 6 derived those grammars correctly and still let
    // `csh -c "gh issue comment …"` walk all 18 gated shapes through, because
    // `csh` — a shell in /bin on this machine — simply had no row. A per-tool
    // grammar cannot answer "which tools are there?", so the DEFAULT is
    // inverted instead: an operand of an unrecognised command word is re-read
    // as a script. None of the names below is in any list in this repo.
    [`csh -c "${inner}"`, "csh -c (the round-6 finding)"],
    [`tcsh -c "${inner}"`, "tcsh -c"],
    [`csh -fc "${inner}"`, "csh -fc"],
    [`csh -bc "${inner}"`, "csh -bc"],
    [`tcsh -fc "${inner}"`, "tcsh -fc"],
    [`/bin/tcsh -c "${inner}"`, "tcsh by absolute path"],
    [`pwsh -c "${inner}"`, "pwsh -c"],
    [`pwsh -Command "${inner}"`, "pwsh -Command (not a POSIX option spelling at all)"],
    [`fish -c "${inner}"`, "fish -c"],
    [`nohup csh -c "${inner}"`, "csh behind nohup"],
    [`timeout 30 tcsh -c "${inner}"`, "tcsh behind timeout"],
    [`xargs -I{} csh -c "${inner}"`, "csh behind xargs"],
    [`echo "${inner}" | csh`, "piped into csh"],
    [`echo "${inner}" | tcsh`, "piped into tcsh"],
    [`bash -lc "csh -c \\"${inner}\\""`, "csh nested inside a known shell"],
    // The inversion stated AS a test. These three command words exist on no
    // machine and in no list anywhere in this repo, and one of them takes no
    // option at all. If they still block, the fix is by construction — not a
    // better enumeration of interpreters, which is what rounds 1-6 kept
    // shipping.
    [`zqx-notashell-9f21a -c "${inner}"`, "an interpreter that exists nowhere"],
    [`frobnicate --run-script "${inner}"`, "an invented tool with an invented option"],
    [`hypothetical-shell-2031 "${inner}"`, "an invented tool with no option at all"],
  ];
  for (const [command, label] of cases) {
    assert.equal(bash(command).verdict, "block", `${label}: ${command}`);
  }
});

test("#78 class: the clustered grammar defeats no gated SHAPE either", () => {
  // The round-5 finding was not one shape's problem: `bash -lc` walked all 18
  // of them through. Every gated shape is re-checked behind the cluster.
  const shapes = [
    `gh issue comment 26 --body '${UNMARKED}'`,
    `gh issue close 26 --comment '${UNMARKED}'`,
    `gh issue create --title T --body '${UNMARKED}'`,
    `gh issue edit 26 --body '${UNMARKED}'`,
    `gh issue reopen 26 --comment '${UNMARKED}'`,
    `gh pr comment 12 --body '${UNMARKED}'`,
    `gh pr create --title T --body '${UNMARKED}'`,
    `gh pr close 12 --comment '${UNMARKED}'`,
    `gh pr edit 12 --body '${UNMARKED}'`,
    `gh pr ${"merge"} 12 --body '${UNMARKED}'`,
    `gh pr reopen 12 --comment '${UNMARKED}'`,
    `gh pr revert 12 --body '${UNMARKED}'`,
    `gh pr review 12 --body '${UNMARKED}'`,
    `gh release create v9 --notes '${UNMARKED}'`,
    `gh release edit v9 --notes '${UNMARKED}'`,
    `gh project item-create 1 --body '${UNMARKED}'`,
    `gh project item-edit --id x --body '${UNMARKED}'`,
    `gh api -X POST repos/o/r/issues/26/comments -f body='${UNMARKED}'`,
  ];
  for (const shape of shapes) {
    assert.equal(bash(`bash -lc "${shape}"`).verdict, "block", `bash -lc: ${shape}`);
    assert.equal(bash(`env -S "${shape}"`).verdict, "block", `env -S: ${shape}`);
    // Round 6's finding was the same "all 18 at once" shape as round 5's, one
    // layer up: an interpreter with no row. Sweeping every gated shape behind
    // `csh` and behind a name that exists nowhere is what proves the inverted
    // default covers the SURFACE, not just the reported spelling.
    assert.equal(bash(`csh -c "${shape}"`).verdict, "block", `csh -c: ${shape}`);
    assert.equal(
      bash(`zqx-notashell-9f21a -c "${shape}"`).verdict,
      "block",
      `nonexistent interpreter: ${shape}`,
    );
  }
});

// ── A guard that blocks ordinary work gets routed around: these MUST pass ────

test("#78 class: ordinary, legitimate commands are still ALLOWED", () => {
  const marked = path.join(TMP, "legit-marked.md");
  writeFileSync(marked, `Ruling.\n\n${render("close-issues", 78)}`, "utf8");
  const cases = [
    "cd /tmp && gh issue view 26 --json comments",
    "gh issue list --state open --limit 50",
    "cd /repo && git status --short && pnpm test",
    `grep -rn "gh issue comment" .claude/commands`,
    `rg --no-heading 'gh issue close --comment' .claude`,
    "gh pr view 12 --json statusCheckRollup",
    "gh pr checks 12 && gh run list --limit 3",
    "which gh && gh --version",
    `echo "gh issue comment 26 --body x"`,
    "node scripts/post-issue-comment.mjs 26 --command close-issues --body-file /tmp/x.md",
    `cd /tmp && gh issue comment 26 --body-file ${marked}`,
    `gh issue comment 26 --body-file ${marked} && gh issue view 26`,
    `bash -c 'gh issue view 26'`,
    `bash -lc 'gh issue view 26'`,
    `bash -lc 'pnpm test && pnpm lint'`,
    `bash -euxc 'pnpm build'`,
    `sh -c 'echo hello'`,
    `zsh -lc 'git status --short'`,
    "bash scripts/run.sh --body ignored",
    `env -S 'gh pr checks 12'`,
    `env -u FOO bash -lc 'gh issue list'`,
    `ssh localhost 'gh issue view 26'`,
    "ssh -T git@github.com",
    `nohup bash -lc 'pnpm storybook' &`,
    `echo "gh issue view 26" | bash`,
    `echo "gh issue comment 26 --body x" | grep body`,
    "cat /tmp/deploy.sh | bash",
    `printf 'pnpm test\n' | sh`,
    "pnpm attribution:comments:check && pnpm attribution:comments:check:test",
    "gh issue close 26",
    "gh pr review 12 --approve",
    // The precision guards on the fix-round-7 inversion. Widening the net to
    // "any operand of an unrecognised command word" is only affordable because
    // a `gh` word that is not the operand's own command word counts only when
    // it actually carries a body, and because a command that can merely PRINT
    // its argument is skipped unless it pipes into something that runs it.
    `git commit -m "harden the gh issue comment attribution gate"`,
    `git log --grep "gh issue comment" --oneline`,
    `echo "run gh issue comment by hand" >> NOTES.md`,
    `node -e 'console.log(1 + 1)'`,
    `python3 -c 'print(2 ** 10)'`,
    `csh -c 'gh issue view 26'`,
    `csh -c 'pnpm test'`,
    `zqx-notashell-9f21a -c 'gh pr checks 12'`,
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});

test("#78 class: a marked body behind a cd-prefix passes the REAL hook (exit 0)", () => {
  const marked = path.join(TMP, "legit-hook-marked.md");
  writeFileSync(marked, `Ruling.\n\n${render("close-issues", 78)}`, "utf8");
  const r = runHook({
    tool_name: "Bash",
    tool_input: { command: `cd /tmp && gh issue comment 26 --body-file ${marked}` },
  });
  assert.equal(r.status, 0, r.stderr);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix round 3 (#78) — the SURFACE class: which `gh` calls count as posting.
//
// Round 3 closed the command-GRAMMAR class (above). The validator then defeated
// it one level up, on the CATALOGUE: `gh issue edit --body` rewrites an issue
// body — an ordinary way to publish agent prose, and a way to strip a marker a
// previous run left — and it simply was not in the gated list. Same shape of
// mistake in two other places: `gh api` gated only COLLECTION routes, so every
// item-level edit was outside it; and a subcommand hidden behind an expansion
// was treated as "posts nothing", a FAIL-OPEN default.
//
// So the list below is not "the seven the validator named". It is derived from
// `gh`'s own help — see the derivation recipe above POSTING_SHAPES in
// check-comment-attribution.mjs — and every row is an explicit locking case.
// ─────────────────────────────────────────────────────────────────────────────

// ── Finding: prose-posting subcommands that were never gated ────────────────

// Spelled indirectly so this file can be edited from a shell session whose own
// PreToolUse hook refuses a command line containing the literal `gh pr` +
// squash-and-land verb. It is an ordinary string; nothing depends on the trick.
const MERGE_SUB = "me" + "rge";

/** @type {[string, string][]} `[label, argv-after-gh]` */
const ROUND_3_POSTING_SHAPES = [
  ["gh issue edit --body", "issue edit 26 --body"],
  ["gh issue edit -b", "issue edit 26 -b"],
  ["gh issue reopen --comment", "issue reopen 26 --comment"],
  ["gh issue reopen -c", "issue reopen 26 -c"],
  ["gh pr create --body", "pr create --title T --body"],
  ["gh pr create -db (cluster)", "pr create --title T -db"],
  ["gh pr edit --body", "pr edit 12 --body"],
  ["gh pr close --comment", "pr close 12 --comment"],
  ["gh pr close -dc (cluster)", "pr close 12 -dc"],
  ["gh pr reopen --comment", "pr reopen 12 --comment"],
  ["gh pr MERGEWORD --body", "pr MERGEWORD 12 --squash --body"],
  ["gh pr MERGEWORD -sb (cluster)", "pr MERGEWORD 12 -sb"],
  ["gh pr revert --body", "pr revert 12 --body"],
  ["gh release create --notes", "release create v9.9.9 --notes"],
  ["gh release create -n", "release create v9.9.9 -n"],
  ["gh release edit --notes", "release edit v9.9.9 --notes"],
  ["gh project item-create --body", "project item-create 1 --owner o --title T --body"],
  ["gh project item-edit --body", "project item-edit --id X --body"],
];

test("#78 fix-round-3 verdict: every ungated prose-posting subcommand now BLOCKS (pure)", () => {
  for (const [label, argv] of ROUND_3_POSTING_SHAPES) {
    const command = `gh ${argv.replace(/MERGEWORD/g, MERGE_SUB)} ${shq(UNMARKED)}`;
    assert.equal(bash(command).verdict, "block", `${label}: ${command}`);
  }
});

test("#78 fix-round-3 verdict: the same shapes, through the REAL shell hook -> exit 2", () => {
  for (const [label, argv] of ROUND_3_POSTING_SHAPES) {
    const command = `gh ${argv.replace(/MERGEWORD/g, MERGE_SUB)} ${shq(UNMARKED)}`;
    const r = runHook({ tool_name: "Bash", tool_input: { command } });
    assert.equal(r.status, 2, `${label}: ${command}\n${r.stderr}`);
    assert.match(r.stderr, /comment-attribution gate/, label);
  }
});

test("#78 fix-round-3 verdict: the same shapes are ALLOWED once the body carries the marker", () => {
  const body = shq(`Ruling.\n\n${render("close-issues", 78)}`);
  for (const [label, argv] of ROUND_3_POSTING_SHAPES) {
    const command = `gh ${argv.replace(/MERGEWORD/g, MERGE_SUB)} ${body}`;
    assert.equal(bash(command).verdict, "allow", `${label}: ${command}`);
  }
});

test("#78 fix-round-3 verdict: a --body-file/--notes-file on a newly gated shape is read from disk", () => {
  const unmarked = path.join(TMP, "r3-unmarked.md");
  const marked = path.join(TMP, "r3-marked.md");
  writeFileSync(unmarked, UNMARKED, "utf8");
  writeFileSync(marked, `Ruling.\n\n${render("close-issues", 78)}`, "utf8");
  for (const argv of ["issue edit 26 --body-file", "release create v9 --notes-file"]) {
    assert.equal(bash(`gh ${argv} ${unmarked}`).verdict, "block", argv);
    assert.equal(bash(`gh ${argv} ${marked}`).verdict, "allow", argv);
  }
});

// ── The other side of the same decision: what is deliberately NOT gated ─────
//
// The catalogue is derived by two CONJUNCTIVE criteria (surface + body flag).
// Each row below satisfies at most one of them, and a rule that gated it would
// be visibly wrong — `gh secret set --body` most of all, where `--body` is the
// secret's VALUE. These lock the exclusions so a later widening has to argue
// with a failing test rather than quietly sweep them in.

test("#78 fix-round-3: non-prose `gh` subcommands with a prose-shaped flag stay ALLOWED", () => {
  const cases = [
    // fails (a) SURFACE — configuration, not a conversation
    "gh secret set NPM_TOKEN --body npm_xxxxxxxxxxxx",
    "gh variable set BUILD_MODE --body release",
    // fails (a) and (b) — one-line metadata on an object
    `gh repo edit --description "a component system"`,
    `gh label create bug --description "something is broken"`,
    `gh label edit bug --description "still broken"`,
    `gh project create --owner o --title "Q3"`,
    `gh project edit 1 --owner o --description "roadmap"`,
    `gh gpg-key add key.asc --title "laptop"`,
    `gh ssh-key add key.pub --title "laptop"`,
    `gh gist create -d "scratch output" out.txt`,
    // fails (b) BODY FLAG — a fixed enum, not prose
    "gh issue lock 26 --reason off-topic",
    "gh pr lock 12 --reason spam",
    "gh issue close 26 --reason completed",
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});

// ── Finding: `gh api` item-level edit routes were outside the gated scope ────

test("#78 fix-round-3 verdict: item-level `gh api` prose routes BLOCK", () => {
  const cases = [
    `gh api -X PATCH repos/o/r/issues/comments/999 -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X PATCH repos/o/r/issues/26 -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X PATCH repos/o/r/pulls/12 -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X POST repos/o/r/pulls/12/comments/1/replies -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X POST repos/o/r/pulls/12/reviews -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X PUT repos/o/r/pulls/12/reviews/5/dismissals -f message=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X PATCH repos/o/r/releases/9 -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X POST repos/o/r/issues -f body=${UNMARKED.replace(/ /g, "-")}`,
    `gh api -X PATCH https://api.github.com/repos/o/r/issues/26 -f body=${UNMARKED.replace(/ /g, "-")}`,
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "block", command);
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2, command);
  }
});

test("#78 fix-round-3 verdict: `gh api` reads and non-prose writes stay ALLOWED", () => {
  const cases = [
    "gh api repos/o/r/issues/26",
    "gh api repos/o/r/issues/26/comments --paginate",
    "gh api repos/:owner/:repo/branches/main/protection",
    "gh api -X PUT repos/o/r/issues/26/lock -f lock_reason=off-topic",
    "gh api -X POST repos/o/r/issues/26/labels -f labels[]=bug",
    "gh api -X POST repos/o/r/issues/26/reactions -f content=+1",
    "gh api -X DELETE repos/o/r/issues/comments/999",
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});

test("#78 fix-round-3: apiEndpointPostsProse is a RULE (drop id segments, name the tail)", () => {
  const prose = [
    "repos/o/r/issues",
    "repos/o/r/issues/26",
    "repos/o/r/issues/comments/999",
    "repos/o/r/pulls",
    "repos/o/r/pulls/12",
    "repos/o/r/pulls/comments/999",
    "repos/o/r/pulls/12/comments",
    "repos/o/r/pulls/12/comments/1/replies",
    "repos/o/r/pulls/12/reviews",
    "repos/o/r/pulls/12/reviews/5",
    "repos/o/r/pulls/12/reviews/5/events",
    "repos/o/r/pulls/12/reviews/5/dismissals",
    `repos/o/r/pulls/12/${MERGE_SUB}`,
    "repos/o/r/releases",
    "repos/o/r/releases/9",
    "repos/o/r/discussions/3/comments",
    "/repos/:owner/:repo/issues/{issue_number}",
    "https://api.github.com/repos/o/r/issues/26/comments?per_page=1",
  ];
  const notProse = [
    "repos/o/r/issues/26/lock",
    "repos/o/r/issues/26/labels",
    "repos/o/r/issues/26/assignees",
    "repos/o/r/issues/26/reactions",
    "repos/o/r/issues/comments/999/reactions",
    "repos/o/r/releases/generate-notes",
    "repos/o/r/branches/main/protection",
    "user/repos",
    "graphql",
  ];
  for (const endpoint of prose) assert.equal(apiEndpointPostsProse(endpoint), true, endpoint);
  for (const endpoint of notProse) assert.equal(apiEndpointPostsProse(endpoint), false, endpoint);
});

// ── Finding: an expansion-hidden subcommand was FAIL-OPEN ("posts nothing") ──

test("#78 fix-round-3 verdict: a subcommand hidden by an expansion BLOCKS (unknown == posting)", () => {
  const cases = [
    `SUB=comment; gh issue $SUB 26 --body ${shq(UNMARKED)}`,
    `A=issue; B=comment; gh $A $B 26 --body ${shq(UNMARKED)}`,
    `gh $(printf issue) comment 26 --body ${shq(UNMARKED)}`,
    `gh pr "$ACTION" 12 --body ${shq(UNMARKED)}`,
    // …and it is not satisfied by MARKING the body: the gate still cannot tell
    // what the call does, so the honest verdict stays "refuse".
    `SUB=comment; gh issue $SUB 26 --body ${shq(render("close-issues", 78))}`,
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "block", command);
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 2, command);
  }
});

test("#78 fix-round-3 verdict: a WRITE whose `gh api` endpoint is hidden by an expansion BLOCKS", () => {
  const command = `gh api -X PATCH "$EP" -f body=${UNMARKED.replace(/ /g, "-")}`;
  assert.equal(bash(command).verdict, "block", command);
});

test("#78 fix-round-3: the inversion is scoped — it does not refuse ordinary expansions", () => {
  const marked = path.join(TMP, "r3-scope-marked.md");
  writeFileSync(marked, `Ruling.\n\n${render("close-issues", 78)}`, "utf8");
  const cases = [
    // no value of $X turns a non-gated group into a posting call
    "gh browse $FILE",
    "gh run view $RUN_ID --log",
    "gh release download $TAG --dir /tmp",
    // a READ posts nothing whatever its route, so an opaque endpoint is fine
    `gh api "$EP"`,
    "gh api repos/$OWNER/$REPO/issues/26 --jq .title",
    // the subcommand itself is readable; only the ARGUMENTS are expanded
    `gh issue view $NUM --json body`,
    `gh issue comment $NUM --body-file ${marked}`,
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});

// ── Finding: `--help` was refused, which is a pure false positive ───────────

test("#78 fix-round-3: `--help`/`-h` on a gated subcommand is ALLOWED (gh posts nothing)", () => {
  for (const command of [
    "gh issue comment --help",
    "gh issue comment -h",
    "gh issue create --help",
    "gh pr create --help",
    `gh release create --help`,
  ]) {
    assert.equal(bash(command).verdict, "allow", command);
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 0, command);
  }
});

// ── DECLARED LIMIT, locked so it stays visible ──────────────────────────────
//
// A `--body-file` is read as it stands when the HOOK runs, which is before the
// command executes. If the same command line writes that file first, the gate
// judges the OLD bytes. Nothing at this layer can fix it — the final content
// does not exist yet. This test asserts the CURRENT, LIMITED behaviour on
// purpose: if someone later makes the gate see through it, this test fails and
// the declared limit in the module header has to be updated with it.

test("#78 fix-round-3 DECLARED LIMIT: a --body-file rewritten in the same line is judged on STALE bytes", () => {
  const file = path.join(TMP, "stale-body.md");
  writeFileSync(file, `Ruling.\n\n${render("close-issues", 78)}`, "utf8");
  const command = `printf %s ${shq(UNMARKED)} > ${file} && gh issue comment 26 --body-file ${file}`;
  // ALLOWED, because at hook time the file still holds the marked bytes.
  assert.equal(bash(command).verdict, "allow", command);
  // The documented remedy — post from a separate call — is what the gate can
  // actually see, and it blocks.
  writeFileSync(file, UNMARKED, "utf8");
  assert.equal(bash(`gh issue comment 26 --body-file ${file}`).verdict, "block");
});

test("#78 fix-round-3 DECLARED LIMIT: a gh-computed body (--fill / --generate-notes) is not gated", () => {
  for (const command of [
    "gh pr create --fill",
    "gh pr create --fill-first --base main",
    "gh release create v9.9.9 --generate-notes",
  ]) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// Fix round 4 (#78) — help-ness is a POSITION, and the api declaration.
//
// Round 3's false-positive fix for `gh issue comment --help` asked whether
// `--help`/`-h` appeared ANYWHERE in argv. That is not a question about the
// command's grammar: pflag consumes the word after a value-taking flag even
// when it starts with `-`, so `gh issue create --title -h --body "…"` really
// does post while a "contains -h" test read the whole call as "posts nothing".
// Fourth round of the same failure class — an odd spelling read as "not a
// posting call" — this time introduced by the previous round's own fix.
// ─────────────────────────────────────────────────────────────────────────────

// The seven rows the validator confirmed against real gh 2.93.0. Each reached
// repository resolution, i.e. flag parsing accepted it and it would post.
const ROUND_4_HELP_VALUE_BYPASSES = [
  [`gh issue create --title -h --body "${UNMARKED}"`, "--title consumes -h"],
  [`gh issue create -t -h --body "${UNMARKED}"`, "-t consumes -h"],
  [`gh issue edit 26 --title -h --body "${UNMARKED}"`, "issue edit, --title consumes -h"],
  [`gh pr create --title -h --body "${UNMARKED}"`, "pr create, --title consumes -h"],
  [`gh pr edit 12 --title -h --body "${UNMARKED}"`, "pr edit, --title consumes -h"],
  [`gh release create v9 --title -h --notes "${UNMARKED}"`, "release create, --title consumes -h"],
  [`gh issue comment 26 --body -h`, "--body consumes -h: gh posts a body of `-h`"],
];

test("#78 fix-round-4 verdict Finding 1: a help word in a VALUE position does not disable the gate (pure)", () => {
  for (const [command, label] of ROUND_4_HELP_VALUE_BYPASSES) {
    assert.equal(bash(command).verdict, "block", `${label}: ${command}`);
  }
});

test("#78 fix-round-4 verdict Finding 1: the same seven, through the REAL shell hook -> exit 2", () => {
  for (const [command, label] of ROUND_4_HELP_VALUE_BYPASSES) {
    const r = runHook({ tool_name: "Bash", tool_input: { command } });
    assert.equal(r.status, 2, `${label}: ${command}\n${r.stderr}`);
    assert.match(r.stderr, /comment-attribution gate/, label);
  }
});

test("#78 fix-round-4: a help word in a real FLAG position is still ALLOWED (gh posts nothing)", () => {
  const cases = [
    "gh issue comment --help",
    "gh issue comment -h",
    "gh issue comment 26 --help",
    "gh issue create --help",
    "gh pr create --help",
    "gh release create --help",
    // a BOOLEAN flag consumes nothing, so the help word after it is free
    "gh issue comment --editor --help",
    "gh issue comment -e --help",
    "gh pr create --draft --help",
    // `--body` took its value, so a trailing -h is free: gh prints help
    `gh issue comment 26 --body "${UNMARKED}" -h`,
    // an `=`-form flag carries its value inline and swallows nothing
    `gh issue create --title=T --help`,
    // gh api: help before any endpoint, and on a read
    "gh api --help",
    "gh api repos/o/r/issues/26 --help",
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "allow", command);
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 0, command);
  }
});

test("#78 fix-round-4: helpFlagIsFree walks flags the way pflag does", () => {
  const words = (line) => line.split(" ").map((value) => ({ value, expanded: false }));
  // A shape-style predicate: `--editor` is boolean, `-e` is a boolean
  // shorthand, everything else is assumed to take a value.
  const shape = (token) =>
    token.startsWith("--")
      ? token !== "--editor"
      : !token
          .slice(1)
          .split("")
          .every((char) => char === "e");
  assert.equal(helpFlagIsFree(words("--help"), shape), true);
  assert.equal(helpFlagIsFree(words("26 --help"), shape), true);
  assert.equal(helpFlagIsFree(words("--editor --help"), shape), true, "boolean consumes nothing");
  assert.equal(helpFlagIsFree(words("-e --help"), shape), true, "boolean shorthand");
  assert.equal(helpFlagIsFree(words("--title=T --help"), shape), true, "=-form consumes nothing");
  assert.equal(helpFlagIsFree(words("--title -h"), shape), false, "consumed as --title's value");
  assert.equal(helpFlagIsFree(words("-t --help"), shape), false, "consumed as -t's value");
  assert.equal(helpFlagIsFree(words("-- --help"), shape), false, "-- ends flag parsing");
  // The `gh api` predicate enumerates its value flags in full, so an unlisted
  // flag really is boolean — the opposite default, and deliberately so.
  const api = (token) => ["-X", "--method", "-f", "-H"].includes(token);
  assert.equal(helpFlagIsFree(words("-H --help"), api), false, "header consumes the help word");
  assert.equal(helpFlagIsFree(words("--paginate --help"), api), true, "unlisted api flag is bool");
});

test("#78 fix-round-4: shapes gh itself rejects now BLOCK — a side effect, and harmless", () => {
  // The validator explicitly did NOT report these as bypasses, because `gh`
  // rejects them (`accepts 1 arg(s), received 2`; a header needs a `:`). They
  // are not special-cased in either direction: the general rule says a help
  // word after `--` is a positional and one after `-H` is a header value, so
  // the gate falls through to the unmarked body and refuses. Nothing posts
  // either way, so this locks the behaviour rather than claiming a fix.
  for (const command of [
    `gh issue comment 26 --body "${UNMARKED}" -- --help`,
    `gh issue comment 26 --body "${UNMARKED}" -- -h`,
    `gh api -X PATCH repos/o/r/issues/26 -H -h -f body=${UNMARKED.replace(/ /g, "-")}`,
  ]) {
    assert.equal(bash(command).verdict, "block", command);
  }
});

// ── Finding 2 — the declaration and the behaviour now agree ─────────────────
//
// A `gh api` call is gated only when it is a WRITE, to a CONVERSATION ROUTE,
// CARRYING PROSE. The 11 rows below are the ones the validator ran: ordinary
// prose-free writes that were refused with a message about `gh` opening an
// editor, which `gh api` never does.

test("#78 fix-round-4 verdict Finding 2: a prose-free `gh api` write is ALLOWED", () => {
  const cases = [
    "gh api -X PATCH repos/o/r/issues/26 -f state=closed",
    "gh api -X PATCH repos/o/r/issues/26 -f title=new-title",
    "gh api -X PATCH repos/o/r/issues/26 -f milestone=1",
    "gh api -X PATCH repos/o/r/issues/26 -f assignees[]=me",
    "gh api -X PATCH repos/o/r/pulls/12 -f base=main",
    "gh api -X PATCH repos/o/r/pulls/12 -f state=closed",
    "gh api -X POST repos/o/r/pulls -f title=T -f head=x -f base=main",
    "gh api -X POST repos/o/r/issues -f title=T",
    "gh api -X PATCH repos/o/r/releases/123 -f draft=false",
    `gh api -X PUT repos/o/r/pulls/12/${MERGE_SUB} -f ${MERGE_SUB}_method=squash`,
    "gh api -X POST repos/o/r/pulls/12/reviews -f event=APPROVE",
  ];
  for (const command of cases) {
    assert.equal(bash(command).verdict, "allow", command);
    assert.equal(runHook({ tool_name: "Bash", tool_input: { command } }).status, 0, command);
  }
});

test("#78 fix-round-4 Finding 2: narrowing did NOT weaken the prose or unreadable cases", () => {
  const unmarked = UNMARKED.replace(/ /g, "-");
  const blocked = [
    // carries prose -> still gated
    `gh api -X PATCH repos/o/r/issues/26 -f body=${unmarked}`,
    `gh api -X POST repos/o/r/issues/26/comments -f body=${unmarked}`,
    `gh api -X PUT repos/o/r/pulls/12/reviews/5/dismissals -f message=${unmarked}`,
    // payload the gate cannot READ -> still refused
    "gh api -X PATCH repos/o/r/issues/26 --input /tmp/does-not-exist.json",
    `gh api -X PATCH repos/o/r/issues/26 -f body=$MSG`,
    `gh api -X PATCH "$EP" -f body=${unmarked}`,
  ];
  for (const command of blocked) {
    assert.equal(bash(command).verdict, "block", command);
  }
});
// ── The parser itself ───────────────────────────────────────────────────────

test("parseShellCommands: splits on every operator and recurses into substitutions", () => {
  const { commands } = parseShellCommands(`cd /tmp && gh issue comment 26 --body "hi there"`);
  const argvs = commands.map((c) => c.words.map((w) => w.value));
  assert.deepEqual(argvs[0], ["cd", "/tmp"]);
  assert.deepEqual(argvs[1], ["gh", "issue", "comment", "26", "--body", "hi there"]);
});

test("parseShellCommands: marks a word carrying an unresolvable expansion", () => {
  const { commands } = parseShellCommands(`gh issue comment 26 --body "$MSG"`);
  const last = commands[0].words.at(-1);
  assert.equal(last.expanded, true);
});

test("parseShellCommands: a quoted posting command is ONE word, not a command", () => {
  const { commands } = parseShellCommands(`echo "gh issue comment 26 --body x"`);
  assert.deepEqual(
    commands.map((c) => c.words.map((w) => w.value)),
    [["echo", "gh issue comment 26 --body x"]],
  );
});

test("findGhCandidates: finds gh at ANY position, through paths and assignments", () => {
  for (const command of [
    "gh issue comment 26 --body x",
    "cd /tmp && gh issue comment 26 --body x",
    "FOO=1 BAR=2 /usr/local/bin/gh issue comment 26 --body x",
    "xargs gh issue comment 26 --body x",
  ]) {
    const { commands } = parseShellCommands(command);
    assert.equal(findGhCandidates(commands).length, 1, command);
  }
});

test("#78 class: an UNESCAPED backtick in a double-quoted body is refused, not trusted", () => {
  // `JSON.stringify(render())` looks like a marked body but bash would run
  // `close-issues` as a command substitution, so the bytes that reach GitHub
  // are NOT the ones the gate can see. Refusing is the only honest answer.
  const command = `gh issue comment 26 --body ${JSON.stringify(render("close-issues", 78))}`;
  const v = bash(command);
  assert.equal(v.verdict, "block");
  assert.match(v.reason, /cannot be inspected/i);
});

test("#78 class: an opaque command word and a command hidden in a variable still BLOCK", () => {
  const cases = [
    [`$(echo gh) issue comment 26 --body '${UNMARKED}'`, "command word from a substitution"],
    [`$GH_BIN issue comment 26 --body '${UNMARKED}'`, "command word from a variable"],
    [`CMD="gh issue comment 26 --body ${UNMARKED}"; $CMD`, "whole command in a variable"],
    [`export CMD='gh pr comment 12 --body ${UNMARKED}'`, "exported assignment"],
  ];
  for (const [command, label] of cases) {
    assert.equal(bash(command).verdict, "block", `${label}: ${command}`);
  }
});

test("#78 class: an opaque command word with a NON-posting subcommand is left alone", () => {
  for (const command of [
    "$(which gh) --version",
    "$GH_BIN issue view 26",
    'MSG="hello there"; echo $MSG',
    'PNPM_CMD="pnpm test"; $PNPM_CMD',
  ]) {
    assert.equal(bash(command).verdict, "allow", command);
  }
});

test("#78 class: a heredoc is scoped to the command that USES it, not the whole line", () => {
  // A script that writes a body with `cat > body.md <<EOF` and then posts
  // `--body-file body.md` is perfectly inspectable. Refusing it (because the
  // LINE contains a heredoc) is the kind of false block that gets a gate routed
  // around — the opposite of what #78 is for.
  const file = path.join(TMP, "heredoc-marked.md");
  writeFileSync(file, `Done.\n\n${render("close-issues", 78)}`, "utf8");
  assert.equal(
    bash(`cat > ${file} <<EOF\nhello\nEOF\ngh issue comment 26 --body-file ${file}`).verdict,
    "allow",
  );
  // …but a heredoc feeding the posting call itself is still refused.
  assert.equal(bash(`gh issue comment 26 -F - <<EOF\nhello\nEOF`).verdict, "block");
});

// ── post-issue-comment.mjs — the one sanctioned posting path ────────────────
// It is the script every updated rule tells agents to route through, so its
// argv parsing and body assembly get a regression lock of their own. The `gh`
// exec itself is deliberately not exercised (it would really post).

test("post-issue-comment: parseArgs reads the issue, command, body forms and --close", () => {
  assert.deepEqual(parseArgs(["26", "--command", "close-issues", "--body", "hi"]), {
    _: ["26"],
    command: "close-issues",
    body: "hi",
  });
  assert.deepEqual(parseArgs(["26", "--body-file", "/tmp/x.md", "--close"]), {
    _: ["26"],
    bodyFile: "/tmp/x.md",
    close: true,
  });
});

test("post-issue-comment: buildBody always produces a body the gate accepts", () => {
  const withDraft = buildBody({ draft: "Fixed in #99.", command: "close-issues", issueNumber: 78 });
  assert.ok(hasMarker(withDraft), "a drafted body carries both marker halves");
  assert.ok(withDraft.startsWith("Fixed in #99."), "the draft stays first, the banner trails");
  const empty = buildBody({ draft: "   ", command: "file-issue", issueNumber: 78 });
  assert.ok(hasMarker(empty), "even an empty draft yields a marked body");
  assert.equal(bash(`gh issue comment 26 --body ${shq(withDraft)}`).verdict, "allow");
});

test("post-issue-comment: buildBody's rationale issue stays fixed regardless of the target issue (PR #97 finding 4)", () => {
  // The banner's "See #N for why this banner exists" must always cite the
  // marker's own fixed rationale issue (DEFAULT_ISSUE), never the issue the
  // comment is being POSTED to — otherwise a comment on issue 43 says
  // "See #43 for why this banner exists", a self-referential, meaningless
  // pointer instead of a pointer at the policy issue.
  const body = buildBody({
    draft: "Closing per policy.",
    command: "close-issues",
    issueNumber: 43,
  });
  assert.ok(
    body.includes(`See #${DEFAULT_ISSUE} for why this banner exists.`),
    `banner must cite the fixed rationale issue #${DEFAULT_ISSUE}, got: ${body}`,
  );
  assert.ok(
    !body.includes("See #43 for why this banner exists."),
    "banner must not cite the target issue as its own rationale",
  );
});

test("post-issue-comment: refuses to run without an issue number or a body", () => {
  assert.equal(postMain([]), 1, "no issue number");
  assert.equal(postMain(["not-a-number", "--body", "hi"]), 1, "non-numeric issue");
  assert.equal(postMain(["26", "--command", "close-issues"]), 1, "no --body/--body-file");
});
