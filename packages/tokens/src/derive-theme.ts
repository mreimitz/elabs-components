/**
 * derive-theme — turn one brand colour into a coherent, AA-safe patch for
 * `ThemeProvider`'s `tokenOverrides` prop (issue #39, split out of ADR 0031).
 *
 * `tokenOverrides` (ADR 0031) lets a consumer force individual token VALUES at
 * runtime, but it still requires the consumer to already know the correct
 * value for every token they want to patch — hover/active surfaces, the
 * `-foreground` ink on a plate, a `--ring` that actually clears WCAG 1.4.11.
 * A tenant who only has a single brand colour has no path to a coherent theme
 * without hand-deriving those values themselves. `deriveTheme` is that
 * derivation: it takes a seed colour and returns the dependent tokens, ready
 * to hand straight to `tokenOverrides` with no adapter.
 *
 * ## Scope — a PATCH, not a theme (ADR 0031, "Partial patch, not a
 * replacement")
 *
 * This does NOT return all of `THEME_TOKEN_NAMES`, and that is by design, not
 * an oversight: ADR 0031 explicitly rejected "require full THEME_TOKEN_NAMES
 * coverage" as an alternative for `tokenOverrides` ("defeats the point — a
 * tenant who wants to patch one colour would still have to enumerate 130
 * tokens"). `deriveTheme`'s job is the same partial patch, just computed
 * instead of hand-written. Every key it DOES return is a real
 * `ThemeTokenName` (see `derive-theme.test.ts`, "every returned key is a real
 * ThemeTokenName") — the honest reading of "covers the contract" for a patch
 * is "never emits a token the contract doesn't recognize," not "emits all of
 * it."
 *
 * ## Which tokens, and why exactly these
 *
 * - `--primary` — the seed, passed through (validated, not re-derived).
 * - `--primary-foreground` — the AA-contrast ink for a solid `--primary`
 *   plate (the pairing `INK_TONES` gates in `themes-contrast.test.ts`).
 * - `--accent` / `--accent-foreground` — this codebase's actual hover/active
 *   surface for controls that aren't the primary's own opacity step. `Button`
 *   outline/ghost variants reach for `hover:bg-accent`/`active:bg-accent` —
 *   the SAME token for both states, because this repo has no separate
 *   hover/active custom properties. A `bg-primary/90` hover step on the
 *   primary control itself needs no token at all (it falls out of overriding
 *   `--primary`), so `--accent` is the one pairing that genuinely needs
 *   deriving to read as a tint of the new brand colour instead of the old
 *   theme's blue.
 *   **Scope limit, corrected (fix round 2, issue #39, finding D):** this used
 *   to also claim `Sidebar`'s menu buttons reach for `bg-accent`. They do
 *   not — `sidebar.tsx` uses `bg-sidebar-accent` at every hover/active site,
 *   and `--sidebar-accent` is declared as its OWN literal in `themes.css`,
 *   not a `var(--accent)` mirror (unlike `--sidebar-primary`/`--sidebar-ring`
 *   below, which genuinely are mirrors). So a `deriveTheme` patch reaches
 *   `Button`'s hover/active state but NOT `Sidebar`'s menu hover/active
 *   state, which stays on the old theme's colour — a tenant who also wants
 *   the sidebar to follow must separately set `--sidebar-accent`/
 *   `--sidebar-accent-foreground` themselves; `deriveTheme` does not derive
 *   them.
 * - `--ring` — the focus indicator (ADR 0027). Derived to clear WCAG 1.4.11
 *   (>=3:1) against the given/assumed background, in `--primary`'s own hue
 *   family, rather than defaulting to the reference themes' `var(--primary)`
 *   alias (which is knowingly sub-3:1 in `light` — see `.claude/rules/theming.md`).
 *
 * `--sidebar-primary`, `--sidebar-ring`, etc. are declared in `themes.css` as
 * `var(--primary)` / `var(--ring)` MIRRORS (`.claude/rules/theming.md`,
 * "distinct roles, distinct values" — an intentional mirror uses `var()`), so
 * once `tokenOverrides` forces `--primary`/`--ring` on the element those
 * mirrors resolve to the new value automatically. `deriveTheme` does not need
 * to (and must not) also emit them.
 *
 * ## The AA-safety guarantee (not a claim — a proof + a runtime backstop)
 *
 * Every `-foreground` value this returns is chosen from two fixed near-black /
 * near-white ink anchors, picking whichever contrasts better against its
 * plate. That is ALWAYS achievable at >=4.5:1: for any background luminance
 * `Lbg` in [0, 1], `max((Lbg+0.05)/0.05, 1.05/(Lbg+0.05))` is minimized at
 * `Lbg ~= 0.179`, where it equals ~4.58 — i.e. the worse of the two extreme
 * inks is *never* below ~4.58:1, which already clears the 4.5:1 AA floor. See
 * `derive-theme.test.ts` for the numeric proof-check.
 *
 * `--ring` cannot rely on that identity alone (it must ALSO stay within
 * `--primary`'s hue family, so it can't jump to pure grey the way an ink can)
 * — so it is found by an explicit search over lightness (and, only if the
 * seed's own chroma leaves no room, a reduced chroma) that keeps the same hue
 * and stops at the closest-to-primary value that clears 3:1. If that search
 * still cannot produce a compliant value (it cannot for any real input — full
 * achromatic black/white inherits the same >=4.58:1 floor above, which is >3),
 * the function THROWS rather than returning a value that quietly fails 1.4.11.
 *
 * The search validates candidates AT THE SAME 3-decimal precision `formatOklch`
 * emits — not a finer internal value that gets rounded afterward. An earlier
 * version validated an unrounded candidate and rounded it only when formatting
 * the return value; rounding can move a boundary-sitting candidate (the search
 * always prefers the value CLOSEST to compliant, i.e. sitting exactly on the
 * boundary) back below the floor — measured shipping a 2.9936:1 `--ring` where
 * the search had picked 3.0000:1 before rounding (issue #39 fix round 1,
 * finding 1). Round first, then validate, so the value that is checked is
 * byte-for-byte the value that is returned.
 *
 * `--ring` also actively steers away from colliding with `--accent-foreground`
 * (`MUST_DIFFER` in `scripts/check-role-distinctness.mjs`) — both can land on
 * the same achromatic point (e.g. primary black on both, `deriveTheme({
 * primary: "oklch(0 0 0)" })`) since the ring's anchor is `--primary`'s own
 * lightness and the ink pick is also achromatic (fix round 1, finding 3). See
 * `findAALightness`'s `avoid` parameter.
 *
 * `--accent` is similarly guarded against colliding with `background` itself
 * (fix round 2, issue #39, finding C): the lightness escape that keeps
 * `--accent` off of `--primary` could land it exactly ON `background` instead
 * (measured: `primary: "oklch(0.42 0 0)"`, `background: "oklch(0.56 0 0)"` →
 * `--accent` byte-identical to `background`, an invisible hover state). See
 * `deriveAccent`'s second escape branch.
 *
 * Malformed input (anything `parseOklch` cannot parse) throws immediately for
 * the same reason: this function never returns a value it has not checked.
 * So does a `primary`/`background` that parses but carries alpha < 1 — see
 * `DeriveThemeOptions.primary`'s doc comment (fix round 1, finding 2).
 */
