/**
 * baseline.mjs — record measurements now so `verify` can prove a change worked.
 *
 * The point of a baseline is to make "it feels faster" unsayable. A metric is
 * stored with the method that produced it and, where the method is unstable, its
 * observed spread. `compare()` will refuse to call a change an improvement when
 * the delta is inside that spread — "no measurable effect" is a real answer and
 * the one most often skipped.
 *
 * Zero dependencies. Node >= 22.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUTPUT_DIR, ensureOutputDir } from "./report.mjs";
import { redact } from "./redact.mjs";

export const BASELINE_FILE = `${OUTPUT_DIR}/baseline.json`;

/**
 * A metric: lower is better unless `higherIsBetter`.
 * @typedef {{
 *   key: string, value: number, unit: string, method: string,
 *   exact: boolean, spread?: number, higherIsBetter?: boolean, note?: string
 * }} Metric
 */

/** @param {string} root */
export function readBaseline(root) {
  const p = join(root, BASELINE_FILE);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @param {{ takenAt: string, metrics: Metric[], stack?: any, note?: string }} data
 */
export function writeBaseline(root, data) {
  const dir = ensureOutputDir(root);
  const payload = {
    schema: "repo-cleanup/baseline@1",
    takenAt: data.takenAt,
    note: data.note ?? null,
    stack: data.stack ? { languages: data.stack.languages, gate: data.stack.gate } : null,
    metrics: data.metrics,
  };
  writeFileSync(join(dir, "baseline.json"), `${redact(JSON.stringify(payload, null, 2))}\n`);
  return BASELINE_FILE;
}

/** Metrics worth recording from a context-footprint result. */
export function metricsFromFootprint(fp) {
  return [
    {
      key: "context.alwaysLoadedBytes",
      value: fp.totals.alwaysLoadedBytes,
      unit: "bytes",
      method: "context-footprint.mjs",
      exact: true,
    },
    {
      key: "context.alwaysLoadedEstimatedTokens",
      value: fp.totals.alwaysLoadedEstimatedTokens,
      unit: "tokens (estimate)",
      method: "context-footprint.mjs (chars/4 heuristic)",
      exact: false,
    },
    {
      key: "context.listingChars",
      value: fp.totals.listingChars,
      unit: "chars",
      method: "context-footprint.mjs",
      exact: true,
    },
    {
      key: "context.listedSkills",
      value: fp.skillListing.skills.filter((s) => !s.hidden).length,
      unit: "skills",
      method: "context-footprint.mjs",
      exact: true,
    },
  ];
}

/** Metrics worth recording from a usage-forensics result. */
export function metricsFromUsage(u) {
  const m = [
    {
      key: "usage.sessionFloorTokens",
      value: u.floor?.tokens ?? 0,
      unit: "tokens",
      method: "usage-forensics.mjs (request #1 usage block)",
      exact: true,
      note: u.floor?.session ? `from session ${u.floor.session}` : undefined,
    },
    {
      key: "usage.meanContextPerRequest",
      value: u.totals.meanContextPerRequest,
      unit: "tokens",
      method: "usage-forensics.mjs",
      exact: true,
    },
    {
      key: "usage.subagentShareOfCacheRead",
      value: u.totals.subagentShareOfCacheRead,
      unit: "fraction",
      method: "usage-forensics.mjs",
      exact: true,
    },
    {
      key: "usage.maxSubagentTurns",
      value: u.subagents.leaderboard[0]?.requests ?? 0,
      unit: "turns",
      method: "usage-forensics.mjs",
      exact: true,
    },
  ];
  return m.filter((x) => Number.isFinite(x.value));
}

/**
 * Compare current metrics against a baseline.
 *
 * Verdicts: improved | regressed | no-effect | unmeasurable | new | missing.
 * `no-effect` is returned whenever the delta falls inside the metric's recorded
 * spread — a change smaller than the noise is not an improvement.
 *
 * @param {{ metrics: Metric[] } | null} baseline
 * @param {Metric[]} current
 */
export function compare(baseline, current) {
  if (!baseline) {
    return {
      verdict: "unmeasurable",
      reason: "no baseline recorded — run an audit first so there is something to compare against",
      metrics: [],
    };
  }
  const base = new Map(baseline.metrics.map((m) => [m.key, m]));
  const seen = new Set();
  const rows = [];

  for (const cur of current) {
    seen.add(cur.key);
    const b = base.get(cur.key);
    if (!b) {
      rows.push({ key: cur.key, verdict: "new", before: null, after: cur.value, unit: cur.unit });
      continue;
    }
    const delta = cur.value - b.value;
    const spread = Math.max(b.spread ?? 0, cur.spread ?? 0);
    const better = (cur.higherIsBetter ?? b.higherIsBetter ?? false) ? delta > 0 : delta < 0;
    let verdict;
    if (delta === 0 || Math.abs(delta) <= spread) verdict = "no-effect";
    else verdict = better ? "improved" : "regressed";
    rows.push({
      key: cur.key,
      verdict,
      before: b.value,
      after: cur.value,
      delta,
      pct: b.value === 0 ? null : Math.round((delta / b.value) * 1000) / 10,
      unit: cur.unit,
      exact: b.exact && cur.exact,
      noiseFloor: spread || null,
    });
  }

  for (const [key, b] of base) {
    if (!seen.has(key)) {
      rows.push({ key, verdict: "missing", before: b.value, after: null, unit: b.unit });
    }
  }

  const regressed = rows.filter((r) => r.verdict === "regressed");
  const improved = rows.filter((r) => r.verdict === "improved");
  const verdict =
    regressed.length > 0 ? "regressed" : improved.length > 0 ? "improved" : "no-effect";

  return {
    verdict,
    reason:
      regressed.length > 0
        ? `${regressed.length} metric(s) got worse — a mixed result is a regression until the trade-off is stated`
        : improved.length > 0
          ? `${improved.length} metric(s) improved, none regressed`
          : "every metric is within its noise floor",
    metrics: rows,
  };
}

/** Human-readable comparison table for the report. */
export function renderComparison(cmp) {
  if (cmp.metrics.length === 0) return `**${cmp.verdict}** — ${cmp.reason}\n`;
  const rows = cmp.metrics
    .map((r) => {
      const d =
        r.delta === undefined
          ? "—"
          : `${r.delta > 0 ? "+" : ""}${r.delta}${r.pct === null ? "" : ` (${r.pct}%)`}`;
      const exact = r.exact === false ? " _(estimate)_" : "";
      return `| \`${r.key}\` | ${r.before ?? "—"} | ${r.after ?? "—"} | ${d} | **${r.verdict}**${exact} |`;
    })
    .join("\n");
  return `**${cmp.verdict}** — ${cmp.reason}

| metric | before | after | delta | verdict |
| --- | --- | --- | --- | --- |
${rows}
`;
}
