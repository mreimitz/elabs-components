# 01 · What enterprise-grade component libraries actually offer

> Part of the **enterprise-gap** research pack. This is the distilled benchmark — what
> best-in-class libraries and design systems do, and the bar brand-ui is measured against in
> [`03-gap-analysis.md`](./03-gap-analysis.md). Full sourced notes (76 citations) live in
> [`_research/enterprise-libraries-notes.md`](./_research/enterprise-libraries-notes.md).

## The field, in three tiers

The libraries worth benchmarking compete on different things, so it helps to separate them:

1. **Open-source dev libraries** you `npm install` — MUI (+ MUI X), Ant Design, Mantine, Chakra,
   Radix (Primitives + Themes), shadcn/ui, Base UI, Park UI/Ark. These split into _styled
   batteries-included_ (MUI, Ant, Mantine, Chakra), _headless behavior layers_ (Radix, Base UI,
   Ark/Zag), and _copy-owned source_ (shadcn, Park UI).
2. **Vendor/enterprise design systems** that back a product suite and ship design + code + Figma —
   IBM Carbon, Atlassian (Atlaskit), Shopify Polaris, Microsoft Fluent 2, Salesforce Lightning
   (SLDS/SLDS 2), Adobe Spectrum / React Aria, SAP Fiori/UI5, Google Material 3.
3. **Specialist "hard widget" vendors** the others lean on — AG Grid, TanStack Table/Virtual,
   MUI X Data Grid. This is where the "enterprise vs toy" line is really drawn.

brand-ui is, by design, a **tier-1 copy-owned + imported hybrid** (shadcn-shaped) that aspires to
the **tier-2 governance/credibility bar**. That framing matters: the goal isn't to out-component
MUI, it's to be a _credible internal standard_.

## The ten dimensions that define "enterprise-grade"

### 1. Component breadth — the hard widgets are the signal

Every leader converges on the same taxonomy (inputs/forms · data display · feedback · navigation ·
overlays · layout · surfaces · typography · utilities). Counts are orientation only (Ant ~67 core +
Pro; Mantine 120+ components **and 70 hooks**; Carbon 50+; Ark 45+) — "has a Button" is table
stakes. The real differentiator is the **expensive components**:

- a **virtualized / server-capable data grid** (AG Grid handles 100k+ rows; TanStack Table is the
  free headless engine; MUI X is tiered/paid),
- **accessible date/time + range pickers**,
- **combobox / autocomplete**,
- **tree / tree-select**,
- **transfer ("shuttle") and virtualized lists**,
- **charts**.

The strategic question a library must answer honestly is **"wrap an engine or build it"** — the
leaders either ship these or document a first-class integration. A library that silently lacks them
forces every consuming team to bolt on AG Grid/TanStack independently, which defeats the point.

### 2. Design tokens — a tiered, standardized contract

The mature pattern is a **layered token system**: primitive/global (raw values) → semantic/alias
(intent: `text.primary`, `surface.raised`) → optional component tokens. The format milestone of the
period: the **W3C Design Tokens (DTCG) spec reached its first stable version, 2025.10, on
2025-10-28** — a vendor-neutral JSON interchange (`$value`/`$type`/`$description`) now supported by
Style Dictionary v4+, Tokens Studio, Figma, and ~10 other tools. The credible 2026 baseline is
_semantic tokens that can round-trip to/from DTCG JSON_, built to CSS variables via a
Style-Dictionary-style pipeline.

### 3. Theming & branding — CSS variables, multi-brand, density

CSS custom properties are the universal mechanism, and the explicit pattern is **"decouple
structure from theme"** — Salesforce SLDS 2, Fluent, Atlassian, and Ant all let you white-label by
swapping a token set without forking components. Best-in-class theming = semantic CSS variables +
multi-brand/white-label + light/dark via token modes + **a density axis** (comfortable/compact),
with a deliberate choice between runtime theming (swap `data-theme` live) and build-time/zero-runtime
generation (smaller bundles, better RSC fit). Density is a genuine enterprise table-stakes feature
that lighter libraries routinely omit.

### 4. Accessibility — now legally load-bearing

This is the single biggest enterprise credibility gate, and as of mid-2025 it is **legal**, not
aspirational: the **European Accessibility Act deadline was 28 June 2025**, enforced against
**WCAG 2.1 AA via EN 301 549** (2.2 AA aspirational), with fines into six figures. The bar:
APG-conformant keyboard/ARIA patterns, real screen-reader testing, **axe checks in CI**, and a
publishable **VPAT/ACR** for procurement. **React Aria (Adobe)** and **Radix** are the reference
implementations to emulate.

### 5. Internationalization & RTL

Enterprise-grade i18n means **RTL/bidi-safe styling** (logical CSS properties, or a dir-aware
build), **Intl-based locale formatting** including non-Gregorian calendars (React Aria leads), and
**fully externalized, overridable component strings** (aria-labels, "no rows", pagination text).
Apps need to translate built-in component microcopy, not just their own copy. Tailwind v4 + logical
properties make RTL far more tractable than the old Emotion-plugin era.

