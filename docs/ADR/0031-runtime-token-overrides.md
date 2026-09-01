# ADR 0031 — Runtime token-VALUE overrides on `ThemeProvider`

- **Status:** Accepted, **amended 2026-08-30 and 2026-09-01** (see Amendments)
- **Date:** 2026-08-30
- **Extends:** ADR [0029](./0029-open-theme-registry.md) (open theme registry) —
  that ADR decides WHICH named theme applies; this one decides how to patch
  individual token VALUES without authoring a whole new theme.
- **Relates to:** ADR [0027](./0027-focus-ring-token-contract.md) (`--ring`
  contract) — its own documented remedy ("override `--ring` in your own theme
  block") is the concrete case that motivated this.
- **Partially addresses:** issue #17 — the runtime-override mechanism ships;
  the SSR flash is documented rather than solved and `deriveTheme` is split
  out to issue #39 (see Amendment). #17 stays open until both land.

## Amendment (2026-08-30) — value validation, leak/unmount cleanup, and the `deriveTheme` split

A code review of the initial implementation (commit that introduced this ADR)
found the mechanism sound but three gaps between what shipped and what this
document and `ThemeProviderProps.tokenOverrides`'s own doc comment claimed.
All three are fixed in the same fix-round commit that added this amendment;
recorded here rather than silently folded into the sections below because the
original text (still accurate on the DESIGN) previously implied a stronger
guarantee than the first implementation actually gave:

- **Values were unvalidated.** Only KEYS were checked against
  `THEME_TOKEN_NAMES`; a value like `tokenOverrides={{ "--primary": "not-a-color" }}`
  was written to the DOM as-is and silently resolved to `unset` at the point of
  use. Fixed: every token except `--shadow-strength` (the one non-color,
  numeric-multiplier token in the contract) is now checked with
  `CSS.supports("color", value)` before being applied, and rejected — with the
  same `warnDev` treatment an unknown key already got — when the browser can
  answer and says no. Where `CSS.supports` doesn't exist (this package's own
  jsdom test environment implements no `CSS` global at all, and neither do
  some older runtimes), the value is applied unchecked, since refusing every
  override on an engine that cannot answer the question would regress
  "unchecked" to "the feature never applies" for that engine's users.
- **Overrides leaked onto the wrong element.** The apply effect fell back to
  `document.documentElement` whenever `attributeTarget` was `null`, which is
  exactly its value on a component's first render under the callback-ref
  pattern ADR 0029 documents for scoping a provider to one subtree (see
  `BringYourOwnThemeDemo` / `RuntimeTokenOverridesDemo` in
  `apps/docs/stories/foundations/theming.stories.tsx`). Once the ref resolved
  and `attributeTarget` became a real node, the effect re-ran and applied to
  the NEW element — but never cleared the OLD one, so the override stayed on
  `<html>` permanently. **Fixed**, along with unmount cleanup below, by a
  single mechanism: the apply effect now returns a cleanup function that
  removes exactly the properties it applied from exactly the element it
  applied them to, tracked in one `useRef<{ el, keys }>` rather than the
  previous bare `useRef<string[]>`. React invokes that cleanup before the
  effect re-runs on a dependency change, which is what clears the OLD
  target before the NEW one is written.
- **No unmount cleanup.** Unmounting `<ThemeProvider tokenOverrides={…}>`
  left every property it had applied in place forever, indistinguishable from
  the theme's own value to anything reading the DOM afterward. Fixed by the
  same cleanup-function mechanism above — React also invokes an effect's
  cleanup on unmount, with no special-casing needed.
- **`deriveTheme({ primary, background })` was deferred with no tracking
  issue.** The "Alternatives considered" table below said "Left as a future
  issue" without one existing. Filed as issue #39 rather than left
  ambiguous; that issue owns the AA-safety-guarantee work this ADR's table
  already correctly identified as separable and materially larger than the
  mechanism this ADR ships.

