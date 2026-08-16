/**
 * themes-io.mjs — shared parse helpers for the DTCG ⇄ themes.css pipeline.
 *
 * The single source of truth for:
 *   - WHERE the six theme blocks live in themes.css (the same FIRST-match block
 *     extraction the parity gate + contrast test use), and
 *   - WHICH `--token: value;` lines are "in scope" for the DTCG value sync.
 *
 * In scope = a per-theme SEMANTIC color/value token whose value is a literal
 * `oklch(...)` OR a `var(--…)` alias, and whose name is NOT machinery (the
 * parity gate's root-only allowlist: decoration / blueprint / motion / radius /
 * font). The assembler rewrites ONLY the value text of these lines, in place,
 * matched by token name within each block — every other byte is preserved.
 *
 * Dependency-free, ESM, cwd-independent.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/tokens/scripts/lib
export const TOKENS_PKG = dirname(dirname(HERE)); // → packages/tokens
export const THEMES_CSS = join(TOKENS_PKG, "src", "themes.css");
export const TOKENS_DIR = join(TOKENS_PKG, "tokens");

/**
 * Theme mode key → block, in report order. `light` is the FIRST `:root` block
 * (the neutral base/fallback, not a selectable theme); the rest are the FIRST
 * `[data-theme="name"]` block. Mirrors THEME_NAMES in scripts/check-theme-parity.mjs.
 *
 * A PAUSED theme is absent: its DTCG file and its CSS block both stay on disk,
 * but the sync never reads or rewrites them — "kept as source, not touched"
 * (.claude/rules/paused-surfaces.md).
 */
export const THEME_NAMES = ["light", "qlik-bright", "qlik-dark"];

/**
 * Machinery declared per-theme but NOT a synced semantic value (timing /
 * decoration / blueprint overlay / radius scale / fonts). Identical to the
 * parity gate's ROOT_ONLY_RE so the two stay in lockstep.
 */
const MACHINERY_RE = /^--(decoration($|-)|bp-|duration-|t-|motion-|radius($|-)|font-)/;

/**
 * A token is in scope for the DTCG sync iff it is NOT machinery AND its value is
 * an `oklch(...)` literal or a `var(--…)` alias. Hex brand-mark tokens, the
 * `linear()`/`calc()` machinery, etc. are intentionally left out (exactness +
 * safety — we never touch a line we don't own).
 */
export function isInScope(name, value) {
  if (MACHINERY_RE.test(name)) return false;
  const v = value.trim();
  return /^oklch\([^;]*\)$/.test(v) || /^var\(--[\w-]+\)$/.test(v);
}

/**
 * Match the body of a theme block exactly the way the parity gate does:
 *   light → first `:root { … \n}`; else → first `[data-theme="name"] { … \n}`.
 * Returns { start, end, body } char offsets into `cssText`, or null if absent.
 * `start`/`end` bracket the INNER body (between `{` and the closing `\n}`), so a
 * value rewrite stays strictly inside this one block.
 */
export function locateBlock(cssText, name) {
  const re =
    name === "light"
      ? /:root\s*\{([\s\S]*?)\n\}/
      : new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = re.exec(cssText);
  if (!m) return null;
  const body = m[1];
  const start = m.index + m[0].indexOf(body, m[0].indexOf("{"));
  return { start, end: start + body.length, body };
}

/**
 * Blank out CSS comments, preserving length and newlines so byte offsets stay
 * valid for any caller that needs them. `themes.css` documents the very
 * tokens this scanner parses, so a comment sitting directly above a
 * declaration routinely contains a `--token:`-shaped substring (e.g. the real
 * comment above qlik-bright's `--ring`, themes.css:826-834, which mentions
 * `--info:`). Without blanking, the lazy `[^;]*?` below can start a match
 * INSIDE that comment and run to the semicolon of the NEXT real declaration,
 * silently dropping it (#401 — the same hazard `scripts/check-elevation.mjs`'s
 * `blankComments` was written to fix, and the same fix already applied in
 * `scripts/check-role-distinctness.mjs`). Duplicated here (rather than
 * imported across the packages/tokens ⇄ repo-root `scripts/` boundary) to
 * keep this pure, dependency-free, cwd-independent file self-contained.
 */
function blankComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Parse one block body → ordered [{ name, value }] of IN-SCOPE tokens only.
 * Captures the EXACT literal value string (trimmed of trailing whitespace, no
 * trailing `;`), e.g. `oklch(0.594 0.163 150)` or `var(--border)`.
 */
export function parseScopedTokens(body) {
  const out = [];
  for (const m of blankComments(body).matchAll(/(--[\w-]+)\s*:\s*([^;]*?)\s*;/g)) {
    const name = m[1];
    const value = m[2].trim();
    if (isInScope(name, value)) out.push({ name, value });
  }
  return out;
}

/** Read the committed themes.css source. */
export function readThemesCss() {
  return readFileSync(THEMES_CSS, "utf8");
}
