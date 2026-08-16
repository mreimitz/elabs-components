# Enterprise React/Web Component Libraries & Design Systems — Benchmark Research Notes

> Raw research for benchmarking an internal component library (`brand-ui`) against best-in-class
> public libraries and enterprise design systems. Prioritizes **current** info (2025–2026).
> Every non-obvious claim is sourced inline `[n]` and listed in **Sources** at the end.
> Where a fact is uncertain or could not be pinned to a primary source, it is flagged **(uncertain)**.
>
> Compiled: 2026-06 (research cutoff: mid-2026). This is raw input for a later synthesis doc, so it
> errs toward depth and over-coverage rather than brevity.

---

## 0. Orientation: the benchmark set, grouped

It helps to separate the field into three tiers, because they compete on different things:

1. **Open-source "dev libraries"** (community-driven, broad adoption, you `npm install` them):
   MUI (Material UI) + MUI X, Ant Design, Mantine, Chakra UI, Radix (Primitives + Themes),
   shadcn/ui, Base UI, Park UI / Ark UI.
   - These split further into **styled batteries-included** (MUI, Ant, Mantine, Chakra) vs
     **headless/unstyled behavior layers** (Radix Primitives, Base UI, Ark UI/Zag) vs
     **copy-owned source distribution** (shadcn/ui, Park UI).

2. **Vendor/enterprise design systems** (run by a company, back a product suite, ship design+code+Figma):
   IBM Carbon, Atlassian Design System (Atlaskit), Shopify Polaris, Microsoft Fluent 2 / Fluent UI,
   Salesforce Lightning Design System (SLDS / SLDS 2), Adobe Spectrum / React Spectrum / React Aria,
   SAP Fiori / UI5 Web Components, Google Material 3 / Material Web.

3. **Specialist "advanced component" vendors** that the enterprise libs lean on or compete with for the
   hardest widgets: AG Grid, TanStack Table/Virtual, MUI X Data Grid (data grids); these are where the
   "enterprise vs toy" line is really drawn.

A recurring 2025–2026 theme across tier 2: **convergence on Web Components + CSS-variable "styling
hooks"** for framework-agnostic delivery (Polaris, Fluent, UI5, SLDS 2 all moved this way), and
**convergence on the W3C DTCG token format** for design↔code interchange. See §2 and §10.

---

## 1. Component breadth & taxonomy

### What "complete" looks like (the standard taxonomy)

Leaders converge on roughly the same top-level categories. Ant Design's official taxonomy is a good
canonical reference (counts from the live overview page, antd v6.4.x) [1]:

- **General** (4): Button, FloatButton, Icon, Typography
- **Layout** (7): Divider, Flex, Grid, Layout, Masonry, Space, Splitter
- **Navigation** (7): Anchor, Breadcrumb, Dropdown, Menu, Pagination, Steps, Tabs
- **Data Entry** (18): AutoComplete, Cascader, Checkbox, ColorPicker, DatePicker, Form, Input,
  InputNumber, Mentions, Radio, Rate, Select, Slider, Switch, TimePicker, **Transfer**, TreeSelect, Upload
- **Data Display** (20): Avatar, Badge, Calendar, Card, Carousel, Collapse, Descriptions, Empty, Image,
  List, Popover, QRCode, Segmented, Statistic, **Table**, Tag, Timeline, Tooltip, Tour, **Tree**
- **Feedback** (11): Alert, Drawer, Message, Modal, Notification, Popconfirm, Progress, Result,
  Skeleton, Spin, Watermark
- **Other** (5): Affix, App, ConfigProvider, etc.

So Ant ships **~67 core components** out of the box (plus the separate **Pro Components** layer:
ProLayout, ProForm, ProTable, ProDescriptions, ProList, EditableProTable for opinionated CRUD apps) [1].
Ant is widely described as having one of the richest catalogs and a **desktop-first** posture aimed at
dense enterprise apps [2][3].

The generic "complete" taxonomy synthesizers use is: **inputs/forms · data display · feedback ·
navigation · overlays/portals · layout · surfaces/containers · typography · utilities** — every leading
system maps onto these buckets.

### Rough component counts (orientation, not exact — definitions differ)

