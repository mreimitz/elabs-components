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

import { MARKER, BLOCKQUOTE_PHRASE, hasMarker, render } from "./lib/comment-attribution.mjs";
import {
  shellSplit,
  isUninspectableBashCommand,
  matchBashPostingShape,
  resolveBashBody,
  resolveMcpBody,
  evaluateHookPayload,
  POSTING_RE,
  HELPER_REFERENCE_RE,
  findUnguardedPostingSites,
  scannedFilesRung2,
  findWiringViolations,
} from "./check-comment-attribution.mjs";

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
    tool_input: { command: `gh issue comment 26 --body ${JSON.stringify(body)}` },
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

test("hook: a non-tool-name it does not recognize is left alone", () => {
  const r = runHook({ tool_name: "Read", tool_input: { file_path: "/tmp/x" } });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim(), "");
});
