/**
 * themes-contrast.test.ts — deterministic, browser-free WCAG AA gate on the
 * design-system color tokens.
 *
 * Parses themes.css, extracts each theme block's raw oklch() token literals,
 * converts oklch → sRGB → WCAG relative luminance, and asserts the text/surface
 * pairings that consumers actually render clear the AA 4.5:1 body-text threshold
 * in EVERY theme. A theme that forgets a token (falling back to :root) or
 * under-tunes one fails here, before it ships. Locks issues #20 and #23.
 */
import { describe, expect, it } from "vitest";

import { readThemeCss } from "./_theme-css-source";
import { contrast, parseOklch } from "./color-contrast";

// ADR 0029 — the reference themes live in their own stylesheets now, so read
// the SET. The helper throws if a theme's block is missing rather than let a
// block regex match less and pass vacuously.
const css = readThemeCss();

const AA = 4.5;
/** WCAG 1.4.11 — non-text UI components (borders/outlines) need ≥3:1. */
const AA_NONTEXT = 3;

/**
 * Theme key → CSS selector body extractor. `root` is the `:root` neutral
 * base/fallback — NOT a selectable theme, and deliberately NOT keyed `light`:
 * `light` is a real shipped theme slug, and a colliding key silently OVERWROTE
 * the base block here (leaving it unaudited) the moment the theme was renamed.
 * Canonical declaration: `ROOT_MODE` in `scripts/lib/themes-io.mjs`.
 */
const THEME_BLOCKS: Record<string, string> = {
  root: extractBlock(/:root\s*\{([\s\S]*?)\n\}/),
  light: extractThemeBlock("light"),
  dark: extractThemeBlock("dark"),
};

function extractBlock(re: RegExp): string {
  const m = css.match(re);
  const body = m?.[1];
  if (body == null) throw new Error(`Block not found for ${re}`);
  return body;
}

/** First `[data-theme="name"] { … }` block. */
function extractThemeBlock(name: string): string {
  const re = new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  return extractBlock(re);
}

/** All `--token: oklch(...)` declarations in a block body → map. */
function tokenMap(body: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(oklch\([^;]+\))\s*;/g)) {
    const name = m[1];
    const value = m[2];
    if (name != null && value != null) map[name] = value.trim();
  }
  return map;
}

const TOKENS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(THEME_BLOCKS).map(([name, body]) => [name, tokenMap(body)]),
);

const THEMES = Object.keys(THEME_BLOCKS);
/** The surfaces colored TEXT is rendered on (issue #20). */
const TEXT_SURFACES = ["--background", "--card", "--surface-muted"] as const;
/**
 * #399 — the surfaces the BRAND accent is rendered on as ordinary text. A
 * superset of `TEXT_SURFACES`: a `ProseLink` / `Button variant="link"` /
 * `Text tone="primary"` lands on the two mid-tone wells too (a link inside a
 * `--muted` panel, a `--secondary` chip), and `--primary` was under AA on all
 * five in light (3.87-4.48:1), so the new `-text` rung is gated on the
 * widest set rather than only the three the status `-text` rungs use.
 */
const PRIMARY_TEXT_SURFACES = [
  ...TEXT_SURFACES,
  "--muted",
  "--secondary",
] as const satisfies readonly string[];
/**
 * Canonical content surfaces a load-bearing divider/outline is drawn against
 * (issue #172). 1.4.11 is pair-relative — `--border-strong`/`--input` are
 * guaranteed only against `--card`/`--background`, not the mid-tone surfaces.
 */
const NONTEXT_SURFACES = ["--card", "--background"] as const;
/**
 * #381 — every surface a status MARK can be drawn on. Unlike `--border-strong`
 * (guaranteed only against `--card`/`--background`), a status dot / node stroke /
 * swatch lands on mid-tone surfaces too — a `Timeline` dot sits on `--background`,
 * a flow node on `--canvas`, a chip inside a `--muted` well. 1.4.11 is
 * pair-relative, so the fill rung has to clear 3:1 against all of them.
 */
const MARK_SURFACES = [
  "--background",
  "--card",
  "--muted",
  "--surface-muted",
  "--secondary",
] as const;
/**
 * #381 — the status FILL rungs. Each is reached for as a colour-only graphical
 * mark somewhere in the library (`bg-warning` dot in `Timeline`,
 * `border-warning` stroke in `FlowNode`, `text-warning` star in `Rating`,
 * `bg-<tone>` indicator in `Progress`), where the hue is the ONLY carrier of the
 * state — the exact case WCAG 1.4.11 covers.
 */