- **Ant Design:** ~67 core + Pro Components suite [1].
- **Mantine:** "more than 120 customizable components and 70 hooks" (a distinguishing feature — most
  libs don't ship a large hooks layer); `@mantine/hooks` alone is 50+ hooks [4][5].
- **MUI (Material UI core):** large catalog (inputs, data display, feedback, surfaces, navigation,
  layout, utils); the differentiator is **MUI X** for advanced data components (below) [6].
- **Chakra UI v3:** broad component set; v3 absorbed several **Ark UI** components (e.g. ColorPicker,
  DatePicker) and recently added a **Splitter** for resizable panels [7][8].
- **Ark UI:** "45+ accessible, unstyled components" across React/Vue/Solid/Svelte (headless) [9].
- **Carbon:** "over 50 production-ready components" plus tokens, Figma, icons, and a **charts** package
  (`@carbon/charts-react`) [10].
- **Radix Primitives:** ~30 headless primitives; **Radix Themes** is a smaller pre-styled set on top.
- **shadcn/ui:** a curated set of copy-owned components (built on Radix or, since late 2025, Base UI) —
  intentionally not a fixed "count," because it's a registry, not a package (§8) [11][12].

### The advanced components that separate enterprise libs from toys

This is the single most important breadth signal. "Does it have a Button" is table stakes; "does it have
a virtualized, server-side, groupable data grid" is what gates real enterprise adoption.

- **Data grid (the crown jewel).** Three reference points:
  - **AG Grid** — the "maximalist" enterprise grid. Built-in row & column **virtualization**, stays
    responsive past **100,000 rows**, server-side row model; advanced features (row grouping,
    aggregation, Excel export, pivoting) require **AG Grid Enterprise (~$999/dev/yr)** [13][14].
  - **TanStack Table v8** — **headless, logic-only**, you bring the UI + a virtualizer
    (`@tanstack/react-virtual`); 100% free, no community/enterprise split; real-world footprint ~30KB
    once you add UI + virtualization. Smooth under ~10k rows with react-window/virtual; you own
    everything visual [13][14]. _(This is the engine `brand-ui`'s `@qlik-coe-emea/qlabs-components-data` uses.)_
  - **MUI X Data Grid** — tiered: **Community** (free, MIT) → **Pro** (multi-filter/sort, column
    pinning/resizing, **commercial license**) → **Premium** (row grouping, aggregation, **pivoting**,
    Excel export). Recently added an **AI Assistant ("Ask Your Table")** for natural-language querying,
    gated behind license/API-key management in the MUI Console [6][15].
- **Date / time pickers + ranges.** MUI X: Date/Time/DateTime pickers in Community; **Date/Time Range
  Pickers** are Pro [6]. Ant ships DatePicker/TimePicker/RangePicker natively [1]. React Aria/Spectrum
  ship fully accessible Calendar + DateField/DatePicker with i18n calendars [16][17].
- **Combobox / autocomplete.** Mantine ships a composable **Combobox** primitive that powers
  select/multiselect/autocomplete/tags-input with full UI control [18]. Ant has AutoComplete + Select +
  Mentions + Cascader + TreeSelect [1]. React Aria added an **Autocomplete** (alpha in early 2025) [16].
- **Tree view / tree select.** Ant: Tree + TreeSelect [1]; MUI X: Tree View (with drag-and-drop) [6];
  React Aria: Tree with **full keyboard + screen-reader DnD** (2025) [16].
- **Transfer list ("shuttle").** A classic enterprise widget; Ant has it natively (**Transfer**) [1] —
  many lighter libs do not.
- **Virtualized lists.** TanStack Virtual is the de-facto headless engine; AG Grid/MUI X build it in.
- **Charts.** MUI X Charts [6], Ant Design Charts (separate `@antv`-based pkg) [1], Carbon Charts [10].
  Most headless/copy-owned libs (Radix, shadcn, Base UI) deliberately **don't** ship charts (shadcn
  documents Recharts-based chart blocks instead).
- **Rich text / code editor, file upload, scheduler/calendar, chat.** Upload is native in Ant [1].
  MUI X is pushing into **Scheduler** and **Chat** (alpha in v8/v9 line) — notable because it signals
  even mature libs are still expanding into "app-shaped" surfaces in 2025–2026 [6][15][19].

**Takeaway for benchmarking:** breadth is necessary but the _enterprise_ differentiator is the presence
of **(a) a virtualized/server-capable data grid, (b) accessible date/range pickers, (c) combobox/
autocomplete, (d) tree, (e) transfer/virtualized lists, (f) charts.** Libraries that lack these push
teams to bolt on AG Grid / TanStack / MUI X — which is exactly the seam where internal libs should
decide "wrap an engine vs build."

---

## 2. Design tokens

### The token architecture everyone now uses: tiered primitive → semantic → component

The mature pattern (made explicit by Fluent, Carbon, Atlassian, Salesforce) is a **layered token
system**:

- **Primitive / global / "core" tokens** — raw, context-agnostic values (a hex, a px, a font size).
  Fluent calls these **global tokens** ("context-agnostic, store raw values like hex codes") [20][21].
- **Semantic / alias tokens** — add _meaning/intent_ (e.g. `color.text.primary`, `surface.raised`).
  Fluent calls these **alias tokens** ("add semantic meaning to the stored values") [20][21]. This is
  the layer components should consume.
- **Component tokens** — per-component overrides (e.g. `button.background.hover`). Salesforce SLDS uses
  `--slds-c-*` for component styling hooks (notably **not yet supported in SLDS 2** — see §3) [22].

`brand-ui`'s own model (primitive values in `themes.css` → semantic CSS vars → Tailwind utilities) maps
directly onto primitive→semantic; it largely skips an explicit component-token tier, which is a
deliberate restraint choice and consistent with shadcn-style systems.

### The format milestone: W3C DTCG reached its **first stable spec (2025.10)** on **2025-10-28**

This is arguably the most important tokens development of the period. The **Design Tokens Community
Group** announced the first stable version of the **Design Tokens Specification (2025.10)** on
**October 28, 2025** — "a production-ready, vendor-neutral format for sharing design decisions across
tools and platforms," adding multi-file support, theming, and advanced color [23][24].

Format specifics worth recording:

- JSON interchange; recommended media type `application/design-tokens+json`; file extensions
  `.tokens` / `.tokens.json` [24].
- DTCG uses **`$value`, `$type`, `$description`** (the older/legacy format used `value`, `type`,
  `comment`) [24][25].
- Adoption: **10+** design tools and OSS projects support/implement it, including Penpot, Figma,
  Sketch, Framer, Knapsack, Supernova, zeroheight, with reference implementations in **Style
  Dictionary**, **Tokens Studio**, and **Terrazzo** [24].

### Tooling: Style Dictionary + Tokens Studio + Figma Variables

- **Style Dictionary** — the dominant build tool that transforms token JSON into platform outputs
  (CSS vars, JS, iOS, Android). **As of v4 it has first-class DTCG support** [26].
- **Tokens Studio (Figma plugin)** — lets you author tokens in Figma and choose the **DTCG format** in
  the plugin, moving toward the W3C spec [25].
- **Figma Variables** — Figma's native token primitive; **variable collections support modes**
  (e.g. Light/Dark as columns), so a semantic token like `text-primary` keeps its name while pointing
  to `gray-900` in Light and `gray-100` in Dark [27][28]. Figma's **REST API** + GitHub Actions let
  teams pull variable data into code so devs always work from current values (token sync, §7) [28].

**Takeaway:** the credible 2026 baseline is **tiered tokens (primitive→semantic, ideally + component) +
emitting/consuming DTCG JSON + a Style-Dictionary-style build → CSS variables**, with the tokens also
living as Figma Variables. A library that hardcodes values, or whose tokens can't round-trip to/from
the DTCG format, is now behind the standard.

---

## 3. Theming & branding (multi-brand / white-label, dark, density, runtime vs build-time)

### CSS variables are the universal mechanism; "decouple structure from theme"

The dominant, explicitly-stated pattern is **CSS custom properties as the theming layer**, with
structure decoupled from skin:

- **Salesforce SLDS 2** rebuilt its CSS framework to **separate structure from theme using styling
  hooks (CSS custom properties)**, explicitly so you're "no longer locked into predefined design
  choices for buttons, modals, fonts, borders" — i.e. **white-labeling via `--slds-g-*` global
  hooks** [22][29]. Caveat (2025): **component-level styling hooks `--slds-c-*` are not yet supported
  in SLDS 2**; Salesforce advises keeping orgs on SLDS 1 themes if you rely on them [22].
- **Fluent UI Web Components** are "styled using tokens in the form of **CSS variables**," with a
  `setTheme` utility to apply a theme app-wide [20].
- **Atlassian** ADS is fully **token-driven**, integrates with **Figma Variables**, and supports
  **dark-mode switching** + scalable system-wide updates from one token source [30][31].
- **Ant Design v5+** uses a **design-token / CSS-in-JS theming engine** (`ConfigProvider`, Theme
  Editor) enabling runtime theme switching and algorithm-based dark/compact themes [2][3].

### Runtime vs build-time theming (a real architectural fork)

- **Runtime theming** (swap a `data-theme`/CSS-var set live, no rebuild): the norm for CSS-variable
  systems — Fluent (`setTheme`), SLDS hooks, Ant (`ConfigProvider`), Radix Themes, and `brand-ui`'s own
  `data-theme` approach [20][22][2].
- **Build-time / zero-runtime** (styles generated at build, e.g. **Panda CSS** in Park UI, **CSS
  Modules** in Mantine v7+): wins on bundle size and SSR/RSC alignment but theming is less dynamic
  [32][33]. Mantine's v7 rewrite **dropped Emotion for CSS Modules**, eliminating the CSS-in-JS runtime
  and improving SSR/bundle [33].

### Density modes

Density (comfortable/compact) is a hallmark of _enterprise_ systems and often missing from lighter libs:
Ant has a **compact algorithm**; Carbon and Fluent expose sizing/spacing token scales; data grids (AG
Grid, MUI X) ship explicit density toggles. Worth flagging as an enterprise-table-stakes feature.

**Takeaway:** best-in-class theming = **semantic CSS variables + multi-brand/white-label by swapping a
token set + light/dark via token modes + a density axis**, with the choice of runtime vs build-time
generation being a deliberate trade (dynamic theming vs bundle/SSR). `brand-ui`'s `data-theme` +
"every theme overrides every token" model is squarely in the mainstream runtime-CSS-var camp.

---

## 4. Accessibility (the biggest enterprise credibility gate)

### Who leads: React Aria (Adobe) and Radix

- **React Aria (Adobe)** is widely regarded as the gold standard for accessible behavior: "unstyled
  React components and hooks … accessibility as a top priority, **battle-tested in production**," with
  behavior implemented to the **WAI-ARIA Authoring Practices (APG)**, full screen-reader + keyboard
  support, focus management, and SR announcements [16][34]. Adobe maintains a dedicated **Quality /
  accessibility** page describing their testing rigor [34]. 2025 additions: Autocomplete (alpha),
  CSS-transition support in overlays, **keyboard+SR drag-and-drop in Tree**, React 19 ref-cleanup
  support, `firstDayOfWeek` for calendars, and a test-utils package [16].
- **Radix Primitives** handle focus management, keyboard nav, and ARIA patterns out of the box and are
  the accessibility backbone for shadcn/ui [35]. **Base UI** (the MUI-team headless layer) and **Ark
  UI/Zag** make the same promise [35][9].

### The standards that matter (and the 2025 legal forcing function)

- **WCAG 2.1 AA** is the baseline enterprise procurement target. **WCAG 2.2** became a **W3C
  Recommendation on 2023-10-05**, adding **9 new success criteria** (6 of which land at AA), notably
  **Target Size (Minimum) 2.5.8**, **Focus Appearance 2.4.11**, **Focus Not Obscured 2.4.11/2.4.12**,
  and **Dragging Movements 2.5.7** [36][37].
- **European Accessibility Act (EAA):** main compliance deadline **June 28, 2025**, now actively
  enforced. The operative technical benchmark is **EN 301 549**, which incorporates **WCAG 2.1 AA**
  (WCAG 2.2 is **not yet** folded into the harmonized standard, so 2.1 AA remains the bar) [38][39].
  Penalties range widely (e.g. up to **€100k/violation in Germany**; €5k–€250k+ in France) and the first
  enforcement actions/injunctions already hit retailers in late 2025 [38][39]. **This is the single
  biggest reason a11y is now a hard gate, not a nice-to-have, for any EU-facing enterprise UI.**

### VPAT / ACR (the procurement artifact)

- A **VPAT** (Voluntary Product Accessibility Template, by ITI) completed with test results becomes an
  **ACR** (Accessibility Conformance Report) — "the leading global reporting format" for buyers/sellers,
  covering **Section 508 (US), EN 301 549 (EU), WCAG**. Current template is **VPAT 2.5 (Nov 2023,
  aligned to WCAG 2.2)**, in four editions mapping to different standards [40][41].
- Enterprise vendors publish ACRs/VPATs as part of procurement (e.g. IBM via the **IBM Able / IBM
  Accessibility** program; Carbon follows the **IBM Accessibility Checklist** built on WCAG AA + Section
  508 + EU standards) [10][42]. *(I did not locate a single consolidated 2025 VPAT for Carbon/Fluent/
  Spectrum design-system packages specifically — these are typically published per *product*, not per
  design-system library — **(uncertain)** on a library-level ACR existing for each.)*

### Testing in practice

The credible a11y pipeline = **automated axe checks in CI + interaction tests + manual screen-reader
passes**. Storybook now runs **axe a11y as part of interaction/visual tests** (and Chromatic surfaces
them), so a11y is enforced per-story in CI (§9) [43][44]. React Aria additionally ships **test utils**
to assert accessible behavior [16].

**Takeaway:** the accessibility bar for "enterprise standard" is now: **WCAG 2.1 AA minimum (2.2 AA
aspirational), APG-conformant keyboard/ARIA patterns, real screen-reader testing, axe-in-CI, and a
publishable VPAT/ACR.** React Aria and Radix are the reference implementations to emulate; the EAA has
made this legally load-bearing in the EU as of mid-2025.

---

## 5. Internationalization & RTL

- **RTL / bidi** is a first-class concern for the big systems. MUI supports RTL for Arabic/Persian/
  Hebrew, set **globally (`dir="rtl"` on root) or per-component**; with Emotion it needs an RTL stylis
  plugin (`@mui/stylis-plugin-rtl`) via a CacheProvider — and a known gotcha is that **portal
  components (Dialog) don't inherit `dir`** and need explicit handling [45][46].
- **Locale-aware formatting** (dates/numbers/calendars) is where React Aria/Spectrum lead: they use the
  browser **Intl** APIs and support non-Gregorian calendars, locale-aware date fields, and
  `firstDayOfWeek` [16][17]. MUI X Charts and pickers document locale + RTL configuration [6][45].
- **i18n message catalogs:** most libs externalize component strings (aria-labels, pagination text,
  "no rows," etc.) into overridable locale packs (MUI's `localization` providers, Ant's
  `ConfigProvider locale`) [3][47]. This is essential: enterprise apps need to translate built-in
  component microcopy, not just app copy.

**Takeaway:** enterprise-grade i18n = **logical-property/RTL-safe styling (or a dir-aware build),
Intl-based locale formatting incl. non-Gregorian calendars, and fully externalized/overridable
component strings.** Tailwind v4 + logical CSS properties make RTL more tractable than the old Emotion-
plugin approach; worth noting as a `brand-ui` advantage if it leans on logical properties.

---

## 6. Documentation & DX

### The expected anatomy of a "best-in-class" component doc page

Synthesized from current best-practice guidance, every leading system's component page provides
**both** a designer and a developer surface [48][49]:

- **Live, interactive examples** (rendered real component, often editable) for each variant/state.
- **Props / API tables** auto-generated from **TypeScript types** (kept in sync with source).
- **Usage Do / Don't** pairs (visual guidance).
- **Per-component accessibility notes**: which WCAG criteria apply, expected keyboard interactions,
  required ARIA attributes [48].
- **Design tokens / CSS references** used by the component.
- Separation of **design guidelines** vs **developer docs** (Atlassian, Polaris, Carbon, Fluent all
  split "Design" and "Develop" sections) [30][50][10][20].
- **Search**, and ideally **versioned docs** (MUI, Carbon, Ant all host older major versions).

### Storybook is the de-facto DX/documentation engine

- **Storybook autodocs** (`tags: ['autodocs']`) auto-generates doc pages from stories, including
  interactive controls and prop tables pulled from TS — "live, testable documentation always in sync
  with the codebase" [43][49]. This is exactly `brand-ui`'s approach.
- The strongest DX argument in 2026: **generate docs from source** so they can't rot; the 2025 Design
  Systems Report notes teams automate token pipelines but still hand-maintain guidelines/a11y notes —
  the gap to close [49].

### The AI/agent DX frontier (notable, emerging)

Multiple systems are shipping **MCP servers** so AI agents read _ground-truth_ component info instead of
hallucinating APIs: **shadcn CLI 3.0 ships an MCP server** [12]; **Storybook has an addon-mcp**; **SAP
UI5** added **MCP server support** for AI-driven workflows [51]; even **Carbon** has community MCP
experiments [52]. This mirrors `brand-ui`'s own Storybook-MCP rule and is becoming a real differentiator
for "agent-legible" libraries.

**Takeaway:** doc excellence = **live examples + auto-generated TS prop tables + Do/Don't + per-
component a11y notes + split design/dev guidance + search + versioned docs**, generated from source
(Storybook autodocs) so it stays accurate — increasingly **plus an MCP/agent interface**.

---

## 7. Figma / design-to-dev

- **Figma kits with Variables** are standard for enterprise systems: Atlassian ships token-driven
  components mapped to **Figma Variables** with auto-layout, spacing variables, and variants that match
  the coded implementation [30][31]. Fluent 2, Polaris, Carbon, Spectrum all publish official Figma
  libraries.
- **Code Connect** (Figma) links a Figma component to its **real coded equivalent**, so developers see
  the production code snippet in **Dev Mode** — the current best answer to design/code parity [53][54].
- **Token sync** is increasingly automated: **Dev Mode** shows variable→code-syntax mappings; the Figma
  **REST API** + GitHub Actions pipelines push variable changes into code (CSS custom properties) so
  design and code share one source of truth, and can **enforce** that new variables carry a code-syntax
  mapping [27][28][53].
- **Parity** is the goal and the hard part: variable **modes** (Light/Dark) line up with token themes;
  Code Connect closes the "what's the prop?" gap; but most teams still struggle to keep Figma
  components and coded components 1:1 over time (an org/process problem, §11) [27][30].

**Takeaway:** the gold standard is a **bi-directional token pipeline (DTCG/Style Dictionary ⇄ Figma
Variables) + Code Connect for component-level parity + Dev Mode** so a designer's variable change and a
developer's CSS variable are the same decision. A library with no Figma kit / no token round-trip is
hard to adopt at design-led enterprises.

---

## 8. Distribution & versioning

### Two distribution philosophies (the central 2025 debate)

1. **Installed-package model** (npm, semver, you depend on it): MUI, Ant, Mantine, Chakra, Carbon,
   Fluent, Spectrum. Central updates, but you don't own the source and customization is bounded.
2. **Copy-owned / registry model** (shadcn/ui, Park UI): components are **source you copy into your
   repo**, not a dependency — divergence is expected and fine [11][32]. This trades central updates for
   total ownership/editability.

### shadcn/ui registry — the model to understand

- **shadcn CLI 3.0 (Aug 2025)** introduced **namespaced registries** (`@registry/name`), advanced
  auth, a rewritten registry engine, **and an MCP server** [11][12].
- **Decentralized, no central registrar** — any team can host a namespace (`@design`, `@engineering`,
  `@marketing`) and components can depend across registries; **private registries** support basic auth,
  bearer tokens, API-key query params, custom headers — explicitly aimed at **enterprise teams with
  proprietary UI libraries** [11][55]. A **Registry Index** (Sep 2025) improves discovery [56].
- This is precisely the model `brand-ui` mirrors with its `registry/` + `npx shadcn add` "copy-own
  prototype blocks" mode alongside stable `@qlik-coe-emea/qlabs-components-*` packages — i.e. brand-ui already implements the
  hybrid that's now considered best practice.

### Versioning, LTS, migrations, codemods

- **Semver + changelogs + hosted versioned docs** are universal among the mature libs.
- **Migration guides + codemods** are a real enterprise differentiator. **MUI ships `@mui/codemod`**
  (and `@mui/x-codemod`) with `preset-safe` codemods per major (v4→5, 5→6, 6→7, 7→8) using
  **jscodeshift**, automating import-path and API changes — though some breaks are still manual [57][58].
- **Atlassian** uses **codemods/Hypermod** to automate design-system evolution across consumers [59].
- **Carbon** publishes detailed v10→v11 migration guides (token/prop renames, CSS-grid layout) and has
  **deprecated the old `carbon-components` / `carbon-components-react`** in favor of `@carbon/react` +
  `@carbon/styles` — a clean deprecation story [10][60].
- **Cadence:** MUI realigned **MUI X with Material UI majors** so the suite shares one major again
  (MUI X v9 ↔ Material UI v9, targeting stable ~end of Q1 2026); MUI X v8 stable targeted **March 2025**
  [6][15][19]. Ant is on **v6.x** (v6.4.x current) [1]. Mantine on **v8/9.x** (9.3.0 reported mid-2026)
  [4]. Base UI hit **v1.0 stable in Dec 2025** [35]. Chakra **v3** is current [7][8].

### Tree-shaking & bundle size (a procurement concern)

- **Mantine** is architected for tree-shaking and (post-v7) ships **no CSS-in-JS runtime** → smaller
  bundles, best **RSC/App-Router alignment** [4][33][61].
- **MUI** ~**100–200KB gzipped** (heaviest of the styled three; CSS-in-JS/Emotion historically) [61].
- **Ant Design** full import can exceed **~350KB gzipped**; tree-shaking helps but shared deps pull in
  weight [61].
- **Headless libs (Radix, Base UI, Ark) + copy-owned (shadcn)** have the smallest footprints because
  you only ship what you use and styling is your own CSS/Tailwind [35][61].

**Takeaway:** enterprise distribution credibility = **semver + changelog + versioned docs + a real
migration story (guides AND codemods) + a clean deprecation policy + good tree-shaking.** The
strategic 2025 insight is the **hybrid model** (stable installed packages **plus** a copy-owned
registry with private/namespaced support) — which is the structure both shadcn and `brand-ui` adopt.

---

## 9. Quality engineering

The credible testing stack for a component system (2025–2026), largely centered on Storybook:

- **Unit / behavior tests:** Vitest/Jest + Testing Library (render + key behavior) — `brand-ui` does
  this.
- **Interaction tests:** Storybook **play functions** drive real user interactions in a real browser
  and assert outcomes; "static stories become interactive tests" [44][62].
- **Visual regression:** **Chromatic** (made by the Storybook team) captures pixel-perfect screenshots
  of every story/state, diffs against the approved baseline, and flags changes before prod — "critical
  for design systems where components share tokens." **TurboSnap** only re-snaps stories whose deps
  changed (50–80% fewer snapshots) [43][63]. Chromatic also now integrates with **Playwright** [43].
- **Accessibility in CI:** Storybook runs **axe a11y** as part of its test run; "in 2026 Storybook is a
  full component-testing platform — interaction tests, visual regression, a11y, all in CI without
  spinning up the whole app" [43][44]. _(This is exactly `brand-ui`'s `test-storybook` + addon-a11y +
  addon-vitest setup.)_
