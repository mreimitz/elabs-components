/**
 * config.mjs — repo root discovery + `.repo-cleanup.{json,yml,yaml}` loading.
 *
 * Why a hand-rolled YAML reader: this skill must install by copying a directory
 * into any repo, with no `pnpm add`. A dependency would defeat that. The parser
 * therefore supports a DOCUMENTED SUBSET and fails loudly on anything else,
 * rather than guessing — a config silently half-parsed is worse than no config.
 *
 * Supported YAML subset:
 *   key: scalar                      (string | number | true | false | null)
 *   key: [a, b, c]                   inline sequence of scalars
 *   key: { a: 1, b: two }            inline map of scalars
 *   key:                             nested block map (2-space indent, any depth)
 *     child: value
 *   key:                             block sequence of scalars
 *     - a
 *     - b
 *   # comments, blank lines, optional quotes
 *
 * NOT supported (throws): anchors, aliases, multi-line scalars, tabs for
 * indentation, sequences of maps, multiple documents.
 *
 * Zero dependencies. Node >= 22.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const CONFIG_BASENAMES = [".repo-cleanup.json", ".repo-cleanup.yml", ".repo-cleanup.yaml"];

/** Safe defaults. Every key is optional in the file. */
export const DEFAULT_CONFIG = {
  version: 1,
  exclude: [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "coverage",
    "vendor",
    ".next",
    "__pycache__",
    ".venv",
    "target",
  ],
  protected_paths: [],
  gate: "auto",
  limits: {
    command_timeout_seconds: 300,
    max_command_output_kb: 512,
    max_file_size_mb: 10,
  },
  audit: { context: true, tokens: true, docs: true, repo: true, git: true },
  performance: { repetitions: 3, warmup_runs: 1 },
  privacy: { redact_secrets: true, allow_network: false, include_source_snippets: false },
  remediation: { require_clean_git: true, allow_automatic_deletion: false },
  // USD per MILLION tokens. Absent by default on purpose: guessing a price list
  // would make the most quotable number in a report the least defensible one.
  // Set it and `usage-forensics.mjs` will produce a labelled cost estimate.
  pricing: null,
};

// --------------------------------------------------------------------------
// repo root
// --------------------------------------------------------------------------

/**
 * Repo root = git toplevel when available, else the nearest ancestor holding a
 * project marker, else cwd. Never throws — a repo without git is a supported
 * input, not an error (see tests/fixtures/no-git).
 *
 * @param {string} [startDir]
 */
export function findRepoRoot(startDir = process.cwd()) {
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: startDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const root = out.trim();
    if (root) return root;
  } catch {
    // no git, or not a repo — fall through
  }
  const markers = [
    "package.json",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "CLAUDE.md",
    ".claude",
  ];
  let dir = resolve(startDir);
  for (;;) {
    if (markers.some((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(startDir);
    dir = parent;
  }
}

// --------------------------------------------------------------------------
// YAML subset
// --------------------------------------------------------------------------

function parseScalar(raw) {
  const s = raw.trim();
  if (s === "") return "";
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
    (s.startsWith("'") && s.endsWith("'") && s.length > 1)
  ) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return Number.parseFloat(s);
  return s;
}

function splitTopLevel(body) {
  // split on commas that are not inside quotes or nested brackets
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts;
}

function parseInline(raw, lineNo) {
  const s = raw.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    const body = s.slice(1, -1).trim();
    if (body === "") return [];
    return splitTopLevel(body).map((p) => parseScalar(p));
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    const body = s.slice(1, -1).trim();
    /** @type {Record<string, unknown>} */
    const out = {};
    if (body === "") return out;
    for (const pair of splitTopLevel(body)) {
      const idx = pair.indexOf(":");
      if (idx === -1) {
        throw new Error(
          `.repo-cleanup.yml line ${lineNo}: inline map entry without ':' — ${pair.trim()}`,
        );
      }
      out[pair.slice(0, idx).trim()] = parseScalar(pair.slice(idx + 1));
    }
    return out;
  }
  return parseScalar(s);
}