import type { ThemeTokenName } from "./theme-token-names.generated";
import { contrastRatio, parseOklch, type Oklch } from "./color-contrast";

/** Input to {@link deriveTheme}. */
export interface DeriveThemeOptions {
  /**
   * The seed brand colour, as a raw `oklch(L C H)` string — the same literal
   * format every token in `themes.css` uses. Other color formats (hex,
   * `rgb()`) are not accepted; convert to `oklch()` first (e.g. via the
   * browser's own `getComputedStyle`/Color 4 support, or a conversion
   * library) — see the CONSUMING.md note on this scope limit.
   *
   * **Must be fully opaque (alpha 1, or omitted).** `parseOklch` accepts the
   * `oklch(L C H / A)` form, but `deriveTheme` REJECTS an `A` other than 1
   * (fix round 1, issue #39, finding 2): every token in `themes.css` is a
   * solid, fully-opaque colour — alpha is applied via Tailwind's `/` modifier
   * at USE time (`bg-primary/10`), never baked into the token — and a
   * translucent seed has no well-defined derived value without knowing what
   * is painted behind it. `deriveTheme` only ever composites `--primary`
   * against `background`, but `--primary` legitimately renders over OTHER
   * surfaces too (a card, a popover); accepting a translucent seed and
   * measuring its `-foreground` ink against the un-composited colour
   * silently produced a 1.16:1 white-on-near-white pairing while the
   * function believed 17.97:1. Composite the seed against its real, intended
   * backdrop yourself first, and pass the resulting OPAQUE `oklch()`.
   */
  primary: string;
  /**
   * The surface the derived tokens will be read against — normally the
   * active theme's own `--background` (e.g. `getComputedStyle(document.documentElement)
   *   .getPropertyValue("--background")`). Optional: when omitted, derivation
   * assumes the `light` reference theme's own background
   * (`oklch(0.985 0.002 257)`), which is the correct default for the common
   * "tenant picks a brand colour, app stays on the `light` reference theme"
   * case. Pass the real value explicitly when deriving for `dark` or a
   * custom theme, or `--ring`'s search will optimize against the wrong
   * surface.
   *
   * **Must be fully opaque (alpha 1, or omitted)** — the same reasoning as
   * `primary` above: a translucent "surface" has no defined resolved colour
   * without knowing what is behind IT either.
   */
  background?: string;
}

