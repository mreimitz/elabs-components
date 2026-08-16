/**
 * @elabs/components-cli — the static-audit detector (token/style/anti-slop lint).
 *
 * Extracted from `bin/brand-ui.mjs` so the rule set is (a) unit-testable
 * (`test/audit.test.mjs`) and (b) reusable by the WP-15 anti-slop CI gate
 * (`scripts/check-anti-slop.mjs`) WITHOUT duplicating the slop patterns — one
 * source of truth. Pure string ops only (no `node:fs`), so it imports cleanly
 * into a pre-build CI gate and into a consuming project's CLI alike.
 *
 * SCOPE — this is the *deterministic* pass. It catches what a regex can prove on
 * a single line of source. The rendered cross-theme / WCAG-contrast / layout-
 * overflow / "does this look AI-generated?" judgments need a browser and live in
 * the `brand-ui-audit` skill (the LLM/visual pass). Perceptual, register-gated
 * judgments (anti-card-overuse, three-equal-feature-cards, motion intensity)
 * deliberately stay OUT of this file — a regex can't read them honestly.
 *
 * WP-15 (#107): harvested the taste-skill's AI-TELLS catalog — both VISUAL tells
 * and the CONTENT "Jane Doe effect" — token-translated. Every prescription that
 * conflicted with brand-ui's rules was reconciled in brand-ui's favor: no raw
 * hex/font literals leak in (the styling/token rules win), and nothing mandates
 * motion. See research/enterprise-gap/09-taste-adoption.md and
 * skills/brand-ui-audit/reference/anti-patterns.md.
 */

/**
 * CONTENT anti-slop — the "Jane Doe effect" (taste-skill §7). The high-value add
 * the audit lacked: generic placeholder names, fake-perfect numbers, and
 * startup-slop brand names baked into shipped source. Brand-agnostic and
 * deterministic, so this exact set is BOTH the audit's content pass AND the
 * ratcheted CI gate (`scripts/check-anti-slop.mjs`). Patterns are NON-global so
 * they're safe for per-line `.test()`; `countContentSlop` clones them with `g`.
 *
 * Deliberately NARROW (low false-positive) — placeholder content is sometimes
 * intentional (stories, copy-own blocks, syntax-doc examples), so the gate
 * RATCHETS (grandfathers what exists, blocks what's new) rather than hard-bans,
 * and these stay ADVISORY in the read-only audit. Filler/marketing words are a
 * separate, even noisier class kept advisory-only (see `marketing-buzzword`),
 * NOT in the hard gate.
 *
 * @type {{ id: string, re: RegExp, msg: string }[]}
 */
export const CONTENT_SLOP_RULES = [
  {
    id: "slop-generic-name",
    // The taste-skill's named offenders + the canonical "<First> Doe" pattern.
    re: /\b(?:john|jane)\s+doe\b|\bsarah\s+chan\b|\bjack\s+su\b/i,
    msg: 'generic placeholder name (the "Jane Doe effect") — use a realistic, domain-specific name',
  },
  {
    id: "slop-fake-number",
    // Fake-perfect stats: "99.9%"/"99.99%" uptime, the "1234567" sequence.
    // Requires a literal "%" so real prices ($99.99) and alpha/fractions (/50,
    // 1/2) and larger numbers (199.99%) do NOT trip it.
    re: /\b99\.9{1,2}\s*%|\b1234567\b/,
    msg: "fake-perfect number (99.99% / 1234567) — use a realistic, specific figure",
  },
  {
    id: "slop-brand-name",
    // Startup-slop brand names. Brand identity lives in tokens + logo, never in
    // hardcoded sample copy — so a real product name belongs here instead.
    re: /\b(?:acme|nexus|smartflow|cloudly)\b/i,
    msg: "slop brand name (Acme/Nexus/SmartFlow/Cloudly) — brand lives in tokens/logo; sample copy should use the real product name",
  },
];

/**
 * VISUAL anti-slop additions (taste-skill §3/§5/§7), token-translated. Each
 * names the brand-ui fix, never a literal. The pre-existing visual rules
 * (raw-hex, gradient-text, side-stripe, over-round, …) live in RULES below; these
 * are the NEW tells the catalog adds. Mostly advisory: a few (`bg-black` overlay
 * scrims, `h-screen` in a deliberately full-bleed shell) are legitimate, so they
 * inform rather than block — the gate's teeth are on CONTENT slop, where a regex
 * is unambiguous.
 *
 * @type {{ id: string, re: RegExp, msg: string, advisory?: boolean }[]}
 */
