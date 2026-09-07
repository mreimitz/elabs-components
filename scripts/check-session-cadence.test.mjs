// check-session-cadence.test.mjs — self-test for .claude/hooks/session-cadence-nudge.sh
// -----------------------------------------------------------------------------
// The cadence nudge is the runtime half of quality-gates.md ▸ "Session cadence".
// A hook that silently stops firing is worse than none, so this plants fixture
// transcripts (JSONL, the on-disk shape the hook reads) and asserts the exact
// behaviour on each branch: nudge, silence-because-reviewed, silence-because-small,
// and the stop_hook_active loop guard.
//
// THE CONTRACT IS ADVISORY (2026-09-06). When the nudge fires it is printed to
// stderr exactly once and the hook exits 0 — it never blocks the stop. The earlier
// exit-2 contract fed the battery back to the agent and forced it to dispatch the
// reviewer subagents (each a full ~100k-token context) before it was allowed to
// stop, a measured driver of subagent cost. So the branches are told apart by
// STDERR, not by exit status: a fired nudge is `stderr` carrying the nudge text with
// exit 0; silence is empty `stderr` with exit 0; exit 2 is asserted NEVER to happen,
// and a static lock below keeps `exit 2` out of the hook's source.
//
// The fixtures deliberately include the noise a synthetic transcript would
// otherwise omit — the injected `type:"attachment"` agent/skill rosters, a
// `tool_result` echoing quality-gates.md, a `<system-reminder>`, a `Write` payload
// quoting the battery, and (the second dead-hook cause) ASSISTANT PROSE that names
// the reviewers while declining or merely offering the review. None of those may
// count as "already reviewed"; only a real Task/SlashCommand/Skill dispatch, or a
// human typing the command, may.
//
// Run: node --test scripts/check-session-cadence.test.mjs   (pnpm cadence:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(HERE, "../.claude/hooks/session-cadence-nudge.sh");

/** One assistant turn that wrote `files` (the transcript's tool_use shape). */
function assistantEdits(files) {
  return JSON.stringify({
    message: {
      role: "assistant",
      content: files.map((f) => ({ type: "tool_use", name: "Edit", input: { file_path: f } })),
    },
  });
}

/** One assistant text turn. */
function assistantText(text) {
  return JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text }] } });
}

/** One user (human) text turn. */
function userText(text) {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
  });
}

/** One assistant turn that DISPATCHED a reviewer (Task / SlashCommand / Skill). */
function assistantDispatch(name, input) {
  return JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "tool_use", name, input }] },
  });
}

/**
 * The `type:"attachment"` lines Claude Code injects into EVERY session. These are
 * verbatim-shaped copies of the two that carry reviewer names: `agent_listing_delta`
 * (the subagent roster) and `skill_listing` (the skill roster). They land on lines
 * ~4-7 of every real transcript in this repo, which is exactly why the hook must
 * never grep the raw file — see the regression test below.
 */
const HARNESS_ATTACHMENTS = [
  JSON.stringify({
    type: "attachment",
    attachment: {
      type: "agent_listing_delta",
      isInitial: true,
      addedTypes: [
        "brand-ui-accessibility-reviewer",
        "brand-ui-component-builder",
        "brand-ui-session-reviewer",
        "brand-ui-visual-ux-reviewer",
      ],
    },
  }),
  JSON.stringify({
    type: "attachment",
    attachment: {
      type: "skill_listing",
      isInitial: true,
      names: ["review-component", "review-interface", "session-retro", "visual-review"],
      content:
        "- review-component: Review a component against the brand-ui quality gates\n" +
        "- visual-review: Visually validate brand-ui across both themes via brand-ui-visual-ux-reviewer\n" +
        "- session-retro: Force an objective self-review via brand-ui-session-reviewer",
    },
  }),
];

/** A user turn carrying a tool_result — e.g. the bytes of a `Read` of a rule file. */
function toolResult(text) {
  return JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_x", content: text }],
    },
  });
}

