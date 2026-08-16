#!/usr/bin/env node
/**
 * check-attribution-provenance.mjs — shipped source may not name an upstream it
 * borrowed from unless that upstream is actually credited.
 *
 * Incident: the repo credited 6 things in `scripts/attributions.sources.json`
 * while ~15 real borrowings existed only as source-file comments — Milkdown
 * vendored wholesale under `packages/editor/src/markdown-editor/milkdown-react/`,
 * anyview's adapter-registry architecture in `packages/viewer`, three shipped
 * `blocks.so` sidebars, assistant-ui's grouping design, and more. Several named
 * no licence at all. `pnpm attributions:check` could not catch any of it: it
 * proves the generated outputs match the dataset, never that the dataset matches
 * the repo. So the credits list stayed frozen at 6 while the borrowing kept
 * going, and the repo is headed for public release.
 *
 * The rule this enforces (`.claude/rules/attribution.md`): a comment saying
 * "adapted from X" is a pointer, not an attribution — X must have an entry in
 * the dataset, added in the same change.
 *
 * DETECTION. Strong provenance phrases only — `adapted from`, `vendored from`,
 * `borrowed from`, `forked from`, `copied from`, `ported from`, `port of`. A hit
 * resolves if any credited upstream's alias (its name, id, or the owner/repo
 * segments of its URL) appears as a whole word on the same line, or if the line
 * names only first-party work.
 *
 * Three near-miss phrases are deliberately EXCLUDED, because a gate that cries
 * wolf gets routed around within a week:
 *   - `based on` / `inspired by` — ubiquitous in ordinary design prose ("based on
 *     the density factor").
 *   - `derived from` — measured, not assumed: it appears 22 times in this repo
 *     meaning "computed from" ("derived from Object.keys(data[0])", "derived from
 *     the active brand theme") against zero third-party credits that rely on it
 *     alone. Including it made the gate 65% noise on its first run.
 * The cost is real and worth stating: a future borrowing whose ONLY marker is the
 * word "derived" passes this gate. The rule, the review and `attributions:check`
 * carry that case; this gate carries the phrases that are almost always
 * attributive.
 *
 * SCOPE, honestly. Shipped source (`packages/<pkg>/src/`, excluding tests) and
 * `registry/` — where borrowed CODE lives. Not `docs/ADR/`, whose "Prior art
 * evaluated" sections legitimately name projects that were considered and
 * REJECTED, and not `.claude/rules/`. Those are on the author and the reviewer.
 *
 *   node scripts/check-attribution-provenance.mjs            # CI / manual
 *   node scripts/check-attribution-provenance.mjs --update   # re-freeze the baseline
 *   node scripts/check-attribution-provenance.mjs --root <d> # self-test escape hatch
 *
 * The baseline (`scripts/attribution-provenance-baseline.json`) freezes hits whose
 * upstream could not be identified at all — it RATCHETS DOWN only: a hit the
 * branch introduces is a failure, never a silent baseline addition.
 *
 * Dependency-free; ESM; cwd-independent. Exports the pure scanner for the
 * self-test (`scripts/check-attribution-provenance.test.mjs`,
 * `pnpm attribution:provenance:check:test`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

const BASELINE_FILE = join(SCRIPT_DIR, "attribution-provenance-baseline.json");

/**
 * Strong provenance phrases. `based on`, `inspired by` and `derived from` are
 * excluded as measured noise — see the header for the counts.
 */
export const PROVENANCE_RE =
  /\b(?:adapted|vendored|borrowed|forked|copied|ported)\s+from\b|\bport\s+of\b/i;

/** Files whose provenance claims are load-bearing: shipped code and the registry. */
export const SCANNED_RE = /^(?:packages\/[^/]+\/src\/|registry\/)/;
export const SCANNED_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|css|json|md)$/;
/** Tests are excluded: they describe fixtures and past bugs, not what ships. */
export const EXCLUDED_RE = /\.(?:test|spec)\.[jt]sx?$|\/__(?:tests|fixtures|mocks)__\//;

/**
 * Names that mean "this came from us". A first-party provenance note is not an
 * attribution obligation — `registry.json`'s "Derived from the Qlik brand palette"
 * credits nobody but the repo itself.
 */
export const FIRST_PARTY_ALIASES = ["elabs", "brand-ui", "qlik", "qlabs"];

/** Lines of trailing context searched for the upstream's name (comments wrap). */
export const CONTEXT_LINES = 2;

const normalizeWord = (s) => String(s).toLowerCase();

/** Every token that identifies an upstream: its name, its id, its URL owner/repo. */
export function aliasesFor(entry) {
  const out = new Set();
  const add = (v) => {
    for (const part of String(v ?? "")
      .toLowerCase()
      .split(/[^a-z0-9.+-]+/)) {
      // 3 chars is the floor: shorter tokens ("ui", "ai") match half the English
      // language and would resolve every hit vacuously.
      if (part.length >= 3) out.add(part);
    }
  };
  add(entry.name);
  add(entry.id);
  if (entry.url) {
    try {
      const u = new URL(entry.url);
      add(
        u.hostname
          .replace(/^www\./, "")
          .split(".")
          .slice(0, -1)
          .join(" "),
      );
      add(u.pathname.replace(/\.[a-z]+$/i, ""));
    } catch {
      /* a malformed URL is the linkedness gate's problem, not this one */
    }
  }
  return out;
}

/**
 * Does `line` name a known upstream (or only first-party work)?
 * Whole-word matching, so the font "Inter" does not resolve "interval".
 */
