#!/usr/bin/env node
/**
 * extract-tokens.mjs — ONE-TIME bootstrap (kept in the repo for re-seeding).
 * ---------------------------------------------------------------------------
 * Seeds the DTCG (W3C Design Tokens) JSON source under `packages/tokens/tokens/`
 * from the CURRENT, hand-authored values in `src/themes.css`. Because we copy
 * each token's EXACT literal value string verbatim (oklch or `var(--…)`), the
 * Style-Dictionary build that reads these files back out and the in-place
 * assembler that writes them into themes.css are a perfect NO-OP on a fresh
 * checkout — byte-stable by construction.
 *
 * LAYOUT (SD-v5-friendly, one mode per file):
 *   tokens/$themes.json          — the mode list (the six themes, in order).
 *   tokens/themes/<mode>.tokens.json
 *                                — { "<token>": { "$type", "$value", "$description" } }
 *                                  per-mode flat color group, value = literal string.
 *
 * Descriptions are authored here (intent / when-to-use) and live ONLY on the
 * canonical `light` mode file; the others omit `$description` (values vary per
 * theme, intent does not). The build/assembler ignore `$description` — it is
 * documentation that rides with the values.
 *
 * Re-run ONLY to re-seed from a known-good themes.css (it OVERWRITES the JSON).
 * Day-to-day, edit the JSON and run `pnpm --filter @qlik-coe-emea/qlabs-components-tokens tokens:build`.
 *
 * Usage:  node packages/tokens/scripts/extract-tokens.mjs
 * Dependency-free; ESM.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  THEME_NAMES,
  TOKENS_DIR,
  locateBlock,
  parseScopedTokens,
  readThemesCss,
} from "./lib/themes-io.mjs";

/**
 * One-line `$description` per semantic token — the INTENT (when to use it). Any
 * token not listed gets a generic fallback; add entries as the surface grows.
 * Authored, not extracted — this is the human-meaningful half of DTCG.
 */
const DESCRIPTIONS = {
  "--background": "Page/document ground — the lowest surface everything sits on.",
  "--foreground": "Default body text color on --background.",
  "--card": "Card/panel surface raised off the page ground.",
  "--card-foreground": "Text color on --card.",
  "--popover": "Floating overlay surface (menus, popovers, tooltips).",
  "--popover-foreground": "Text color on --popover.",
  "--primary": "Brand accent — primary action fill (buttons, active state).",
  "--primary-foreground": "Ink on a --primary fill.",
  "--secondary": "Low-emphasis action/secondary surface fill.",
  "--secondary-foreground": "Ink on --secondary.",
  "--muted": "Muted surface for de-emphasized regions.",
  "--muted-foreground": "De-emphasized text; ≥4.5:1 on --muted/--surface-muted.",
  "--accent": "Subtle accent surface (hover rows, highlighted cells).",
  "--accent-foreground": "Text color on --accent.",
  "--destructive": "Danger/error fill (destructive buttons, error plates).",
  "--destructive-foreground": "Ink on a --destructive fill.",
  "--destructive-text": "On-surface error TEXT color; ≥4.5:1 on content surfaces.",
  "--success": "Success/positive fill.",
  "--success-foreground": "Ink on a --success fill.",
  "--success-text": "On-surface success TEXT color; ≥4.5:1 on content surfaces.",
  "--warning": "Warning/caution fill.",
  "--warning-foreground": "Ink on a --warning fill.",
  "--warning-text": "On-surface warning TEXT color; ≥4.5:1 on content surfaces.",
  "--info": "Informational fill.",
  "--info-foreground": "Ink on an --info fill.",
  "--info-text": "On-surface info TEXT color; ≥4.5:1 on content surfaces.",
  "--border": "Subtle/redundant hairline boundary (the default border color).",
  "--border-strong": "Load-bearing divider/outline; ≥3:1 vs --card/--background (WCAG 1.4.11).",
  "--input": "Form-field border; on the strong (≥3:1) rung.",
  "--ring": "Focus ring color.",
  "--surface": "Layered neutral surface for shells/panels.",
  "--surface-muted": "Muted layered surface (toolbars, table headers).",
  "--surface-elevated": "Most-elevated neutral surface.",
  "--sidebar": "App-chrome sidebar ground.",
  "--sidebar-foreground": "Text color on --sidebar.",
  "--sidebar-muted-foreground": "Muted sidebar nav text; ≥4.5:1 vs --sidebar.",
  "--sidebar-border": "Sidebar border/divider.",
  "--sidebar-accent": "Sidebar hover/active surface.",
  "--sidebar-accent-foreground": "Text color on --sidebar-accent.",
  "--sidebar-primary": "Primary accent within the sidebar.",
  "--sidebar-primary-foreground": "Ink on --sidebar-primary.",
  "--sidebar-ring": "Focus ring within the sidebar.",
  "--canvas": "React Flow / drawing canvas ground.",
  "--canvas-grid": "Canvas grid line color.",
  "--flow-node": "React Flow node surface.",
  "--flow-node-foreground": "Text color on a flow node.",
  "--flow-edge": "React Flow edge/connector color.",
  "--chat-user": "AI chat — user message bubble surface.",
  "--chat-user-foreground": "Text color on a user message bubble.",
  "--chat-assistant": "AI chat — assistant message bubble surface.",
  "--chat-assistant-foreground": "Text color on an assistant message bubble.",
  "--chart-1": "Categorical data series 1.",
  "--chart-2": "Categorical data series 2.",
  "--chart-3": "Categorical data series 3.",
  "--chart-4": "Categorical data series 4.",
  "--chart-5": "Categorical data series 5.",
  "--chart-grid": "Chart gridlines (alias).",
  "--chart-foreground": "Chart foreground text/lines (alias).",
  "--chart-foreground-muted": "Muted chart foreground (alias).",
  "--chart-background": "Chart plotting background (alias).",
  "--chart-label": "Chart axis/label text (alias).",
  "--chart-crosshair": "Chart crosshair color (alias).",
  "--chart-line-primary": "Primary chart line (alias of --chart-1).",
  "--chart-line-secondary": "Secondary chart line (alias of --chart-2).",
  "--chart-brush-border": "Chart brush/selection border (alias).",
  "--chart-indicator-color": "Chart indicator color (alias).",
  "--chart-indicator-secondary-color": "Secondary chart indicator color (alias).",
  "--chart-marker-background": "Chart marker background (alias).",
  "--chart-marker-foreground": "Chart marker foreground (alias).",
  "--chart-marker-border": "Chart marker border (alias).",
  "--chart-marker-badge-background": "Chart marker badge background (alias).",
  "--chart-marker-badge-foreground": "Chart marker badge ink (alias).",
  "--chart-ring-background": "Chart ring/gauge background (alias).",
  "--chart-segment-background": "Chart segment background (alias).",
  "--chart-segment-line": "Chart segment divider (alias).",
  "--chart-tooltip-background": "Chart tooltip surface (alias).",
  "--chart-tooltip-foreground": "Chart tooltip text (alias).",
  "--chart-tooltip-muted": "Muted chart tooltip text (alias).",
  "--legend-foreground": "Chart legend text (alias).",
  "--legend-muted": "Muted chart legend surface (alias).",
  "--legend-muted-foreground": "Muted chart legend text (alias).",
  "--legend-track": "Chart legend track/rail (alias).",
  "--rule": "Reprographic drawn rule (hairline).",
  "--rule-strong": "Stronger reprographic rule.",
  "--grid-line": "Graph-paper minor grid line.",
  "--grid-line-major": "Graph-paper major grid line.",
};