/** Write a fixture transcript and run the hook against it. */
function run(lines, { stopHookActive = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "cadence-"));
  const tp = path.join(dir, "transcript.jsonl");
  try {
    writeFileSync(tp, lines.join("\n") + "\n");
    const r = spawnSync("bash", [HOOK], {
      input: JSON.stringify({ transcript_path: tp, stop_hook_active: stopHookActive }),
      encoding: "utf8",
    });
    return { status: r.status, stderr: r.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The advisory contract, asserted in one place: the nudge text is on stderr EXACTLY
 * once, and the exit status is 0 — a fired nudge must never block the stop.
 */
function assertNudged(r, why) {
  assert.equal(r.status, 0, `${why} — and advisory: a fired nudge must never block (exit 0)`);
  assert.match(r.stderr, /session-cadence nudge/, why);
  assert.match(r.stderr, /8 product files/, why);
  assert.equal(
    (r.stderr.match(/session-cadence nudge/g) ?? []).length,
    1,
    "the nudge is printed exactly once",
  );
}

/** Silence: nothing on stderr, exit 0. */
function assertSilent(r, why) {
  assert.equal(r.status, 0, why);
  assert.equal(r.stderr, "", why);
}

const EIGHT_FILES = [
  "/repo/packages/ui/src/components/button/button.tsx",
  "/repo/packages/ui/src/components/card/card.tsx",
  "/repo/packages/ui/src/components/badge/badge.tsx",
  "/repo/packages/ai/src/message.tsx",
  "/repo/packages/ai/src/composer.tsx",
  "/repo/packages/charts/src/charts/bar-chart.tsx",
  "/repo/apps/docs/stories/Scenarios.tsx",
  "/repo/apps/playground/src/main.tsx",
];

test("8 product-file edits with no reviewer → exactly one nudge on stderr, exit 0", () => {
  const r = run([assistantEdits(EIGHT_FILES), assistantText("All done.")]);
  assertNudged(r, "a large unreviewed session is nudged");
  assert.match(r.stderr, /\/visual-review/);
  assert.match(r.stderr, /never blocks the stop/, "the nudge says it is advisory");
});

// ── The advisory contract itself ─────────────────────────────────────────────
// The old exit-2 contract blocked the stop and forced reviewer-subagent dispatches.
// Lock the new one at both layers: the observed exit status above, and the hook's
// own source (so a later "let's make it reach the agent" edit fails here first).

test("the hook never exits 2 — a fired nudge is advisory, not a block", () => {
  const r = run([...HARNESS_ATTACHMENTS, assistantEdits(EIGHT_FILES), assistantText("Done.")]);
  assert.notEqual(r.status, 2, "exit 2 would block the stop and force reviewer dispatches");
  assert.equal(r.status, 0);
});

test("the hook's source carries no `exit 2` (static lock on the advisory contract)", () => {
  const src = readFileSync(HOOK, "utf8");
  assert.ok(
    !/^\s*exit\s+2\b/m.test(src),
    "session-cadence-nudge.sh must never `exit 2` — it is advisory (stderr + exit 0)",
  );
});

test("a human typing /visual-review counts as reviewed (silent)", () => {
  const r = run([
    assistantEdits(EIGHT_FILES),
    userText("/visual-review packages/ui/src/components/button"),
  ]);
  assertSilent(r, "a human-requested review silences the nudge");
});

// ── The prose-silencing regression (the second reason this hook was rejected) ─
// Assistant TEXT is not an action, and in the real transcripts the prose that
// names a reviewer is overwhelmingly the prose that DECLINES it. Counting it
// inverted the hook: two 18/19-product-file sessions with ZERO reviewer
// dispatches went silent because the agent wrote "…is still owed" / "…you can run
// /visual-review". Assistant prose must never silence the nudge.

test("assistant prose saying the sweep is still OWED still nudges", () => {
  const r = run([
    assistantEdits(EIGHT_FILES),
    assistantText(
      "Not verified on a real screen: a brand-ui-visual-ux-reviewer cross-theme sweep " +
        "on a real screen is still owed. If you want the belt-and-suspenders render " +
        "check, run /visual-review.",
    ),
  ]);
  assertNudged(r, "prose declining the review must not silence the nudge");
});

test("assistant prose merely CLAIMING the battery ran still nudges", () => {
  const r = run([
    assistantEdits(EIGHT_FILES),
    assistantText("Running /visual-review and brand-ui-accessibility-reviewer over the surfaces."),
  ]);
  assertNudged(r, "a claim is not a dispatch — only Task/SlashCommand/Skill count");
});

test("a BUILDER skill dispatch is not a review (still nudges)", () => {
  const r = run([
    ...HARNESS_ATTACHMENTS,
    assistantEdits(EIGHT_FILES),
    assistantDispatch("Skill", { skill: "brand-ui:brand-ui-component" }),
  ]);
  assertNudged(r, "building is not reviewing");
});

// ── The dead-on-arrival regression (the reason this hook was rejected once) ───
// The harness injects the reviewer/skill rosters into EVERY session as
// `type:"attachment"` lines. A whole-file grep matched them on line ~5 and the
// hook went silent forever. Evidence must come from the agent's OWN actions.

test("harness attachment lines naming the reviewers do NOT count as reviewed", () => {
  const r = run([...HARNESS_ATTACHMENTS, assistantEdits(EIGHT_FILES), assistantText("All done.")]);
  assertNudged(r, "injected agent/skill listings must not silence the nudge");
});

test("READING a rule that documents the battery does not count as running it", () => {
  const r = run([
    assistantEdits(EIGHT_FILES),
    toolResult(
      "run /visual-review (→ brand-ui-visual-ux-reviewer) and the " +
        "brand-ui-accessibility-reviewer on the surfaces you touched, and /review-component",
    ),
    assistantText("All done."),
  ]);
  assertNudged(r, "a tool_result echoing quality-gates.md is not a review");
});

test("a system-reminder injecting the rule text does not count as reviewed", () => {
  const r = run([
    assistantEdits(EIGHT_FILES),
    JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "<system-reminder>After a larger session run /visual-review and /session-retro.</system-reminder>",
          },
        ],
      },
    }),
  ]);
  assertNudged(r, "an injected system-reminder is not the agent running a review");
});