/**
 * `deriveTheme`'s return shape — a subset of `ThemeTokenName` keys, so it is
 * directly assignable to `ThemeProvider`'s `tokenOverrides` prop with no
 * adapter. See the module doc comment ("Scope — a PATCH, not a theme") for
 * why this is intentionally partial.
 */
export type DerivedThemeTokens = Partial<Record<ThemeTokenName, string>>;

/** WCAG AA body-text floor (4.5:1) — see `themes-contrast.test.ts`'s `AA`. */
const AA_TEXT = 4.5;
/** WCAG 1.4.11 non-text floor (3:1) — see `themes-contrast.test.ts`'s `AA_NONTEXT`. */
const AA_NONTEXT = 3;
/** ADR 0027 clause 1 — `--ring` stays within this many degrees of `--primary`'s hue. */
const RING_HUE_TOLERANCE_DEG = 20;

/**
 * Perceptual distinctness floor, as an OKLab ΔE — the SAME constant
 * `scripts/check-role-distinctness.mjs` (`ROLE_SEPARATION_DELTA_E`) and
 * `themes-contrast.test.ts` apply to committed theme tokens. `deriveTheme`
 * emits a runtime patch those gates never see (they only read committed
 * theme CSS), so the same invariant — `(--accent-foreground, --ring)` is a
 * `MUST_DIFFER` pair — has to be enforced here instead (fix round 1, issue
 * #39, finding 3).
 */
const ROLE_SEPARATION_DELTA_E = 0.05;

/**
 * `light` reference theme's own `--background` literal
 * (`packages/tokens/src/themes/light.css`) — the assumed surface when the
 * caller doesn't pass one. Mirrors the anchor `themes-contrast.test.ts` and
 * `color-contrast.test.ts` already use for the same value.
 */
const DEFAULT_BACKGROUND = "oklch(0.985 0.002 257)";

/**
 * True black / true white ink anchors — deliberately NOT the shipped
 * `--foreground` values (`oklch(0.145 0 0)` / `oklch(0.985 0 0)` in the
 * reference themes), which are softened for aesthetics and, measured, only
 * guarantee ~4.35:1 in the worst case (below the 4.5:1 floor this function
 * promises). Pure black/white is what actually attains the ~4.58:1 worst-case
 * floor proven in the module doc comment and locked by the "proof-check" test
 * in `derive-theme.test.ts` — necessary because a derived fill can land at any
 * lightness (unlike a hand-authored theme's small set of surfaces).
 */