const VISUAL_SLOP_RULES = [
  {
    id: "pure-black",
    advisory: true,
    // `text/border/ring/fill/stroke-black`, and bare `bg-black` — but NOT
    // `bg-black/<alpha>` (a legitimate overlay scrim, e.g. DialogOverlay).
    re: /\b(?:text|border|ring|fill|stroke)-black\b|\bbg-black\b(?!\/)/,
    msg: "pure black — use a foreground/border token (off-black); bg-black is only OK as an alpha overlay scrim (bg-black/50)",
  },
  {
    id: "neon-glow",
    advisory: true,
    // Arbitrary outer glow: a 0 0 <blur> shadow. Tinted/inset shadow tokens read
    // as depth; a 0-offset glow reads as AI neon.
    re: /(?:drop-)?shadow-\[0_0_/,
    msg: "neon/outer glow (0 0 blur) — use a tinted/inset shadow token, not an outer glow",
  },
  {
    id: "custom-cursor",
    // Tailwind arbitrary (`cursor-[url(…)]`) and CSS / CSS-in-JS (`cursor: url(…)`,
    // `cursor: "url(…)"`) forms.
    re: /cursor-\[url\(|cursor:\s*["']?url\(/,
    msg: "custom mouse cursor — accessibility-hostile and dated; keep the system cursor",
  },
  {
    id: "viewport-h-screen",
    advisory: true,
    // h-screen / min-h-screen use 100vh, which is wrong on mobile (the URL bar
    // gap). Prefer the dvh-backed utilities for a viewport-stable full height.
    re: /\bh-screen\b/,
    msg: "h-screen (100vh) — use min-h-dvh / min-h-[100dvh] for mobile viewport stability",
  },
];

/**
 * The full deterministic rule set. Ported (token-aware) from the impeccable
 * detector's regex engine, then extended with the taste-skill catalog (WP-15).
 *
 * Rule flags:
 *   - `advisory`  — informational; shown in a separate list, never the headline.
 *   - `colorRule` — exempt inside `themes.css` (the one place raw color is legal).
 *   - `copyRule`  — a CONTENT/prose check; skipped in `.css` files (no JSX copy).
 *   - `category`  — grouping for reporting ("content-slop" / "visual-slop").
 *   - `brandTolerant` — the BRAND register legitimately does this (see below).
 *
 * Regexes are NON-global (safe for per-line `.test()`); never add `g` here.
 *
 * @type {{ id: string, re: RegExp, msg: string, advisory?: boolean, colorRule?: boolean, copyRule?: boolean, category?: string, brandTolerant?: boolean }[]}
 */
export const RULES = [
  // — tokens / color —
  {
    id: "raw-hex",
    colorRule: true,
    re: /#[0-9a-fA-F]{3,8}\b/,
    msg: "raw hex color — use a semantic token (bg-*/text-*/border-*)",
  },
  {
    id: "rgb-literal",
    colorRule: true,
    re: /\b(?:rgb|rgba|hsl|hsla)\(/,
    msg: "raw color function — use a semantic token",
  },
  {
    id: "arbitrary-color",
    colorRule: true,
    re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-\[(?:#|(?:rgb|hsl|oklch|oklab|lab|lch|hwb)a?\()/i,
    msg: "arbitrary color value — use a token",
  },
  {
    id: "gradient-text",
    re: /bg-clip-text|background-clip:\s*text|\[background-clip:\s*text\]/,
    msg: "gradient text (bg-clip-text) — banned; use one solid token color, emphasis via weight/size",
  },
  // — radius (brand-ui standardizes on --radius; no hardcoded/over-round) —
  {
    id: "arbitrary-radius",
    re: /\brounded-\[[\d.]+(?:px|rem|em)/,
    msg: "hardcoded radius — use the --radius scale (rounded-sm/md/lg/xl)",
  },
  {
    id: "over-round",
    brandTolerant: true,
    re: /\brounded-(?:3xl|4xl|\[(?:[3-9]\d|\d{3})px\])\b/,
    msg: "over-rounded corner — brand-ui radius is intentionally tight; use rounded-md/lg",
  },
  // — layout / spacing / sizing —
  { id: "space-y-x", re: /\bspace-[xy]-\d/, msg: "space-x/space-y — use flex/grid with gap-*" },
  { id: "wh-equal", re: /\bw-(\d+)\s+h-\1\b/, msg: "w-N h-N with equal values — use size-N" },
  {
    id: "side-stripe",
    brandTolerant: true,
    re: /\bborder-[lr]-(?:2|4|8)\b/,
    msg: "side-stripe accent border — AI tell; use a full border, bg tint, or leading icon",
  },
  // — typography —
  {
    id: "tiny-text",
    re: /\btext-\[(?:[0-9]|10|11)px\]|font-size:\s*(?:[0-9]|1[01])px\b/,
    msg: "body text < 12px — use ≥14px (16px ideal)",
  },
  {
    id: "tight-leading",
    advisory: true,
    re: /\bleading-none\b|line-height:\s*(?:0?\.\d+|1)\s*[;}]/,
    msg: "tight line-height — fine on headings, but body text wants 1.5–1.7",
  },
  {
    id: "justified-text",
    re: /\btext-justify\b|text-align:\s*justify/,
    msg: "justified text — rivers of white; use left-align (or hyphens:auto)",
  },
  // — motion —
  {
    id: "bounce-easing",
    brandTolerant: true,
    re: /\b(?:bounce|elastic)\b|cubic-bezier\([^)]*(?:-0?\.\d|1\.[1-9])/i,
    msg: "bounce/elastic/overshoot easing — use ease-out-quart/quint/expo",
  },
  {
    id: "layout-anim",
    advisory: true,
    re: /transition:\s*[^;]*\b(?:width|height|margin|padding|top|left)\b|transition-\[(?:width|height|margin|padding)/,
    msg: "animating layout properties — prefer transform/opacity (intentional width transitions, e.g. a collapsing sidebar, are fine)",
  },
  // — a11y —
  {
    id: "outline-none",
    advisory: true,
    re: /outline-none(?![^"]*ring)/,
    msg: "outline-none with no ring on the same line — verify a focus-visible:ring exists (line-based check; multi-line classNames may be fine)",
  },
  // — visual anti-slop (WP-15 taste-skill §3/§5/§7, token-translated) —
  ...VISUAL_SLOP_RULES.map((r) => ({ ...r, category: "visual-slop" })),
  // — copy (advisory) —
  {
    id: "marketing-buzzword",
    advisory: true,
    copyRule: true,
    re: /\b(?:streamline|empower|supercharge|leverage|unleash|seamless|world-class|enterprise-grade|next-generation|next-gen|cutting-edge|game-changer|mission-critical|elevate|revolutionize|reimagine|disrupt)\b/i,
    msg: "marketing buzzword / filler verb — name what it literally does",
  },
  {
    id: "em-dash-overuse",
    advisory: true,
    copyRule: true,
    re: /—[^—\n]*—/,
    msg: "two+ em-dashes in a line — use commas/colons/periods",
  },
  // — content anti-slop (WP-15 "Jane Doe effect", taste-skill §7) —
  // Advisory in the read-only audit (placeholders can be intentional); the
  // ratcheted CI gate (scripts/check-anti-slop.mjs) is where these get teeth.
  ...CONTENT_SLOP_RULES.map((r) => ({
    ...r,
    advisory: true,
    copyRule: true,
    category: "content-slop",
  })),
];

/**
 * REGISTER GATING (#108). The taste profile's `register` axis decides WHICH BAR a
 * surface is judged against, so the detector's severities must vary with it —
 * previously every scan assumed `product` and a marketing hero got told off for
 * being expressive. Only the `brandTolerant` rules move, and they only ever
 * SOFTEN (blocking → advisory) in the `brand` register; nothing a repo rule bans
 * outright (raw color, `gradient-text`, tiny text, custom cursors) is negotiable,
 * and CONTENT slop is slop in both registers. The perceptual register-gated tells
 * (3-equal-cards, anti-card-overuse) stay in the skill's rendered pass — a regex
 * can't read them honestly.
 *
 * @param {string} register
 * @returns {boolean} whether `brandTolerant` rules downgrade to advisory.
 */
function softensBrandTells(register) {
  return register === "brand";
}

/**
 * Scan one file's text against every applicable rule.
 * @param {string} text - the file contents.
 * @param {{ isCss?: boolean, isThemeFile?: boolean, register?: "product"|"brand" }} [opts]
 *   `register` is the active taste profile's register (default "product", the
 *   restrained bar). See `softensBrandTells`.
 * @returns {{ rule: string, advisory: boolean, category: string|undefined, line: number, msg: string, text: string }[]}
 */
export function scanText(text, { isCss = false, isThemeFile = false, register = "product" } = {}) {
  const soften = softensBrandTells(register);
  const findings = [];
  text.split("\n").forEach((line, i) => {
    for (const rule of RULES) {
      if (isThemeFile && rule.colorRule) continue; // themes.css owns raw color
      if (isCss && rule.copyRule) continue; // no JSX/prose copy in .css
      if (rule.re.test(line)) {
        findings.push({
          rule: rule.id,
          advisory: Boolean(rule.advisory) || (soften && Boolean(rule.brandTolerant)),
          category: rule.category,
          line: i + 1,
          msg: rule.msg,
          text: line.trim().slice(0, 100),
        });
      }
    }
  });
  return findings;
}

/**
 * Every CONTENT-slop occurrence in `text`, with line + the matched string. Uses
 * a global clone of each (non-global) CONTENT_SLOP_RULES pattern so repeated
 * matches on one line all count. This is the gate's source of truth.
 * @param {string} text
 * @returns {{ id: string, line: number, match: string, msg: string }[]}
 */
export function findContentSlop(text) {
  const out = [];
  const globals = CONTENT_SLOP_RULES.map((r) => ({
    id: r.id,
    msg: r.msg,
    g: new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : r.re.flags + "g"),
  }));
  text.split("\n").forEach((line, i) => {
    for (const { id, msg, g } of globals) {
      g.lastIndex = 0;
      for (const m of line.matchAll(g)) out.push({ id, line: i + 1, match: m[0], msg });
    }
  });
  return out;
}

/** Total CONTENT-slop occurrences in `text` (the ratchet count). */
export function countContentSlop(text) {
  return findContentSlop(text).length;
}
