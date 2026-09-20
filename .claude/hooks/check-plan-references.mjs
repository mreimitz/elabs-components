#!/usr/bin/env node
/**
 * check-plan-references.mjs — PostToolUse(Write|Edit)
 * ---------------------------------------------------------------------------
 * Forces the third-party-reference decision AT AUTHORSHIP TIME, in the one
 * moment when the agent that wrote the sentence still knows why it wrote it.
 *
 * When a plan, roadmap item, ADR, changeset or research note names a
 * third-party product, exactly two outcomes are legitimate:
 *
 *   1. We genuinely reused their work — code, data, a licensed asset. Then it
 *      belongs in the ATTRIBUTION dataset (`scripts/attributions.sources.json`).
 *   2. It was only a reference we thought with. Then it must DISAPPEAR: say
 *      what the feature does, not whose product it resembles.
 *
 * There is no third option where the name quietly stays in the document.
 *
 * WHY A HOOK AND NOT ONLY A CHECK RULE
 * The `reference-leakage` check rule works from a CURATED list, so it can only
 * ever find products somebody already thought to add. That is a real hole, and
 * no static list closes it. This hook closes it from the other end: it also
 * reports names it does NOT recognise and asks the author — who knows — to
 * either record the product or drop it. That is how the list grows without
 * anybody maintaining it.
 *
 * BLOCKING BEHAVIOUR
 *   exit 2 — a KNOWN product in a planning document. A binary decision, not a
 *            nudge; stderr goes back to the agent, which resolves it.
 *   exit 0 — unknown candidates only. Advisory: too noisy to block on a guess.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  PRODUCTS,
  classifyContext,
  specifierSpans,
} from "../skills/repo-cleanup/scripts/reference-leakage.mjs";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/** Documents where a reference gets WRITTEN: plans, roadmap, research, releases. */
const PLANNING_DOC =
  /^(?:roadmap\/.*\.md|docs\/review\/.*\.md|docs\/ADR\/.*\.md|docs\/playbooks\/.*\.md|\.changeset\/.*\.md|(?:.*\/)?[^/]*(?:PLAN|plan)[^/]*\.md)$/;

/**
 * Domains that are infrastructure, a standards body or our own stack. Citing
 * one is not a product reference.
 */
const INFRA_DOMAIN =
  /^(?:github|githubusercontent|gitlab|npmjs|jsdelivr|unpkg|cdnjs|developer\.mozilla|mozilla|w3|whatwg|ecma-international|tc39|caniuse|web|webkit|chromium|nodejs|typescriptlang|react|reactjs|nextjs|vercel|tailwindcss|radix-ui|lucide|tanstack|xyflow|maplibre|visx|d3js|storybook|vitest|playwright|eslint|prettier|pnpm|turbo|anthropic|claude|openai|wikipedia|arxiv|stackoverflow|smashingmagazine|a11yproject|deque|wcag)\./i;

/**
 * Capitalised words that open sentences, plus our own vocabulary — never
 * candidates. Deliberately short: this list only has to keep the ADVISORY
 * channel readable, because nothing in that channel blocks.
 */
const NOT_A_PRODUCT = new Set(
  (
    "the this that these those a an and or but if when while for with without from into onto " +
    "it its we our you your they their he she them his her one two three first second next " +
    "every each any all some none both either neither what which who whom whose how why where " +
    "use used using add added adds make makes made set sets keep keeps give gives take takes " +
    "default defaults note notes see also example examples " +
    "react next node typescript javascript css html svg json yaml markdown mdx " +
    "storybook radix tailwind lucide tanstack visx maplibre monaco vitest playwright eslint " +
    "prettier turborepo pnpm changesets streamdown rive xterm mermaid zustand " +
    "brand chart charts dashboard sheet tile theme themes token tokens component components " +
    "wcag aria oklch dtcg adr api ui ux cli mcp sdk png csv pdf " +
    // sentence openers and document furniture, measured against this repo's
    // own planning docs — they were half the advisory channel before this
    "today tomorrow yesterday there here now then once still also thus hence " +
    "setup decision decisions amendment centre center note notes summary scope " +
    "phase phases wave waves step steps goal goals risk risks result results " +
    "flow snow rollup vite everything nothing someone anyone nobody " +
    // already covered by INFRA_DOMAIN — keep the two lists agreeing
    "vercel mdn next.js github npm"
  ).split(/\s+/),
);

