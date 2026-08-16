# Batch 1 — `@brand/tokens`: contrast, semantic collisions, elevation

> **Run this batch first.** Every fix here changes how every component in every other batch renders.
> Landing it later means re-reviewing all the visual work.

---

You are working in the **brand-ui monorepo** (`packages/{ui,data,ai,charts,flow,tokens,editor,…}`,
registry/blocks, Storybook).

Before writing any code, read this repo's own contribution docs and follow its maintainer workflow (the
`brand-ui-component` skill if available: dedupe gate → component API rules → quality gates → manifest
regeneration). Everything in this brief **supplements — never overrides** — the repo's own rules.

**Mandatory, every item:**

1. **Dedupe gate first.** Verify the gap still exists at HEAD. This brief was verified against **v1.9.0**;
   HEAD may have moved. Record a dedupe verdict per item. If already fixed, say so and move on.
2. **Non-breaking by default.** These are additive. If an item genuinely can't be done without a break,
   **stop and report** rather than shipping the break. (Item 1 is the one exception — see its note.)
3. **Tokens only.** No raw hex/rgb/hsl in components. Correct in every shipped theme, verified by looking.
4. **A11y is part of Acceptance**, not a follow-up.
5. **Deliverables per item:** implementation · stories for the named states · docs · exported types ·
   tests · manifest regeneration.
6. **Honest reporting.** Per item: (a) what shipped, (b) what you deliberately left out, (c) what you did
   **not** verify.
7. **Do not silently expand scope.** If a design choice here looks wrong for the library, stop and report.

**Context for this batch:** these were found by a downstream product (a dense operator console) that
consumes `@brand/*` under a hard "every visible element is a `@brand` component" rule. Each item below
cost that app a local override it now has to maintain and would like to delete.

---

## 1. Role **fill ⇄ foreground** pairs are never contrast-tested, and five fail AA — P0

**SYMPTOM.** Filled chips, badges and buttons render their `-foreground` ink on their own `-<role>` fill
at 11–13 px. Five of those pairs measured below the 4.5:1 AA body threshold in the consuming app.

**UPSTREAM.** `tokens/src/themes.css` (per-theme role blocks) + `tokens/src/themes-contrast.test.ts`.

**CURRENT — this is the interesting part.** The contrast test suite is real and thorough, but it tests
the **wrong axis**. It covers `-text` tokens against _surfaces_:

```ts
// tokens/src/themes-contrast.test.ts
const AA = 4.5;
describe("themes.css — WCAG AA token contrast (all themes)", () => {
  describe.each(THEMES)("%s", (theme) => {
    it.each(TEXT_SURFACES)("success-text ≥ 4.5:1 on %s", …);
    it.each(TEXT_SURFACES)("destructive-text ≥ 4.5:1 on %s", …);
    it.each(TEXT_SURFACES)("warning-text ≥ 4.5:1 on %s", …);
    it.each(TEXT_SURFACES)("info-text ≥ 4.5:1 on %s", …);
    it("highlight-foreground ≥ 4.5:1 on --highlight", …);   // ← the ONLY fill⇄foreground assertion
    it.each(TEXT_SURFACES)("muted-foreground ≥ 4.5:1 on %s", …);
    it("sidebar-muted-foreground ≥ 4.5:1 on --sidebar", …);
  });
});
```

The file's own comment states the intent explicitly — _"fill tokens (`--warning`/`--info`) are tuned for
`_-foreground`ink on a [fill]"* — but **only`--highlight`is ever asserted that way.**`--primary`,
`--success`, `--info`, `--warning`and`--destructive` are never checked against their own foregrounds,
in any theme. So the tuning is an intention with no test behind it, and it has drifted.

Measured failures in the consuming app (its own guard test, 2026-07):

| Theme         | Pair                                         | Ratio    |
| ------------- | -------------------------------------------- | -------- |
| `qlik-bright` | `--primary` ⇄ `--primary-foreground`         | **4.31** |
| `qlik-bright` | `--success` ⇄ `--success-foreground`         | **4.31** |
| `qlik-bright` | `--info` ⇄ `--info-foreground`               | **3.76** |
| `qlik-dark`   | `--destructive` ⇄ `--destructive-foreground` | **3.02** |

Note the pattern: `qlik-dark` had _already solved_ four of five by giving its foregrounds a dark ink
(`--primary-foreground: oklch(0.3 0.12 258)`), and `--destructive-foreground` simply never got the same
treatment. This is drift, not a design stance.

**FIX.**

1. **Extend `themes-contrast.test.ts`** with a `ROLE_FILL_PAIRS` block asserting every
   `--<role>` ⇄ `--<role>-foreground` pair ≥ 4.5:1, for every role × every theme. Add the test **first**,
   watch it fail, then tune. That test is the real deliverable — it prevents the next drift.
2. Retune the failing values. Prefer adjusting **lightness only**, holding chroma and hue, so brand
   identity is preserved (the consuming app's own override did exactly this and is a usable reference:
   `qlik-bright --primary` L `0.553 → 0.515`, `--info` L `0.6 → 0.55`; `qlik-dark --destructive-foreground`
   → a dark ink `oklch(0.22 0.005 75)`).