test("writing a doc that quotes the battery does not count as running it", () => {
  const r = run([
    assistantEdits(EIGHT_FILES),
    assistantDispatch("Write", {
      file_path: "/repo/docs/PLAN.md",
      content: "Then run /review-component and the brand-ui-visual-ux-reviewer.",
    }),
  ]);
  assertNudged(r, "a Write payload quoting the battery is not a review");
});

// ── Real dispatches DO count, even with the harness noise present ─────────────

for (const [label, line] of [
  [
    "Task → brand-ui-visual-ux-reviewer",
    assistantDispatch("Task", { subagent_type: "brand-ui-visual-ux-reviewer", prompt: "sweep" }),
  ],
  [
    "SlashCommand → /review-component",
    assistantDispatch("SlashCommand", {
      command: "/review-component packages/ui/src/components/button",
    }),
  ],
  ["Skill → review-component", assistantDispatch("Skill", { skill: "review-component" })],
]) {
  test(`a real dispatch counts as reviewed (silent): ${label}`, () => {
    const r = run([...HARNESS_ATTACHMENTS, assistantEdits(EIGHT_FILES), line]);
    assertSilent(r, `a real ${label} dispatch silences the nudge`);
  });
}

test("stop_hook_active bounds it to one fire (silent, no loop)", () => {
  const r = run([assistantEdits(EIGHT_FILES)], { stopHookActive: true });
  assertSilent(r, "the loop guard keeps the second stop of a chain silent");
});

test("a small session (under the threshold) is silent", () => {
  const r = run([assistantEdits(EIGHT_FILES.slice(0, 4))]);
  assertSilent(r, "4 product files is below the threshold");
});

test("non-product edits (scripts, docs, rules) do not count", () => {
  const r = run([
    assistantEdits([
      "/repo/scripts/check-a.mjs",
      "/repo/scripts/check-b.mjs",
      "/repo/docs/NOTES.md",
      "/repo/.claude/rules/theming.md",
      "/repo/CLAUDE.md",
      "/repo/package.json",
      "/repo/AGENTS.md",
      "/repo/README.md",
    ]),
  ]);
  assertSilent(r, "governance/docs edits are not product files");
});

test("test files do not count toward the threshold", () => {
  const r = run([assistantEdits(EIGHT_FILES.map((f) => f.replace(/\.tsx$/, ".test.tsx")))]);
  assertSilent(r, "*.test.tsx edits are excluded");
});

test("the same file edited repeatedly counts once", () => {
  const one = "/repo/packages/ui/src/components/button/button.tsx";
  const r = run([assistantEdits([one, one, one, one, one, one, one, one])]);
  assertSilent(r, "distinct files, not edit events");
});

test("a missing transcript path is silent (never blocks a stop)", () => {
  const r = spawnSync("bash", [HOOK], {
    input: JSON.stringify({ stop_hook_active: false }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.equal(r.stderr ?? "", "");
});

test("the hook is registered on Stop in .claude/settings.json", () => {
  const settings = JSON.parse(readFileSync(path.resolve(HERE, "../.claude/settings.json"), "utf8"));
  const commands = (settings.hooks?.Stop ?? []).flatMap((e) =>
    (e.hooks ?? []).map((h) => h.command ?? ""),
  );
  assert.ok(
    commands.some((c) => c.includes("session-cadence-nudge.sh")),
    "session-cadence-nudge.sh must be wired into hooks.Stop — an unregistered hook never fires",
  );
});