const DARK_INK: Oklch = { l: 0, c: 0, h: 0, alpha: 1 };
const LIGHT_INK: Oklch = { l: 1, c: 0, h: 0, alpha: 1 };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Round `n` to `digits` decimal places — the SAME rounding `formatOklch` applies. */
function roundTo(n: number, digits: number): number {
  return Number(n.toFixed(digits));
}

/** Serialize an {@link Oklch} back to the `oklch(L C H)` literal format themes.css uses. */
function formatOklch(o: Oklch): string {
  return `oklch(${roundTo(o.l, 3)} ${roundTo(o.c, 3)} ${roundTo(o.h, 1)})`;
}

/**
 * OKLab ΔE (Euclidean distance in L/a/b) between two {@link Oklch} colors —
 * mirrors the ΔE definition `scripts/check-role-distinctness.mjs` and
 * `themes-contrast.test.ts` already use, INCLUDING the `Math.hypot` call
 * (fix round 2, issue #39, finding E): a plain `Math.sqrt(dL**2+da**2+db**2)`
 * disagrees with `Math.hypot(dL,da,db)` by exactly one ulp at the 0.05 floor
 * (`oklch(0 0.05 116.5)` vs `oklch(0 0 0)`: `sqrt` → 0.05, `hypot` →
 * 0.049999999999999996), and the searches in this file deliberately prefer
 * the candidate CLOSEST to the floor — i.e. the one point where the two
 * functions can disagree about whether the floor is cleared.
 */
function oklabDistance(a: Oklch, b: Oklch): number {
  const toLab = (o: Oklch) => {
    const hr = (o.h * Math.PI) / 180;
    return { L: o.l, a: o.c * Math.cos(hr), b: o.c * Math.sin(hr) };
  };
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b);
}

/**
 * Pick whichever of {@link DARK_INK}/{@link LIGHT_INK} contrasts better
 * against `fill`, and throw if — despite the proof in the module doc comment
 * — neither clears `minRatio`. This is the "fail loudly, never quietly
 * non-compliant" backstop named in issue #39, kept even though the search
 * space (a fixed pair of achromatic extremes) makes the failure
 * mathematically unreachable for any finite, valid `fill`.
 */
function deriveForeground(fill: Oklch, minRatio: number, label: string): Oklch {
  const darkRatio = contrastRatio(DARK_INK, fill);
  const lightRatio = contrastRatio(LIGHT_INK, fill);
  const best = darkRatio >= lightRatio ? DARK_INK : LIGHT_INK;
  const bestRatio = Math.max(darkRatio, lightRatio);
  if (bestRatio < minRatio) {
    throw new Error(
      `deriveTheme: could not derive an AA-safe (>=${minRatio}:1) ${label} — best achievable was ` +
        `${bestRatio.toFixed(2)}:1. This should be mathematically unreachable for a valid oklch() ` +
        `input; check that "primary" parses to a real color.`,
    );
  }
  return best;
}

/**
 * Search lightness (and, if needed, chroma) at a fixed hue for the value
 * closest to `anchorL` that clears `targetContrast` against `background`,
 * while also staying >= {@link ROLE_SEPARATION_DELTA_E} OKLab ΔE from every
 * color in `avoid`. Used for `--ring`: keeps `--primary`'s hue (ADR 0027
 * clause 1), prefers staying close to `--primary`'s own lightness (only
 * moving as far as the contrast floor requires), and steers clear of
 * `--accent-foreground` (`MUST_DIFFER`, fix round 1 finding 3).
 *
 * Every candidate is rounded to the SAME precision `formatOklch` emits
 * (3 decimals for L/C) BEFORE it is measured, not after — validating an
 * unrounded value and rounding only at format time can silently move a
 * boundary-sitting candidate below the floor (fix round 1 finding 1; see the
 * module doc comment for the measured worst case).
 *
 * Chroma is reduced (not hue) when lightness alone can't reach the target at
 * the seed's chroma, because reducing chroma never leaves the ~20 degree hue
 * band this exists to respect, whereas hue-shifting would. The final rung
 * (chroma 0, fully achromatic) inherits the same >=4.58:1 floor proven in the
 * module doc comment, so SOME contrast-compliant value always exists — the
 * throw below is a backstop, not expected to fire. A value that also clears
 * `avoid` might not exist at every rung (two achromatic points can only be
 * pushed apart along the lightness axis); when that happens this walks every
 * chroma rung looking for one, and only if NONE has one falls back to the
 * plain contrast-compliant answer (matching the pre-fix-round-1 behavior —
 * the AA-safety promise still holds, only the separate distinctness goal is
 * missed in that vanishingly unlikely case, and `deriveTheme` re-validates
 * distinctness on the actual return value as a backstop regardless).
 */
