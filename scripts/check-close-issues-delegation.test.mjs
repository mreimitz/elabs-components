// check-close-issues-delegation.test.mjs — self-test for
// .claude/hooks/close-issues-delegation-nudge.sh
// -----------------------------------------------------------------------------
// The hook is the runtime half of .claude/commands/close-issues.md ▸ "The
// delegation contract". A hook that silently stops firing is worse than none, so
// this plants fixture transcripts (JSONL, the on-disk shape the hook reads) and
// asserts the exact behaviour on every branch: the four violation clauses, the
// compliant run, the not-a-close-issues-session case, the loop guard, and the
// `--ledger` reporting mode.
//
// The fixtures deliberately carry the noise a synthetic transcript would otherwise
// omit — the injected `type:"attachment"` command roster (which NAMES close-issues
// in every session in this project, and is what a naive whole-file grep would match
// on), assistant prose quoting the command, and a sidechain turn (a subagent
// dispatching its own helper is not an orchestrator failure). None of those may
// change a verdict. The session-cadence hook shipped dead twice for exactly these
// reasons; a synthetic-only fixture is what let it pass its own gate.
//
// Run: node --test scripts/check-close-issues-delegation.test.mjs
//      (pnpm close-issues:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(HERE, "../.claude/hooks/close-issues-delegation-nudge.sh");

/** The slash-command envelope Claude Code writes into the invoking USER turn. */
const INVOCATION = JSON.stringify({
  type: "user",
  message: {
    role: "user",
    content:
      "<command-message>close-issues</command-message>\n<command-name>/close-issues</command-name>\n<command-args>--only consumer-handover</command-args>",
  },
});

/** Harness noise present in EVERY real session: the roster naming this command. */
const ROSTER = JSON.stringify({
  type: "attachment",
  message: {
    role: "user",
    content: [
      {
        type: "text",
        text: "<command-name>/close-issues</command-name> — Run a cost-aware, evidence-first loop that closes open GitHub issues",
      },
    ],
  },
});

/** Assistant prose that merely TALKS about running the command. */
const PROSE = JSON.stringify({
  type: "assistant",
  message: {
    role: "assistant",
    content: [{ type: "text", text: "I could run /close-issues here, but I will not." }],
  },
});

/** One assistant turn dispatching `models.length` agents (all in this one message). */
function dispatch(models) {
  return JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: models.map((model, i) => ({
        type: "tool_use",
        id: `t${Math.random().toString(36).slice(2)}${i}`,
        name: "Agent",
        input: {
          subagent_type: "general-purpose",
          description: "unit",
          prompt: "x",
          ...(model === null ? {} : { model }),
        },
      })),
    },
  });
}

/** One assistant turn that edited `files`. */
function edits(files, { sidechain = false } = {}) {
  return JSON.stringify({
    type: "assistant",
    isSidechain: sidechain,
    message: {
      role: "assistant",
      content: files.map((f) => ({ type: "tool_use", name: "Edit", input: { file_path: f } })),
    },
  });
}

/**
 * A Claude Code memory file, which lives under the operator's HOME directory —
 * the shape the hook must classify as NOT-source (`~/.claude/projects/<p>/memory/…`).
 *
 * ASSEMBLED AT RUNTIME on purpose. `pnpm machine-paths:check` (#203) scans committed
 * source for `/Users/<name>/…` and `/home/<name>/…` literals, and it is right to: a
 * hardcoded home path in a tracked file breaks on every other machine. This is test
 * DATA the hook must reason about, not a path anything opens, so the fixture keeps the
 * exact string the hook sees while the literal never appears in the file. (The two
 * files already on that gate's IGNORE list solve the same problem with an exemption;
 * building the string keeps this file INSIDE the gate's coverage instead.)
 */
const HOME_MEMORY_FILE = ["", "home", "u", ".claude", "projects", "p", "memory", "note.md"].join(
  "/",
);