- **CI gates + governance:** contribution flows with **RFC processes**, design/eng review, and
  automated a11y/design-system scoring in the dev environment are markers of an **"advanced" governance
  maturity** level [64][65].

**Takeaway:** best-in-class QE = **unit + interaction (play fns) + visual regression (Chromatic) + axe
a11y, all gated in CI**, plus an RFC/review contribution process. `brand-ui`'s Storybook-MCP + vitest +
a11y + (implied) visual sweep stack is aligned with this; the explicit gap to watch is whether **visual
regression (Chromatic-style) is actually wired into CI** vs done manually.

---

## 10. Framework / runtime (SSR/RSC, framework-agnostic, web components)

### The big tier-2 shift: framework-agnostic **Web Components**

Several flagship enterprise systems re-platformed onto **Web Components** in 2024–2025 to escape
React-only lock-in:

- **Shopify Polaris** — **Polaris Web Components shipped Oct 1, 2025**; the old `polaris-react` is
  **deprecated**. New Polaris is "built on Web Components, significantly smaller and faster," works with
  **React, Vue, vanilla JS, or no framework**, and is **unified across Admin, Checkout, and Customer
  Accounts** [66][67].
- **Microsoft Fluent UI Web Components** — built **directly on W3C Web Component standards** (don't
  invent a separate component model; behave like native HTML elements); first-class design-token
  support [20][68]. (Fluent **React v9** remains the path for React-first Fluent 2 apps [69].)