function findAALightness(
  hue: number,
  chroma: number,
  background: Oklch,
  targetContrast: number,
  anchorL: number,
  avoid: Oklch[] = [],
): { l: number; c: number } {
  const hueR = roundTo(hue, 1);
  const CHROMA_STEPS = [chroma, chroma * 0.5, chroma * 0.25, chroma * 0.125, 0].map((c) =>
    roundTo(c, 3),
  );
  const STEPS = 1000;

  let fallback: { l: number; c: number } | null = null;

  for (const c of CHROMA_STEPS) {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let plainBest: number | null = null;
    let plainBestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i <= STEPS; i++) {
      const l = roundTo(i / STEPS, 3);
      const candidate: Oklch = { l, c, h: hueR, alpha: 1 };
      if (contrastRatio(candidate, background) < targetContrast) continue;

      const distance = Math.abs(l - anchorL);
      if (distance < plainBestDistance) {
        plainBestDistance = distance;
        plainBest = l;
      }
      if (
        distance < bestDistance &&
        avoid.every((a) => oklabDistance(candidate, a) >= ROLE_SEPARATION_DELTA_E)
      ) {
        bestDistance = distance;
        best = l;
      }
    }

    if (best != null) return { l: best, c };
    if (fallback == null && plainBest != null) fallback = { l: plainBest, c };
  }

  if (fallback != null) return fallback;
  throw new Error(
    `deriveTheme: could not derive an AA-safe (>=${targetContrast}:1) --ring at hue ${hue.toFixed(1)}° ` +
      `against the given background. This should be mathematically unreachable for a valid background ` +
      `color; check that "background" parses to a real color.`,
  );
}

/**
 * Minimum OKLab lightness delta {@link deriveAccent} keeps `--accent` away
 * from EITHER `--primary` or `background`, chosen comfortably above the 0.05
 * ΔE distinctness floor `pnpm roles:check` applies to co-occurring roles
 * elsewhere in this codebase (`.claude/rules/theming.md`, "Roles that
 * co-occur must stay PERCEPTIBLY apart"). A plain lightness delta of this
 * size alone clears 0.05 total OKLab ΔE regardless of the hue/chroma term, so
 * it is a sufficient (not merely necessary) guard against each anchor
 * individually. Originally guarded `--primary` only; extended to guard
 * `background` too after fix round 2, issue #39, finding C, found `--accent`
 * landing byte-identical to `background` (an invisible hover state) —
 * `deriveAccent` escaped a collision with `--primary` without checking
 * whether the escape route landed on the surface `--accent` is a hover state
 * FOR.
 */
const MIN_ACCENT_DELTA_L = 0.14;

/**
 * Derive the hover/active "peer surface" (`--accent`) as a softened tint of
 * `primary`, blended partway toward the background's own lightness and
 * de-saturated — the same shape as the shipped `light` theme's own
 * `--accent` (a soft powder-blue peer of a near-black-inked lime primary),
 * generalized to whatever hue the seed carries. `--accent` is a FILL, not
 * text, so it carries no contrast obligation against the background itself —
 * only its own `-foreground` ink (derived separately) is contrast-checked.
 *
 * The blend-toward-background step alone is not enough when `primary` is
 * ALREADY close to `background` (the "primary close to background" hostile
 * case) — blending two nearly-identical colours yields a third colour that is
 * also nearly identical to both, so `--accent` would collapse onto `--primary`
 * (an invisible hover state). When the blend doesn't move lightness by at
 * least {@link MIN_ACCENT_DELTA_L}, fall back to moving directly away from
 * `primary`'s own lightness toward the opposite pole instead — this keeps
 * `--accent` a legible, distinct peer of `--primary` regardless of how close
 * the seed and background happen to be, at the cost of no longer leaning
 * toward the background's own tone in that narrow case.
 */