let dir;
function transcript(lines) {
  dir ??= mkdtempSync(path.join(tmpdir(), "close-issues-hook-"));
  const file = path.join(dir, `t${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

function run(file, { active = false } = {}) {
  return spawnSync("bash", [HOOK], {
    input: JSON.stringify({ transcript_path: file, stop_hook_active: active }),
    encoding: "utf8",
  });
}

process.on("exit", () => dir && rmSync(dir, { recursive: true, force: true }));

// --- The violation clauses -------------------------------------------------------

test("SERIAL: 3+ dispatches, never more than one per message", () => {
  const r = run(
    transcript([
      ROSTER,
      INVOCATION,
      dispatch(["sonnet"]),
      dispatch(["sonnet"]),
      dispatch(["haiku"]),
    ]),
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /SERIAL: 3 dispatches/);
  assert.doesNotMatch(r.stderr, /NO CHEAP TIER/);
});

test("SOURCE EDIT: orchestrator edits product source (worktree copies count)", () => {
  const r = run(
    transcript([
      INVOCATION,
      dispatch(["sonnet", "haiku"]),
      edits([
        "/repo/.claude/worktrees/fix-main/packages/cli/lib/app-spec.mjs",
        "/repo/packages/ui/src/components/button/button.tsx",
      ]),
    ]),
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /SOURCE EDIT: the orchestrator edited 2 product file/);
});

test("briefs, scratchpad, memory and docs are NOT source edits", () => {
  const r = run(
    transcript([
      INVOCATION,
      dispatch(["sonnet", "haiku"]),
      edits([
        "/tmp/scratchpad/CODER-CONTRACT.md",
        "/repo/.claude/scratch/close-issues/run1/unit-brief.md",
        HOME_MEMORY_FILE,
        "/repo/docs/ADR/0021-x.md",
        "/repo/CHANGELOG.md",
      ]),
    ]),
  );
  assert.equal(r.status, 0, r.stderr);
});

test("a SIDECHAIN (subagent) editing source is not an orchestrator failure", () => {
  const r = run(
    transcript([
      INVOCATION,
      dispatch(["sonnet", "haiku"]),
      edits(["/repo/packages/ui/src/components/button/button.tsx"], { sidechain: true }),
    ]),
  );
  assert.equal(r.status, 0, r.stderr);
});

test("INHERITED MODEL: a dispatch with no model field", () => {
  const r = run(transcript([INVOCATION, dispatch(["sonnet", null])]));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /INHERITED MODEL: 1 dispatch/);
});

test("NO CHEAP TIER: a large wave that never used haiku", () => {
  const r = run(transcript([INVOCATION, dispatch(Array(8).fill("sonnet"))]));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /NO CHEAP TIER: 8 dispatches/);
  assert.doesNotMatch(r.stderr, /SERIAL/); // batch of 8 is not serial
});

// --- Silence on the happy path and on unrelated sessions -------------------------

test("a compliant run is silent", () => {
  const r = run(
    transcript([
      ROSTER,
      INVOCATION,
      PROSE,
      dispatch(["haiku", "haiku", "sonnet"]),
      dispatch(["sonnet", "opus"]),
      edits(["/repo/.claude/scratch/close-issues/run1/unit-brief.md"]),
    ]),
  );
  assert.equal(r.status, 0, r.stderr);
});

test("a session that never INVOKED the command is silent, roster and prose notwithstanding", () => {
  // This is the failure mode that silently disabled session-cadence-nudge.sh: the
  // roster line naming the command appears in every transcript in this project.
  const r = run(
    transcript([
      ROSTER,
      PROSE,
      dispatch(["sonnet"]),
      dispatch(["sonnet"]),
      dispatch(["sonnet"]),
      edits(["/repo/packages/ui/src/components/button/button.tsx"]),
    ]),
  );
  assert.equal(r.status, 0, r.stderr);
});

test("two dispatches are allowed to be serial (below the threshold)", () => {
  const r = run(transcript([INVOCATION, dispatch(["sonnet"]), dispatch(["haiku"])]));
  assert.equal(r.status, 0, r.stderr);
});

test("stop_hook_active bounds it to one fire — it can never loop", () => {
  const file = transcript([
    INVOCATION,
    dispatch(["sonnet"]),
    dispatch(["sonnet"]),
    dispatch(["sonnet"]),
  ]);
  assert.equal(run(file).status, 2);
  assert.equal(run(file, { active: true }).status, 0);
});

test("a missing or unreadable transcript is silent, not an error", () => {
  const r = spawnSync("bash", [HOOK], {
    input: JSON.stringify({ transcript_path: "/nope/missing.jsonl", stop_hook_active: false }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
});

// --- The --ledger reporting mode -------------------------------------------------

test("--ledger prints the measured numbers and exits 0", () => {
  const file = transcript([
    INVOCATION,
    dispatch(["haiku", "sonnet"]),
    dispatch(["opus", null]),
    edits(["/repo/packages/ui/src/components/button/button.tsx"]),
  ]);
  const r = spawnSync("bash", [HOOK, "--ledger", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    r.stdout,
    /4 dispatches · largest parallel batch 2 · haiku 1 · inherited-model 1 · orchestrator source files edited 1/,
  );
});

test("--ledger works on a session that never invoked the command (report tooling, not a gate)", () => {
  const file = transcript([ROSTER, dispatch(["sonnet"])]);
  const r = spawnSync("bash", [HOOK, "--ledger", file], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 dispatches · largest parallel batch 1/);
});

// --- Wiring ----------------------------------------------------------------------

test("the hook is registered on Stop in .claude/settings.json", () => {
  const settings = JSON.parse(readFileSync(path.resolve(HERE, "../.claude/settings.json"), "utf8"));
  const commands = (settings.hooks?.Stop ?? []).flatMap((e) =>
    (e.hooks ?? []).map((h) => h.command ?? ""),
  );
  assert.ok(
    commands.some((c) => c.includes("close-issues-delegation-nudge.sh")),
    "close-issues-delegation-nudge.sh must be wired into hooks.Stop — an unregistered hook never fires",
  );
});

test("the command documents the ledger mode it is measured by", () => {
  const cmd = readFileSync(path.resolve(HERE, "../.claude/commands/close-issues.md"), "utf8");
  assert.match(
    cmd,
    /close-issues-delegation-nudge\.sh --ledger/,
    "close-issues.md must tell the run how to measure its own dispatch ledger",
  );
});