None of the above changes the DECISION this ADR records (the shape of
`tokenOverrides`, why it's a partial patch, why it survives a theme switch);
they close a gap between that decision and the first cut of its
implementation. The sections below are otherwise unchanged and remain
accurate to what ships today.

## Amendment (2026-09-01) — `deriveTheme`'s 3:1 proof is scoped to one background, not a theme-switching guarantee (issue #91)

An independent validator's sweep found that a `--ring` `deriveTheme` derives
and proves ≥3:1 against one background (the caller's `background` argument,
or the `light` reference theme's own background when omitted) can measure as
low as **1.00:1** (fully invisible) when the SAME returned `tokenOverrides`
object is instead applied while a DIFFERENT theme/background is active — 466
of 960 sampled seeds fell below 3:1. `deriveTheme` had already disclosed this
in prose (its own JSDoc and `docs/CONSUMING.md` §5.3 both said "pass
`background` explicitly for `dark`"), but disclosure alone left the
repository's own reference usage (`DeriveThemeDemo` in
`apps/docs/stories/foundations/theming.stories.tsx`) calling `deriveTheme`
with no `background` at all — evidence that a documented caveat is not a
shape that stops the mistake.

Filed as issue #91, triaged `needs-decision` (three directions were on the
table: a per-theme-keyed return, a `Record<themeName, background>` input, or
a `ThemeProvider` integration that re-derives live on theme change). **The
maintainer ruled: narrow the promise, then close — do not build the
multi-background guarantee.** All three directions would have made
`deriveTheme` couple to a theme registry (ADR 0029) or move color math into
the render/theme-switch path, either of which is a materially larger,
behaviour-changing surface than this fix warrants; the existing single-call,
single-background shape (this ADR's `tokenOverrides`, patched by one
synchronous derivation) stays exactly as designed.

What changed instead, so no caller can read a stronger promise than the
function delivers:

- **Docs narrowed.** The module doc comment and the `background` option's own
  doc comment in `packages/tokens/src/derive-theme.ts`, and `docs/CONSUMING.md`
  §5.3, now state plainly that the 3:1 proof covers ONLY the one `background`
  a call used — never a second theme/background the app might also render on.
- **A runtime diagnostic, not just prose.** `deriveTheme` now emits a
  dev-only `console.warn` (compiled out of production, the same `warnDev`
  shape `theme-provider.tsx` uses) on every call, restating the scope limit
  and pointing the caller at the "derive again per background, swap the
  result" workaround. This is the "warn for the case it cannot prove" half of
  the ruling — `deriveTheme` cannot know whether the consuming app switches
  themes, so it warns unconditionally rather than guessing.
- **The flagship demo left honest, not fixed by inventing an API.**
  `DeriveThemeDemo` never switches its own inner theme (it has no
  `defaultTheme`, so it always renders `light`, matching `deriveTheme`'s
  default background) — a doc comment on the demo now says so explicitly and
  points at `docs/CONSUMING.md` §5.3 for the cross-theme pattern, instead of
  silently implying the demo covers a case it does not.

This is the SAME kind of gap the 2026-08-30 Amendment above closed for
`tokenOverrides` itself (a claim stronger than the shipped guarantee) — the
fix is again to make the documented text and the runtime behavior agree,
not to grow the mechanism.

## Context

ADR 0029 made theming open: `ThemeName` is a plain string, and a consumer
registers any `[data-theme="…"]` block via `<ThemeProvider themes={[...]}>`.
That solves "which theme applies." It does not solve a different, narrower
problem: **changing one or two token VALUES without writing a whole theme.**

Verified against source before writing this ADR:

- `packages/tokens/src/theme-types.ts` — `defineTheme()` types a
  `{value, label, dark, description?, decorationLevel?}` descriptor. It carries
  no color/token values; its own doc comment says checking the CSS block exists
  "is a build-time property," not something this function does.
- `packages/tokens/src/theme-provider.tsx` (pre-#17) — `ThemeProviderProps` had
  no `tokens`/`style`/custom-property prop, and no `applyX` helper in the file
  ever wrote an inline style. Every one of them (`applyTheme`,
  `applyMotionPreference`, `applyDecoration`, `applyRegister`, `applyDensity`)
  only ever calls `setAttribute`/`removeAttribute` for a `data-*` attribute.
- `.claude/rules/theming.md` (the `--ring` section, clause 5) states the
  CURRENT sanctioned path for a single-token override is authoring a whole
  `[data-theme="…"]`-scoped block and states a preference for forking the
  theme entirely (`/new-theme`) over patching one token — i.e. the rule itself
  confirms there is no lighter-weight path today.

So a multi-tenant/white-label consumer — or anyone following ADR 0027's own
documented `--ring` remedy — has to author and maintain a CSS block covering
all of `THEME_TOKEN_NAMES` (130 tokens at the time of writing) just to change
one brand color. That is disproportionate to the ask and is issue #17's actual
claim, which holds against current source.

## Decision

**Add `tokenOverrides?: Partial<Record<ThemeTokenName, string>>` to
`ThemeProviderProps`.** On mount and on every render where its content
changes, the provider writes each entry as an inline CSS custom property on
`attributeTarget` via `element.style.setProperty(key, value)` — layered OVER
whichever `[data-theme]` block is active, at the highest specificity CSS has
(an inline property beats any stylesheet rule regardless of theme).

### Why `tokenOverrides`, not the issue's suggested `tokens`

The issue's own suggested shape used `tokens={{ "--primary": "..." }}`. This
ADR departs from that name for one reason: `themes`/`allowedThemes` already
name the theme-REGISTRY side of this provider's surface, and `tokens` reads as
though it could be a third registry-like concept (e.g. "the token set this app
ships") rather than a patch. `tokenOverrides` states the partial-patch
semantics — the one decision this ADR most needs to get right (see next
section) — directly in the name, so a reader does not have to open the doc
comment to know it isn't a replacement.

### Partial patch, not a replacement — deliberately, against the theming rule's own default

`.claude/rules/theming.md` states "every theme overrides every token... a
missing token falls back to `:root` and usually looks wrong." `tokenOverrides`
**intentionally does not follow that rule**, and this is the central design
decision this ADR records:

- A hand-authored `[data-theme="…"]` block is a **complete replacement** theme.
  Every token it doesn't define falls through to `:root`'s neutral base — which
  is why the theming rule requires full coverage.
- `tokenOverrides` is a **partial patch OVER an already-complete theme**. A key
  you don't pass simply isn't forced by an inline property, so it keeps coming
  from whichever `[data-theme]` block is active (`light`, `dark`, or a
  consumer's own registered theme) — never from `:root`. There is no
  "incomplete theme" failure mode here because there is no second theme; there
  is one active theme plus a small number of forced values on top of it.

This is exactly what a tenant wants: override `--primary`/`--ring`/`--accent`
for their brand, keep every other token (surfaces, borders, chart ramp,
sidebar, …) exactly as the underlying `light`/`dark` theme already tuned it.
Requiring full coverage for this case would just be ADR 0029's forking
workaround again, which is the thing #17 asks to avoid.

### Keys are validated against `THEME_TOKEN_NAMES` — rejected, not silently applied

`THEME_TOKEN_NAMES` (`packages/tokens/src/theme-token-names.generated.ts`,
ADR 0029 §4) is already exported as the authoritative token contract. A
`tokenOverrides` key that is not in that list is **rejected** (not applied) and
triggers a `warnDev` message naming the key.

This is the failure mode named in the work brief: `element.style.setProperty("--totally-not-a-real-token", "red")`
succeeds at the DOM level with zero visual effect, because no `themes.css` rule
reads a property with that name — indistinguishable from success unless
something says otherwise. Rejecting (not just warning-and-applying) also keeps
`attributeTarget`'s inline style free of dead custom properties that a
consumer might later mistake for load-bearing.

### Reactive, controlled prop — no internal state, no setter, no persistence

Every other dial in this file (`theme`, `decoration`, `density`, `register`)
follows the same shape: internal `useState`, a `defaultX`/`xStorageKey` pair, a
mount-time hydration effect, and an exported `setX` the app calls to change it
later. `tokenOverrides` deliberately does **not** follow that shape:

- There is no `useTokenOverrides()`/`setTokenOverrides` and no storage key.
  The consumer (an app that already fetched a tenant's brand colors from
  wherever tenant config lives) is the source of truth; the provider's only
  job is to keep the DOM in sync with whatever value the prop currently holds.
  This matches D5 (`docs/DECISIONS.md`) — brand-ui is a presentation layer, it
  does not own where tenant configuration comes from.
- The apply effect is keyed on the override's **content** (a stable,
  order-independent string built from its entries), not its object identity,
  exactly like `registryKey`/`allowedKey` already do for `themes`/
  `allowedThemes` — so an inline object literal on every render doesn't churn
  the effect.
- Removing a key (or the whole prop) between renders clears the corresponding
  inline property via `removeProperty`, restoring the active theme's own
  cascade value. The provider tracks the previously-applied key set in a
  `useRef` to know what to clear — there is no other way to know what to
  remove, since CSS offers no "unset back to whatever the stylesheet says"
  short of removing the exact property you added.

### Overrides survive a theme switch

`tokenOverrides` is applied to `attributeTarget`'s inline style, completely
independent of the `data-theme` attribute `setTheme` writes to the same
element. Calling `setTheme("dark")` does not touch the inline overrides, so
they keep applying across the switch. This is the behavior a tenant needs:
their brand accent should hold whether the user is in light or dark mode, not
reset every time the theme changes. The alternative (clearing overrides on
every theme switch) was considered and rejected — it would make the feature
useless for exactly the case it exists for.

### SSR: this flashes, and that is accepted for v1

`ThemeProvider` is `"use client"`, and — like the theme/decoration/density
effects above it in the same file — `tokenOverrides` applies in a
`useEffect`, which never runs during server rendering. **First paint (and the
hydration frame) render the un-overridden theme; the tenant's override appears
one paint later.** This is the same sharp edge ADR 0029 already documents for
`attributeTarget` with a callback ref ("Watch for"), extended to this prop.

This is accepted rather than fixed here because fixing it requires
**app-level** cooperation this package cannot provide on its own: the override
values have to reach the server-rendered `<html>`/`<head>` before React ever
runs (e.g. an inline `<style>`/`<script>` the app's own SSR entry emits, keyed
off the same tenant lookup that would otherwise feed this prop client-side) —
exactly the class of concern `.claude/rules/interaction-guidelines.md` calls
out as belonging to the **app**, not the component library (RSC hydration
specifics, `<meta name="theme-color">`, etc.). Documenting the flash and the
recommended app-side workaround (`docs/CONSUMING.md` § 5.2) is this ADR's
answer for v1; a package-level SSR helper is a possible follow-up, not part of
this change.

### CSP: confirmed, not assumed

`docs/csp-policy.json`'s `style-src` carve-out already grants `'unsafe-inline'`
because React, React Flow, Radix and Recharts all write `style="…"` attributes
at runtime; that carve-out is not needed for this feature and this feature
does not widen it. Independently of that carve-out, `element.style.setProperty()`
mutates the CSSOM directly rather than parsing a `style` attribute string or
`<style>` element — per the CSP spec, `style-src` restricts markup-level style
parsing, not a script's direct property assignment on an already-live
`CSSStyleDeclaration`. If a script can call `setProperty` at all, that script
already executed under whatever `script-src` allowed; `style-src` has no
separate veto over it. (Confirmed via MDN's `style-src` documentation and the
CSP working-group's own list-archive discussion of "what it means to ignore
style attributes" — both agree the CSSOM-manipulation path is
`script-src`-gated, not `style-src`-gated.) This is exactly why the
implementation uses `setProperty`/`removeProperty` throughout and never
`style.cssText = …` or `setAttribute("style", …)` — those two ARE treated as
style-attribute parsing and would need `'unsafe-inline'` to work under a
strict policy. `pnpm csp:check` and `pnpm csp-sinks:check` both pass unchanged
because nothing in this change touches `docs/csp-policy.json`, adds a new
remote origin, or matches any of `check-csp-sinks.mjs`'s sink patterns
(`dangerouslySetInnerHTML`, `.innerHTML =`, `.outerHTML =`,
`insertAdjacentHTML`, `document.write`).

### Why this does not weaken "semantic tokens only"

`.claude/rules/styling-and-tokens.md` bans raw hex/arbitrary color values in
component SOURCE, with `themes.css` as the one exception. `tokenOverrides`
does not touch component source at all — no `@elabs-ai/components-*` component
gains a hardcoded color. It is a **consumer-supplied runtime value**, exactly
like a `style` prop a consumer already passes to any DOM element, except
scoped to the token namespace and validated against `THEME_TOKEN_NAMES`. The
rule governs what a component AUTHOR may hardcode; it says nothing about what
values a CONSUMER may inject into the CSS custom-property layer at runtime —
that channel (CSS custom properties resolving to whatever a theme or an inline
override says) is the entire mechanism the token system is built on. `pnpm
palette:check` (`scripts/check-raw-palette.mjs`) scans component source for
raw Tailwind palette utilities (`bg-red-500`, …); it has nothing to scan here
since no component source changed, and it passes unchanged.

## Alternatives considered

| Option                                                                                                                                                                                                     | Why not                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`deriveTheme({ primary, background })`** — a color-theory helper deriving hover/active/`--ring` from 1-2 seed colors                                                                                     | Separable, materially larger (color math, AA-safety guarantees across every derived role). The issue itself lists it as a follow-up, not this fix. Tracked as issue #39 (see Amendment) — **implemented**, see `packages/tokens/src/derive-theme.ts` and `docs/CONSUMING.md` §5.3. Its 3:1 proof is scoped to ONE background per call, not a theme-switching guarantee — see the 2026-09-01 Amendment (issue #91). |
| **`deriveTheme` resolving `--ring` against every theme a `ThemeProvider` registry knows about** (per-theme-keyed return, a `Record<themeName, background>` input, or a live re-derivation on theme change) | Couples a pure color-theory helper to the theme registry (ADR 0029) or moves color math into the render/theme-switch path — a materially larger, behaviour-changing surface than the gap (issue #91) warranted. Rejected by the maintainer 2026-09-01 in favor of narrowing the documented promise and adding a dev-only warning; see the Amendment above.                                                         |
| **Shipped presets (`accessibleFocusRing` for light/dark)**                                                                                                                                                 | Once `tokenOverrides` exists, a preset is just a canned value for it — a small follow-up, not part of the mechanism itself.                                                                                                                                                                                                                                                                                        |
| **Require full `THEME_TOKEN_NAMES` coverage (mirror the theme-authoring rule exactly)**                                                                                                                    | Defeats the point — a tenant who wants to patch one color would still have to enumerate 130 tokens. Rejected; see "Partial patch" above.                                                                                                                                                                                                                                                                           |
| **Silently apply an unknown key**                                                                                                                                                                          | Reproduces the exact silent-no-op failure mode `warnDev` exists to catch elsewhere in this file (`setTheme` on a disallowed name already warns rather than silently applying). Rejected.                                                                                                                                                                                                                           |
| **Expose `tokenOverrides` via `useTheme()`/a `setTokenOverrides` setter, mirroring theme/decoration/density**                                                                                              | Adds internal state and a persistence question (should a tenant override survive a reload via localStorage — almost never, since it is re-derived from tenant config on every app boot) for no benefit: the consumer already holds the value it would be echoing back. Rejected in favor of a plain controlled prop.                                                                                               |
| **A CSS class per override (`data-token-primary="…"`) instead of inline style**                                                                                                                            | CSS cannot read an arbitrary attribute VALUE into a property value (no `attr()` support for color-typed custom properties in any shipping engine at the time of writing) — this would require a `<style>` block per unique value combination, reintroducing the exact style-attribute CSP surface this design avoids, for no benefit over inline `setProperty`. Rejected.                                          |

## Consequences

- **Better.** A tenant/white-label consumer can override 1-2 brand tokens with
  a plain React prop instead of authoring a full theme, satisfying issue #17
  and giving ADR 0027's `--ring` remedy a lighter-weight path than "fork the
  theme."
- **Worse.** A new sharp edge to document (SSR flash), on top of the two ADR
  0029 already carries for `attributeTarget`. Consumers with a hard first-paint
  requirement must additionally emit the same values server-side — this ADR
  does not solve that half.
- **Watch for.** A future maintainer adding a SECOND way to set a token value
  at runtime (e.g. a `useTheme().setToken()` escape hatch) should route through
  the same `THEME_TOKEN_NAMES` validation and the same `setProperty`/
  `removeProperty` mechanism rather than inventing a second one — the
  validation and the CSP reasoning above apply identically to any future
  runtime-value-setting API in this package.

## References

- ADR [0029](./0029-open-theme-registry.md) — the open theme registry this
  extends; `THEME_TOKEN_NAMES` (§4) is the contract `tokenOverrides` validates
  against.
- ADR [0027](./0027-focus-ring-token-contract.md) — the `--ring` remedy that
  motivated this (clause 5: "prefer forking the theme… over patching one
  token" — this ADR gives the lighter-weight alternative that sentence lacked).
- `.claude/rules/theming.md` — "every theme overrides every token" (the rule
  this ADR deliberately does NOT apply to a partial runtime patch, and why).
- `.claude/rules/styling-and-tokens.md` — "semantic tokens only" (why this
  does not weaken it — see above).
- `.claude/rules/scope-and-non-goals.md` (D5) — why the SSR flash fix is an
  app-level concern, not a package one.
- `docs/csp-policy.json` §`style-src` carve-out — the existing `'unsafe-inline'`
  reasoning this feature does not need to extend.
- `docs/CONSUMING.md` § 5.2 — the consumer-facing recipe and SSR caveat.
- `packages/tokens/src/theme-provider.tsx` — `tokenOverrides`,
  `applyTokenOverrides`, `tokenOverridesKey`.
- `packages/tokens/src/theme-provider.test.tsx` — `describe("ThemeProvider —
tokenOverrides (#17)", …)`.
- Issue #17.
- Issue #39 — the `deriveTheme({ primary, background })` follow-up split out
  by the 2026-08-30 Amendment above. Implemented in
  `packages/tokens/src/derive-theme.ts` / `packages/tokens/src/derive-theme.test.ts`,
  exported from the package barrel, documented in `docs/CONSUMING.md` §5.3, and
  demonstrated in `Foundations/Theming` → "Derive theme from one colour".
- Issue #91 — `deriveTheme` resolves `--ring` against one background; a
  theme-switching app can render it below 3:1. Closed by the 2026-09-01
  Amendment above (narrow the promise + a dev-only warning), not by building
  the multi-background guarantee.