function deriveAccent(primary: Oklch, background: Oklch): Oklch {
  let l = clamp01(primary.l + 0.6 * (background.l - primary.l));
  if (Math.abs(l - primary.l) < MIN_ACCENT_DELTA_L) {
    l =
      primary.l > 0.5
        ? clamp01(primary.l - MIN_ACCENT_DELTA_L)
        : clamp01(primary.l + MIN_ACCENT_DELTA_L);
  }

  // Fix round 2, finding C: the escape above only guards against colliding
  // with --primary — nothing stopped the result from landing on `background`
  // itself (an invisible hover state; the reproduction:
  // primary=oklch(0.42 0 0), background=oklch(0.56 0 0) escapes toward
  // primary.l + MIN_ACCENT_DELTA_L = 0.56, which IS background.l exactly).
  // Escaping a second time by simply re-running the same "push away from
  // background.l" step would ping-pong `l` straight onto `--primary` when
  // the two anchors sit less than 2 * MIN_ACCENT_DELTA_L apart (exactly the
  // reproduction above), so push clear of BOTH anchors at once instead: below
  // the lower of the two if that stays in range, else above the higher.
  if (Math.abs(l - background.l) < MIN_ACCENT_DELTA_L) {
    const lo = Math.min(primary.l, background.l);
    const hi = Math.max(primary.l, background.l);
    l = lo - MIN_ACCENT_DELTA_L >= 0 ? lo - MIN_ACCENT_DELTA_L : clamp01(hi + MIN_ACCENT_DELTA_L);
  }

  const c = Math.min(primary.c, 0.05);
  return { l, c, h: primary.h, alpha: 1 };
}

/**
 * Derive a coherent, AA-safe set of dependent tokens from one seed brand
 * colour, ready to pass straight to `ThemeProvider`'s `tokenOverrides` prop:
 *
 * ```tsx
 * const overrides = deriveTheme({ primary: "oklch(0.55 0.18 250)" });
 * <ThemeProvider tokenOverrides={overrides}>
 * ```
 *
 * See the module doc comment for exactly which tokens this returns, why
 * those and not the full `THEME_TOKEN_NAMES` set, and the AA-safety
 * guarantee every returned `-foreground`/`--ring` value carries.
 *
 * @throws if `primary`/`background` don't parse as `oklch(...)` colors, if
 *   either carries alpha other than 1 (see `DeriveThemeOptions.primary`), or —
 *   only reachable as a defensive backstop, see the module doc comment — if
 *   an AA-safe or distinct value genuinely cannot be found.
 */