const MARK_TONES = ["--warning", "--success", "--info", "--destructive"] as const;

/**
 * #221 — calc syntax-highlight TEXT tokens. Rendered as colored code text on the
 * calc sheet (`bg-card`) and inline in prose (`bg-background`), so each must clear
 * AA on both. Hue is never the SOLE cue (weight/underline carry roles in
 * low-chroma themes), but the colors still have to be legible.
 */
const CALC_TEXT_TOKENS = [
  "--calc-foreground",
  "--calc-number",
  "--calc-unit",
  "--calc-currency",
  "--calc-variable",
  "--calc-reference",
  "--calc-function",
  "--calc-operator",
  "--calc-result",
  "--calc-comment",
  "--calc-warning",
] as const;

/**
 * #315 — CodeBlock (@elabs/components-ai, Shiki) syntax-highlight TEXT tokens.
 * `--code-background`/`--code-foreground` are `var(--card)`/`var(--foreground)`
 * aliases (already covered by the foreground/card pairings used everywhere) so
 * they're not literal `oklch()` declarations this regex-based map can see; only
 * the 9 hue-role tokens are literal and checked here, on both surfaces the
 * derived Shiki theme can render on (`bg-card` code panel, `bg-background`
 * inline prose).
 */
const CODE_TEXT_TOKENS = [
  "--code-comment",
  "--code-string",
  "--code-number",
  "--code-constant",
  "--code-keyword",
  "--code-function",
  "--code-type",
  "--code-tag",
  "--code-property",
] as const;

/**
 * #321/#383 — the INK rung: `--<tone>-foreground` is *defined* as the ink on a
 * solid `bg-<tone>` plate (see the three-rung doctrine in
 * `.claude/rules/styling-and-tokens.md`), so it is only ever painted on
 * `--<tone>` and the pair is checkable on the tokens themselves. Shipped call
 * sites render it at 12-14px, weight 400-500 (`Badge` fixes `text-xs`/weight
 * 500, `Button` `text-sm`/weight 500, `StatusBadge`, `Alert`; `Calendar`'s
 * selected-day cell — `calendar.tsx`, `selected:` classNames — renders the
 * `--primary` pair at `text-sm`/weight 400, #430), so AA-Large never applies
 * (it needs ≥18.66px bold or ≥24px regardless of weight) and 4.5:1 is the
 * operative floor at 100% of them.
 */
const INK_TONES = [
  "--primary",
  "--secondary",
  "--destructive",
  "--success",
  "--warning",
  "--info",
] as const;

/**
 * Sub-AA ink pairs accepted on a brand argument, keyed by `(theme, tone)` — NOT
 * by tone. **Currently empty, and that is a result, not an oversight.**
 *
 * #180 was closed won't-fix for white-on-brand-green in `light` specifically: at
 * `oklch(0.553 0.143 153)` the brand green was too light to carry white ink at
 * 4.5:1, and too dark to carry black, so the brand hue itself was the argument.
 * The Phase-4 debrand retired that green. `--primary` is now the lime
 * `oklch(0.875 0.148 116.5)`, which is light enough that its ink FLIPS to
 * near-black — and near-black on lime measures well past AA. The exemption is
 * not re-pinned to the new literal because there is no longer anything to
 * exempt: the pair passes `INK_TONES` on its own merits.
 *
 * The keying rule stands for whoever adds the next one. Keyed by tone alone it
 * would travel to `:root`'s genuine `--primary` failure and to every future
 * theme, silently green-lighting them; it would also have to name `--success`,
 * freezing a token #334 already moved off the brand hue. Scope an exemption to
 * ONE `(theme, tone)` and cite the argument, or do not add it.
 */
const INK_EXEMPT = new Set<string>([]);

/**
 * The literal each exemption was granted against, so an exemption cannot rot
 * silently: retuning the tone fails this row and forces whoever moved it to
 * re-derive the exemption deliberately. That is exactly how the #180 row
 * behaved when Phase 4 moved `--primary` — it failed, and re-deriving it showed
 * the exemption was no longer needed at all.
 */
