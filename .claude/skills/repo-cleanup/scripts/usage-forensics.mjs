#!/usr/bin/env node
/**
 * usage-forensics.mjs — where the tokens actually went.
 *
 * Reads this repo's Claude Code transcripts and reports what static inspection
 * structurally cannot see:
 *
 *   - the SESSION FLOOR: request #1's context with no work done yet;
 *   - the CONTEXT-GROWTH CURVE, whose quadratic term dominates long sessions;
 *   - the SUBAGENT LEADERBOARD from the per-session sidecar transcripts (nested
 *     .jsonl files under each session directory) — a static audit cannot see
 *     these at all, and they are routinely the majority of spend;
 *   - the MATERIAL MIX: what kind of content filled the window.
 *
 * PRIVACY IS A HARD CONSTRAINT (references/safety-model.md). Transcripts contain
 * real conversation content and may contain secrets. This script emits COUNTS,
 * TOKEN TOTALS, TIMESTAMPS and TOOL NAMES only. It never emits message text,
 * tool arguments, tool results, file contents, or any substring of a
 * conversation. `tests/usage-forensics.test.mjs` asserts that with a transcript
 * seeded with sentinel strings.
 *
 * Usage:
 *   node usage-forensics.mjs [--root <dir>] [--since <ISO>] [--curve-points N]
 *                            [--transcript-dir <dir>]
 * Zero dependencies. Node >= 22.
 */

import { createReadStream, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { findRepoRoot, loadConfig } from "./config.mjs";

// --------------------------------------------------------------------------
// transcript discovery
// --------------------------------------------------------------------------

/**
 * Claude Code stores transcripts under `~/.claude/projects/<sanitized-cwd>/`,
 * where the sanitiser replaces every non-alphanumeric character with `-`.
 * Derived by inspection, so `resolved: false` is a supported outcome and the
 * caller must be told rather than shown zeros.
 *
 * @param {string} root
 */
export function transcriptDirFor(root, opts = {}) {
  const claudeDir =
    opts.userClaudeDir ?? process.env.REPO_CLEANUP_USER_CLAUDE_DIR ?? join(homedir(), ".claude");
  const slug = resolve(root)
    .split(sep)
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "-");
  return join(claudeDir, "projects", slug);
}

/** @param {string} dir */
function findTranscripts(dir) {
  /** @type {{ path: string, kind: 'main' | 'subagent', session: string }[]} */
  const out = [];
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      out.push({ path: p, kind: "main", session: basename(entry.name, ".jsonl") });
      continue;
    }
    if (!entry.isDirectory()) continue;
    // Sidecars live under <session>/**/…jsonl — the nesting level has changed
    // across versions, so walk rather than assume `subagents/`.
    const walk = (d, depth) => {
      if (depth > 3) return;
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const q = join(d, e.name);
        if (e.isDirectory()) walk(q, depth + 1);
        else if (e.name.endsWith(".jsonl"))
          out.push({ path: q, kind: "subagent", session: entry.name });
      }
    };
    walk(p, 0);
  }
  return out;
}

// --------------------------------------------------------------------------
// per-file aggregation
// --------------------------------------------------------------------------

const EMPTY_MIX = () => ({
  toolResult: 0,
  toolUseInput: 0,
  thinking: 0,
  assistantText: 0,
  userText: 0,
  image: 0,
  other: 0,
});

/**
 * Aggregate one transcript. Streams so a 200 MB file does not have to fit in
 * memory, and so a truncated final line degrades to "skip that line".
 *
 * @param {{ path: string, kind: string, session: string }} file
 * @param {{ since: number | null }} opts
 */
