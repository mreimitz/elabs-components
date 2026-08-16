import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { measureContextFootprint } from "../scripts/context-footprint.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const NODE_APP = join(FIXTURES, "node-app");
const BARE = join(FIXTURES, "bare");

/** Fixture runs must not read the developer's real ~/.claude. */
function emptyUserDir() {
  return mkdtempSync(join(tmpdir(), "repo-cleanup-user-"));
}
function measure(root) {
  const userClaudeDir = emptyUserDir();
  try {
    return measureContextFootprint(root, { userClaudeDir });
  } finally {
    rmSync(userClaudeDir, { recursive: true, force: true });
  }
}

test("measures always-loaded instruction files and separates conditional ones", () => {
  const r = measure(NODE_APP);
  const paths = r.instructions.filter((e) => e.alwaysLoaded).map((e) => e.path);
  assert.ok(paths.includes("CLAUDE.md"));
  assert.ok(paths.includes(join(".claude", "rules", "one.md")));
  assert.ok(
    !paths.includes("~/.claude/CLAUDE.md"),
    "an empty user dir must contribute nothing — no machine dependence",
  );
  assert.equal(
    r.totals.alwaysLoadedBytes,
    r.instructions.filter((e) => e.alwaysLoaded).reduce((n, e) => n + e.bytes, 0),
    "the total must equal the sum it claims to be",
  );
});

test("a nested CLAUDE.md is reported but kept OUT of the always-loaded total", () => {
  const r = measure(NODE_APP);
  const nestedPath = join("packages", "inner", "CLAUDE.md");
  const nested = r.instructions.find((e) => e.path === nestedPath);

  assert.ok(nested, "the nested fixture must be discovered — a conditional cost is still a cost");
  assert.equal(nested.alwaysLoaded, false, "it loads only while working in that subtree");
  assert.equal(nested.scope, "project-nested");
  assert.ok(nested.bytes > 0);

  // The distinction has to be observable in the totals, or the flag is decorative.
  assert.equal(r.totals.conditionalInstructionBytes, nested.bytes);
  assert.ok(
    r.totals.alwaysLoadedBytes > 0 &&
      r.totals.alwaysLoadedBytes < nested.bytes + r.totals.alwaysLoadedBytes,
    "sanity: both buckets are non-empty",
  );
  const alwaysPaths = r.instructions.filter((e) => e.alwaysLoaded).map((e) => e.path);
  assert.ok(
    !alwaysPaths.includes(nestedPath),
    "a nested file must never inflate the always-loaded total",
  );
});

test("token counts are labelled as estimates", () => {
  const r = measure(NODE_APP);
  assert.equal(r.tokenEstimate.method, "chars / 4");
  assert.match(r.tokenEstimate.caveat, /ESTIMATE ONLY/);
  assert.equal(r.totals.alwaysLoadedEstimatedTokens, Math.round(r.totals.alwaysLoadedBytes / 4));
});

test("skillOverrides: off removes a skill from the listing cost", () => {
  const r = measure(NODE_APP);
  const demo = r.skillListing.skills.find((s) => s.name === "demo");
  assert.ok(demo, "the fixture skill must be discovered");
  assert.equal(demo.hidden, true, "settings say demo is off");
  assert.equal(demo.cappedChars, 0, "a hidden skill costs nothing in the listing");
  assert.ok(demo.descChars > 0, "but its description length is still reported");
});

test("agent and command descriptions are counted in the listing", () => {
  const r = measure(NODE_APP);
  assert.equal(r.agents.length, 1);
  assert.equal(r.commands.length, 1);
  assert.equal(
    r.totals.listingChars,
    r.agents[0].descChars + r.commands[0].descChars,
    "demo is hidden, so agents + commands are the whole listing here",
  );
});

test("settings levers are read from the merged chain", () => {
  const r = measure(NODE_APP);
  assert.equal(r.levers.model, "opus[1m]");
  assert.equal(r.levers.effortLevel, "xhigh");
  assert.equal(r.levers.autoCompactWindow, null);
  assert.equal(r.levers.skillOverrideCount, 1);
  assert.deepEqual(r.settingsLayersPresent, ["project"]);
});

test("a 1M model with no compaction window is observed, not silently accepted", () => {
  const r = measure(NODE_APP);
  const codes = r.observations.map((o) => o.code);
  assert.ok(codes.includes("CTX.long-context-model"));
  assert.ok(codes.includes("CTX.no-compact-window"));
});

test("context-injecting hooks become a declared measurement gap", () => {
  const r = measure(NODE_APP);
  assert.equal(r.hooks.contextInjectingHooks, 1);
  assert.ok(
    r.measurementGaps.some((g) => /running a hook to size it is a mutating act/.test(g)),
    "hook output size must be declared unmeasured, never estimated",
  );
});

test("MCP tool schema cost is a declared gap, never a zero", () => {
  const r = measure(NODE_APP);
  assert.equal(r.mcp.toolSchemaBytes, null);
  assert.match(r.mcp.measurementGap, /read-only and does not connect/);
});

test("a bare repo produces a valid, empty-ish result instead of throwing", () => {
  const r = measure(BARE);
  assert.equal(r.schema, "repo-cleanup/context-footprint@1");
  assert.equal(r.totals.alwaysLoadedBytes, 0);
  assert.deepEqual(r.settingsLayersPresent, []);
  assert.deepEqual(r.skillListing.skills, []);
});

test("observations are facts with data, not prose findings", () => {
  const r = measure(NODE_APP);
  for (const o of r.observations) {
    assert.match(o.code, /^CTX\./);
    assert.equal(typeof o.statement, "string");
    assert.ok("data" in o);
    assert.ok(
      !/should|must|recommend/i.test(o.statement),
      `observation "${o.code}" is editorialising`,
    );
  }
});

test("NO secret from an audited file reaches the output", () => {
  // The fixture CLAUDE.md deliberately contains a token-shaped literal.
  const claudeMd = readFileSync(join(NODE_APP, "CLAUDE.md"), "utf8");
  const secret = /ghp_[A-Za-z0-9]+/.exec(claudeMd)?.[0];
  assert.ok(secret, "fixture must contain the synthetic token this test exists to catch");

  const r = measure(NODE_APP);
  const serialised = JSON.stringify(r);
  assert.ok(!serialised.includes(secret), "a secret from an audited file reached the report");
  // Belt: no line of any audited instruction file may appear either.
  for (const line of claudeMd.split("\n")) {
    if (line.trim().length < 12) continue;
    assert.ok(
      !serialised.includes(line.trim()),
      `file content leaked into output: ${line.slice(0, 40)}`,
    );
  }
});

test("CLI entrypoint emits parseable JSON and writes nothing", () => {
  const script = join(HERE, "..", "scripts", "context-footprint.mjs");
  const before = execFileSync("git", ["status", "--porcelain"], { cwd: HERE, encoding: "utf8" });
  const out = execFileSync(process.execPath, [script, "--root", NODE_APP], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, REPO_CLEANUP_USER_CLAUDE_DIR: emptyUserDir() },
  });
  const json = JSON.parse(out);
  assert.equal(json.schema, "repo-cleanup/context-footprint@1");
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: HERE, encoding: "utf8" });
  assert.equal(before, after, "a read-only analyzer changed the working tree");
});
