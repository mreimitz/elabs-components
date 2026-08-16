#!/usr/bin/env node
/**
 * check-agent-output.mjs — the AGENT-OUTPUT CONTRACT gate (the "teeth").
 *
 * The manifest's `agentOutput` block (source: packages/cli/lib/agent-output.mjs)
 * documents the brand-ui-OWNED projection of the AI SDK message model: the tool
 * `state → Status` mapping and the closed `Status` enum. Those are AUTHORED in the
 * sidecar, but the COMPONENTS own the truth — `statusFromToolState` in
 * packages/ai/src/tool.tsx and `STATUSES` in packages/ui/.../status-badge.tsx. If
 * they ever diverge, an agent following the contract would emit a state the UI
 * mis-maps. This gate FAILS CI on any such drift (per "a convention ships with its
 * teeth", quality-gates.md), so the contract cannot rot.
 *
 * It also checks contract HONESTY: every `consumedBy`/component the block names
 * must be a real `@elabs-ai/components-ai` export (manifest), and the conversation example must
 * NOT contain `useChat(` (the agent emits DATA; the app owns the runtime — D6/D5).
 *
 * Dependency-free; locates files relative to this file (cwd-independent).
 * Mirrors scripts/check-charts-reuse.mjs (pure exports + guarded main()).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const TOOL_SRC = join(REPO_ROOT, "packages/ai/src/tool.tsx");
const BADGE_SRC = join(REPO_ROOT, "packages/ui/src/components/status-badge/status-badge.tsx");
const MANIFEST_PATH = join(REPO_ROOT, "brand-ui.manifest.json");

/**
 * Parse the `statusFromToolState` switch in tool.tsx → { state: status }.
 * Scoped to that function so an unrelated `case` elsewhere can't leak in.
 */
export function parseStateToStatus(toolSrc) {
  const start = toolSrc.indexOf("statusFromToolState");
  let scope = toolSrc;
  if (start !== -1) {
    const next = toolSrc.indexOf("getStatusBadge", start);
    scope = toolSrc.slice(start, next === -1 ? toolSrc.length : next);
  }
  const out = {};
  for (const m of scope.matchAll(/case\s+"([^"]+)"\s*:\s*return\s+"([^"]+)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** Parse the closed `STATUSES` array in status-badge.tsx → string[]. */
export function parseStatuses(badgeSrc) {
  const m = badgeSrc.match(/export const STATUSES\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Shallow record equality (string→string). */
function sameRecord(a, b) {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) return false;
  return ak.every((k) => a[k] === b[k]);
}

/** Ordered array equality. */
function sameArray(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Diff the manifest's agentOutput block against the source of truth. Pure +
 * dependency-free so the self-test can drive it with fixtures.
 *
 * @param {{
 *   agentOutput: any,
 *   aiComponentNames: Set<string>,
 *   srcStateToStatus: Record<string,string>,
 *   srcStatuses: string[],
 * }} args
 * @returns {string[]} human-readable problems (empty = clean)
 */
export function diffAgentOutput({ agentOutput, aiComponentNames, srcStateToStatus, srcStatuses }) {
  const problems = [];
  const paths = agentOutput?.paths;
  if (!paths?.conversation) {
    problems.push("manifest.agentOutput.paths.conversation is missing — run `pnpm manifest`.");
    return problems;
  }
  const conv = paths.conversation;
  const tool = (conv.parts || []).find((p) => p.kind === "tool");
  if (!tool) {
    problems.push(
      "agentOutput conversation has no `tool` part — cannot verify the status mapping.",
    );
  } else {
    if (!Object.keys(srcStateToStatus).length) {
      problems.push("could not parse `statusFromToolState` from tool.tsx (source moved?).");
    } else if (!sameRecord(tool.stateToStatus || {}, srcStateToStatus)) {
      problems.push(
        "tool `stateToStatus` DRIFTED from statusFromToolState (tool.tsx).\n" +
          `      contract: ${JSON.stringify(tool.stateToStatus)}\n` +
          `      source:   ${JSON.stringify(srcStateToStatus)}`,
      );
    }
    if (!srcStatuses.length) {
      problems.push("could not parse `STATUSES` from status-badge.tsx (source moved?).");
    } else if (!sameArray(tool.statusEnum || [], srcStatuses)) {
      problems.push(
        "tool `statusEnum` DRIFTED from STATUSES (status-badge.tsx).\n" +
          `      contract: ${JSON.stringify(tool.statusEnum)}\n` +
          `      source:   ${JSON.stringify(srcStatuses)}`,
      );
    }
  }
  // Every component the contract names must be a real @elabs-ai/components-ai export.
  const named = new Set([
    ...(conv.consumedBy || []),
    ...(conv.parts || []).flatMap((p) => p.consumedBy || []),
    ...(paths.jsxPreview?.component ? [paths.jsxPreview.component] : []),
  ]);
  for (const name of [...named].sort()) {
    if (!aiComponentNames.has(name)) {
      problems.push(
        `agentOutput names "${name}", which is NOT exported by @elabs-ai/components-ai (renamed/removed?).`,
      );
    }
  }
  // D6/D5 honesty: the conversation example is DATA, not a runtime call.
  if (typeof conv.example === "string" && /useChat\s*\(/.test(conv.example)) {
    problems.push(
      "conversation `example` contains `useChat(` — the agent emits DATA; the app owns the runtime (D5/D6).",
    );
  }
  return problems;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main() {
  for (const [label, p] of [
    ["manifest", MANIFEST_PATH],
    ["tool.tsx", TOOL_SRC],
    ["status-badge.tsx", BADGE_SRC],
  ]) {
    if (!existsSync(p)) {
      console.error(`✖ agent-output gate: ${label} not found at ${p}.`);
      process.exit(1);
    }
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (e) {
    console.error(`✖ agent-output gate: failed to parse the manifest: ${e.message}`);
    process.exit(1);
  }
  const aiComponentNames = new Set(
    (manifest?.packages?.["@elabs-ai/components-ai"]?.components ?? []).map((c) => c.name),
  );
  const problems = diffAgentOutput({
    agentOutput: manifest.agentOutput,
    aiComponentNames,
    srcStateToStatus: parseStateToStatus(readFileSync(TOOL_SRC, "utf8")),
    srcStatuses: parseStatuses(readFileSync(BADGE_SRC, "utf8")),
  });
  if (problems.length) {
    console.error(`\n✖ agent-output gate FAILED (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\nThe agent-output contract (packages/cli/lib/agent-output.mjs → manifest.agentOutput)\n" +
        "must match the components it documents. Update the sidecar to match the source and\n" +
        "run `pnpm manifest`, or fix the divergence. See .claude/rules/quality-gates.md.",
    );
    process.exit(1);
  }
  console.log("✔ agent-output: contract matches statusFromToolState + STATUSES; names + D6 OK.");
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