3. Do the same audit for every other shipped theme, not just the two named here.

> **Breaking-change note:** this changes rendered colour. That is the point, and it is the one item in
> this batch that legitimately shifts pixels. Call it out in the changelog as a contrast fix.

**ACCEPTANCE.** `ROLE_FILL_PAIRS` × all themes green. Re-measure and report the _new_ ratios (don't trust
the table above — it's from a downstream app). Storybook shows a filled chip of each role in each theme.

---

## 2. `--primary === --success` and `--ring === --info`, byte-identical — P0

**SYMPTOM.** A "success" chip is indistinguishable from a primary action, and a focus ring is
indistinguishable from an "Info"/"Running" chip — **by colour alone**, which is the only signal these
tokens carry.

**UPSTREAM.** `tokens/src/themes.css`, `qlik-bright` block (~line 595) and the `qlik-dark` block.

**CURRENT.** Verified at v1.9.0 — these are literally the same string:

```css
/* qlik-bright */
--primary: oklch(0.553 0.143 153);
--success: oklch(0.553 0.143 153); /* ← identical to --primary */

--info: oklch(0.6 0.13 245);
--ring: oklch(0.6 0.13 245); /* ← identical to --info */
```

The same collision holds in `qlik-dark`. A semantic token that equals another semantic token isn't a
token — it's an alias that nobody declared, and consumers can't tell the two states apart.

**FIX.** Give `--success` a value distinct from `--primary`, and `--ring` a value distinct from `--info`,
in **every** theme. Keep them recognisably in-family (the consuming app shifted `--success` hue
150 → 166 for a bluer emerald and `--ring` to a brighter blue at `oklch(0.62 0.16 250)`) — the ask is
distinguishability, not a redesign. Mirror any derived tokens (`--sidebar-primary`, `--sidebar-ring`).

**ACCEPTANCE.** A test asserting `--success !== --primary` and `--ring !== --info` (string inequality is
enough to prevent regression; a small ΔE floor is better). Both remain AA-compliant per item 1. A
Storybook story showing a success chip beside a primary button, and a focused input beside an info chip,
in every theme — visibly different.

---

## 3. **No `--shadow-*` tokens exist**, so every Tailwind `shadow-*` utility is a silent no-op — P0

**SYMPTOM.** `shadow-sm` / `-md` / `-lg` / `-xl` / `-2xl` add a class and **paint nothing**. Every card,
popover, floating composer and elevated panel in a consuming app renders flat. This was found as a live
"the card is missing" bug and took CDP-probing the computed style to diagnose, because the markup looks
completely correct.

**UPSTREAM.** `tokens/src/themes.css`.

**CURRENT.** Verified: `grep -c 'shadow' themes.css` → 5 matches, `grep '\-\-shadow' themes.css` → **zero
definitions**. In Tailwind v4 every `shadow-*` utility compiles to `--tw-shadow`, which with no token
resolves to `0 0 #0000` — fully transparent.

This compounds with near-identical surface fills: `qlik-bright` `--card: oklch(1 0 0)` vs
`--background: oklch(0.985 0 0)` is a **1.5% lightness gap**, with `--border: oklch(0.88 0 0)`. So a card
separates from the page by a hairline and nothing else — there is no elevation channel at all.

The library's own `Toaster` is affected: `ui/src/components/sonner/sonner.tsx:39` sets
`group-[.toaster]:shadow-lg` on every toast. That shadow has never rendered.

**FIX.** Ship a per-theme elevation ramp (`--shadow-sm` … `--shadow-2xl`) and bridge it into the `@theme`
block so the Tailwind utilities resolve. Two constraints learned the hard way downstream:

- **Derive from a token, not a raw black.** Tinting from `--foreground` via
  `color-mix(in oklab, var(--foreground) 22%, transparent)` gives a real shadow on light themes and a
  subtle glow on dark ones, and keeps consumers' "no raw colors" lint rules satisfied.
- **Keep the y-offset modest with a wide blur.** A large downward offset falls off the viewport on
  bottom-docked elements and gets clipped by any `overflow-hidden` ancestor.

**ACCEPTANCE.** `getComputedStyle(document.documentElement).getPropertyValue('--shadow-lg')` returns a
non-empty value in every theme. A Storybook story with a `shadow-sm/md/lg/xl/2xl` ladder over both `--card`
and `--background`, in every theme, showing visible separation. Confirm the existing `Toaster` now casts
its shadow.

---

## 4. Density rescales boxes but not type — **feature request, and you may reasonably decline** — P2

> **RESOLVED 2026-08-02 (issue #340) — accepted, but NOT in the shape proposed below.** The
> maintainer agreed with the premise and chose to make `data-density` scale type **directly**,
> rather than behind the opt-in `[data-density-type="scaled"]` second attribute this item asks
> for: one `--type-factor` per density block (compact 0.9375 / comfortable 1 / spacious 1.0625)
> multiplies every role's size + line-height, above a 13px body legibility floor. `comfortable`
> and "no attribute" remain the exact identity, so a screen that never opts into a density is
> unchanged — but a screen already using `data-density="compact"` now renders smaller text.
> That is a deliberate behaviour change, recorded in `CHANGELOG.md` → Unreleased → Changed.
> The "CURRENT — deliberate decision" quote below is therefore **historical**; research 07 §E.4
> is marked superseded. Everything else in this item (the scale is well-formed, no hierarchy
> defect upstream) still stands.

**SYMPTOM.** `[data-density="compact"]` tightens every padding/height/gap but leaves type at full size, so
a compact table has tight rows around unchanged text. A consuming operator console wanted the whole
surface to scale together and had to redeclare **11 semantic role tokens and 8 raw Tailwind steps** (each
with its companion line-height) under `[data-density="compact"]` in its own stylesheet.

**UPSTREAM.** `tokens/src/density.css`, `tokens/src/themes.css` (`@theme` role block ~line 1075).

**CURRENT — and this is a deliberate decision, not an oversight.** The source says so directly:

```css
/* Type is deliberately NOT density-aware (07 §E.4): compact tables want
   tighter spacing, same readable text. Raw `text-sm`/`text-[17px]` in
   component source fails `pnpm text-scale:check` (ratchet). */
```

**We are flagging this as a disagreement, not a bug.** The shipped scale is genuinely well-formed —
`--text-display: 1.875rem` (30 px) / `--text-title: 1.25rem` (20 px) / `--text-body: 0.875rem` (14 px) /
`--text-kpi: 2rem` (32 px), a 2.14× display:body ratio with tuned weights and letter-spacing per role.
There is **no hierarchy defect upstream**; an earlier version of the downstream app's _own_ compact
override had flattened everything into 11–22 px, and that was self-inflicted.

**FIX (only if you agree with the premise).** An **opt-in** density-aware type layer — e.g.
`[data-density="compact"][data-density-type="scaled"]`, or a documented, supported recipe for consumers
who want it. Do **not** make it the default; §E.4's reasoning (readable text at any density) is sound and
a default change would shift every existing consumer's screens.

**ACCEPTANCE.** Either it ships opt-in with a story showing compact-scaled vs compact-default side by
side, **or** you decline it with the rationale recorded so downstream stops re-raising it. **A reasoned
decline is a perfectly good outcome for this item** — please don't build it just because it's listed.

---

## 5. Inter ships with no font-smoothing rule — P2

**SYMPTOM.** `@brand` ships the Inter `@font-face`, but nothing sets `font-smoothing`. On WebKit/Blink the
UI subpixel-renders heavier than the type was designed for — noticeably bolder on macOS. Every consumer
independently rediscovers this and adds the same two lines.

**UPSTREAM.** `tokens/src/themes.css` / the font entry in `tokens/src/fonts/`.

**FIX.** Ship it with the font:

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

Applied at the same layer as the `@font-face` so it can't be missed. If a global `body` rule is too
opinionated for a library, expose it as a documented utility class — but shipping the font without it
means every consumer renders it wrong by default.

**ACCEPTANCE.** A before/after screenshot on a WebKit browser at the same zoom. Confirm no consumer-side
override is needed.

---

## 6. No way to restrict which themes are exposed — P2

**SYMPTOM.** `THEMES` / `THEME_META` are all-or-nothing. A product shipping only two of the available
themes has to defend against the others in **three** places: filter the switcher's option list, guard
`localStorage` **before mount** (a persisted value for a now-hidden theme is applied on boot before React
runs), and run a `useEffect` safety net to coerce a stale persisted value back. Three defenses for one
config need, and forgetting the pre-mount guard produces a flash of a theme that isn't in the product.

**UPSTREAM.** `tokens/src/theme-provider.tsx`, `tokens/src/theme-types.ts`.

**FIX.** An `allowedThemes?: ThemeName[]` option on `ThemeProvider` that: filters what `useTheme()` and
`ThemeSwitcher` expose; coerces a persisted-but-disallowed value to the default **during the same
pre-mount read that already applies the theme** (so there's no flash); and makes `setTheme` to a
disallowed value a no-op with a dev warning.

**ACCEPTANCE.** Given `allowedThemes={["a","b"]}` and `localStorage` holding `"c"`: no flash of `c` on
boot, the switcher lists only `a`/`b`, `setTheme("c")` is a no-op, and a dev-mode warning fires. Story +
test covering the persisted-disallowed-value path specifically.

---

## Batch definition of done

Per item: dedupe verdict · implementation · tests (items 1, 2 and 6 are **test-first** — the test is the
deliverable that prevents recurrence) · stories in every shipped theme · docs · changelog entry naming
what changed visually · honest report of what you did not verify.

**One cross-cutting ask:** items 1 and 2 are both "a token invariant nobody was checking." Consider
whether `themes-contrast.test.ts` should grow into a general **token-invariants** suite — fill⇄foreground
contrast, semantic distinctness, required-token presence (which would have caught item 3 the day
`--shadow-*` went missing). That suite is worth more than any individual fix in this batch.