- **SAP UI5 Web Components** — framework-agnostic Fiori controls usable from React/Vue/Angular; v2.x
  adds custom icon collections and **MCP server support** [51].
- **Carbon** offers **Web Components** + a React wrapper around them [10][70].
- **Google Material Web (`material-web`)** — the cautionary tale: **in maintenance mode pending new
  maintainers**, resources reassigned, and **Material 3 _Expressive_ is NOT implemented on Web** as of
  2025 (showcased at I/O 2025 for other platforms). Web-first/React teams should "expect friction" — a
  notable gap for Google's own system [71][72].

### React-only vs multi-framework (dev libs)

- **React-only:** MUI, Ant Design, Mantine, Chakra, Radix, shadcn, Base UI.
- **Multi-framework via shared state machines:** **Ark UI / Zag.js** — a single framework-agnostic
  **state-machine** definition drives **React, Vue, Solid, Svelte** adapters simultaneously; Park UI
  builds styled components on top [9][32].

### SSR / RSC (React Server Components)

- **shadcn/ui** has explicit **RSC support**; the CLI auto-adds `"use client"` to client components
  when RSC mode is enabled [73].
- **Mantine v7+ (CSS Modules, no CSS-in-JS runtime)** is described as **the most aligned with the RSC
  model** for Next.js App Router (minimal client JS) [33][61].