// ---------------------------------------------------------------------------

function hookInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

/** Known products, minus the mentions the software actually needs to work. */
function knownProducts(text, rel) {
  const found = new Map();
  let offset = 0;
  for (const line of text.split("\n")) {
    const spans = specifierSpans(line);
    for (const p of PRODUCTS) {
      p.re.lastIndex = 0;
      for (const m of line.matchAll(p.re)) {
        const ctx = classifyContext(line, rel, m.index ?? 0, spans);
        if (ctx === "package-specifier" || ctx === "migration-source") continue;
        if (!found.has(p.id)) {
          found.set(p.id, {
            name: m[0],
            line: text.slice(0, offset).split("\n").length,
            excerpt: line.trim().slice(0, 120),
          });
        }
      }
    }
    offset += line.length + 1;
  }
  return [...found.values()];
}

/**
 * Names we do NOT recognise. Two high-signal shapes only — a possessive proper
 * noun ("Datawrapper's own guidance", "Borrow Lumira's drill-down model") and a
 * non-infrastructure domain. Anything looser reproduces the failure that made a
 * heuristic unusable in the first place: in this repo, "capitalised word that
 * looks like a brand" reported the linear scale 444 times. This channel is
 * advisory and never blocks, so it is tuned for recall over precision.
 */
function candidates(text) {
  const knownIds = new Set(PRODUCTS.map((p) => p.id));
  const out = new Map();
  const add = (name, why, line) => {
    const key = name.toLowerCase();
    if (knownIds.has(key) || NOT_A_PRODUCT.has(key) || out.has(key)) return;
    if (PRODUCTS.some((p) => ((p.re.lastIndex = 0), p.re.test(name)))) return;
    out.set(key, { name, why, line });
  };

  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/https?:\/\/(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
      const host = m[1];
      if (INFRA_DOMAIN.test(`${host}.`)) continue;
      add(host.split(".")[0], `linked: ${host}`, i + 1);
    }
    // No sentence-context gate. Requiring reference language ("parity",
    // "inspired by") was the first cut and it missed "Borrow Lumira's
    // drill-down model" — a real product, in a planning note, in the exact
    // phrasing this is meant to catch. A possessive proper noun in a PLANNING
    // document is signal enough, and this channel never blocks.
    for (const m of line.matchAll(/\b([A-Z][A-Za-z0-9.]{2,})(?:'s|’s)\b/g)) {
      add(m[1], "possessive proper noun", i + 1);
    }
  });
  return [...out.values()];
}

// ---------------------------------------------------------------------------

const input = hookInput();
const filePath = input?.tool_input?.file_path;
if (!filePath) process.exit(0);

const rel = relative(ROOT, resolve(filePath));
if (!PLANNING_DOC.test(rel)) process.exit(0);

let text;
try {
  text = readFileSync(resolve(filePath), "utf8");
} catch {
  process.exit(0);
}

const known = knownProducts(text, rel);
const maybe = candidates(text);
if (!known.length && !maybe.length) process.exit(0);

const say = (s) => process.stderr.write(`${s}\n`);

if (known.length) {
  say(`✖ third-party references in a planning document: ${rel}`);
  say("");
  for (const k of known) say(`  line ${k.line}  ${k.name} — "${k.excerpt}"`);
  say("");
  say("  Each one goes exactly one of two ways — there is no leaving it in:");
  say("");
  say("   1. We REUSED their work (code, data, a licensed asset)");
  say("      → add an entry to scripts/attributions.sources.json, then run `pnpm gen`.");
  say("");
  say("   2. It was only a reference we thought with  →  REMOVE the name.");
  say("      Say what the feature does, not whose product it resembles:");
  say('      "X-parity bar richness"  →  "percent, diverging and grouped stacks".');
}

if (maybe.length) {
  if (known.length) say("");
  say(`⚠ names this repo does not recognise, in ${rel}:`);
  for (const c of maybe) say(`  line ${c.line}  ${c.name} (${c.why})`);
  say("");
  say("  If any is a third-party product, it takes the same two-way decision above.");
  say("  Record it so it is caught next time: add it to PRODUCTS in");
  say("  .claude/skills/repo-cleanup/scripts/reference-leakage.mjs — that one list");
  say("  feeds both the `reference-leakage` check rule and this hook.");
}

// A known product is a decision the author must make; an unknown one is a guess.
process.exit(known.length ? 2 : 0);