export function lineResolves(line, aliases) {
  const lower = normalizeWord(line);
  for (const alias of aliases) {
    // Escape regex metacharacters; `.` and `+` are legal in package names.
    const safe = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^a-z0-9])${safe}(?:[^a-z0-9]|$)`, "i").test(lower)) return true;
  }
  return false;
}

/**
 * Scan file contents for unattributed provenance claims. Pure — the self-test
 * drives this directly.
 *
 * @param files    `[{ file, content }]`
 * @param aliases  Set of every credited alias (see `aliasesFor`) ∪ first-party.
 * @returns `[{ file, line, text }]` sorted by file then line.
 */
export function findUnattributed(files, aliases) {
  const hits = [];
  for (const { file, content } of files) {
    const lines = String(content).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!PROVENANCE_RE.test(lines[i])) continue;
      // The upstream's name FOLLOWS the phrase, and a wrapped block comment puts
      // it on the next line ("Adapted from\n * blocks.so") — matching the hit line
      // alone reported those as uncredited while the credit sat one line below.
      const context = lines.slice(i, i + CONTEXT_LINES + 1).join(" ");
      if (lineResolves(context, aliases)) continue;
      hits.push({ file, line: i + 1, text: lines[i].trim().slice(0, 120) });
    }
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export const keyOf = (h) => `${h.file}:${h.line}`;

// ───────────────────────────────── CLI ────────────────────────────────────────

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

export function scannedFiles(root) {
  let tracked;
  try {
    tracked = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  } catch {
    return [];
  }
  return tracked
    .filter((f) => SCANNED_RE.test(f) && SCANNED_EXT_RE.test(f) && !EXCLUDED_RE.test(f))
    .map((file) => {
      const abs = join(root, file);
      if (!existsSync(abs)) return null;
      try {
        return { file, content: readFileSync(abs, "utf8") };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Every credited alias. Reads the curated sources plus the generated dataset —
 * the latter carries the harvested npm dependencies and vendored fonts, which are
 * legitimate provenance targets (`Derived from @visx/curve's own exports`).
 */
export function creditedAliases(root) {
  const aliases = new Set(FIRST_PARTY_ALIASES);
  const sources = join(root, "scripts", "attributions.sources.json");
  if (existsSync(sources)) {
    for (const entry of JSON.parse(readFileSync(sources, "utf8")).sources ?? []) {
      for (const a of aliasesFor(entry)) aliases.add(a);
    }
  }
  // The generated module is TS, not JSON — pull the identifying fields textually
  // rather than importing it (this script must stay dependency-free and must not
  // need the package to build).
  const generated = join(
    root,
    "packages/ui/src/components/attribution-panel/attributions.generated.ts",
  );
  if (existsSync(generated)) {
    const text = readFileSync(generated, "utf8");
    for (const m of text.matchAll(/^\s*(?:id|name|url):\s*"([^"]+)"/gm)) {
      for (const a of aliasesFor({ name: m[1], id: m[1], url: null })) aliases.add(a);
    }
  }
  return aliases;
}

function readBaseline() {
  if (!existsSync(BASELINE_FILE)) return {};
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8")).unresolved ?? {};
}

export function main(argv) {
  const rootIdx = argv.indexOf("--root");
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : REPO_ROOT;
  const update = argv.includes("--update");

  const hits = findUnattributed(scannedFiles(root), creditedAliases(root));

  if (update) {
    const unresolved = {};
    for (const h of hits) unresolved[keyOf(h)] = h.text;
    writeFileSync(
      BASELINE_FILE,
      `${JSON.stringify(
        {
          $comment: [
            "Provenance claims in shipped source whose upstream could NOT be identified,",
            "frozen so they cannot grow. Regenerate with:",
            "  pnpm attribution:provenance:check -- --update",
            "This baseline RATCHETS DOWN only — resolving one and re-running --update is the",
            "intended direction. Adding an entry to hide a NEW borrowing defeats the gate;",
            "credit the upstream in scripts/attributions.sources.json instead.",
          ],
          unresolved,
        },
        null,
        2,
      )}\n`,
    );
    console.log(
      `✔ attribution-provenance: froze ${Object.keys(unresolved).length} unresolved claim(s).`,
    );
    return 0;
  }

  const baseline = readBaseline();
  const fresh = hits.filter((h) => !(keyOf(h) in baseline));

  if (fresh.length > 0) {
    console.error(
      `✖ attribution-provenance gate FAILED (${fresh.length} uncredited borrowing(s)):`,
    );
    for (const h of fresh.slice(0, 50)) console.error(`  ${h.file}:${h.line}: ${h.text}`);
    if (fresh.length > 50) console.error(`  … and ${fresh.length - 50} more`);
    console.error(
      "\nEach line above says this code came from somewhere else, but that upstream has no\n" +
        "entry in scripts/attributions.sources.json — so it appears in neither ATTRIBUTION.md\n" +
        "nor the in-product AttributionPanel. A source comment is a pointer, not an\n" +
        "attribution.\n\n" +
        "Add the upstream (name, canonical URL — the GitHub repo where one exists, licence\n" +
        "read from its actual LICENSE file, and the copyright line verbatim), then run\n" +
        "`pnpm gen:attributions`. See .claude/rules/attribution.md.\n\n" +
        "If the upstream genuinely cannot be identified, say so — do not invent a licence.",
    );
    return 1;
  }

  const stale = Object.keys(baseline).filter((k) => !hits.some((h) => keyOf(h) === k));
  console.log(
    `✔ attribution-provenance: every provenance claim in shipped source resolves to a credited ` +
      `upstream (${Object.keys(baseline).length} baselined${stale.length ? `, ${stale.length} now clean — run --update to ratchet down` : ""}).`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