async function aggregate(file, opts) {
  const acc = {
    requests: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheCreation: 0,
    contexts: /** @type {number[]} */ ([]),
    firstTs: /** @type {string | null} */ (null),
    lastTs: /** @type {string | null} */ (null),
    mix: EMPTY_MIX(),
    toolCalls: /** @type {Record<string, number>} */ ({}),
    malformedLines: 0,
  };

  const rl = createInterface({
    input: createReadStream(file.path, "utf8"),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of rl) {
    if (!line) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      acc.malformedLines++;
      continue;
    }
    const ts = typeof rec.timestamp === "string" ? rec.timestamp : null;
    if (opts.since && ts && Date.parse(ts) < opts.since) continue;

    const msg = rec.message ?? {};
    const usage = msg.usage;
    if (usage) {
      acc.requests++;
      acc.input += usage.input_tokens ?? 0;
      acc.output += usage.output_tokens ?? 0;
      acc.cacheRead += usage.cache_read_input_tokens ?? 0;
      acc.cacheCreation += usage.cache_creation_input_tokens ?? 0;
      acc.contexts.push(
        (usage.input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
      );
      if (ts) {
        acc.firstTs ??= ts;
        acc.lastTs = ts;
      }
    }

    // Material mix: LENGTHS ONLY. Nothing below ever stores a character.
    const content = msg.content;
    if (typeof content === "string") {
      acc.mix.userText += content.length;
    } else if (Array.isArray(content)) {
      for (const b of content) {
        if (!b || typeof b !== "object") continue;
        switch (b.type) {
          case "thinking":
            acc.mix.thinking += (b.thinking ?? "").length;
            break;
          case "text":
            acc.mix.assistantText += (b.text ?? "").length;
            break;
          case "tool_use":
            acc.mix.toolUseInput += JSON.stringify(b.input ?? {}).length;
            if (typeof b.name === "string")
              acc.toolCalls[b.name] = (acc.toolCalls[b.name] ?? 0) + 1;
            break;
          case "tool_result":
            acc.mix.toolResult += JSON.stringify(b.content ?? "").length;
            break;
          case "image":
            acc.mix.image += JSON.stringify(b).length;
            break;
          default:
            acc.mix.other += JSON.stringify(b).length;
        }
      }
    }
  }
  rl.close();
  return acc;
}

// --------------------------------------------------------------------------
// derived shape
// --------------------------------------------------------------------------

/** Least-squares slope of context vs request index — the growth term. */
function growthPerTurn(contexts) {
  const n = contexts.length;
  if (n < 3) return 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const y = contexts[i] ?? 0;
    sx += i;
    sy += y;
    sxy += i * y;
    sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return Math.round((n * sxy - sx * sy) / denom);
}

/** Sample the curve down to at most `points` entries so a report can show it. */
function curve(contexts, points) {
  const n = contexts.length;
  if (n === 0) return [];
  const step = Math.max(1, Math.ceil(n / points));
  const out = [];
  for (let i = 0; i < n; i += step) out.push({ request: i, context: contexts[i] ?? 0 });
  const lastIndex = n - 1;
  if (out.at(-1)?.request !== lastIndex)
    out.push({ request: lastIndex, context: contexts[lastIndex] ?? 0 });
  return out;
}

/**
 * What a single long-lived agent costs versus the same work split into `k`
 * fresh contexts. Cache-read cost is `turns × floor + growth × turns²/2`;
 * splitting divides the quadratic term by k and leaves the linear term.
 */
function splitCounterfactual(requests, floor, growth, k = 10) {
  if (requests < 2) return null;
  const modelled = requests * floor + (growth * requests * requests) / 2;
  const perAgent = Math.ceil(requests / k);
  const split = k * (perAgent * floor + (growth * perAgent * perAgent) / 2);
  if (modelled <= 0 || split <= 0) return null;
  return {
    agents: k,
    turnsEach: perAgent,
    modelledCacheReadTokens: Math.round(modelled),
    splitCacheReadTokens: Math.round(split),
    ratio: Math.round((modelled / split) * 10) / 10,
    caveat:
      "MODELLED from the fitted growth slope, not a re-run. Compare against the measured cacheRead.",
  };
}

function sum(list, key) {
  return list.reduce((n, x) => n + (x[key] ?? 0), 0);
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

/**
 * @param {string} [rootArg]
 * @param {{ since?: string, curvePoints?: number, transcriptDir?: string, userClaudeDir?: string, splitInto?: number }} [opts]
 */
export async function runUsageForensics(rootArg, opts = {}) {
  const root = rootArg ?? findRepoRoot();
  const { config } = loadConfig(root);
  const dir = opts.transcriptDir ?? transcriptDirFor(root, opts);
  const since = opts.since ? Date.parse(opts.since) : null;
  const curvePoints = opts.curvePoints ?? 12;
  const splitInto = opts.splitInto ?? 10;
  const prices = config.pricing ?? {};

  const files = findTranscripts(dir);
  if (files.length === 0) {
    return {
      schema: "repo-cleanup/usage-forensics@1",
      root,
      transcriptDir: dir,
      resolved: false,
      reason: existsSync(dir)
        ? "transcript directory exists but holds no .jsonl files"
        : "no transcript directory for this repo — the path is derived from cwd and may be wrong, or this repo has no session history",
      sessions: [],
      subagents: { count: 0, leaderboard: [] },
      totals: null,
      observations: [],
      measurementGaps: ["no transcripts found; every usage figure is unavailable, not zero"],
    };
  }

  /** @type {any[]} */
  const mains = [];
  /** @type {any[]} */
  const subs = [];

  for (const f of files) {
    const a = await aggregate(f, { since });
    if (a.requests === 0) continue;
    const contexts = a.contexts;
    const rec = {
      session: f.session,
      file: relative(dir, f.path),
      kind: f.kind,
      requests: a.requests,
      input: a.input,
      output: a.output,
      cacheRead: a.cacheRead,
      cacheCreation: a.cacheCreation,
      floorTokens: contexts[0] ?? 0,
      peakContext: Math.max(...contexts),
      meanContext: Math.round(contexts.reduce((n, c) => n + c, 0) / contexts.length),
      growthPerTurn: growthPerTurn(contexts),
      firstTs: a.firstTs,
      lastTs: a.lastTs,
      malformedLines: a.malformedLines,
      mix: a.mix,
      toolCalls: a.toolCalls,
    };
    if (f.kind === "main") rec.curve = curve(contexts, curvePoints);
    (f.kind === "main" ? mains : subs).push(rec);
  }

  const all = [...mains, ...subs];
  const totalCacheRead = sum(all, "cacheRead");
  const totalRequests = sum(all, "requests");
  const subCacheRead = sum(subs, "cacheRead");

  // Material mix across everything.
  const mix = EMPTY_MIX();
  for (const r of all) for (const k of Object.keys(mix)) mix[k] += r.mix[k] ?? 0;
  const mixTotal = Object.values(mix).reduce((n, v) => n + v, 0);
  const mixShare = Object.fromEntries(
    Object.entries(mix).map(([k, v]) => [
      k,
      mixTotal === 0 ? 0 : Math.round((v / mixTotal) * 1000) / 10,
    ]),
  );

  // Aggregate tool calls (names only — see the privacy note at the top).
  /** @type {Record<string, number>} */
  const toolCalls = {};
  for (const r of all)
    for (const [n, c] of Object.entries(r.toolCalls)) toolCalls[n] = (toolCalls[n] ?? 0) + c;

  const leaderboard = [...subs]
    .sort((a, b) => b.cacheRead - a.cacheRead)
    .slice(0, 10)
    .map((s) => ({
      session: s.session,
      file: s.file,
      requests: s.requests,
      cacheRead: s.cacheRead,
      output: s.output,
      peakContext: s.peakContext,
      floorTokens: s.floorTokens,
      growthPerTurn: s.growthPerTurn,
      counterfactual: splitCounterfactual(s.requests, s.floorTokens, s.growthPerTurn, splitInto),
    }));

  // The floor — TWO numbers, because they answer different questions and
  // conflating them is how a report ends up quoting a stale figure as current.
  //   min:    the cheapest session start ever observed. Historical, and useful
  //           only as the low-water mark the repo once had.
  //   latest: the most recent session's first request. This is what a NEW
  //           session costs today, and it is the one a finding should cite.
  // Both take the FIRST request of a main transcript; a resumed session's first
  // request already carries history, which is why `resumedLikely` is flagged
  // rather than silently averaged in.
  const withFloor = mains.filter((m) => m.floorTokens > 0);
  const byFloor = [...withFloor].sort((a, b) => a.floorTokens - b.floorTokens);
  const byTime = [...withFloor].sort((a, b) =>
    String(b.firstTs ?? "").localeCompare(String(a.firstTs ?? "")),
  );
  const asFloor = (m) =>
    m
      ? { tokens: m.floorTokens, session: m.session, startedAt: m.firstTs, requests: m.requests }
      : null;
  const floor = asFloor(byFloor[0]);
  const floorLatest = asFloor(byTime[0]);
  if (floor && floorLatest && floorLatest.tokens > floor.tokens * 1.15) {
    floorLatest.note = `the floor has grown ${Math.round((floorLatest.tokens / floor.tokens - 1) * 100)}% since the cheapest observed session start`;
  }

  const cost = estimateCost({ all, prices });

  const result = {
    schema: "repo-cleanup/usage-forensics@1",
    root,
    transcriptDir: dir,
    resolved: true,
    privacy:
      "counts, token totals, timestamps and tool NAMES only — no message content of any kind",
    window: { since: opts.since ?? null, files: files.length, sessionsWithUsage: all.length },
    floor,
    floorLatest,
    sessions: mains.sort((a, b) => b.cacheRead - a.cacheRead),
    subagents: {
      count: subs.length,
      requests: sum(subs, "requests"),
      cacheRead: subCacheRead,
      output: sum(subs, "output"),
      leaderboard,
    },
    totals: {
      requests: totalRequests,
      input: sum(all, "input"),
      output: sum(all, "output"),
      cacheRead: totalCacheRead,
      cacheCreation: sum(all, "cacheCreation"),
      meanContextPerRequest: totalRequests === 0 ? 0 : Math.round(totalCacheRead / totalRequests),
      cacheReadShareOfInput:
        totalCacheRead === 0
          ? 0
          : Math.round(
              (totalCacheRead / (totalCacheRead + sum(all, "input") + sum(all, "cacheCreation"))) *
                1000,
            ) / 10,
      subagentShareOfCacheRead:
        totalCacheRead === 0 ? 0 : Math.round((subCacheRead / totalCacheRead) * 1000) / 10,
    },
    materialMix: { chars: mix, sharePct: mixShare },
    toolCalls,
    cost,
    measurementGaps: buildGaps(all, cost),
  };

  result.observations = buildObservations(result);
  return result;
}

/**
 * Cost is an ESTIMATE and is only produced when prices are configured. Guessing
 * a price list would make the most quotable number in the report the least
 * defensible one.
 */
function estimateCost({ all, prices }) {
  const need = ["input", "output", "cacheRead", "cacheCreation"];
  const have = need.every((k) => typeof prices[k] === "number");
  if (!have) {
    return {
      available: false,
      reason:
        "no `pricing` block in .repo-cleanup config — set pricing.{input,output,cacheRead,cacheCreation} in USD per million tokens to enable a cost estimate",
      prices: null,
      usd: null,
    };
  }
  const usd =
    (sum(all, "input") * prices.input +
      sum(all, "output") * prices.output +
      sum(all, "cacheRead") * prices.cacheRead +
      sum(all, "cacheCreation") * prices.cacheCreation) /
    1e6;
  return {
    available: true,
    prices,
    usd: Math.round(usd * 100) / 100,
    caveat:
      "ESTIMATE from configured list prices — not billing data, and it ignores discounts and tier changes",
  };
}

function buildGaps(all, cost) {
  const gaps = [];
  const malformed = all.reduce((n, r) => n + r.malformedLines, 0);
  if (malformed > 0)
    gaps.push(`${malformed} transcript line(s) were unparseable and are excluded from every total`);
  if (!cost.available) gaps.push(cost.reason);
  gaps.push(
    "transcripts record what the client sent and received; they cannot attribute cost to a skill, rule file, or MCP server directly",
  );
  return gaps;
}

function buildObservations(r) {
  const obs = [];
  const push = (code, statement, data) => obs.push({ code, statement, data });
  const t = r.totals;

  push("TOK.totals", "aggregate token usage over the observed window", t);

  if (r.floor)
    push(
      "TOK.session-floor-min",
      "cheapest session start ever observed (historical low-water mark)",
      r.floor,
    );
  if (r.floorLatest)
    push(
      "TOK.session-floor-current",
      "what a NEW session costs today — cite this one, not the minimum",
      r.floorLatest,
    );

  if (r.subagents.count > 0) {
    push("TOK.subagent-share", "share of all cache-read tokens attributable to subagent sidecars", {
      subagents: r.subagents.count,
      requests: r.subagents.requests,
      cacheRead: r.subagents.cacheRead,
      sharePct: t.subagentShareOfCacheRead,
    });
    const worst = r.subagents.leaderboard[0];
    if (worst) push("TOK.longest-subagent", "the single most expensive subagent context", worst);
  }

  const longest = [...r.sessions].sort((a, b) => b.peakContext - a.peakContext)[0];
  if (longest) {
    push("TOK.context-growth", "longest main session: floor, peak, and fitted growth per turn", {
      session: longest.session,
      requests: longest.requests,
      floorTokens: longest.floorTokens,
      peakContext: longest.peakContext,
      growthPerTurn: longest.growthPerTurn,
      curve: longest.curve,
    });
  }

  push(
    "TOK.material-mix",
    "what kind of content filled the context window (share of characters)",
    r.materialMix.sharePct,
  );

  const topTools = Object.entries(r.toolCalls)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (topTools.length)
    push("TOK.tool-calls", "most-invoked tools by name (names only, no arguments)", topTools);

  return obs;
}

// --------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const out = await runUsageForensics(arg("--root"), {
    since: arg("--since"),
    curvePoints: arg("--curve-points") ? Number(arg("--curve-points")) : undefined,
    transcriptDir: arg("--transcript-dir"),
  });
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