### 6. Documentation & DX

A best-in-class component doc page carries **both** a designer and a developer surface: live
interactive examples per state, **auto-generated TS prop tables** (so they can't rot), Do/Don't
pairs, **per-component accessibility notes**, the tokens it consumes, split design-vs-dev guidance,
search, and versioned docs. **Storybook autodocs** is the de-facto engine. The emerging frontier
(see doc 02): an **MCP/agent interface** so AI tools read ground-truth APIs.

### 7. Figma / design-to-dev parity

The gold standard is a **bi-directional token pipeline** (DTCG/Style Dictionary ⇄ Figma Variables) +
**Code Connect** linking each Figma component to its real coded implementation, surfaced in Dev
Mode. Variable _modes_ (Light/Dark) line up with token themes. A system with no Figma kit and no
token round-trip is hard to adopt at design-led orgs — though this matters less for a code-first,
agent-first internal library.

### 8. Distribution & versioning — the under-rated adoption factor

Two philosophies: **installed-package** (npm + semver; central updates, bounded customization) and
**copy-owned registry** (shadcn/Park UI; total ownership, you maintain it). The strategic 2025
insight is the **hybrid** — stable installed packages _plus_ a copy-owned registry with
**namespaced/private** support (shadcn CLI 3.0, Aug 2025) — which is exactly brand-ui's structure.

The most under-rated factor in whether a system gets adopted is the **migration story**: semver +
changelogs + versioned docs + **migration guides AND codemods** (MUI ships `@mui/codemod`;
Atlassian uses Hypermod; Carbon has a clean `carbon-components`→`@carbon/react` deprecation). Teams
adopt what they can upgrade safely and leave gracefully.

### 9. Quality engineering — gated in CI

The credible 2025–2026 stack, largely Storybook-centered: **unit/behavior tests** (Vitest + Testing
Library) + **interaction tests** (Storybook play functions) + **visual regression** (Chromatic, with
TurboSnap) + **axe a11y** — _all gated in CI_, plus an RFC/review contribution process. The marker
of "advanced" governance maturity is automated a11y/design-system scoring wired into the delivery
pipeline, not run by hand.

### 10. Framework/runtime — RSC-safe is the React-lane bar

Two paths: **React-first with token-driven, RSC-safe styling** (Tailwind/CSS Modules, correct
`"use client"` boundaries) — brand-ui's lane — versus **framework-agnostic Web Components** (the
re-platforming Polaris, Fluent, UI5 chose for multi-framework reach; Polaris deprecated
`polaris-react` in Oct 2025). For a React-only internal library the credibility bar is clean RSC
support + zero/low-runtime styling; going framework-agnostic is a bigger bet only worth it if real
non-React consumers exist.

## What makes a library credible as an _enterprise standard_ (the non-component things)

This is the part teams underestimate. Distilled from how Carbon, Atlassian, and Polaris are actually
run:

1. **Governance & support** — a named owning team, a federated contribution/RFC process, a
   versioning + **deprecation policy**, predictable release cadence.
2. **Stability & longevity** — semver, support windows, migration guides + codemods, versioned docs,
   so teams trust it won't strand them. (Counter-examples that _erode_ trust: Radix's post-WorkOS
   momentum stall; Google's Material Web in maintenance mode.)
3. **Accessibility compliance** — WCAG 2.1 AA + publishable VPAT/ACR (EAA-forced in the EU).
4. **Theming / white-label** — semantic tokens (ideally DTCG) so one system serves many brands.
5. **Design-to-code parity** — Figma kit + token sync + Code Connect.
6. **Quality engineering in CI** — interaction + visual-regression + a11y gates.
7. **Migration story** — codemods to upgrade, clean deprecation to leave.
8. **Breadth where it's hard** — a real data grid/pickers/combobox/tree/charts, or an honest "wrap
   the engine" story.
9. **Agent-legibility (emerging)** — a ground-truth interface so AI tools use real APIs (doc 02).

## The one-line takeaway for brand-ui

brand-ui already sits in the _right architectural lane_ (hybrid copy-owned + imported, Tailwind v4 +
Radix + semantic tokens, Storybook). Where best-in-class systems pull ahead is **not raw component
count** — it's the **operational spine**: accessibility you can prove, tokens in a standard
interchangeable format, density/i18n for real enterprise apps, the hard data widgets, and above all
**quality + governance gated in CI with a real versioning/migration story**. Those are the themes
the gap analysis drills into.

---

_Sources: see [`_research/enterprise-libraries-notes.md`](./_research/enterprise-libraries-notes.md)
for the full inline-cited research (Ant, MUI X, Mantine, Carbon, Atlassian, Polaris, Fluent, SLDS,
React Aria, shadcn, DTCG/W3C, WCAG/EAA, Chromatic/Storybook, and more)._
