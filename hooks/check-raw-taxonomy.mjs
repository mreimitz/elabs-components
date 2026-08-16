#!/usr/bin/env node
/**
 * brand-ui plugin · PostToolUse(Write|Edit) hook — taxonomy guard for end users.
 *
 * After a coding agent edits a .tsx/.jsx, this scans the file for the two
 * design-system violations that make agent-built UIs look chaotic and feeds them
 * straight back as context, so the agent self-corrects IN THE LOOP:
 *   - raw font sizes (`text-2xl`, `text-[18px]`)  → "type is a ROLE, not a size"
 *   - raw colours (`text-gray-500`, `bg-[#fff]`)  → "colour is a TOKEN, not a palette"
 *
 * ADVISORY ONLY — it never blocks the edit (exit 0). It is the in-loop sibling of
 * the durable CI gate (@qlik-coe-emea/qlabs-components-eslint-config `brand/no-raw-*`); the regexes mirror
 * that rule + scripts/check-raw-palette.mjs so all three surfaces agree.
 *
 * Zero-dependency (Node ESM, stdin/JSON only) so it works in any installed plugin
 * before `pnpm install`. The library's own source + copy-own registry blocks are
 * skipped — those are governed by the repo ratchets, not this consumer-facing hook.
 */
import { readFileSync } from "node:fs";

// Mirror of @qlik-coe-emea/qlabs-components-eslint-config rules/brand-tokens.js + scripts/check-raw-palette.mjs.
const FONT_SIZE_RE = /\b-?text-(?:xs|sm|base|lg|xl|[0-9]+xl)\b/g;
const FONT_SIZE_ARB_RE = /\b-?text-\[[^\]]*(?:px|rem|em|ch|vw|vh|pt|pc)\b[^\]]*\]/g;
const PALETTE_RE =
  /\b-?(?:text|bg|border|fill|stroke|ring|from|via|to|outline|decoration|accent|caret|shadow|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?\b/g;
const COLOR_ARB_RE =
  /\b-?(?:text|bg|border|fill|stroke|ring|from|via|to|outline|decoration|accent|caret|shadow|divide|placeholder)-\[(?:#|rgb|hsl|hwb|oklch|oklab|lab|lch|color\b)[^\]]*\]/gi;

/** Skip library source + copy-own blocks + demos (governed elsewhere) + vendored. */
const SKIP =
  /(?:node_modules|\/dist\/|storybook-static|\.turbo|coverage|\/packages\/[^/]+\/src\/|\/registry\/|\.stories\.|\.test\.)/;

const MAX_LISTED = 40; // keep additionalContext well under the 10k cap

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let input;
try {
  input = JSON.parse(readStdin());
} catch {
  process.exit(0);
}

const file = input?.tool_input?.file_path ?? "";
if (!/\.(tsx|jsx|ts|js)$/.test(file) || SKIP.test(file)) process.exit(0);

let src;
try {
  src = readFileSync(file, "utf8");
} catch {
  process.exit(0);
}

const sizes = [];
const colors = [];
src.split("\n").forEach((line, i) => {
  const ln = i + 1;
  for (const re of [FONT_SIZE_RE, FONT_SIZE_ARB_RE])
    for (const m of line.matchAll(re)) sizes.push({ ln, cls: m[0].replace(/^-/, "") });
  for (const re of [PALETTE_RE, COLOR_ARB_RE])
    for (const m of line.matchAll(re)) colors.push({ ln, cls: m[0].replace(/^-/, "") });
});

if (sizes.length === 0 && colors.length === 0) process.exit(0);

const name = file.split("/").pop();
const fmt = (arr) =>
  arr
    .slice(0, MAX_LISTED)
    .map((f) => `    L${f.ln}: ${f.cls}`)
    .join("\n") + (arr.length > MAX_LISTED ? `\n    … +${arr.length - MAX_LISTED} more` : "");

let ctx = `brand-ui taxonomy guard — ${sizes.length + colors.length} raw utility(ies) in ${name} that break the design system. Fix these before moving on:`;
if (sizes.length)
  ctx +=
    `\n\n• Type is a ROLE, not a size. Replace with a text-<role> utility (display / title / subtitle / body / caption / meta / kpi) or a <Heading>/<Text> component:\n` +
    fmt(sizes);
if (colors.length)
  ctx +=
    `\n\n• Colour is a TOKEN, not a palette. Replace with a semantic token (text-foreground, text-muted-foreground, bg-card, bg-primary + text-primary-foreground, bg-success/10, border-border, …). Raw palette/hex bypasses every theme and breaks contrast:\n` +
    fmt(colors);
ctx += `\n\nSee the app's CLAUDE.md (Non-negotiable rules) — enforced by @qlik-coe-emea/qlabs-components-eslint-config (brand/no-raw-font-size, brand/no-raw-color).`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: ctx },
  }),
);
process.exit(0);
