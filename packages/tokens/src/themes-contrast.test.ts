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
import { contrast, contrastSrgb, mixOverSrgb, parseOklch } from "./color-contrast";

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

/**
 * All `--token: oklch(...)` declarations in a block body → map, with
 * single-level `var(--other)` aliases RESOLVED to the literal they point at.
 *
 * Alias resolution is not a convenience — it closes a hole. This regex used to
 * match `oklch(` only, so a token declared as `var(--other)` was simply absent
 * from the map, and every assertion about it either threw "missing" or was never
 * written because the token "did not parse". That put the theming rule's two
 * halves in direct conflict: "an INTENTIONAL mirror is declared with `var()`,
 * never copy-pasted" (#385) versus "anything themes-contrast asserts on must
 * stay a literal". A theme author following the first rule silently dropped the
 * token out of this gate. `scripts/check-role-distinctness.mjs` already resolves
 * `var()` before comparing, for exactly this reason; this brings the two into
 * agreement.
 *
 * Resolution is scoped to the SAME block, which is what the cascade actually
 * does for a mirror like `--sidebar-ring: var(--ring)` or `--ring:
 * var(--primary)`. A `var()` pointing at a token the block does not declare is
 * left unresolved and therefore still absent — that case IS a fall-through to
 * `:root`, and the "missing" error it produces is the correct answer.
 */
function tokenMap(body: string): Record<string, string> {
  const literals: Record<string, string> = {};
  const aliases: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(oklch\([^;]+\)|var\(\s*--[\w-]+\s*\))\s*;/g)) {
    const name = m[1];
    const value = m[2]?.trim();
    if (name == null || value == null) continue;
    if (value.startsWith("var(")) {
      const target = value.match(/var\(\s*(--[\w-]+)\s*\)/)?.[1];
      if (target != null) aliases[name] = target;
    } else {
      literals[name] = value;
    }
  }
  const map: Record<string, string> = { ...literals };
  // One resolution pass per alias, following chains but refusing to loop.
  for (const [name, firstTarget] of Object.entries(aliases)) {
    let target: string | undefined = firstTarget;
    const seen = new Set<string>([name]);
    while (target != null && !seen.has(target)) {
      seen.add(target);
      const literal = literals[target];
      if (literal != null) {
        map[name] = literal;
        break;
      }
      target = aliases[target];
    }
  }
  return map;
}

const TOKENS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(THEME_BLOCKS).map(([name, body]) => [name, tokenMap(body)]),
);

const THEMES = Object.keys(THEME_BLOCKS);
/**
 * The surfaces colored TEXT is rendered on (issue #20). Originally just the
 * three "obvious" content grounds (`--background`/`--card`/`--surface-muted`);
 * WIDENED in the #38 fix round to also include `--muted`/`--secondary` after
 * an independent review found the `-text` wash sweep below (`WASH_TONES` ×
 * `WASH_SURFACES`) landed under AA specifically on `--secondary` — a real
 * content well (`InlineCitationCarouselHeader`, `StatusBadge`'s
 * `pending`/`skipped`/`neutral` variants, `Badge variant="secondary"`) that
 * this list never touched. `--muted` already passed at the old three-surface
 * literals; it's included here for the same reason `--secondary` is: nothing
 * should have to re-derive "is this surface covered" from which array a token
 * happens to appear in.
 */
const TEXT_SURFACES = [
  "--background",
  "--card",
  "--surface-muted",
  "--muted",
  "--secondary",
] as const;
/**
 * #38 — the surfaces a status `-text` rung is rendered on, ALIASED to
 * `TEXT_SURFACES` (same grounds — the missing invariant was never a
 * different surface set, it was the missing wash on top of it). Kept as its
 * own name because it documents a distinct CLAIM: not "text on a bare
 * surface" but "text on that surface's composited bg-<tone>/10 wash", which
 * is the pairing `StatusBadge`, `InlineCitationCardTrigger`, the editor entity
 * chip and the registry trend-badge actually render. `.claude/rules/styling-
 * and-tokens.md` prescribes exactly this pairing (the fill rung as the
 * "attention" wash, `-text` as its ink); until this block existed, the bare-
 * surface assertions below were necessary but not sufficient to prove it AA.
 */