- CSS-in-JS-runtime libraries (older MUI/Emotion, older Chakra) historically created **RSC/SSR
  friction**, pushing the whole tree client-side; the industry response is **zero-runtime styling**
  (Panda CSS, CSS Modules, Tailwind) — the direction `brand-ui` already takes with Tailwind v4 [33][61].
- The general RSC mental model: **server owns the tree; `"use client"` marks interactive islands**;
  TanStack Start offers an alternative "RSC as streamable data" model [73][74].

**Takeaway:** the runtime story splits into **(a) React-first with token-driven CSS + RSC-safe styling
(Tailwind/CSS Modules)** — `brand-ui`'s lane — vs **(b) framework-agnostic Web Components** (the path
Polaris/Fluent/UI5 chose for multi-framework reach). For a React-only internal lib, the credibility
bar is **clean RSC support (correct `"use client"` boundaries) + zero/low-runtime styling**; going
framework-agnostic is a bigger strategic bet only worth it if non-React consumers are real.

---

## 11. Governance & adoption (how enterprises actually run a design system)

### Governance is the thing that separates "system" from "mess"

"Governance is what separates a design system that stays consistent over two years from one that
becomes a mess of one-off exceptions" [10]. The recurring enterprise governance pattern:

- **A dedicated core team** (designers + engineers) owns direction, plus a **federated/contribution
  model** where product teams contribute back. **Atlassian** uses a core team **plus rotating
  "ambassadors"** from product teams (Jira, Trello) who contribute components back to ADS, shipping on
  **bi-weekly sprints** [30][31].
- **Carbon** is run by a **steering committee** that provides oversight/direction, with explicit
  **contribution guidelines** giving a "neutral framework for deciding what belongs in the shared
  system vs what stays local" [10].
- **Shopify Polaris** is frequently cited for its strong governance, structured contribution, and clear
  deprecation discipline [75].

### Maturity models & metrics

Design-system maturity is assessed across ~5 dimensions — **governance, adoption, technical
implementation, design quality, operations** [64][76]. Governance maturity progresses
**beginner → developing → advanced**, where "advanced" means **active adoption, governance reviews
integrated into delivery timelines, and automated a11y/design-system scoring in the dev environment**
[64][65]. Key metrics: **adoption rate, correct/consistent component usage, time-to-resolution** for
issues, and eventually **ROI** [64][65][76].

### Adoption & deprecation

- **Adoption** is measured by coverage (what % of product surfaces use the system) and correct usage;
  once adoption is high, focus shifts from "get people to use it" to **enforcing standards while
  allowing creativity** [76].