/**
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
export function parseYamlSubset(text) {
  /** @type {{indent:number, container:any, kind:'map'|'seq'}[]} */
  const stack = [{ indent: -1, container: {}, kind: "map" }];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const lineNo = i + 1;
    if (rawLine.includes("\t")) {
      throw new Error(`.repo-cleanup.yml line ${lineNo}: tabs are not supported for indentation`);
    }
    const withoutComment = rawLine.replace(/(^|\s)#.*$/, "$1");
    if (withoutComment.trim() === "") continue;
    if (withoutComment.trim() === "---") continue;

    const indent = withoutComment.length - withoutComment.trimStart().length;
    const content = withoutComment.trim();

    while (stack.length > 1 && indent <= /** @type {any} */ (stack.at(-1)).indent) stack.pop();
    const top = /** @type {any} */ (stack.at(-1));

    // block sequence item
    if (content.startsWith("- ") || content === "-") {
      if (!Array.isArray(top.container)) {
        throw new Error(`.repo-cleanup.yml line ${lineNo}: sequence item outside a sequence`);
      }
      const item = content === "-" ? "" : content.slice(2);
      if (item.includes(":") && !item.startsWith("[") && !item.startsWith("{")) {
        throw new Error(`.repo-cleanup.yml line ${lineNo}: sequences of maps are not supported`);
      }
      top.container.push(parseInline(item, lineNo));
      continue;
    }

    const colon = content.indexOf(":");
    if (colon === -1) {
      throw new Error(`.repo-cleanup.yml line ${lineNo}: expected 'key: value' — got ${content}`);
    }
    const key = content.slice(0, colon).trim();
    const rest = content.slice(colon + 1).trim();

    if (Array.isArray(top.container)) {
      throw new Error(`.repo-cleanup.yml line ${lineNo}: map entry inside a sequence`);
    }

    if (rest === "") {
      // block map or block sequence follows; decide by peeking at the next
      // non-blank, non-comment line
      let j = i + 1;
      let child = null;
      while (j < lines.length) {
        const l = lines[j];
        if (l === undefined) break;
        const c = l.replace(/(^|\s)#.*$/, "$1");
        if (c.trim() !== "") {
          child = c;
          break;
        }
        j++;
      }
      const childIndent = child ? child.length - child.trimStart().length : -1;
      const isSeq = child !== null && childIndent > indent && child.trim().startsWith("-");
      const container = isSeq ? [] : {};
      top.container[key] = container;
      stack.push({ indent, container, kind: isSeq ? "seq" : "map" });
      continue;
    }

    top.container[key] = parseInline(rest, lineNo);
  }

  return /** @type {any} */ (stack[0]).container;
}

// --------------------------------------------------------------------------
// merge + load
// --------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Deep merge where arrays REPLACE (an exclude list is a choice, not an addition). */
export function mergeConfig(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? mergeConfig(base[k], v) : v;
  }
  return out;
}

/**
 * @param {string} [repoRoot]
 * @returns {{ config: any, source: string | null, warnings: string[] }}
 */
export function loadConfig(repoRoot = findRepoRoot()) {
  const warnings = [];
  for (const base of CONFIG_BASENAMES) {
    const p = join(repoRoot, base);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    let parsed;
    try {
      parsed = base.endsWith(".json") ? JSON.parse(text) : parseYamlSubset(text);
    } catch (err) {
      // A broken config must not silently become "defaults" — say so loudly and
      // keep going with defaults so the audit still runs.
      warnings.push(`config at ${base} could not be parsed (${err.message}); using defaults`);
      return { config: DEFAULT_CONFIG, source: null, warnings };
    }
    if (parsed?.version !== undefined && parsed.version !== 1) {
      warnings.push(`config version ${parsed.version} is newer than this skill understands (1)`);
    }
    return { config: mergeConfig(DEFAULT_CONFIG, parsed), source: base, warnings };
  }
  return { config: DEFAULT_CONFIG, source: null, warnings };
}

/** @param {string} p @param {string} repoRoot */
export function isExcluded(p, config, repoRoot = "") {
  const rel = isAbsolute(p) && repoRoot ? p.slice(repoRoot.length + 1) : p;
  const segments = rel.split("/");
  return config.exclude.some(
    (ex) => segments.includes(ex) || rel === ex || rel.startsWith(`${ex}/`),
  );
}

/** Rough, honest token estimate. NEVER present as billing data. */
export function estimateTokens(chars) {
  return Math.round(chars / 4);
}