const WASH_SURFACES = TEXT_SURFACES;
/**
 * #38 — every status tone's [fill token, on-surface TEXT token] pair, the
 * inputs `mixOverSrgb`/`contrastSrgb` need to model the composited wash.
 */
const WASH_TONES = [
  ["--success", "--success-text"],
  ["--info", "--info-text"],
  ["--destructive", "--destructive-text"],
  ["--warning", "--warning-text"],
] as const;
/** Tailwind's `/10` opacity modifier, e.g. `bg-success/10`. */
const WASH_ALPHA = 0.1;
/**
 * #399 — the surfaces the BRAND accent is rendered on as ordinary text. A
 * `ProseLink` / `Button variant="link"` / `Text tone="primary"` lands on the
 * two mid-tone wells too (a link inside a `--muted` panel, a `--secondary`
 * chip), and `--primary` was under AA on all five in light (3.87-4.48:1) —
 * the original reason this list existed separately from `TEXT_SURFACES`.
 * Since the #38 fix round folded `--muted`/`--secondary` into `TEXT_SURFACES`
 * itself (the status `-text` wash had the identical gap), the two sets are
 * now the SAME five surfaces. Kept as its own name because it documents a
 * distinct claim (brand-as-text, not a status wash) — not because the
 * surface list still differs.
 */
const PRIMARY_TEXT_SURFACES = TEXT_SURFACES;
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
 * #315 — CodeBlock (@elabs-ai/components-ai, Shiki) syntax-highlight TEXT tokens.
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

/**
 * TERMINAL / CONSOLE (#115) — the sixteen ANSI slots, in escape-code order.
 *
 * An ANSI palette with two slots on one colour is SILENTLY broken: the program
 * writing the escape codes has no way to know, the user just sees two different
 * meanings render identically. So the slots get the same treatment `ROLE_PAIRS`
 * gives semantic roles — byte inequality AND a perceptual floor — but across the
 * whole set, not a hand-picked pair list, because every pair of ANSI slots is a
 * pair a program can put side by side.
 */
const TERMINAL_ANSI_SLOTS = [
  "--terminal-ansi-black",
  "--terminal-ansi-red",
  "--terminal-ansi-green",
  "--terminal-ansi-yellow",
  "--terminal-ansi-blue",
  "--terminal-ansi-magenta",
  "--terminal-ansi-cyan",
  "--terminal-ansi-white",
  "--terminal-ansi-bright-black",
  "--terminal-ansi-bright-red",
  "--terminal-ansi-bright-green",
  "--terminal-ansi-bright-yellow",
  "--terminal-ansi-bright-blue",
  "--terminal-ansi-bright-magenta",
  "--terminal-ansi-bright-cyan",
  "--terminal-ansi-bright-white",
] as const;

/**
 * The ONE ANSI slot exempt from the ink floor. By ANSI convention slot 0 is a
 * GROUND rung — "invisible ink", used for shading and for text that is meant to
 * disappear into the background — not a colour chosen to be read. Every other
 * slot is painted as real text by the terminal, so every other slot owes AA.
 * This mirrors the exemption `buildInteractiveTerminalTheme` already applies at
 * runtime (`packages/ai/src/interactive-terminal.tsx`, #386).
 */
const TERMINAL_ANSI_GROUND_SLOT = "--terminal-ansi-black";

/** ANSI slots that must be legible as TEXT on `--terminal-background`. */
const TERMINAL_INK_SLOTS = TERMINAL_ANSI_SLOTS.filter((s) => s !== TERMINAL_ANSI_GROUND_SLOT);

/**
 * The console's own (non-ANSI) ink roles, and the floor each owes on
 * `--terminal-background`. `--terminal-border` is a 1.4.11 MARK, not text: the
 * console's box-drawing rules are the sole structural cue between two regions of
 * the same ground, which is the `border-strong` case in
 * `.claude/rules/styling-and-tokens.md`.
 */
