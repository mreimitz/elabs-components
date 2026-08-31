// check-consultation-claims.test.mjs — self-test for scripts/check-consultation-claims.mjs
// and its Stop-hook wrapper .claude/hooks/gate-consultation-claims.sh (#42).
//
// The gap: a real result file (form-primitives-result.md, an earlier /close-issues
// coder run) claimed "Consulted `brand-ui-design-system-architect`, who confirmed…"
// with NO actual Task dispatch anywhere in that session's transcript — a fabricated
// consultation. Nothing in the repo's honesty machinery caught it:
// gate-completion-claims.sh only reads the LAST assistant message's text and has no
// consultation-phrase coverage at all.
//
// These fixtures plant the exact two required shapes from the issue's "Test to add":
// (1) a claim with no prior dispatch → the checker must fail it; (2) a claim preceded
// by a real matching Task dispatch → the checker must pass it. Plus noise/regression
// coverage mirroring check-session-cadence.test.mjs's own harness-noise lessons, and
// wiring tests proving the hook is actually reachable.
//
// Run: node --test scripts/check-consultation-claims.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractEvents, findUnverifiedConsultationClaims } from "./check-consultation-claims.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const CHECKER = path.join(REPO_ROOT, "scripts", "check-consultation-claims.mjs");
const HOOK = path.join(REPO_ROOT, ".claude", "hooks", "gate-consultation-claims.sh");

/** A transcript line for a Write tool_use, in real JSONL shape. */
function assistantWrite(filePath, content) {
  return {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", name: "Write", input: { file_path: filePath, content } }],
    },
  };
}

/** A transcript line for a real Task dispatch, in real JSONL shape. */
function assistantDispatch(subagent_type, description = "task") {
  return {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", name: "Task", input: { subagent_type, description } }],
    },
  };
}

/** Harness-injected agent roster line — must never count as a dispatch or a claim. */
function harnessAttachment() {
  return {
    type: "attachment",
    attachment: {
      type: "agent_listing_delta",
      isInitial: true,
      addedTypes: ["brand-ui-design-system-architect", "brand-ui-component-builder"],
    },
  };
}

