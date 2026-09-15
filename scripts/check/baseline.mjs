/**
 * baseline.mjs — the ratchet arithmetic for every rule, and the one baseline file.
 *
 * `scripts/check/baseline.json` = `{ "<id>": number | { "<file>": n } | ["<key>", …] }`,
 * written with sorted keys. A `none` rule has no entry (it must stay at 0).
 *
 * Findings with `warn: true` are advisory: printed, never counted, never baselined.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), "baseline.json");

export function readBaseline(path = BASELINE_PATH) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function sortDeep(value) {
  if (Array.isArray(value)) return [...value].sort();
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortDeep(value[k])]),
    );
  return value;
}

export function writeBaseline(data, path = BASELINE_PATH) {
  writeFileSync(path, JSON.stringify(sortDeep(data), null, 2) + "\n");
}

const keyOf = (f) => f.key ?? `${f.file}::${f.msg}`;

function perFile(findings) {
  const counts = {};
  for (const f of findings) counts[f.file] = (counts[f.file] ?? 0) + 1;
  return counts;
}

/**
 * Compare a rule's counted findings to its baseline entry.
 * @returns {{ count, allowed, ok, failing }} `failing` = the findings that break the ratchet.
 */
export function evaluate(rule, findings, entry) {
  const counted = findings.filter((f) => !f.warn);
  switch (rule.baseline) {
    case "count": {
      const allowed = typeof entry === "number" ? entry : 0;
      const ok = counted.length <= allowed;
      return { count: counted.length, allowed, ok, failing: ok ? [] : counted };
    }
    case "per-file": {
      const base = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
      const counts = perFile(counted);
      const over = new Set(Object.keys(counts).filter((f) => counts[f] > (base[f] ?? 0)));
      const allowed = Object.values(base).reduce((a, b) => a + b, 0);
      const failing = counted.filter((f) => over.has(f.file));
      return { count: counted.length, allowed, ok: over.size === 0, failing };
    }
    case "keys": {
      const base = new Set(Array.isArray(entry) ? entry : []);
      const keys = new Set(counted.map(keyOf));
      const failing = counted.filter((f) => !base.has(keyOf(f)));
      return { count: keys.size, allowed: base.size, ok: failing.length === 0, failing };
    }
    default: {
      // "none"
      return { count: counted.length, allowed: 0, ok: counted.length === 0, failing: counted };
    }
  }
}

/** The baseline entry that records the current findings (undefined for `none`). */
export function nextEntry(rule, findings) {
  const counted = findings.filter((f) => !f.warn);
  if (rule.baseline === "count") return counted.length;
  if (rule.baseline === "per-file") return perFile(counted);
  if (rule.baseline === "keys") return [...new Set(counted.map(keyOf))].sort();
  return undefined;
}

/**
 * What writing `next` over `prev` would RAISE — human-readable lines; empty = pure ratchet-down.
 */
export function raises(rule, prev, next) {
  if (rule.baseline === "count") {
    const p = typeof prev === "number" ? prev : 0;
    return next > p ? [`${p} → ${next}`] : [];
  }
  if (rule.baseline === "per-file") {
    const p = prev && typeof prev === "object" ? prev : {};
    return Object.keys(next)
      .filter((f) => next[f] > (p[f] ?? 0))
      .map((f) => `${f}  ${p[f] ?? 0} → ${next[f]}`);
  }
  if (rule.baseline === "keys") {
    const p = new Set(Array.isArray(prev) ? prev : []);
    return next.filter((k) => !p.has(k)).map((k) => `+ ${k}`);
  }
  return []; // "none" is never written
}