/** Strip the leading `--` for a cleaner DTCG token name. */
const dtcgName = (cssVar) => cssVar.replace(/^--/, "");

function main() {
  const css = readThemesCss();

  mkdirSync(join(TOKENS_DIR, "themes"), { recursive: true });

  for (const mode of THEME_NAMES) {
    const loc = locateBlock(css, mode);
    if (!loc) throw new Error(`extract-tokens: theme block "${mode}" not found in themes.css`);
    const tokens = parseScopedTokens(loc.body);

    const group = {};
    for (const { name, value } of tokens) {
      const entry = { $type: "color", $value: value };
      // Author the intent only on the canonical `light` mode (values vary per
      // theme; intent does not). Falls back to a generic note if unlisted.
      if (mode === "light") {
        entry.$description = DESCRIPTIONS[name] ?? `Semantic token ${name}.`;
      }
      group[dtcgName(name)] = entry;
    }

    const file = join(TOKENS_DIR, "themes", `${mode}.tokens.json`);
    writeFileSync(file, JSON.stringify(group, null, 2) + "\n", "utf8");
    process.stdout.write(`  wrote ${file} (${tokens.length} tokens)\n`);
  }

  // The mode manifest — the ordered list of themes, consumed by the SD config.
  // Emit the short `modes` array inline so the output is Prettier-stable (a short
  // array prints on one line; `JSON.stringify(…, 2)` would one-per-line it and
  // drift from format:check on every re-seed).
  const modesInline = "[" + THEME_NAMES.map((m) => JSON.stringify(m)).join(", ") + "]";
  const manifest =
    "{\n" +
    `  "$description": "DTCG theme modes for @qlik-coe-emea/qlabs-components-tokens.",\n` +
    `  "modes": ${modesInline}\n` +
    "}\n";
  writeFileSync(join(TOKENS_DIR, "$themes.json"), manifest, "utf8");
  process.stdout.write(`  wrote ${join(TOKENS_DIR, "$themes.json")}\n`);
  process.stdout.write("✔ extract-tokens: DTCG source seeded from themes.css\n");
}

main();