function writeTranscript(lines) {
  const dir = mkdtempSync(path.join(tmpdir(), "consultation-claims-"));
  const tp = path.join(dir, "transcript.jsonl");
  writeFileSync(tp, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return { dir, tp };
}

function runChecker(lines) {
  const { dir, tp } = writeTranscript(lines);
  try {
    const r = spawnSync("node", [CHECKER, tp], { encoding: "utf8" });
    return { status: r.status, stderr: r.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- The issue's two required fixtures -------------------------------------------

test("a claim with NO prior Task dispatch fails", () => {
  const lines = [
    assistantWrite(
      "/repo/.claude/scratch/x/form-primitives-result.md",
      "Consulted `brand-ui-design-system-architect`, who confirmed the subpath export is warranted.",
    ),
  ];
  const violations = findUnverifiedConsultationClaims(lines);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].agent, "brand-ui-design-system-architect");

  const r = runChecker(lines);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /brand-ui-design-system-architect/);
  assert.match(r.stderr, /no prior/);
});

test("a claim preceded by a REAL matching Task dispatch passes", () => {
  const lines = [
    assistantDispatch("brand-ui-design-system-architect", "review subpath export"),
    assistantWrite(
      "/repo/.claude/scratch/x/form-primitives-result.md",
      "Consulted `brand-ui-design-system-architect`, who confirmed the subpath export is warranted.",
    ),
  ];
  assert.deepEqual(findUnverifiedConsultationClaims(lines), []);

  const r = runChecker(lines);
  assert.equal(r.status, 0);
});

// --- Regression / noise coverage --------------------------------------------------

test("a dispatch to a DIFFERENT agent does not verify the claim", () => {
  const lines = [
    assistantDispatch("brand-ui-component-builder", "build the form"),
    assistantWrite(
      "/repo/result.md",
      "Consulted `brand-ui-design-system-architect`, who confirmed it.",
    ),
  ];
  const violations = findUnverifiedConsultationClaims(lines);
  assert.equal(violations.length, 1);
});

test("a dispatch that comes AFTER the claim does not verify it (order matters)", () => {
  const lines = [
    assistantWrite(
      "/repo/result.md",
      "Consulted `brand-ui-design-system-architect`, who confirmed it.",
    ),
    assistantDispatch("brand-ui-design-system-architect", "after the fact"),
  ];
  const violations = findUnverifiedConsultationClaims(lines);
  assert.equal(violations.length, 1);
});

test("the harness agent-roster attachment is never mistaken for a dispatch", () => {
  const lines = [
    harnessAttachment(),
    assistantWrite(
      "/repo/result.md",
      "Consulted `brand-ui-design-system-architect`, who confirmed it.",
    ),
  ];
  const violations = findUnverifiedConsultationClaims(lines);
  assert.equal(violations.length, 1, "the attachment roster must not count as a real dispatch");
});

test("plain prose that merely MENTIONS an agent, with no claim verb, is not flagged", () => {
  const lines = [
    assistantWrite(
      "/repo/result.md",
      "brand-ui-design-system-architect exists for structural decisions but was not needed here.",
    ),
  ];
  assert.deepEqual(findUnverifiedConsultationClaims(lines), []);
});

test("'confirmed by' phrasing is covered, symmetric with 'consulted'", () => {
  const lines = [
    assistantWrite("/repo/result.md", "This was confirmed by `brand-ui-design-system-architect`."),
  ];
  const violations = findUnverifiedConsultationClaims(lines);
  assert.equal(violations.length, 1);
});

test("'per the architect' / 'architect sign-off' imply brand-ui-design-system-architect", () => {
  const a = findUnverifiedConsultationClaims([
    assistantWrite("/repo/r.md", "Shipped per the architect."),
  ]);
  const b = findUnverifiedConsultationClaims([
    assistantWrite("/repo/r.md", "Got architect sign-off before merging."),
  ]);
  assert.equal(a[0].agent, "brand-ui-design-system-architect");
  assert.equal(b[0].agent, "brand-ui-design-system-architect");
});

test("an Edit's new_string is scanned the same as a Write's content", () => {
  const lines = [
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "Edit",
            input: {
              file_path: "/repo/result.md",
              old_string: "old",
              new_string: "Consulted `brand-ui-design-system-architect`, who confirmed it.",
            },
          },
        ],
      },
    },
  ];
  assert.equal(findUnverifiedConsultationClaims(lines).length, 1);
});

test("no transcript given → exits 0 (never fails the caller for a missing arg)", () => {
  const r = spawnSync("node", [CHECKER], { encoding: "utf8" });
  assert.equal(r.status, 0);
});

test("a nonexistent transcript path → exits 0, not an error", () => {
  const r = spawnSync("node", [CHECKER, "/no/such/file.jsonl"], { encoding: "utf8" });
  assert.equal(r.status, 0);
});

test("extractEvents drops isMeta lines and non-assistant roles", () => {
  const lines = [
    {
      isMeta: true,
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Task", input: { subagent_type: "x" } }],
      },
    },
    {
      message: {
        role: "user",
        content: [{ type: "tool_use", name: "Task", input: { subagent_type: "y" } }],
      },
    },
  ];
  assert.deepEqual(extractEvents(lines), []);
});

// --- Wiring tests (the sanctioned lightweight proof, per check-debrand.test.mjs) --

test("the Stop hook is registered in .claude/settings.json", () => {
  const settings = JSON.parse(
    readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"),
  );
  const stopHooks = settings.hooks?.Stop ?? [];
  const commands = stopHooks.flatMap((entry) => (entry.hooks ?? []).map((h) => h.command ?? ""));
  assert.ok(
    commands.some((c) => c.includes("gate-consultation-claims.sh")),
    "gate-consultation-claims.sh must be registered under hooks.Stop",
  );
});

test("the hook script delegates to the checker script", () => {
  const hook = readFileSync(HOOK, "utf8");
  assert.match(hook, /check-consultation-claims\.mjs/);
});

test("package.json wires the self-test script", () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["consultation-claims:check:test"],
    "node --test scripts/check-consultation-claims.test.mjs",
  );
});

test("the self-test is wired into gates.yml's Gate self-tests step", () => {
  const gates = readFileSync(path.join(REPO_ROOT, ".github", "workflows", "gates.yml"), "utf8");
  assert.match(gates, /pnpm consultation-claims:check:test/);
});