export function deriveTheme(options: DeriveThemeOptions): DerivedThemeTokens {
  const primary = parseOklch(options.primary);
  const background = parseOklch(options.background ?? DEFAULT_BACKGROUND);

  if (primary.alpha !== 1) {
    throw new Error(
      `deriveTheme: "primary" must be fully opaque (alpha 1) — got alpha=${primary.alpha}. ` +
        `See DeriveThemeOptions.primary's doc comment: composite a translucent seed against its ` +
        `real backdrop yourself first, and pass the resulting opaque oklch() color.`,
    );
  }
  if (background.alpha !== 1) {
    throw new Error(
      `deriveTheme: "background" must be fully opaque (alpha 1) — got alpha=${background.alpha}. ` +
        `A translucent background has no defined resolved color without knowing what is behind it.`,
    );
  }

  const primaryForeground = deriveForeground(primary, AA_TEXT, "--primary-foreground");

  const accent = deriveAccent(primary, background);

  // Defensive backstop (fix round 2, finding C): re-measure the EXACT
  // emitted --accent string against the resolved background, in case
  // deriveAccent's two escapes ever both miss (see its own comment for why
  // that should not happen) — fail loudly rather than silently ship an
  // invisible hover state.
  const emittedAccent = parseOklch(formatOklch(accent));
  const accentBackgroundDeltaE = oklabDistance(emittedAccent, background);
  if (accentBackgroundDeltaE < ROLE_SEPARATION_DELTA_E) {
    throw new Error(
      `deriveTheme: internal invariant violated — emitted --accent collapses onto "background" ` +
        `at ΔE ${accentBackgroundDeltaE.toFixed(4)} OKLab (floor ${ROLE_SEPARATION_DELTA_E}). ` +
        `This indicates a bug in deriveAccent, not a bad input.`,
    );
  }

  const accentForeground = deriveForeground(accent, AA_TEXT, "--accent-foreground");

  // --ring actively steers away from colliding with --accent-foreground
  // (fix round 1, finding 3) — both are achromatic-capable outputs of this
  // same call, so the collision is entirely within deriveTheme's own output.
  const ringLC = findAALightness(primary.h, primary.c, background, AA_NONTEXT, primary.l, [
    accentForeground,
  ]);
  const ring: Oklch = { l: ringLC.l, c: ringLC.c, h: primary.h, alpha: 1 };

  // ADR 0027 clause 1 is satisfied by construction (ring.h === primary.h
  // always), but assert it defensively so a future refactor that starts
  // adjusting hue trips this immediately rather than shipping silently.
  const hueGap = Math.min(Math.abs(ring.h - primary.h), 360 - Math.abs(ring.h - primary.h));
  if (hueGap > RING_HUE_TOLERANCE_DEG) {
    throw new Error(
      `deriveTheme: derived --ring drifted ${hueGap.toFixed(1)}° from --primary's hue ` +
        `(limit ${RING_HUE_TOLERANCE_DEG}°, ADR 0027 clause 1) — this indicates a bug in ` +
        `findAALightness, not a bad input.`,
    );
  }

  // Defensive backstop (fix round 1, finding 1): re-measure the EXACT,
  // already-rounded value about to be emitted, not the pre-rounding
  // candidate findAALightness validated internally. Round-tripping through
  // formatOklch -> parseOklch here is what makes this check byte-for-byte
  // the same computation a caller re-checking the returned string would
  // perform — this is the check that would have caught finding 1 at the
  // point of return instead of downstream.
  const emittedRing = parseOklch(formatOklch(ring));
  const emittedRingRatio = contrastRatio(emittedRing, background);
  if (emittedRingRatio < AA_NONTEXT) {
    throw new Error(
      `deriveTheme: internal invariant violated — the emitted --ring value measures ` +
        `${emittedRingRatio.toFixed(4)}:1 against "background", below the ${AA_NONTEXT}:1 floor ` +
        `this function promises. This indicates a bug in findAALightness, not a bad input.`,
    );
  }

  // Defensive backstop (fix round 1, finding 3): re-measure distinctness on
  // the EXACT emitted strings, in case findAALightness ever falls back to a
  // plain (avoid-ignoring) answer — fail loudly rather than silently ship a
  // MUST_DIFFER collision.
  const emittedAccentForeground = parseOklch(formatOklch(accentForeground));
  const ringAccentForegroundDeltaE = oklabDistance(emittedRing, emittedAccentForeground);
  if (ringAccentForegroundDeltaE < ROLE_SEPARATION_DELTA_E) {
    throw new Error(
      `deriveTheme: internal invariant violated — emitted --ring and --accent-foreground collapse ` +
        `to ΔE ${ringAccentForegroundDeltaE.toFixed(4)} OKLab (floor ${ROLE_SEPARATION_DELTA_E}, ` +
        `MUST_DIFFER in scripts/check-role-distinctness.mjs). This indicates a bug in ` +
        `findAALightness's collision avoidance, not a bad input.`,
    );
  }

  return {
    "--primary": options.primary.trim(),
    "--primary-foreground": formatOklch(primaryForeground),
    "--accent": formatOklch(accent),
    "--accent-foreground": formatOklch(accentForeground),
    "--ring": formatOklch(ring),
  };
}
