# ADR 0014 — i18n seam: Radix `DirectionProvider` in `LocaleProvider` + microcopy externalization

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** brand-ui-design-system-architect (design gate for the i18n block)
- **Relates to:** `LocaleProvider` (`packages/ui/src/components/locale-provider/`), which
  already documents this as a FOLLOW-UP (lines 113–118 of `locale-provider.tsx`); the
  open WP-06 i18n scope question (P0 vs P1).

## Context

`@elabs/components-ui` ships `LocaleProvider` / `useLocale()` with `locale`, `dir`, `t`,
`formatNumber`, `formatDate`. It sets `dir` on its own wrapper `<div dir={dir}>`, but
**portalled Radix content escapes that wrapper** — Dialog, Sheet, Popover, DropdownMenu,
Select, Tooltip, ContextMenu, HoverCard, Menubar, NavigationMenu all render through a
portal outside the `dir` ancestor, so in an RTL locale those overlays lay out LTR. Radix
solves exactly this with `@radix-ui/react-direction`'s `DirectionProvider`, which every
Radix primitive reads via context regardless of DOM position. That dep is **not yet in
the tree** (verified absent); `@elabs/components-ui` already depends on ~25 `@radix-ui/*` packages
at the `^1.x`/`^2.x` line.

Separately, `@elabs/components-ai` hardcodes locale in formatters: `context.tsx` has 11
`new Intl.NumberFormat("en-US", …)` and `commit.tsx` a `new Intl.RelativeTimeFormat("en", …)`.
`@elabs/components-ai` depends on `@elabs/components-ui` (`workspace:*`), so it **can** consume `useLocale()`.
These hardcoded `"en-US"`/`"en"` strings are a microcopy/format-locale leak that defeats
the LocaleProvider for any non-English consumer.

Adding a new `@radix-ui/*` runtime dep is a structural call (lockfile churn, a new
runtime dependency in the foundation package) — architect-gated.

## Decision

### (a) Adopt `@radix-ui/react-direction` and wire `DirectionProvider` into `LocaleProvider`

- Add `@radix-ui/react-direction` to `packages/ui` as a runtime `dependency`, **version
  range aligned with the sibling Radix deps** (the `react-direction` package versions in
  lockstep with the others; pin to its current `^1.1.x` line — the builder confirms the
  exact published range at install time so it matches the rest of the `@radix-ui/*`
  block).
- Wrap `LocaleProvider`'s subtree in `<DirectionProvider dir={dir}>` so portalled Radix
  overlays inherit direction from context, not the DOM ancestor. Keep the existing
  `<div dir={dir}>` for non-Radix content. This is the **complete** fix the existing
  FOLLOW-UP comment describes; delete that comment when wired.
- No public API change — `LocaleProvider`'s `dir` prop already exists; this only makes it
  reach Radix portals. Backward compatible.

### (b) Microcopy / format-locale seam in `@elabs/components-ai`

- The 11 `Intl.NumberFormat` and the `RelativeTimeFormat` in `@elabs/components-ai` read `locale`
  from `useLocale()` instead of the hardcoded `"en-US"`/`"en"`. `@elabs/components-ai` already
  depends on `@elabs/components-ui`, so this is an in-graph consumption, not a new edge.
  - Prefer the **`formatNumber` helper on the context** (`useLocale().formatNumber(n, opts)`)
    over a raw `new Intl.NumberFormat(locale, opts)` — it already caches formatters per
    `locale+opts` (avoids re-allocating Intl objects per render). For `RelativeTimeFormat`
    (which `LocaleContextValue` does not yet expose), read `locale` from `useLocale()` and
    construct locally, OR extend the context with a `formatRelativeTime` helper if more than
    one call site needs it (currently one — read `locale` locally; do not grow the interface
    for a single caller).
  - These components stay **presentational + runtime-agnostic** (D5/D6): `useLocale()` is a
    pure presentation-layer read; no model/transport concern is introduced.
- **Non-hook formatting path:** some `@elabs/components-ai` helpers may format outside a component
  (module-scope utilities). For those, the consumer must pass `locale` explicitly (a
  function arg defaulting to `"en-US"`), since hooks can't run there. Do NOT introduce a
  module-level mutable "current locale" singleton — that breaks SSR/concurrent rendering.
  The hook path is the default; the explicit-arg path is the escape hatch for the few
  non-component formatters.

### (c) Open product question — flagged, NOT blocked

Whether non-English / EU locales are **in scope now (WP-06 i18n P0)** or **later (P1)** is
a product decision for the human, not an architecture blocker. This design works for both:
the seam is opt-in (English defaults when no `LocaleProvider`/non-en locale is set), so
shipping it changes nothing for English-only consumers and unlocks RTL/EU the moment a
consumer sets `locale`/`dir`. **Note for the human:** confirm the WP-06 P0/P1 call; the
seam is built either way.

## Install timing

**Defer the install to the human** (same posture as ADR 0013). This block does not run
`pnpm install`. The builder lane:

1. stages `packages/ui/package.json` adding `@radix-ui/react-direction` at the aligned
   range,
2. flags "human: run `pnpm install` to update the lockfile" as a follow-up.

## Consequences

- `+` RTL becomes correct for portalled Radix overlays — the one structural i18n gap in
  the foundation — with no public API change.
- `+` `@elabs/components-ai` numbers/dates/relative-times honor the active locale; the en-US leak is
  closed; components stay presentational.
- `+` English-only consumers see zero behavior change (opt-in seam).
- `−` One new MIT runtime dep in `@elabs/components-ui` and a lockfile update (human-approved).

## References

- `packages/ui/src/components/locale-provider/locale-provider.tsx` (the documented
  FOLLOW-UP this resolves); `packages/ai/src/context.tsx`, `packages/ai/src/commit.tsx`
  (the hardcoded formatters); `.claude/rules/scope-and-non-goals.md` (D5),
  `.claude/rules/ai-sdk-vs-a2ui.md` (D6); `.claude/rules/component-api.md` (Composition
  patterns — `use(Context)` over `useContext`).