- **Deprecation policy** is a maturity marker: communicate, provide a migration path + codemods, then
  remove (Carbon's `carbon-components` deprecation; MUI's lab→stable→removed lifecycle with codemods)
  [60][57]. `brand-ui`'s own rule "deleting superseded components is allowed; prefer it over dead code"
  is consistent with this discipline.

**Takeaway — what makes a library credible as an ENTERPRISE STANDARD (the non-component things):**

1. **Governance & support:** a named owning team, a federated contribution/RFC process, a versioning &
   **deprecation policy**, and predictable release cadence.
2. **Stability & longevity:** semver, LTS-ish support windows, migration guides **+ codemods**, hosted
   versioned docs — so teams trust it won't strand them (counter-example: Radix's momentum stalled after
   the **WorkOS acquisition** with the original team leaving and tech debt building; Material Web in
   maintenance mode — both _reduce_ enterprise confidence) [35][71].
3. **Accessibility compliance:** WCAG 2.1 AA (2.2 aspirational), APG patterns, **publishable VPAT/ACR**
   — now legally forced in the EU by the **EAA (June 2025)** [38][40][42].
4. **Theming / white-label:** semantic tokens (ideally DTCG) + CSS-variable theming → multi-brand,
   light/dark, density, so one system serves many products/brands [22][20][30].
5. **Design-to-code parity:** Figma kit + token sync + Code Connect/Dev Mode [53][30].
6. **Quality engineering in CI:** interaction + visual-regression + a11y gates [43][44].
7. **Migration story:** the _single_ most under-rated adoption factor — teams adopt what they can
   **upgrade safely** (codemods) and **leave gracefully** (clean deprecation) [57][59][60].
8. **Breadth where it's hard:** a real **data grid + pickers + combobox + tree + charts**, or an
   honest "wrap AG Grid/TanStack/MUI X" story [13][6].
9. **Agent-legibility (emerging):** an MCP/ground-truth interface so AI tools use real APIs, not
   hallucinations [12][51].

---

## 12. Quick comparison snapshots (for the synthesis doc)

### Dev libraries

| Library              | Model                   | Styling/runtime             | A11y backbone            | Standout strength                                                                   | Enterprise caveat                                     |
| -------------------- | ----------------------- | --------------------------- | ------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **MUI + MUI X**      | Installed pkg           | Emotion CSS-in-JS (heavier) | own + ARIA               | Best **advanced components** (Data Grid/pickers/charts/scheduler), codemods [6][57] | Bundle ~100–200KB; X Pro/Premium are **paid** [61][6] |
| **Ant Design**       | Installed pkg           | CSS-in-JS tokens            | own + ARIA               | Richest **enterprise breadth** (~67 + Pro), desktop-dense [1][2]                    | Largest bundle (~350KB) [61]                          |
| **Mantine**          | Installed pkg           | **CSS Modules, no runtime** | own + ARIA               | 120+ comps **+ 70 hooks**, best **RSC/bundle** fit [4][33]                          | Smaller org/community than MUI/Ant                    |
| **Chakra UI v3**     | Installed pkg           | recipes (Panda-inspired)    | own + Ark                | DX, recipes; absorbed Ark comps [7][8]                                              | v2→v3 was a big migration [7]                         |
| **Radix Primitives** | Installed pkg           | **headless** (you style)    | **reference-grade** [35] | Accessible primitives, powers shadcn                                                | **WorkOS-acquisition stall**, tech debt [35]          |
| **Radix Themes**     | Installed pkg           | pre-styled (themeable)      | Radix                    | Looks designed day-1                                                                | Limited customization vs primitives                   |
| **Base UI**          | Installed pkg           | **headless**                | strong                   | **v1.0 Dec 2025**, MUI-team backed, actively maintained [35]                        | Newer; smaller catalog                                |
| **shadcn/ui**        | **Copy-owned registry** | Tailwind + Radix/Base       | inherits Radix/Base      | **Registry/namespace/MCP** model, total ownership [11][12]                          | You own maintenance; no central updates               |
| **Ark UI / Park UI** | headless / copy-owned   | Zag.js SM; Panda CSS        | strong                   | **Multi-framework** (React/Vue/Solid/Svelte) [9][32]                                | Smaller ecosystem                                     |

### Enterprise design systems

| System                                     | Vendor     | Delivery (2025)                                           | Tokens                             | Notable 2025–26 move                                                      |
| ------------------------------------------ | ---------- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| **Carbon**                                 | IBM        | React (`@carbon/react`) + **Web Components**              | tiered + charts/icons pkgs         | v11; deprecated old `carbon-components`; IBM a11y program [10][60]        |
| **Atlassian (ADS/Atlaskit)**               | Atlassian  | React (Atlaskit)                                          | token-driven + **Figma Variables** | bi-weekly sprints; typography refresh; ambassador contribution [30][31]   |
| **Polaris**                                | Shopify    | **Web Components (Oct 2025)**; `polaris-react` deprecated | tokens                             | unified across Admin/Checkout/Accounts; framework-agnostic [66][67]       |
| **Fluent 2 / Fluent UI**                   | Microsoft  | **Web Components (W3C)** + **React v9**                   | global+alias, CSS vars             | WC built on standards; `setTheme` [20][69]                                |
| **SLDS / SLDS 2**                          | Salesforce | LWC / CSS framework                                       | **styling hooks** `--slds-g-*`     | SLDS 2 decouples structure/theme; `--slds-c-*` not yet in SLDS 2 [22][29] |
| **Spectrum / React Spectrum / React Aria** | Adobe      | React + **React Aria** (headless)                         | Spectrum tokens                    | **A11y gold standard**; 2025 DnD-tree, Autocomplete alpha [16][34]        |
| **SAP Fiori / UI5 WC**                     | SAP        | **Web Components** (framework-agnostic)                   | Fiori tokens                       | v2.x; **MCP server** support [51]                                         |
| **Material 3 / Material Web**              | Google     | Web Components — **maintenance mode**                     | M3 tokens                          | **MWC stalled**; **M3 Expressive not on Web** [71][72]                    |

---

## 13. Open questions / uncertainties (flagged honestly)

- **Exact component counts** vary by how you count (compound parts, lab/alpha, hooks). Ant's ~67 is from
  the live overview [1]; Mantine's "120+/70 hooks" and Carbon's "50+" are vendor phrasing [4][10].
  Treat all counts as **orientation, not precise**.
- **Library-level VPAT/ACRs:** VPATs are typically published per _product_, not per design-system
  package; I could not confirm a dedicated public ACR for each of Carbon/Fluent/Spectrum as _libraries_
  (vendors run broader a11y programs instead — IBM Able, etc.) — **(uncertain)** [40][42].