const TERMINAL_CHROME_INK = [
  ["--terminal-foreground", AA],
  ["--terminal-muted", AA],
  ["--terminal-accent", AA],
  ["--terminal-border", AA_NONTEXT],
] as const;

/**
 * A selection band changes the GROUND under console text, so the AA obligation
 * travels with it. These are the two inks a selection realistically lands on:
 * the console's full ink and the normal ANSI ink rung.
 */
const TERMINAL_SELECTION_INK = ["--terminal-foreground", "--terminal-ansi-white"] as const;

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

    // #38 — the MISSING invariant: every status `-text` rung against its OWN
    // composited `bg-<tone>/10` wash, on every surface the wash is rendered
    // over. The four blocks above assert `-text` against the BARE surface,
    // which is necessary but not sufficient — `StatusBadge`,
    // `InlineCitationCardTrigger`, the editor entity chip and the registry
    // trend-badge all render `-text` ON TOP OF the fill's own 10% wash, never
    // on the bare surface alone. In `light`/`:root` the bare-surface margin
    // was thin enough (+0.22-0.84) that the wash consumed it entirely,
    // measuring 4.05-4.46:1 — a real, shipped AA failure axe caught on
    // `ai-markdownview--inline-citations`. Modeled with `mixOverSrgb` (see
    // color-contrast.test.ts for the axe-anchored ground truth) rather than
    // approximated, so this reproduces exactly what a browser paints.
    it.each(WASH_TONES)("%s wash: %s ≥ 4.5:1 on its own bg/10 wash", (fillToken, textToken) => {
      for (const surface of WASH_SURFACES) {
        const wash = mixOverSrgb(
          parseOklch(token(theme, fillToken)),
          parseOklch(token(theme, surface)),
          WASH_ALPHA,
        );
        const ratio = contrastSrgb(parseOklch(token(theme, textToken)), wash);
        expect(
          ratio,
          `${textToken} vs ${fillToken}@${WASH_ALPHA * 100}% over ${surface} in ${theme} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA);
      }
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
    // `MatchHighlight` (@elabs-ai/components-ui). See #284 + the highlight-token issue.
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

    // #14 — the ordered neutral ramp's two NEW text rungs (foreground-2
    // secondary label, foreground-4 disabled). -1/-3 are var() aliases of
    // --foreground/--muted-foreground and inherit those tokens' own gated
    // assertions; only the two new literals need their own lock.
    it.each(TEXT_SURFACES)("foreground-2 ≥ 4.5:1 on %s (secondary label, AA)", (surface) => {
      const ratio = contrast(token(theme, "--foreground-2"), token(theme, surface));
      expect(
        ratio,
        `foreground-2 vs ${surface} in ${theme} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // foreground-4 (disabled) is INTENTIONALLY sub-AA (WCAG 1.4.3 exempts
    // inactive-control text) — the lock is the RAMP ORDERING, not a contrast
    // floor: it must read dimmer than foreground-3 (muted-foreground) on every
    // surface, never brighter/inverted, while staying above a "not literally
    // invisible" sanity floor.
    it.each(TEXT_SURFACES)("foreground-4 stays between 1.5:1 and foreground-3 on %s", (surface) => {
      const disabledRatio = contrast(token(theme, "--foreground-4"), token(theme, surface));
      const tertiaryRatio = contrast(token(theme, "--foreground-3"), token(theme, surface));
      expect(
        disabledRatio,
        `foreground-4 vs ${surface} in ${theme} = ${disabledRatio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(1.5);
      expect(
        disabledRatio,
        `foreground-4 (${disabledRatio.toFixed(2)}) should be dimmer than foreground-3 ` +
          `(${tertiaryRatio.toFixed(2)}) vs ${surface} in ${theme}, not brighter/inverted`,
      ).toBeLessThan(tertiaryRatio);
    });

    // #14 (fix round 1, 2026-08-30) — the border ramp is TWO rungs, mapped 1:1
    // onto the existing binary 1.4.11 contract (--border = redundant boundary,
    // --border-strong = sole cue). A third "mid" rung was dropped: it was too
    // weak to be a sole cue and added nothing over the subtle rung when the
    // boundary is redundant, so it had no legitimate job and only invited
    // picking it for a sole-cue divider (a silent 1.4.11 failure). The lock is
    // that both rungs are exactly what they claim to alias — not a contrast
    // number, since --border/--border-strong already carry their own gated
    // assertions elsewhere in this file.
    it("border-1/border-2 resolve to border/border-strong", () => {
      expect(token(theme, "--border-1")).toBe(token(theme, "--border"));
      expect(token(theme, "--border-2")).toBe(token(theme, "--border-strong"));
    });

    // #14 — surface-1..4 are pure var() aliases (an ordered VIEW onto existing
    // surfaces, not new colors), so the lock is that each rung still resolves
    // to the token it claims to mirror — not a contrast number.
    it("surface-1..4 resolve to background/surface/card/surface-elevated", () => {
      expect(token(theme, "--surface-1")).toBe(token(theme, "--background"));
      expect(token(theme, "--surface-2")).toBe(token(theme, "--surface"));
      expect(token(theme, "--surface-3")).toBe(token(theme, "--card"));
      expect(token(theme, "--surface-4")).toBe(token(theme, "--surface-elevated"));
    });

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
    //
    // #67 — THE COMPOUND FOCUS INDICATOR. The `light` exemption that used to sit
    // here is GONE, and so is the failure it recorded.
    //
    // The reference themes declare `--ring: var(--primary)` — an explicit
    // maintainer decision that the focus indicator IS the brand plate
    // (superseding ADR 0027 clauses 1 and 3), which is unchanged and NOT what
    // this row is about. On `light` that lime measures 1.23-1.42:1 against the
    // mark surfaces on its own, and between 2026-08-16 and this fix the suite
    // carried a `RING_1411_EXEMPT` carve-out saying so out loud.
    //
    // The repair the ADR's Amendment prescribed is a COMPOUND indicator: the
    // ring PLUS a `--ring-contour` hairline drawn immediately outside it (the
    // `focus-ring` utility in themes.css). So the 1.4.11 obligation belongs to
    // the INDICATOR, not to either layer alone: at least one of the two must
    // clear 3:1 against whatever the indicator lands on. Asserting `--ring`
    // alone would demand the very retune the maintainer rejected; asserting
    // only `--ring-contour` would let a theme ship a contour that vanishes
    // against a surface its ring also cannot carry.
    //
    // `--primary` is in the surface list on purpose and is NOT a mark surface:
    // a focused primary button's own fill sits directly under the ring, and on
    // both reference themes the ring IS that fill — so without this row the
    // indicator around the one control the alias affects most would be
    // unmeasured (issue #67's first acceptance criterion).
    //
    // THE INVERSE-INK GROUNDS ARE IN THE LIST TOO (#67 fix round 2). A focus
    // indicator is not confined to the mark surfaces: a sidebar nav button, a
    // terminal composer, a chat bubble and a flow node are all Tab stops, and on
    // `light` several of those grounds are DARK (`--sidebar` is 0.30,
    // `--terminal-background` 0.24). There the deep contour vanishes and the
    // brand ring alone carries the indicator — which is correct and comfortable
    // today, and was measured before this row was written. The gap this closes
    // is that nothing asserted it: a future `--primary` retune that kept the
    // five mark surfaces green could go quiet on the sidebar and no gate would
    // notice. `max(ring, contour)` is exactly the right shape for these grounds,
    // because which layer does the work is the per-theme answer the token is
    // there to carry.
    const INDICATOR_SURFACES = [
      ...MARK_SURFACES,
      "--primary",
      "--sidebar",
      "--terminal-background",
      "--chat-user",
      "--chat-assistant",
      "--flow-node",
      "--canvas",
    ] as const;
    //
    // ONE DECLARED, MEASURED CARVE-OUT — `:root` on the terminal ground.
    // `:root` is the neutral light fallback a consumer who imports no theme
    // stylesheet inherits. Its ring is a mid blue (`oklch(0.45 0.21 264)`) and
    // its contour is a near-black blue (`oklch(0.22 0.02 264)`), both tuned for
    // a white page; against `:root`'s very dark terminal ground
    // (`oklch(0.15 0.018 264)`) they measure 2.49:1 and 1.14:1. So on that ONE
    // pairing the indicator has no layer that clears 3:1.
    //
    // This is PRE-EXISTING and is not something #67 introduced — before the
    // compound indicator the same ring measured the same 2.49:1 there, with no
    // second layer at all. It is carried here rather than silently dropped from
    // the surface list, and it is not a licence: the repair is either a `:root`
    // ring retune (a fallback-wide token-value change that needs its own
    // cross-theme sweep) or the terminal region retargeting its ring through
    // the sanctioned `[--focus-ring-color:…]` seam. Both reference themes pass
    // this surface, so nothing that ships a theme is affected.
    const INDICATOR_SURFACE_EXEMPT: Record<string, readonly string[]> = {
      root: ["--terminal-background"],
    };
    const exempt = (surface: string) => (INDICATOR_SURFACE_EXEMPT[theme] ?? []).includes(surface);

    it.each(INDICATOR_SURFACES)(
      "compound focus indicator ≥ 3:1 on %s (WCAG 1.4.11 / 2.4.7)",
      (surface) => {
        const ring = contrast(token(theme, "--ring"), token(theme, surface));
        const contour = contrast(token(theme, "--ring-contour"), token(theme, surface));
        const best = Math.max(ring, contour);
        if (exempt(surface)) {
          // The carve-out is asserted in the INVERSE, the shape
          // `CHART_1411_EXEMPT` already uses: it fails the day it stops
          // excusing anything, so a retune that fixes the pairing cannot leave
          // a stale exemption behind claiming a failure that no longer exists.
          expect(
            best,
            `focus indicator vs ${surface} in ${theme} now measures ` +
              `${best.toFixed(2)} — it clears 3:1, so the declared carve-out is ` +
              `stale. Delete this theme/surface pair from ` +
              `INDICATOR_SURFACE_EXEMPT.`,
          ).toBeLessThan(AA_NONTEXT);
          return;
        }
        expect(
          best,
          `focus indicator vs ${surface} in ${theme}: ring = ${ring.toFixed(2)}, ` +
            `contour = ${contour.toFixed(2)} — neither layer clears 3:1, so the ` +
            `indicator has no visible edge on this surface`,
        ).toBeGreaterThanOrEqual(AA_NONTEXT);
      },
    );

    // #67 — the contour has to be a SECOND layer, not a repaint of the first.
    // Two layers the same colour are one layer: the theme whose ring cannot
    // carry the indicator must give the contour a value that can. Scoped to the
    // themes where the ring actually fails, because a theme whose ring already
    // clears 3:1 everywhere is free to collapse the contour into its own ground
    // (which is exactly what `dark` does — see its `--ring-contour` comment).
    it("a ring that cannot carry the indicator has a contour that can", () => {
      const ringCarries = MARK_SURFACES.every(
        (surface) => contrast(token(theme, "--ring"), token(theme, surface)) >= AA_NONTEXT,
      );
      if (ringCarries) return;
      const ratio = contrast(token(theme, "--ring-contour"), token(theme, "--ring"));
      expect(
        ratio,
        `--ring-contour vs --ring in ${theme} = ${ratio.toFixed(2)} — this theme's ` +
          `ring is below 3:1 on at least one mark surface, so the contour is the ` +
          `layer carrying the indicator and must be distinguishable from the ring`,
      ).toBeGreaterThanOrEqual(AA_NONTEXT);
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

    // #259 — the Gantt inside-bar-label pill (@elabs-ai/components-charts
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

    // ── TERMINAL / CONSOLE (#115) ─────────────────────────────────────────
    // The console is a DARK machine surface in every theme (including `light`),
    // so one ink ladder runs upward from `--terminal-background` in all of them.
    // These rows are what make the group a contract rather than 24 nice colours.

    it("--terminal-foreground meets AA on --terminal-background", () => {
      const ratio = contrast(
        token(theme, "--terminal-foreground"),
        token(theme, "--terminal-background"),
      );
      expect(ratio, `${theme}: console ink is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    });

    // Every ANSI slot except the ground rung is painted as real TEXT by the
    // terminal, so every one owes AA — the exact class of bug #386 had to repair
    // at runtime when the slots were derived from MARK-rung (≥3:1) semantic
    // tokens. Authoring the rungs against the console's own ground is what lets
    // the declared group clear this without a runtime clamp.
    it.each(TERMINAL_INK_SLOTS)("%s is legible ink on --terminal-background", (slot) => {
      const ratio = contrast(token(theme, slot), token(theme, "--terminal-background"));
      expect(ratio, `${theme}: ${slot} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    });

    it.each(TERMINAL_CHROME_INK)("%s clears its floor on --terminal-background", (role, floor) => {
      const ratio = contrast(token(theme, role), token(theme, "--terminal-background"));
      expect(ratio, `${theme}: ${role} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(floor);
    });

    // The accent plate carries an agent badge; its ink is the console ground
    // punched out, so this row also proves that mirror is still a legal pairing.
    it("--terminal-accent-foreground is legible on --terminal-accent", () => {
      const ratio = contrast(
        token(theme, "--terminal-accent-foreground"),
        token(theme, "--terminal-accent"),
      );
      expect(ratio, `${theme}: accent ink is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    });

    // A selection band re-grounds the text under it. Assert the ink, not the
    // band: a band loud enough to be a 3:1 mark would put its own text below AA,
    // which is the trade every terminal makes the same way.
    it.each(TERMINAL_SELECTION_INK)("%s stays AA over --terminal-selection", (ink) => {
      const ratio = contrast(token(theme, ink), token(theme, "--terminal-selection"));
      expect(
        ratio,
        `${theme}: ${ink} on selection is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA);
    });

    // No two ANSI slots may share a literal — an ANSI palette with a duplicate
    // slot is broken in a way nothing else in the system can detect. Byte
    // inequality first…
    it("every ANSI slot carries its own literal", () => {
      const seen = new Map<string, string>();
      for (const slot of TERMINAL_ANSI_SLOTS) {
        const value = token(theme, slot);
        const previous = seen.get(value);
        expect(previous, `${theme}: ${slot} and ${previous} are both ${value}`).toBeUndefined();
        seen.set(value, slot);
      }
    });

    // …and, as with ROLE_PAIRS, inequality alone is too weak: a 0.001 nudge
    // would satisfy it while still rendering as the same colour. The tightest
    // shipped pair is bright-blue vs bright-cyan (ΔE 0.0703 in `dark`), which is
    // the sRGB gamut talking — blue and cyan are 37° apart and both lose chroma
    // fast above L 0.78.
    it("every pair of ANSI slots is perceptibly separated", () => {
      for (let i = 0; i < TERMINAL_ANSI_SLOTS.length; i += 1) {
        for (let j = i + 1; j < TERMINAL_ANSI_SLOTS.length; j += 1) {
          const a = TERMINAL_ANSI_SLOTS[i] as string;
          const b = TERMINAL_ANSI_SLOTS[j] as string;
          const distance = oklabDistance(token(theme, a), token(theme, b));
          expect(
            distance,
            `${theme}: ${a} vs ${b} ΔE(OKLab) = ${distance.toFixed(4)}`,
          ).toBeGreaterThanOrEqual(ROLE_SEPARATION_DELTA_E);
        }
      }
    });

    // The console is the DEEPEST surface in every theme — the decision that lets
    // one ink ladder serve all three blocks and keeps "bright" meaning LIGHTER
    // everywhere (on a light ground it would have to mean darker, inverting every
    // ANSI author's intent — #386). A maintainer who "fixes" the light theme by
    // grounding its console on `--card` fails here, loudly, instead of shipping a
    // palette whose bright rungs are its least legible colours.
    it.each(["--background", "--card", "--sidebar"] as const)(
      "--terminal-background is darker than %s",
      (surface) => {
        const console_ = parseOklch(token(theme, "--terminal-background")).l;
        const other = parseOklch(token(theme, surface)).l;
        expect(console_, `${theme}: console L ${console_} vs ${surface} L ${other}`).toBeLessThan(
          other,
        );
      },
    );
  });
});

// ADR 0027 — `--ring` is BRAND-DERIVED. The hue bound survives; the DISTINCT-RUNG
// bound does not.
//
// As shipped 2026-08-16 the reference themes declare `--ring: var(--primary)`
// outright — the focus indicator IS the brand plate. That is a deliberate
// maintainer decision (ADR 0027 amendment) and it makes the old ΔE assertion
// below self-contradictory: it demanded the ring be perceptibly separated from
// the very token it now aliases.
//
// What is KEPT is the half that still protects something. #334's failure mode was
// a maintainer resolving a distinctness collision by walking the ring out of the
// palette entirely — a blue ring on a lime brand, with every other gate green.
// An alias cannot drift that way, but a future value CAN, so the hue-family bound
// stays and is written to hold whether the ring is an alias or a literal.
//
// What is LOST is the guarantee that a focused control never reads as the default
// button. That is now intended, not prevented. The visibility cost of the alias
// (1.23-1.42:1 in `light`) is recorded on the exemption inside the per-theme
// block above, which fails if the ring ever clears 3:1 there.
//
// Scoped to the two SHIPPING themes: `:root` keeps an independent, compliant ring
// (its `--primary` is a blue and the ring is that hue at a distinct rung), so it
// satisfies the original contract on its own terms and is deliberately NOT
// aliased — an unregistered consumer falling through to the base should get a
// focus indicator they can see.
describe("themes.css — --ring is brand-derived (ADR 0027, #427)", () => {
  it.each(["light", "dark"])("%s: --ring is in --primary's hue family", (theme) => {
    const ring = parseOklch(token(theme, "--ring"));
    const primary = parseOklch(token(theme, "--primary"));
    const hueGap = Math.min(Math.abs(ring.h - primary.h), 360 - Math.abs(ring.h - primary.h));
    expect(hueGap, `${theme}: --ring is ${hueGap.toFixed(0)}° from --primary`).toBeLessThanOrEqual(
      20,
    );
  });

  // The alias is the shipped intent, so assert it structurally: a maintainer who
  // replaces `var(--primary)` with a hand-copied literal of the same colour has
  // broken the mirror (#385 — a duplicated literal cannot be told apart from an
  // accidental collision, and drifts the moment one side is retuned) even though
  // every ratio above still passes.
  it.each(["light", "dark"])("%s: --ring is declared as the var() mirror, not a copy", (theme) => {
    const block = THEME_BLOCKS[theme] ?? "";
    expect(
      /--ring:\s*var\(\s*--primary\s*\)\s*;/.test(block),
      `${theme}: --ring must be declared \`var(--primary)\`. If the ring is being ` +
        `given an independent value again, restore the DISTINCT-RUNG assertion here, ` +
        `the 1.4.11 row in the per-theme block, and the two MUST_DIFFER rows in ` +
        `scripts/check-role-distinctness.mjs.`,
    ).toBe(true);
  });

  // `:root` must NOT follow them into the alias — see the scoping note above.
  it("root keeps an independent focus ring that clears 3:1", () => {
    expect(/--ring:\s*var\(/.test(THEME_BLOCKS.root ?? "")).toBe(false);
    for (const surface of MARK_SURFACES) {
      const ratio = contrast(token("root", "--ring"), token("root", surface));
      expect(ratio, `root --ring vs ${surface} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        AA_NONTEXT,
      );
    }
  });
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