const INK_EXEMPT_LITERALS: Record<string, string> = {};

/**
 * #334 — pairs of DISTINCT semantic roles that must never collapse onto one
 * literal. `[role, the-role-it-must-not-equal]`.
 */
const ROLE_PAIRS = [
  ["--success", "--primary"],
  ["--ring", "--info"],
] as const;

/**
 * Perceptual floor for a role pair, as an OKLab ΔE. ~0.02 is roughly the
 * just-noticeable difference for two large patches, so 0.05 is a comfortable
 * "these read as different colours" bar while still allowing an in-family
 * nudge (the fix for #334 stays inside the green/blue families).
 */
const ROLE_SEPARATION_DELTA_E = 0.05;

/** Euclidean distance in OKLab between two `oklch()` literals. */
function oklabDistance(a: string, b: string): number {
  const toLab = (raw: string) => {
    const { l, c, h } = parseOklch(raw);
    const rad = (h * Math.PI) / 180;
    return [l, c * Math.cos(rad), c * Math.sin(rad)] as const;
  };
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function token(theme: string, name: string): string {
  const v = TOKENS[theme]?.[name];
  if (!v) throw new Error(`${theme} is missing ${name} (would fall back to :root)`);
  return v;
}

describe("themes.css — WCAG AA token contrast (all themes)", () => {
  describe.each(THEMES)("%s", (theme) => {
    // Issue #20 — on-surface status TEXT tokens.
    it.each(TEXT_SURFACES)("success-text ≥ 4.5:1 on %s", (surface) => {
      const ratio = contrast(token(theme, "--success-text"), token(theme, surface));
      expect(
        ratio,
        `success-text vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    it.each(TEXT_SURFACES)("destructive-text ≥ 4.5:1 on %s", (surface) => {
      const ratio = contrast(token(theme, "--destructive-text"), token(theme, surface));
      expect(
        ratio,
        `destructive-text vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // On-surface status TEXT tokens, siblings of success/destructive-text. The
    // fill tokens (`--warning`/`--info`) are tuned for *-foreground ink on a
    // colored plate and are often too light for bare colored TEXT on a surface,
    // so the `-text` variants carry the AA-cleared on-surface color.
    it.each(TEXT_SURFACES)("warning-text ≥ 4.5:1 on %s", (surface) => {
      const ratio = contrast(token(theme, "--warning-text"), token(theme, surface));
      expect(
        ratio,
        `warning-text vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    it.each(TEXT_SURFACES)("info-text ≥ 4.5:1 on %s", (surface) => {
      const ratio = contrast(token(theme, "--info-text"), token(theme, surface));
      expect(
        ratio,
        `info-text vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // #399 — the BRAND accent as on-surface TEXT. Every status tone shipped
    // three rungs (fill / `-foreground` plate ink / `-text`) but `--primary`
    // shipped only two, so 16 call sites that needed "brand accent, as ordinary
    // text" (ProseLink, `Button variant="link"`, `Text tone="primary"`, the
    // academic-layer citation links, …) reached for the FILL rung — whose
    // contract is the 1.4.11 mark bar (3:1), not the 1.4.3 text floor. In
    // light that measured 3.87-4.48:1 and in `:root` 4.47:1 on
    // `--surface-muted`: real, shipped AA failures. This row is the missing
    // rung's gate; it is the reason the token exists.
    it.each(PRIMARY_TEXT_SURFACES)("primary-text ≥ 4.5:1 on %s", (surface) => {
      const ratio = contrast(token(theme, "--primary-text"), token(theme, surface));
      expect(
        ratio,
        `primary-text vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // #399 — …and the new rung must be a real token, not an undeclared alias of
    // a role it sits beside (`.claude/rules/theming.md`, "Distinct roles,
    // distinct values"; #334/#385). `--primary` is the one that matters most: if
    // `--primary-text` ever collapses back onto the fill, the AA row above would
    // start re-asserting the fill's own contrast and the regression would ship
    // silently the next time the brand hue is retuned.
    it.each(["--primary", "--success-text", "--info-text", "--ring"] as const)(
      "primary-text is not byte-identical to %s",
      (other) => {
        expect(token(theme, "--primary-text")).not.toBe(token(theme, other));
      },
    );

    // Search / find-in-page match highlight — the ink on the `<mark>` plate must
    // clear AA body text in every theme (the dedicated pair that replaces the
    // sub-AA `bg-warning/40` improvisation, 3.48:1 in dark). Consumed by
    // `MatchHighlight` (@elabs/components-ui). See #284 + the highlight-token issue.
    it("highlight-foreground ≥ 4.5:1 on --highlight", () => {
      const ratio = contrast(token(theme, "--highlight-foreground"), token(theme, "--highlight"));
      expect(
        ratio,
        `highlight-foreground vs --highlight in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // The CURRENT match ("3 of 12") is a second highlight plate, so it carries
    // two obligations, not one: its ink must clear AA like any other mark, AND
    // the plate itself must be distinguishable from the ordinary highlight it
    // sits among — a legible current mark nobody can pick out of the run is the
    // same failure as no current mark at all. 1.4.11's 3:1 is the bar for that
    // second row because the difference is carried by adjacent colour, not text.
    // (`--highlight-active` also carries an outline + `aria-current`, so colour
    // is never the only channel — see `.claude/rules/accessibility.md`.)
    it("highlight-active-foreground ≥ 4.5:1 on --highlight-active", () => {
      const ratio = contrast(
        token(theme, "--highlight-active-foreground"),
        token(theme, "--highlight-active"),
      );
      expect(
        ratio,
        `highlight-active-foreground vs --highlight-active in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    it("highlight-active ≥ 3:1 against --highlight (the run it must be picked out of)", () => {
      const ratio = contrast(token(theme, "--highlight-active"), token(theme, "--highlight"));
      expect(
        ratio,
        `highlight-active vs --highlight in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA_NONTEXT);
    });

    // Issue #20 — muted text on muted surfaces (light was the regression).
    it.each(["--muted", "--surface-muted"] as const)(
      "muted-foreground ≥ 4.5:1 on %s",
      (surface) => {
        const ratio = contrast(token(theme, "--muted-foreground"), token(theme, surface));
        expect(
          ratio,
          `muted-foreground vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA);
      },
    );

    // Issue #23 — sidebar muted nav foreground on the sidebar ground.
    it("sidebar-muted-foreground ≥ 4.5:1 on --sidebar", () => {
      const ratio = contrast(token(theme, "--sidebar-muted-foreground"), token(theme, "--sidebar"));
      expect(
        ratio,
        `sidebar-muted-foreground vs --sidebar in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // Issue #172 — WCAG 1.4.11: the load-bearing divider/outline rung ≥ 3:1 on
    // the canonical content surfaces. `--border` stays subtle by design (it's a
    // redundant boundary, 1.4.11-exempt); `--border-strong` carries the structural
    // cue and must clear non-text contrast. This is the ADR 0010 rung and STANDS.
    it.each(NONTEXT_SURFACES)("border-strong ≥ 3:1 on %s", (surface) => {
      const ratio = contrast(token(theme, "--border-strong"), token(theme, surface));
      expect(
        ratio,
        `border-strong vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA_NONTEXT);
    });

    // #381 — WCAG 1.4.11: the status FILL rungs as colour-only GRAPHICAL marks.
    // Until this row existed the file only asserted the `-text` rungs at 4.5:1,
    // so `--warning` shipped at 1.79-2.07:1 — it cleared 3:1 against no surface
    // at all in light, making the `awaiting-approval` Timeline dot and the
    // `warning` flow-node stroke effectively invisible. Filled plates that also
    // carry a LABEL (Badge, StatusBadge) are a redundant boundary and 1.4.11-
    // exempt, but the same token is used bare, so the token itself must clear it.
    it.each(MARK_TONES)("%s ≥ 3:1 on every mark surface", (tone) => {
      for (const surface of MARK_SURFACES) {
        const ratio = contrast(token(theme, tone), token(theme, surface));
        expect(
          ratio,
          `${tone} vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA_NONTEXT);
      }
    });

    // #427 — the FOCUS INDICATOR as a colour-only graphical mark. Until this row
    // existed `--ring` had no contrast assertion anywhere in the suite: the
    // 5.36:1 / 8.87:1 figures quoted in `themes.css`'s own comments were
    // hand-computed claims no test had ever checked. A focus ring lands on all
    // five mark surfaces (a field on `--background`, a button in a `--card`, a
    // control inside a `--muted` well), so 1.4.11 applies to it exactly as it
    // does to the status fills above. Value-independent on purpose — it survives
    // any future retune of the ring.
    it("ring ≥ 3:1 on every mark surface (WCAG 1.4.11 — the focus indicator)", () => {
      for (const surface of MARK_SURFACES) {
        const ratio = contrast(token(theme, "--ring"), token(theme, surface));
        expect(
          ratio,
          `--ring vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA_NONTEXT);
      }
    });

    // #321/#383 — the INK rung, generalized to EVERY status tone.
    //
    // This row started life (#381) scoped to `--warning` alone, with a comment
    // declining to generalize it because "the white-on-brand-green
    // `--primary`/`--success` pairing is an accepted brand exemption (#180)".
    // That reasoning was the bug: one brand decision on ONE pair left the entire
    // foreground-on-fill class unmeasured, which is how dark shipped a
    // 3.02:1 error badge (#321) and light a 3.74:1 info badge (#383).
    // The fix is not "no gate" but "gate everything except what is blessed" —
    // see INK_TONES / INK_EXEMPT above. Do NOT re-narrow this row.
    it.each(INK_TONES.filter((t) => !INK_EXEMPT.has(`${theme}/${t}`)))(
      "%s-foreground ≥ 4.5:1 on its own fill",
      (tone) => {
        const ratio = contrast(token(theme, `${tone}-foreground`), token(theme, tone));
        expect(
          ratio,
          `${tone}-foreground vs ${tone} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA);
      },
    );

    // NOTE: there is intentionally NO `--input ≥ 3:1` assertion here.
    // ADR 0010 Amendment (2026-06-20) returned `--input` to the SUBTLE hairline
    // rung (== --border on both reference themes; a perceptible-but-quiet
    // 0.42 mid-value on dark) so form controls read on-theme rather than
    // carrying a dark strong-rung outline. This relaxes ADR 0010's `--input → strong
    // rung` sub-decision by maintainer direction: <3:1 resting contrast is an
    // accepted aesthetic-over-strict-1.4.11 tradeoff for an internal system — field
    // identity rests on the recessed fill + focus-visible ring + control glyphs +
    // hover, with the resting border as a redundant hairline. Do NOT re-add a 3:1
    // gate on `--input`; the `--border-strong` rung above is the load-bearing one.

    // #259 — the Gantt inside-bar-label pill (@elabs/components-charts
    // gantt-bar.tsx `GANTT_INSIDE_LABEL_SCRIM`) is opaque `bg-foreground` +
    // `text-background`, chosen SPECIFICALLY because it is fill-independent and
    // guaranteed ≥4.5:1 in every theme — unlike `--primary-foreground`, which is
    // light in light but DARK in dark. This row is the gate
    // that keeps that pair from silently inverting again.
    it("foreground ≥ 4.5:1 on background (Gantt inside-label pill, #259)", () => {
      const ratio = contrast(token(theme, "--foreground"), token(theme, "--background"));
      expect(
        ratio,
        `--foreground vs --background in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // #221 — calc syntax tokens as colored TEXT on the surfaces calc renders on.
    it.each(CALC_TEXT_TOKENS)("%s ≥ 4.5:1 on calc surfaces", (tokenName) => {
      for (const surface of NONTEXT_SURFACES) {
        const ratio = contrast(token(theme, tokenName), token(theme, surface));
        expect(
          ratio,
          `${tokenName} vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    });

    // #315 — CodeBlock syntax tokens as colored TEXT on the surfaces a code
    // block renders on (its own `bg-card` panel, or `bg-background` inline).
    it.each(CODE_TEXT_TOKENS)("%s ≥ 4.5:1 on code surfaces", (tokenName) => {
      for (const surface of NONTEXT_SURFACES) {
        const ratio = contrast(token(theme, tokenName), token(theme, surface));
        expect(
          ratio,
          `${tokenName} vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    });

    // #315 follow-up — `--code-tag` used to be BYTE-IDENTICAL to
    // `--calc-warning`/`--destructive-text` in every theme, so a perfectly
    // valid <div>/JSX tag (the most common markup element in the languages
    // CodeBlock renders) was visually indistinguishable from an error/warning
    // highlight. Locks the fix: the tag role must have its own value.
    it("--code-tag is never byte-identical to --calc-warning or --destructive-text", () => {
      const tag = token(theme, "--code-tag");
      expect(tag).not.toBe(token(theme, "--calc-warning"));
      expect(tag).not.toBe(token(theme, "--destructive-text"));
    });

    // #334 — two SEMANTIC ROLES must never share one literal. `--success` was
    // byte-identical to `--primary` and `--ring` to `--info` in BOTH reference
    // themes, so a success chip was indistinguishable from a primary button and
    // a focus ring from an "Info"/"Running" chip — by colour, the only signal
    // these tokens carry. A token that equals another token is an undeclared
    // alias, not a distinct token. light already separated them; this
    // row keeps their good state locked too.
    it.each(ROLE_PAIRS)("%s is not byte-identical to %s", (role, other) => {
      expect(token(theme, role)).not.toBe(token(theme, other));
    });

    // …and inequality alone is too weak a gate: a 0.001 nudge would satisfy it
    // while still rendering as the same colour. The roles must be separated
    // PERCEPTUALLY. Smallest shipped separation is light's success/primary
    // at ΔE 0.070 (its monochrome palette separates by lightness alone).
    it.each(ROLE_PAIRS)("%s is perceptibly separated from %s", (role, other) => {
      const distance = oklabDistance(token(theme, role), token(theme, other));
      expect(
        distance,
        `${role} vs ${other} in ${theme} ΔE(OKLab) = ${distance.toFixed(4)}`,
      ).toBeGreaterThanOrEqual(ROLE_SEPARATION_DELTA_E);
    });
  });
});

// ADR 0027 — `--ring` is BRAND-DERIVED: the same hue family as `--primary`, at a
// DISTINCT rung. Both halves are load-bearing. Without the hue bound, the next
// maintainer resolving the next distinctness collision can walk the ring out of
// the palette again with every other gate green — which is exactly what #334 did
// and what this row exists to prevent. Without the ΔE bound, "same family" could
// collapse into an undeclared alias of the primary action.
//
// Scoped to the two SHIPPING themes: `:root`'s `--primary` is a blue and its ring
// is already the same hue at a distinct rung, so it satisfies the contract on
// its own terms.
describe("themes.css — --ring is brand-derived (ADR 0027, #427)", () => {
  it.each(["light", "dark"])(
    "%s: --ring is in --primary's hue family but a distinct rung",
    (theme) => {
      const ring = parseOklch(token(theme, "--ring"));
      const primary = parseOklch(token(theme, "--primary"));
      const hueGap = Math.min(Math.abs(ring.h - primary.h), 360 - Math.abs(ring.h - primary.h));
      expect(
        hueGap,
        `${theme}: --ring is ${hueGap.toFixed(0)}° from --primary`,
      ).toBeLessThanOrEqual(20);
      expect(
        oklabDistance(token(theme, "--ring"), token(theme, "--primary")),
        `${theme}: --ring vs --primary must be a DISTINCT rung`,
      ).toBeGreaterThanOrEqual(ROLE_SEPARATION_DELTA_E);
    },
  );
});

// #321/#383 — change-detector on every `INK_EXEMPT` pair. An exemption suppresses
// a real AA failure, so it must not be able to outlive its own justification: if
// the exempted tone moves, this fails and the mover has to re-measure the pair and
// decide whether the exemption still applies at all. `INK_EXEMPT` is empty today
// (Phase 4 retired the #180 pair — see its comment), so the guard below is what
// keeps the two structures honest while there is nothing to pin.
describe("themes.css — every ink exemption is pinned to its literal", () => {
  it("INK_EXEMPT and INK_EXEMPT_LITERALS describe the same set of pairs", () => {
    expect([...INK_EXEMPT].sort()).toEqual(Object.keys(INK_EXEMPT_LITERALS).sort());
  });

  it.each(Object.entries(INK_EXEMPT_LITERALS))("%s still holds %s", (key, literal) => {
    const [theme, tone] = key.split("/") as [string, string];
    expect(INK_EXEMPT.has(key), `${key} is not in INK_EXEMPT`).toBe(true);
    expect(
      token(theme, tone),
      `${key} moved off the exemption-accepted literal — re-measure ` +
        `${tone}-foreground on ${tone} and decide whether the exemption still applies`,
    ).toBe(literal);
  });
});

// NOTE Issue #162's monochrome status-lightness row lived here. It only ever
// applied to a monochrome theme this repo no longer ships, so it is retired with
// it — restore it from git history if such a theme returns.