- **Material Web future:** "maintenance mode pending new maintainers" was the status in 2025; whether
  Google reassigns resources later is unknown — **(uncertain)** [71].
- **Radix trajectory post-WorkOS:** the "team left / tech debt" characterization comes from community
  analysis, not an official WorkOS statement — directionally well-attested but **treat as community
  assessment** [35].
- **SLDS 2 GA status:** described as **Beta** in 2025 sources; full GA timing/`--slds-c-*` support
  timeline is moving — **(uncertain)** [22][29].
- **RSC support specifics for MUI/Mantine** beyond the general points were not exhaustively confirmed
  from primary docs in this pass; Mantine's CSS-Modules/RSC alignment is well-attested [33][61], MUI's
  is evolving — verify against current MUI docs before quoting hard claims — **(uncertain)**.

---

## Sources

1. Ant Design — Components Overview (live, v6.4.x taxonomy & counts): https://ant.design/components/overview/
2. Ant Design 5.0 enterprise overview (MernStackDev): https://mernstackdev.com/ant-design-5-0-enterprise-level-ui-design-system/
3. Ant Design (official site): https://ant.design/
4. Mantine (official): https://mantine.dev/ ; changelog v8.0.0: https://mantine.dev/changelog/8-0-0/
5. Mantine hooks package: https://mantine.dev/hooks/package/
6. MUI X (official) — advanced components: https://mui.com/x/ ; What's new in MUI X: https://mui.com/x/whats-new/ ; Date/Time Pickers: https://mui.com/x/react-date-pickers/
7. Chakra UI v3 announcement: https://www.chakra-ui.com/blog/00-announcing-v3 ; migration: https://chakra-ui.com/docs/get-started/migration
8. Chakra UI v3.30 Splitter: https://chakra-ui.com/blog/chakra-3.30-splitter-is-here ; components overview: https://chakra-ui.com/docs/components/concepts/overview
9. Ark UI (official): https://ark-ui.com/ ; Ark repo (React/Vue/Solid/Svelte): https://github.com/chakra-ui/ark
10. IBM Carbon Design System — overview/governance/a11y (Brilworks analysis): https://www.brilworks.com/blog/ibm-carbon-design-system/ ; Carbon a11y guidelines: https://carbondesignsystem.com/guidelines/accessibility/overview/ ; Carbon repo: https://github.com/carbon-design-system/carbon
11. shadcn/ui Registry docs: https://ui.shadcn.com/docs/registry ; Namespaces: https://ui.shadcn.com/docs/registry/namespace
12. shadcn CLI 3.0 + MCP (Aug 2025 changelog): https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp
13. TanStack Table vs AG Grid (Simple Table, 2025): https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison ; TanStack note on AG Grid: https://tanstack.com/table/v8/docs/enterprise/ag-grid
14. AG Grid React: https://www.ag-grid.com/react-table/ ; PkgPulse grid comparison: https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026
15. Introducing MUI X v8 (blog): https://mui.com/blog/mui-x-v8/ ; MUI X Data Grid v9: https://mui.com/blog/introducing-mui-x-data-grid-v9/
16. React Aria (official) + 2025 releases: https://react-spectrum.adobe.com/react-aria/index.html ; releases: https://react-aria.adobe.com/releases/ ; May 19 2025 release: https://react-spectrum.adobe.com/releases/2025-05-19.html
17. React Spectrum (official): https://react-spectrum.adobe.com/index.html
18. Mantine Combobox: https://mantine.dev/ (Combobox docs) ; @mantine/form: https://mantine.dev/
19. MUI X v9 + Scheduler/Chat alpha: https://mui.com/blog/introducing-mui-v9/ ; Scheduler v9 alpha: https://mui.com/blog/introducing-mui-x-scheduler-v9-alpha/
20. Fluent UI Web Components design tokens: https://learn.microsoft.com/en-us/fluent-ui/web-components/design-system/design-tokens ; Fluent WC overview: https://learn.microsoft.com/en-us/fluent-ui/web-components/
21. Fluent 2 design tokens (design site): https://fluent2.microsoft.design/design-tokens
22. Salesforce SLDS 2 styling hooks (LWC dev guide): https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties.html ; "What is SLDS 2": https://www.salesforce.com/blog/what-is-slds-2/
23. DTCG — "Design Tokens specification reaches first stable version" (W3C CG, 2025-10-28): https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
24. Design Tokens Format Module 2025.10 (draft/spec): https://www.designtokens.org/tr/drafts/format/ ; DTCG home: https://www.designtokens.org/
25. Tokens Studio — DTCG vs legacy format: https://docs.tokens.studio/manage-settings/token-format
26. Style Dictionary — DTCG support (v4): https://styledictionary.com/info/dtcg/ ; tokens: https://styledictionary.com/info/tokens/
27. Figma — Variables in Dev Mode: https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode ; Update 1 tokens/variables/styles: https://help.figma.com/hc/en-us/articles/18490793776023-Update-1-Tokens-variables-and-styles
28. Figma — Design Tokens (sync design & code): https://www.figma.com/resource-library/design-tokens/ ; Dev Mode: https://www.figma.com/dev-mode/
29. SLDS 2 future-proofing (Salesforce Ben): https://www.salesforceben.com/slds-2-beta-how-you-can-future-proof-your-salesforce-ui/ ; Trailhead SLDS 2: https://trailhead.salesforce.com/content/learn/modules/salesforce-lightning-design-system-2-for-developers/explore-salesforce-lightning-design-system-2
30. Atlassian Design System (official): https://atlassian.design/ ; components: https://atlassian.design/components ; design tokens: https://atlassian.design/foundations/tokens
31. Atlassian Design System (Juan Fernando Pacheco analysis, 2025): https://juanfernandopacheco.com/2025/06/atlassian-design-system/ ; Atlaskit: https://atlaskit.atlassian.com/
32. Park UI (official): https://park-ui.com/ ; Park UI repo: https://github.com/chakra-ui/park-ui
33. Makers' Den — React UI libs 2025 (Mantine v7 CSS Modules / RSC): https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra
34. React Aria — Quality/accessibility: https://react-spectrum.adobe.com/react-aria/accessibility.html
35. Radix vs Base UI (2025/2026 comparison incl. WorkOS stall + Base UI v1.0): https://dev.to/edriso/shadcn-vs-radix-vs-base-ui-which-one-should-a-junior-pick-in-2026-1jml ; Tailkits comparison: https://tailkits.com/blog/base-ui-vs-shadcn-ui-vs-radix-ui-comparison/ ; Radix Primitives repo (maintained by WorkOS): https://github.com/radix-ui/primitives
36. W3C — What's New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ ; WCAG 2.2 Rec: https://www.w3.org/TR/WCAG22/
37. WCAG 2.2 new success criteria guide (TestParty): https://testparty.ai/blog/wcag-22-new-success-criteria
38. European Accessibility Act compliance (Level Access): https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/ ; EAA key dates (Quadient): https://www.quadient.com/en/blog/eaa-key-dates-requirements-and-impact
39. EAA 2025 deadline Q&A (UsableNet): https://blog.usablenet.com/eaa-2025-deadline-top-questions-answered-ahead-of-compliance ; Accessibility.works EAA: https://www.accessibility.works/european-accessibility-act/
40. ITI VPAT (official): https://www.itic.org/policy/accessibility/vpat ; Section508.gov — create ACR with VPAT: https://www.section508.gov/sell/how-to-create-acr-with-vpat/
41. VPAT/ACR guide 2026 (Level Access): https://www.levelaccess.com/blog/vpats-and-acrs-what-you-need-to-know/ ; ACR vs VPAT (AccessibilityChecker): https://www.accessibilitychecker.org/blog/acr-vs-vpat/
42. IBM Accessibility (IBM Able): https://www.ibm.com/able/
43. Chromatic — Visual testing for Storybook: https://www.chromatic.com/storybook ; visual tests docs: https://www.chromatic.com/docs/visual/
44. Storybook — Visual testing / interaction tests: https://storybook.js.org/docs/writing-tests/visual-testing ; component testing guide (Qaskills): https://qaskills.sh/blog/storybook-component-testing-guide
45. MUI — Right-to-left support: https://mui.com/material-ui/customization/right-to-left/ ; Localization: https://mui.com/material-ui/guides/localization/
46. MUI RTL (Medium, Massoud Sharifi): https://medium.com/@massoud-sharifi/material-ui-right-to-left-54e1f0675bb7
47. MUI X Charts — Localization: https://mui.com/x/react-charts/localization/
48. Documenting your design system (Magic Patterns): https://www.magicpatterns.com/blog/design-system-documentation
49. Design system documentation best practices (UXPin): https://www.uxpin.com/studio/blog/7-best-practices-for-design-system-documentation/ ; LogRocket: https://blog.logrocket.com/ux-design/design-system-documentation/
50. Shopify Polaris React (docs): https://polaris-react.shopify.com/
51. SAP Fiori & UI5 — What's New in 2025 (SAP Community, incl. MCP): https://community.sap.com/t5/technology-blog-posts-by-members/sap-fiori-amp-ui5-what-s-new-in-2025/ba-p/14272140 ; UI5 Web Components repo: https://github.com/UI5/webcomponents
52. Carbon MCP (Medium, community): https://medium.com/@ramyaskv812/turning-design-systems-into-conversations-how-carbon-mcp-makes-ai-carbon-aware-30e6006f79d7
53. Figma Code Connect — quickstart: https://developers.figma.com/docs/code-connect/quickstart-guide/
54. Figma Dev Mode (design-to-development): https://www.figma.com/dev-mode/
55. shadcn private/namespaced registries (Shadcnblocks): https://www.shadcnblocks.com/blog/shadcn-private-registry-access-namespaced-registries
56. shadcn Registry Index (Sep 2025 changelog): https://ui.shadcn.com/docs/changelog/2025-09-registry-index
57. MUI — Upgrade to v7 (codemods): https://mui.com/material-ui/migration/upgrade-to-v7/ ; Upgrade to v6: https://mui.com/material-ui/migration/upgrade-to-v6/
58. MUI X — Data Grid migration v7→v8 (x-codemod): https://mui.com/x/migration/migration-data-grid-v7/ ; Migration & Versioning (DeepWiki): https://deepwiki.com/mui/mui-x/8-migration-and-versioning
59. Hypermod — Automating design system evolution with codemods (Atlassian): https://www.hypermod.io/blog/7-automating-design-system-evolution
60. Carbon — deprecating carbon-components / carbon-components-react (Medium, F. Lucca): https://medium.com/carbondesign/moving-forward-on-deprecating-carbon-components-and-carbon-components-react-4f2f0c3d8448 ; Carbon v11 migration: https://carbondesignsystem.com/migrating/guide/overview/
61. React UI library bundle-size comparison (PkgPulse): https://www.pkgpulse.com/blog/best-react-ui-libraries-2026 ; AdminLTE Mantine vs Chakra vs MUI: https://adminlte.io/blog/mantine-vs-chakra-ui-vs-mui/
62. Automating UI testing with Storybook/Chromatic/CircleCI: https://circleci.com/blog/automating-ui-testing-with-storybook-chromatic/
63. Chromatic (platform) + TurboSnap: https://www.chromatic.com/ ; Steve Kinney Storybook visual tests: https://stevekinney.com/courses/storybook/visual-tests
64. Design System Maturity Model guide (Number Analytics): https://www.numberanalytics.com/blog/design-system-maturity-model-ultimate-guide ; maturity metrics: https://www.numberanalytics.com/blog/design-system-maturity-metrics
65. Design System Maturity Model (designsystems.one): https://www.designsystems.one/foundations/maturity-model ; Sparkbox: https://sparkbox.com/foundry/design_system_maturity_model
66. Polaris — unified and for the web (Shopify Partners, 2025): https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web
67. Polaris Goes Stable (Shopify Partners, 2025): https://www.shopify.com/partners/blog/polaris-goes-stable-the-future-of-shopify-app-development-is-here ; polaris-react (deprecated) repo: https://github.com/shopify/polaris-react
68. Fluent UI repo: https://github.com/microsoft/fluentui
69. Fluent 2 — Develop (React v9): https://fluent2.microsoft.design/get-started/develop
70. Carbon — Web Components framework docs: https://carbondesignsystem.com/developing/frameworks/web-components/
71. Material Web — "MWC is in maintenance mode" (GitHub discussion #5642): https://github.com/material-components/material-web/discussions/5642 ; Telerik "What's going on with Material": https://www.telerik.com/blogs/whats-going-material
72. Material 3 Expressive (Supercharge analysis; not on Web): https://supercharge.design/blog/material-3-expressive ; M3 develop/web: https://m3.material.io/develop/web ; Google I/O 2025 M3 Expressive: https://io.google/2025/explore/technical-session-24/
73. shadcn/ui — components.json (RSC support, auto "use client"): https://ui.shadcn.com/docs/components-json
74. TanStack — React Server Components Your Way: https://tanstack.com/blog/react-server-components
75. Shopify Polaris deep analysis (structure/governance, UpUply): https://www.upuply.com/blog/shopify-design-system
76. Elevating design systems — holistic maturity framework (UX Planet): https://uxplanet.org/elevating-design-systems-a-holistic-framework-for-maturity-7ce70d295cec
