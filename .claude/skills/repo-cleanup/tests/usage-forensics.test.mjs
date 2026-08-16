/**
 * The privacy lock is the reason this file exists. Everything else here is
 * arithmetic; the sentinel test is the contract.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { runUsageForensics, transcriptDirFor } from "../scripts/usage-forensics.mjs";

/** @type {string[]} */
const temps = [];
function temp(prefix) {
  const d = mkdtempSync(join(tmpdir(), `repo-cleanup-${prefix}-`));
  temps.push(d);
  return d;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

// Strings that must never appear in any output, in every place content can hide.
const SENTINELS = {
  userText: "SENTINEL_USER_PROMPT_zzq1",
  assistantText: "SENTINEL_ASSISTANT_REPLY_zzq2",
  thinking: "SENTINEL_THINKING_zzq3",
  toolInput: "SENTINEL_TOOL_ARGUMENT_zzq4",
  toolResult: "SENTINEL_TOOL_OUTPUT_zzq5",
  secret: "ghp_SENTINELsentinel0123456789abcdefXY",
};

function usage(input, cacheRead, cacheCreation, output) {
  return {
    input_tokens: input,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreation,
    output_tokens: output,
  };
}

function line(obj) {
  return `${JSON.stringify(obj)}\n`;
}

/**
 * Build a transcript dir with one main session and one subagent sidecar, both
 * stuffed with sentinel content.
 */
function seedTranscripts({
  mainRequests = 5,
  subRequests = 4,
  growth = 1000,
  floor = 10_000,
} = {}) {
  const dir = temp("transcripts");
  const sessionId = "sess-0001";

  let main = "";
  main += line({
    timestamp: "2026-01-01T00:00:00.000Z",
    message: { role: "user", content: `${SENTINELS.userText} and a token ${SENTINELS.secret}` },
  });
  for (let i = 0; i < mainRequests; i++) {
    main += line({
      timestamp: `2026-01-01T00:0${i}:00.000Z`,
      message: {
        role: "assistant",
        usage: usage(10, floor + growth * i, 0, 100),
        content: [
          { type: "thinking", thinking: SENTINELS.thinking },
          { type: "text", text: SENTINELS.assistantText },
          { type: "tool_use", name: "Bash", input: { command: SENTINELS.toolInput } },
        ],
      },
    });
    main += line({
      timestamp: `2026-01-01T00:0${i}:30.000Z`,
      message: { role: "user", content: [{ type: "tool_result", content: SENTINELS.toolResult }] },
    });
  }
  writeFileSync(join(dir, `${sessionId}.jsonl`), main);

  mkdirSync(join(dir, sessionId, "subagents"), { recursive: true });
  let sub = "";
  for (let i = 0; i < subRequests; i++) {
    sub += line({
      timestamp: `2026-01-01T01:0${i}:00.000Z`,
      message: {
        role: "assistant",
        usage: usage(5, 50_000 + 5000 * i, 0, 200),
        content: [{ type: "text", text: SENTINELS.assistantText }],
      },
    });
  }
  writeFileSync(join(dir, sessionId, "subagents", "agent-a.jsonl"), sub);
  return dir;
}

// -------------------------------------------------------------------------

test("NO conversation content of any kind reaches the output", async () => {
  const dir = seedTranscripts();
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  const serialised = JSON.stringify(r);
  for (const [kind, value] of Object.entries(SENTINELS)) {
    assert.ok(!serialised.includes(value), `${kind} content leaked into the usage report`);
  }
});

test("tool NAMES are emitted — the documented exception", async () => {
  const dir = seedTranscripts();
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  assert.equal(r.toolCalls.Bash, 5, "tool names are API metadata and are deliberately reported");
  assert.match(r.privacy, /tool NAMES only/);
});

test("subagent sidecars are found and attributed separately", async () => {
  const dir = seedTranscripts({ mainRequests: 5, subRequests: 4 });
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  assert.equal(r.subagents.count, 1, "a nested sidecar must be discovered");
  assert.equal(r.subagents.requests, 4);
  assert.equal(r.sessions.length, 1);
  assert.equal(r.totals.requests, 9);
  assert.ok(r.totals.subagentShareOfCacheRead > 0);
  // 4 sidecar requests at ~50k+ vs 5 main at 10k–14k: the sidecar dominates.
  assert.ok(
    r.totals.subagentShareOfCacheRead > 60,
    "sidecar share must reflect the sidecar tokens",
  );
});

test("the two floors answer different questions", async () => {
  const dir = seedTranscripts({ floor: 10_000 });
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  assert.equal(
    r.floor.tokens,
    10_010,
    "floor = first request context (input + cacheRead + cacheCreation)",
  );
  assert.equal(r.floorLatest.tokens, 10_010, "one session: min and latest coincide");
  assert.equal(r.floor.session, "sess-0001");
});

test("growth slope is fitted, not guessed", async () => {
  const dir = seedTranscripts({ mainRequests: 6, growth: 1000 });
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  assert.equal(
    r.sessions[0].growthPerTurn,
    1000,
    "a linear 1000/turn ramp must fit to exactly 1000",
  );
  assert.ok(r.sessions[0].curve.length > 0);
});

test("the split counterfactual is modelled and says so", async () => {
  const dir = seedTranscripts({ subRequests: 20 });
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  const cf = r.subagents.leaderboard[0].counterfactual;
  assert.ok(cf.ratio > 1, "splitting a growing context must model as cheaper");
  assert.match(cf.caveat, /MODELLED/, "a modelled number must never read as a measurement");
});

test("cost is unavailable unless prices are configured, and never guessed", async () => {
  const dir = seedTranscripts();
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  assert.equal(r.cost.available, false);
  assert.equal(r.cost.usd, null);
  assert.match(r.cost.reason, /pricing/);
});

test("configured prices produce a labelled estimate", async () => {
  const dir = seedTranscripts();
  const root = temp("root");
  writeFileSync(
    join(root, ".repo-cleanup.json"),
    JSON.stringify({ pricing: { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 } }),
  );
  const r = await runUsageForensics(root, { transcriptDir: dir });
  assert.equal(r.cost.available, true);
  assert.ok(r.cost.usd > 0);
  assert.match(r.cost.caveat, /ESTIMATE/);
  assert.match(r.cost.caveat, /not billing data/);
});

test("a malformed line is counted and excluded, not fatal", async () => {
  const dir = seedTranscripts();
  const p = join(dir, "broken.jsonl");
  writeFileSync(p, `{"not json\n${line({ message: { usage: usage(1, 2, 3, 4) } })}`);
  const r = await runUsageForensics(temp("root"), { transcriptDir: dir });
  assert.ok(r.resolved);
  assert.ok(
    r.measurementGaps.some((g) => /unparseable/.test(g)),
    "a dropped line must be declared",
  );
});

test('no transcripts is "unavailable", never zero', async () => {
  const r = await runUsageForensics(temp("root"), { transcriptDir: join(temp("empty"), "nope") });
  assert.equal(r.resolved, false);
  assert.equal(r.totals, null, 'zeros would read as "this repo costs nothing"');
  assert.match(r.reason, /no transcript directory/);
  assert.deepEqual(r.observations, []);
});

test("--since bounds the observation window", async () => {
  const dir = seedTranscripts({ mainRequests: 5 });
  const all = await runUsageForensics(temp("root"), { transcriptDir: dir });
  const since = await runUsageForensics(temp("root"), {
    transcriptDir: dir,
    since: "2026-01-01T00:03:00.000Z",
  });
  assert.ok(
    since.totals.requests < all.totals.requests,
    "a window must actually exclude earlier requests",
  );
});

test("transcript dir is derived from the repo path", () => {
  // The fixture root deliberately avoids a `/Users/<name>` or `/home/<name>` shape:
  // this repo's `pnpm machine-paths:check` gate scans every TRACKED file for one and
  // cannot tell a synthetic fixture from a leaked local path. The slug logic under
  // test is root-agnostic, so any absolute path with a space exercises it identically.
  const d = transcriptDirFor("/srv/x/Documents/my repo", { userClaudeDir: "/opt/.claude" });
  assert.match(d, /^\/opt\/\.claude\/projects\//);
  assert.ok(!d.includes(" "), "the slug must not contain spaces");
  assert.match(d, /srv-x-Documents-my-repo$/);
});
