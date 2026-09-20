# Conventions

Always-on. The single place for component API, styling/tokens, theming, accessibility,
loading states and icons. Package-specific detail lives in the path-scoped rules
(`ai.md`, `charts.md`, `data.md`, `flow-maps-editor.md`, `registry.md`, `storybook-mcp.md`).
Canonical decisions (D1–D7): `docs/DECISIONS.md` + `decisions.md`.

<!-- brand-ui:gen:conventions:start -->

## Component API

- PascalCase components, kebab-case files/folders; co-locate `name.tsx`, `index.ts`,
  `name.stories.tsx`, `name.test.tsx`.
- Extend intrinsic element props (`ButtonHTMLAttributes`, `HTMLAttributes<…>`); spread
  `...props` onto the root; always accept `className`, merged last via `cn()` so callers
  can override.
- `forwardRef` wherever a DOM ref is meaningful (inputs, buttons, Radix content).
- Variants with >1 visual axis use `class-variance-authority`, never hand-rolled
  conditional class strings; export `xxxVariants`; set `defaultVariants`. `cva` is for
  VISUAL axes only, never behavioural modes — compose or make an explicit variant
  component (`ThreadComposer`, not `<Composer isThread>`) instead of boolean-prop
  proliferation.
- Compound components share a context, not props (`Card`/`Tabs`/`Sidebar`); consumers
  compose what they need; prefer `asChild`/`Slot` over wrapper props. Lift state into the
  Provider; expose `state`/`actions`/`meta` so parts and sibling controls read/drive it
  through the interface — no prop-drilling, no `useEffect`-to-sync.
- Children over render-props; `renderX` only when the parent hands data back (`renderItem`).
- `data-slot`: root `data-slot="<kebab-name>"`, each sub-part
  `data-slot="<kebab-name>-<part>"`. A preset wrapping a base component KEEPS the base
  root slot (`UserMessage` emits `data-slot="message"`). `pnpm check --rule data-slot`.
- Controlled/uncontrolled mirrors the platform; if both, `isControlled = value !== undefined`,
  never flip modes.
- Export every public prop/type. Verify real props via `mcp__storybook__get-documentation`
  or the `.tsx` — never guess.
- `*.stories.tsx` exercises every variant + key state (default/hover/focus/disabled,
  loading/error/empty where relevant); a new `cva` value ships its story
  (`pnpm check --rule variant-coverage`).
- `"use client"` on any component using hooks/effects an RSC app may consume.
- A component's `index.ts` re-exports only its own surface — no barrels-of-everything.
- A public subpath export (e.g. `@elabs-ai/components-<pkg>/markdown/frontmatter`) is
  warranted only when it has a lighter/different dependency tree AND a real consumer
  needs the leaf alone — never for API organization. Add it in `exports` +
  `publishConfig.exports` + `tsup.config.ts`, run `pnpm gen`, route through
  `brand-ui-reviewer`.

## Styling & tokens

- Semantic tokens only (Tailwind v4): `bg-background`, `text-foreground`, `border-border`…
  No raw colors in components (hex, `rgb()`, `bg-[#fff]`) — they live only in
  `packages/tokens/src/themes.css` and registry `registry:theme` items.
- `cn()` (`clsx` + `tailwind-merge`) merges every class list. Spacing/radius: the Tailwind
  scale; `rounded-*` backed by `--radius`. No ad-hoc values.
- Focus: `focus-ring` on every interactive element (`focus-ring-within`: compound control;
  `focus-ring-inset`: clipped by overflow; `focus-ring-static`: focus proxied by a hidden
  input or `focus-visible:after:`). Never `focus-visible:outline-none focus-visible:ring-2
focus-visible:ring-ring`. Retarget: `focus-ring [--focus-ring-color:var(--sidebar-ring)]`.
- **`border` vs `border-strong`:** `border-border` (default) = redundant boundary
  (fill/elevation/shadow/spacing also mark the edge); `border-border-strong` (≥3:1 vs
  `--card`/`--background`) = the only cue between same-surface regions (row dividers,
  `Separator`, no-fill controls). `border-input` = the subtle form-field hairline
  (== `--border`), on every form control. **Test:** _"If I deleted this line, could a
  sighted user still tell the two regions apart?"_ Yes → `border`. No → `border-strong`.
- **Status rung for a MARK:** the FILL rung (`bg-<tone>`/`border-<tone>`/`text-<tone>`) is
  the mark, ≥3:1 on background/card/muted in every theme; `text-<tone>-foreground` is
  ONLY ink on a solid `bg-<tone>` plate, never on a wash or bare surface; `text-<tone>-text`
  is coloured TEXT on an ordinary surface (≥4.5:1). Test: colour behind text I control
  (`-foreground`), colour OF text (`-text`), or colour of a shape (fill)?
- New visual concept = new token: `--foo` in every theme block of `themes.css`,
  `--color-foo: var(--foo)` in `@theme inline`, then `bg-foo`/`text-foo`. Never a literal.
- **Surface separation:** one focal gesture per region — fill/zone (`bg-surface-muted`,
  a status `bg-<tone>/10` wash), accent rail (`border-s-2/4` + `border-s-<role>`),
  elevation (raised `bg-card` + `shadow-md`, recessed `bg-background`), or divider
  (`gap-*`/`border-t`). No redundant border on a region with a non-default fill/rail/
  elevation unless it is the SOLE structural cue. `Card` is the one generic surface and
  keeps its border. Chrome < canvas < raised: `bg-sidebar` < `bg-background` < `bg-card`.
- **Elevation:** never hand-roll a shadow. One ramp in `themes.css` (`shadow-2xs`…`2xl`).
  Floating surface (dialogs, popovers, menus, toasts) = `shadow-ring-*`, no border. Resting
  surface (`Card`, form fields, flow nodes) keeps its border + `shadow-sm`/`xs`. Never
  `border` beside `shadow-ring-*`. Retune only via theme vars `--shadow-color`/
  `--shadow-strength`/`--shadow-ring-color`.
- **Typography:** type is a role — `text-<role>` (`display`/`title`/`subtitle`/`body`/
  `caption`/`meta`/`kpi`/`code`) or `<Heading>`/`<Text>`, never raw `text-sm`/`text-[17px]`.
  `kpi` gets `tabular-nums`; `code` gets `font-mono`. Density (`--type-factor`) scales
  every role's size/leading; never hand-scale text yourself. `*Description` parts: full
  width by default; `measure?: boolean` opts into `max-w-prose` for real prose.

## Theming

- Theming is OPEN: `ThemeName` is `string`; any `[data-theme="name"]` block covering the
  token contract, registered on `ThemeProvider`, is a theme. `:root` is the complete light
  fallback. Two reference themes ship: `light` (default), `dark`.
- CSS values are generated from the DTCG source (`packages/tokens/tokens/`) — author there,
  run `tokens:build`; never hand-edit `themes.css` values.
- Every theme overrides every token (`pnpm check --rule theme-parity`). `color-scheme: light|dark`
  in every theme block is load-bearing — anything swapping an asset by darkness reads it
  via `resolveThemeIsDark(el)`, never a registry lookup.
- `ThemeProvider` writes/persists `data-theme`; `useTheme()` reads/sets it. Consumer themes:
  `<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, defineTheme({…})]}>` — the prop
  REPLACES the registry, so spread the built-ins to keep them.
- Focus indicator is compound: `--ring` + `--ring-contour` (1px outline). Never hand-roll
  one; never `focus-visible:ring-2 focus-visible:ring-ring`. Retarget ONE variable, never
  re-stack. `--sidebar-ring: var(--ring)` — never a literal.
- **Taste profile** (`useTasteProfile()`/`brand-ui info --json`): density
  (`comfortable`/`compact`/`spacious` → `data-density`), motion (`system`/`reduced`/`full`
  → `data-motion-pref`; `"full"` is a PERSON's consent, never an app/scaffold default),
  expressiveness 0–10 (== `--decoration`, never a second knob).
- **Decoration dial** (`--decoration` 0–10, `packages/tokens`): orthogonal to color and
  hue-independent. BACKGROUNDS and chart fills only — never inside a control (a button/
  input/badge is identical at 0 and 10). Never flat — every ground paints on a masked
  `::before` layer that fades; mask the layer, never the host. `data-decoration="N"` or
  `<DecorationProvider level={N}>` dials a subtree; `ThemeProvider`/`useDecoration()`
  persist an override. At most one focal drafting gesture per region; when unsure, omit.
  Checked: `pnpm check --rule decoration-css,decoration-collapse,elevation`.

## Accessibility

- Keyboard first — everything mouse-operable must be keyboard-operable; don't remove
  focusability; don't trap focus except in modals (Radix handles this).
- Always render a visible `focus-visible` ring; never `outline: none` with no replacement.
- Real elements: `<button>`, `<a>`, `<input>` — no div-as-button.
- Inputs need labels (visible or `sr-only`); icon-only controls need `aria-label`;
  decorative SVGs get `aria-hidden="true"`.
- **A `Kbd` beside a control's own text joins its accessible name** — decide deliberately.
  Not part of the name (usual): put `Kbd` beside the `<Label>` as a sibling, never inside;
  a control that owns its text sets `aria-label` and marks label + `Kbd` `aria-hidden`.
  Deliberately part of the name: an explicit space text node between them plus a comment
  saying so. Catch it with `toHaveAccessibleName("…")` (exact string), never a name regex.
- Lean on Radix/React Aria — don't reimplement focus management, typeahead or dismissal.
- Status semantics: loading → `role="status"` + `aria-live="polite"`; errors → `role="alert"`.
- Don't over-ARIA — native semantics + Radix beat redundant ARIA.
- Verify text/UI contrast in both themes.
- **Colour is never the only channel (WCAG 1.4.1).** A `cva` colour map that carries
  MEANING (status, severity, tone) needs a second channel too: shape, icon, pattern,
  border-style or text, plus a real accessible name (`data-status` is invisible to AT).
  Test: _"In greyscale, could a user still tell these two states apart?"_ No → add a
  channel. Reference fixes: `StatusIcon`/`STATUS_TONE_ICONS`, `Timeline`'s `NODE_STYLE`,
  `FlowNode`'s `data-tone` + glyph + `sr-only` name.

## Loading & streaming states

Not-ready UI is prop-driven only (D5) — a component never fetches or reads `use()`/Suspense.

- Two orthogonal signals: `loading?: boolean` (no content yet → layout-shaped skeleton) and
  `isStreaming?: boolean` (still arriving, AI → build up, hide transient parse errors).
  From empty, both: skeleton until the first token, then build up. Errors fire ONLY on
  terminal, settled failures — never while loading/streaming or on incomplete input.
- Aliases (keep, never mint a fourth): `loading`/`isStreaming` canonical; `status:
"loading"|"ready"` for charts only; `StatePanel kind="empty|error|loading"` for a message
  panel (mirror layout → `Skeleton`; message → `StatePanel`).
- Slot order: internal prop (own skeleton, mirrors real DOM, no layout shift) → compound
  `XSkeleton` part (consumer-owned layout) → `loadingSlot?: ReactNode` (last resort).
- Never hand-roll `animate-pulse bg-muted` boxes — use `Skeleton`/`Spinner`/`StatePanel`/
  `Shimmer`. Skeletons `aria-hidden`; one `role="status" aria-live="polite"` per region.
  Reserve the final box size (CLS); `Shimmer` gates on `useReducedMotion`.

## Icons

- Default: **Lucide** (`lucide-react`) for every generic UI glyph, nav entry and
  formatting-toolbar glyph. Named imports only (`import { Bell } from "lucide-react"`), no
  barrel/wrapper re-export. Color via `currentColor`, size via `size`, tokens only.
- `@elabs-ai/components-icons` = brand/product-vocabulary icons + `BrandLogo` only, built
  on `Icon`/`createIcon`. Add an icon there only when it is product vocabulary.
- Decorative → hidden from AT automatically (no `title` set). Conveys meaning → `Icon
title=…` (→ `role="img"` + `aria-label`), or the icon-only control carries `aria-label`.
- One `lucide-react` version monorepo-wide; other icon sets fail lint.

## Interaction essentials

- **Empty composer submit:** stays enabled visually but nothing to submit uses
  `aria-disabled="true"` + a handler guard, never native `disabled` (`PromptInputSubmit`).
- **Micro-typography:** `…` not `...`; curly `“ ” ‘ ’` not straight; loading text ends `…`.
  `tabular-nums` on number columns/before-after values.
- **Global pointer cursor:** set once in `themes.css` `@layer base` for interactive
  elements/roles — never re-add `cursor-pointer`; `cursor-*` only for non-default
  (`grab`/`grabbing`/`text`). Disabled keeps the arrow.
- **Destructive actions confirm or offer undo, never fire immediately.**
- **Long content:** `truncate`/`line-clamp-*`/`break-words`; flex children needing this
  MUST also carry `min-w-0` or the truncation silently does nothing.

<!-- brand-ui:gen:conventions:end -->

History and measurements: `docs/rules-history/*.md` (per merged rule, kept as archive).

<!-- brand-ui:gen:check-rules:start -->

## Checked conventions

Generated from `scripts/check/rules/*.mjs` and `scripts/check/commands.mjs` (`pnpm gen`). Edit a rule's `doc`, never this block; `pnpm check` enforces each line.

### Themes

- Ship each downloadable theme family in `themes/<slug>/` complete and readable: one `[data-theme]` block per `<slug>-<scheme>.css` with a matching `color-scheme`, every contract token and nothing else, AA ink pairs, no logo art (`--brand-logo-*` stay `initial`, so brand-ui’s own mark shows and the app overrides it), and a `theme.ts` + README that agree. (`community-themes`)
- Never let a high-decoration rule in decoration.css collapse two or more role fills (`.bg-primary`, `.bg-success`, …) to one appearance without a compensating `[data-status]` channel (≥2 values, same scope). (`decoration-collapse`)
- Keep `background-attachment: fixed` inside `@media (hover: hover) and (pointer: fine)`; mask the `[data-decoration-fade]` fade on an inert `::before` layer, never the host; give `oklch(from …)` inks an `@supports not` fallback. (`decoration-css`)
- Declare each theme selector's color tokens in exactly ONE block; a second color block wins the cascade but is invisible to every first-match tool (machinery-only blocks with no color token are fine). (`duplicate-theme-blocks`)
- Use the one elevation ramp: `shadow-*` for resting surfaces, `shadow-ring-*` (no border) for floating ones, `shadow-hairline` for a bare edge — never a raw `box-shadow`, an arbitrary `shadow-[…]`, or `border` + `shadow-md`+ in one class string. (`elevation`)
- Keep co-occurring roles (focus ring vs success/accent ink, current match vs destructive, every categorical chart series, adjacent sequential/mono steps, diverging steps, accent vs mono) ≥ 0.05 ΔE(OKLab) apart in every theme, after resolving `var()` aliases. (`role-distinctness`)
- Keep app chrome recessed below the canvas in every theme: `L(--background) − L(--sidebar) ≥ 0.02` and `--card` never below `--background` — fix flatness in the theme's `--sidebar`, never in components. (`surface-elevation`)
- Every theme block (`:root` and each `[data-theme]`) defines every semantic token; only `:root` machinery (`--decoration*`, `--deco-*`, `--paper-*`, `--duration-*`, `--t-*`, `--motion-*`, `--radius*`, `--font-*`) is exempt. (`theme-parity`)

### Components

- Every literal `aria-label` and `placeholder` in `@elabs-ai/components-ai` goes through `t()` — no baseline, no exceptions beyond `// i18n-exempt: <reason>`. (`ai-microcopy-a11y`)
- Draw chart furniture with `--chart-grid` at full opacity and `CHART_HAIRLINE_WIDTH` (never a dimming `opacity`/`strokeOpacity` or another numeric `strokeWidth`), and never alias `--chart-grid` to `var(--border)`; one element may opt out with `// chart-hairline-exempt: <reason>`. (`chart-hairline`)
- In `@elabs-ai/components-charts`, draw bars from a zero-including domain (`resolveBarValueDomain` / `resolveYDomain(…, { includeZero: true })`), scale area radii by `sqrt(value / max)`, and never call `Math.random` (use `seededRnd`); a reasoned exception carries `// honesty:allow <reason>`. (`charts-honesty`)
- Every `@elabs-ai/components-charts` container publishes its breakpoint tier (renders `ChartPlotRoot`, sets `data-chart-breakpoint`, or wraps a container that does), and a `Responsive<…>` prop is read only through `resolveResponsive` / `useResponsiveValue` or handed on whole — never branched on directly (ADR 0039); opt out with `// charts-responsive-exempt: <reason>`. (`charts-responsive`)
- Build a collapsing side panel on `useCollapsiblePanel` (`@elabs-ai/components-ui`); never hand-roll a `transition-[…width…]` tween plus an off-screen `[calc(var(--x)*-1)]` slide outside `packages/ui/src/components/collapsible-panel`. (`collapse-fork`)
- Every `@elabs-ai/components-ui` component folder is re-exported from `src/index.ts` (or its own subpath export) and ships a `*.stories.tsx`. (`component-registration`)
- Every scripts/check/contract-known-failures.json entry is a well-formed, ratcheted contract-test gap; the shared baseline makes the count visible so growing it is a reviewed move, not a silent mute. (`contract-known-failures`)
- Give every exported component's root `data-slot="<kebab-name>"` and each sub-part `data-slot="<kebab-name>-<part>"`; a module never gains a component without a slot or drops a slot without its part. (`data-slot`)
- A dimmed disabled state follows the house recipe: `disabled:opacity-50` plus `disabled:pointer-events-none` (Button) or `disabled:cursor-not-allowed` (Input) in the same class list. (`disabled-recipe`)
- A `useEffect`/`useLayoutEffect` that adds a listener, starts a timer/interval, creates an observer or subscribes returns a cleanup that removes/clears/disconnects/unsubscribes it. (`effect-cleanup`)
- Focus indicators use `focus-ring`/`focus-ring-within`/`focus-ring-inset`/`focus-ring-static`, never a hand-rolled `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` stack. (`focus-ring-only`)
- An exported component that spreads `...props` onto a DOM element is wrapped in `forwardRef`. (`forward-ref-required`)
- Size every header band (`<header>`, or a `data-slot` ending `-header`/`top-bar`, with a `border-b`) with `h-header`, never `h-14`/`h-12` or padding, so side-by-side shell headers share one bottom line in every theme; opt out with `// header-band-exempt: <reason>`. (`header-band`)
- Paint the website (`apps/home`, ADR 0038) with tokens only: no raw hex, `rgb()`/`hsl()`/`oklch()` colour or arbitrary `duration-[…]`/`ease-[…]` in `apps/home/**/*.{ts,tsx,css}`; `app/globals.css` may only reference `var(--…)`. (`home-tokens`)
- UI text in package source (JSX text, `aria-label`/`title`/`placeholder` literals) comes from props or a labels object so apps can localize it; stories, tests, templates and registry are exempt. (`i18n-strings`)
- Format numbers and dates with `Intl.*` and a locale prop: no `toLocaleString()`/`toLocaleDateString()`/`toLocaleTimeString()` without a locale, no `new Date(…).toString()` in JSX. (`locale-formatting`)
- Use logical direction utilities (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`border-s`/`rounded-s`/`text-start`), never physical `ml-`/`pr-`/`left-`/`border-l`/`text-right`, so layouts mirror in RTL. (`logical-props`)
- Never wrap a component whose props include `children` in `memo`/`React.memo` — inline children defeat the shallow compare; memoise the children-free part instead. (`memo-on-children`)
- Route user-visible strings (`aria-label`, `placeholder`, `title`, JSX text) through the locale seam `t()` (ADR 0017); a genuinely untranslatable string carries `// i18n-exempt: <reason>`. (`microcopy`)
- Write the curly apostrophe ’ (never a straight `'` between letters) in JSX text and `aria-label`/`placeholder`/`title`/`description` values, stories included; opt out with `// microtypography-exempt: <reason>`. (`microtypography-apostrophe`)
- Write "…" (U+2026), never "...", in JSX text and `aria-label`/`placeholder`/`title`/`description` values, stories included; a genuine code sample carries `// microtypography-exempt: <reason>`. (`microtypography-ellipsis`)
- Use motion tokens in charts/ai source and the website (`apps/home`): `duration-fast|base|slow|slower` and `ease-standard|entrance|exit`, never `duration-<N>`, `ease-in`/`ease-out`/`ease-in-out` or `transition-all` (docs/MOTION_GUIDELINES.md). (`motion-tokens`)
- Triggers (`*Trigger` components, `data-slot="*-trigger"`) size with `min-w-*`/`w-full`, never a fixed `w-40`/`w-[180px]`. (`no-fixed-trigger-width`)
- List keys are stable ids from the item, never the `.map` index (`key={i}`); placeholder lists (`Array.from({ length })`, `(_, i)`) are exempt. (`no-index-key-reorderable`)
- Radius comes from the `rounded-*` scale (backed by `--radius`), never an arbitrary `rounded-[6px]`. (`radius-rungs`)
- Use semantic color utilities (`text-info-text`, `bg-success/10`, `border-destructive`), never raw Tailwind palette utilities (`text-yellow-600`, `bg-red-500`) in package source and the website (`apps/home`). (`raw-palette`)
- Say "every theme" (or "both themes"), never a hardcoded theme count that disagrees with `BUILT_IN_THEMES`, in package source comments and stories. (`source-theme-count`)
- Paint running status text with the ink rung `text-<tone>-text`; a bare `text-<tone>` (the 3:1 fill rung) is for marks only and never shares a class string with a text tell (`text-xs`, a type role, `font-*`, `truncate`). (`status-rung`)
- Give each region ONE separation gesture: never a bare `border` in the same class string as a non-default fill (`bg-surface-muted`, `bg-surface-elevated`, `bg-chat-user`, `bg-<status>/N`); rails (`border-s-*`), axis dividers and `border bg-card` are fine. (`surface-separation`)
- Set type with a role (`text-display-lg|display|title|subtitle|heading-xs|body|caption|meta|eyebrow|kpi|kpi-sm|code` or `<Heading>`/`<Text>`), never a raw size utility (`text-sm`, `text-xl`, `text-[17px]`) in package source or stories. (`text-scale`)
- Compose `TimelineRoot`/`TimelineItem`/`Timeline` from `@elabs-ai/components-ui`; never declare a local `Timeline*` component or hand-roll an `absolute w-px` connector with a status-keyed style map outside `packages/ui/src/components/timeline`. (`timeline-fork`)
- Type is a role: use `text-display-lg|display|title|subtitle|heading-xs|body|caption|meta|eyebrow|kpi|kpi-sm|code`, never raw `text-sm`/`text-[17px]` in `packages/*/src/**/*.tsx` (stories are covered by the `text-scale` rule). (`type-roles`)
- Every `dangerouslySetInnerHTML` has a same-line or directly-preceding comment saying why it is sanitized/trusted/escaped, and its `__html` is a sanitiser call or a `sanitized*`/`safe*` value. (`unsafe-html-justified`)
- A component with both controlled and uncontrolled modes (`value`/`defaultValue`, `open`/`defaultOpen`, …) uses `useControllableState` (ui `lib/use-controllable-state.ts` or Radix), never a hand-rolled `useState` + `x !== undefined` pair. (`use-controllable`)

### Stories

- Axe stays blocking: preview.tsx keeps `a11y: { test: "error" }` and applies `scripts/a11y-baseline.json`, whose generated per-story exemptions never exceed `ratchet.maxStories`; fix a new violation, never exempt it. (`a11y-baseline`)
- Every unit-decomposed chart (waffle/field UnitChart, dot heatmap, `unit`-ed Bar/WaterfallChart, beaded DumbbellChart, raw `UnitStack`) in a chart story, a `registry/blocks/**` block or a block story states its unit ("one X = N") in `unitLabel`, `description` or `accessibleDescription`. (`chart-unit-caption`)
- A component with a `loading`/`isStreaming` (or chart `status: ChartStatus`) prop ships a story that shows it: a `*Loading`/`*Streaming` export or a not-ready arg (`loading: true`, `status="loading"`). (`loading-states`)
- Story decorators and render wrappers never pin a fixed width above 320px (`w-[800px]`, `style={{ width: 800 }}`) without a max — use `w-full max-w-*` or `parameters.layout`. (`no-fixed-story-wrapper`)
- Every allowlisted stateful component (`STATEFUL_COMPONENTS` in the rule) exports a story named for a non-happy state (`Loading`, `Empty`, `Error`, `Disabled`, `Skeleton`, `FirstRun`, `Awaiting`). (`state-coverage`)
- A story's visible name says what the story shows — never an issue number (`#123`), an `ADR`, an `RM-` roadmap item, `harness` or `regression`; that reference belongs in a comment or `parameters.docs.description.story`. (`story-name-hygiene`)
- A story meta for a layout-level surface (`Layout/*`, `Patterns/Templates/*`, `Patterns/Scenarios/*`, AppShell, Sidebar, DataTable, ChatShell, Hero, …) sets `parameters.layout` (`"fullscreen"`/`"padded"`) or a viewport — never the centered default. (`story-viewport-guard`)
- Render every `cva` variant value in a story (`variant="success"` or `args: { variant: "success" }`); `argTypes.options` does not count, a default is met by a story that leaves the axis unset. (`variant-coverage`)

### Packages

- The manifest's `agentOutput` contract matches `statusFromToolState` (ai `tool.tsx`) and `STATUSES` (`status-badge.tsx`), names only real `@elabs-ai/components-ai` exports, and its example never calls `useChat(`. (`agent-output-contract`)
- `@elabs-ai/components-ai` imports `ai` / `@ai-sdk/*` as types only (`import type`, inline `type` specifiers); runtime values like `useChat` belong in the consuming app (ADR 0008, D6). (`ai-sdk-types-only`)
- When shipped source says code was adapted/vendored/borrowed/forked/copied/ported from somewhere, credit that upstream in `scripts/attributions.sources.json` (then `pnpm gen`) in the same change. (`attribution-provenance`)
- In `@elabs-ai/components-charts`, never declare a runtime export named like a `@elabs-ai/components-ui` component (use a chart-scoped name such as `ChartTooltipContent`) and never import `@base-ui/*`. (`charts-reuse`)
- Keep `@elabs-ai/components-charts/test` a faithful, engine-free double: export every real component from `src/test/index.ts`, never import @visx/d3/motion or a chart barrel at runtime from `src/test/**`, keep `./test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest. (`charts-test-double`)
- In `@elabs-ai/components-charts/dashboard` (`packages/charts/src/dashboard/`, ADR 0037), compose charts/ui: no local component named like a ui/charts export, no raw SVG primitives, no data/ai/flow/maps/process/viewer/terminal/editor/marketing imports (host-registered tile kinds instead), and no React/dnd-kit/zustand-React/`@elabs-ai/components-*` import under `dashboard/core/`; exempt one line with `// dashboard-reuse-exempt: <reason>`. (`dashboard-reuse`)
- Keep `@elabs-ai/components-charts/dashboard/test` a faithful, engine-free double: re-export `DashboardSheet` and the contract helpers from `dashboard/test/index.ts`, never import @dnd-kit/visx/d3/motion or a dashboard/charts barrel at runtime from `dashboard/test/**`, keep `./dashboard/test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest. (`dashboard-test-double`)
- `@elabs-ai/components-*` runtime deps (`dependencies`/`peerDependencies`) follow the one-way DAG `tokens → ui/icons → layer-2 leaves → process`; every package is registered in `ALLOWED`, and a shared piece moves down, never sideways. (`dep-direction`)
- Reach heavy engines (mermaid, Rive, xterm, React Flow, media-chrome, viewer parsers) and a package's own optional peers only via dynamic `import()` or a `@lazy-boundary` module in `ai`/`terminal`/`viewer` src; never import a `@lazy-boundary` module statically. (`eager-heavy-deps`)
- Keep the website's `/` initial JavaScript (gzip, `apps/home/.next`) within the `home-bundle` budget in `scripts/check/baseline.json` and free of per-section engines (@xyflow, monaco-editor, maplibre-gl, @milkdown, components-process, components-terminal); skipped without a build unless `HOME_BUNDLE_REQUIRED=1`. (`home-bundle`)
- Build the website (`apps/home`, ADR 0038) only from the library: import react, react-dom, next, motion, @vercel/analytics, lucide-react, `@elabs-ai/*` or a relative path; a registry block copied under `apps/home/components/blocks/` keeps its `// registry: <name> — copied <YYYY-MM-DD>` header. (`home-imports`)
- Declare ONE `lucide-react` version specifier across every workspace manifest (deps, peers, dev deps, `pnpm.overrides`, `resolutions`). (`lucide-version`)
- An optional peer is not also installed through a plain transitive dependency (resolved from `pnpm-lock.yaml`); the known, disclosed exceptions in the rule's `KNOWN_DEFEATS` are exact — remove one the day it goes clean. (`optional-peer-transitives`)
- In `@elabs-ai/components-process` (layer 3), compose base packages: no local component named like a ui/flow/charts/data export, no raw SVG primitives, no `@xyflow/react` primitive flow wraps, no ai/maps/marketing/editor/viewer/terminal imports, and no engine or React import under `src/core/`; exempt one line with `// process-reuse-exempt: <reason>`. (`process-reuse`)
- Keep `@elabs-ai/components-process/test` complete and engine-free: re-export every double from `src/test/index.ts`, never import React Flow/visx/d3/motion or flow/charts/data/process barrels at runtime from `src/test/**`, keep `./test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest. (`process-test-double`)
- Declare every `https://` origin shipped source can reach (including upstream URLs in `attributions.generated.ts`) in `scripts/remote-origins-allowlist.json` with its kind, CSP directive and escape hatch, and name it in `docs/CSP-AND-NETWORK.md`. (`remote-origins`)
- Wrap a safe-by-default renderer (Streamdown) only with `Omit<…, "rehypePlugins">` on every props type and `stripSanitizerOverrides(props)` before spreading props onto it; never set `rehypePlugins` outside the reviewed allowlist. (`sanitizer-passthrough`)
- Name every package that ships Tailwind classes in each `@source`-bearing app CSS file with a pattern that resolves to `packages/<name>/src` (or `node_modules/<pkg>/dist`); an unlisted package renders unstyled. (`tailwind-sources`)
- Keep `@radix-ui/react-scroll-area` and `@radix-ui/react-select` patched (registered in `pnpm.patchedDependencies`, installed dist free of HTML sinks); after a version bump re-apply the patch with `pnpm patch`. (`trusted-types-patches`)
- Never assign HTML (`dangerouslySetInnerHTML`, `.innerHTML =`, `insertAdjacentHTML`, `document.write`) in package source or add a dependency that does — it blanks a Trusted-Types app; static markup belongs in CSS or JSX, and an unavoidable engine sink is baselined and documented in `docs/CSP-AND-NETWORK.md`. (`trusted-types-sinks`)
- A client package (`ui`, `data`, `ai`, `flow`, `maps`, `charts`, `editor`, `viewer`, `terminal`) whose source uses React hooks carries `"use client"` in its source modules, not only in the build banner. (`use-client-source`)
- A viewer adapter's `capabilities.highlight` lists only real address kinds, its renderer reads `highlights` (and `rects` for `rect`), and its `*-adapter.test.tsx` builds and paints each declared kind. (`viewer-highlight`)

### Registry

- Every relative import in a registry item resolves both at its repo `path` and at its install `target` layout; keep `target` folders mirroring the repo tree. (`registry-resolve`)
- Import or re-export `TeamSwitcher`, `NavMain`, `NavUser` and `NavNotifications` from `@elabs-ai/components-ui` in registry sidebar blocks; never re-declare a local copy. (`sidebar-drift`)

### Repo

- Keep what an agent reads first under its byte ceiling: the brand-ui skill router (8 KiB), `llms.txt` and each `llms/<pkg>.txt`, a created app's `brand-ui-context.md` for every template, and every component's `docs --brief` card. (`agent-token-budget`)
- Resolve every Git merge conflict before committing: no line may start with a `<<<<<<<` / `=======` / `>>>>>>>` marker. (`conflict-markers`)
- Keep `docs/csp-policy.json` and the `csp:published`/`csp:dev` blocks in `docs/CSP-AND-NETWORK.md` §2.7 identical, and justify every non-`'self'` relaxation with a carve-out whose `why` names the reason. (`csp-policy`)
- `pnpm-lock.yaml` never repeats a sibling mapping key (a bad merge breaks `--frozen-lockfile` and silently stops CI); dedupe or regenerate with `pnpm install --lockfile-only`. (`lockfile-dup-keys`)
- Never commit a machine-specific absolute home path (`/Users/<name>/…`, `/home/<name>/…`); write it relative to the repo root. (`machine-paths`)
- Suppress lint findings with `// eslint-disable-next-line <rule> -- <reason>`, never a `biome-ignore` comment (this repo has no Biome, so it is inert). (`no-biome-ignore`)
- Shipped plugin skills and agents reference no repo-internal plumbing (`/file-issue`, `.claude/`, `packages/`, `apps/`, maintainer agents); end users install them without this monorepo. (`plugin-consumer-clean`)
- The Claude plugin installs whole: `plugin.json` and `marketplace.json` agree on version, every declared skill/agent path starts `./` and resolves, the `brand-ui-start` router is user-invocable, MCP servers are http or stdio, and shared skill docs exist exactly once. (`plugin-manifest`)
- A `pnpm <script>` named in code, config or docs must be a real script (root or workspace package); dated records are exempt. (`pnpm-script-refs`)
- Name a third-party product (Datawrapper, Qlik, Grafana, MUI, …) only in an attribution or theme surface; everywhere else — shipped source, the manifest, changesets, docs, roadmap — say what the feature does instead. Package specifiers and the libraries `brand-ui migrate` converts from are exempt. (`reference-leakage`)
- The root `test` script runs `turbo run test --concurrency=<int>`; never raise a vitest `testTimeout` to absorb CPU oversubscription (#80). (`test-concurrency`)
- Every app aliases `decode-named-character-reference` and `hast-util-from-html-isomorphic` via `require.resolve(…)`, declares both as direct devDependencies, and `docs/CSP-AND-NETWORK.md` still documents both. (`tt-aliases`)

### External commands

- Keep `registry/registry.json` a valid shadcn registry: unique named items, valid types, real https homepage, every listed file on disk. (`registry-validate`: `node scripts/validate-registry.mjs`)
- Keep the shipped theme token contract (`THEME_TOKEN_NAMES`) in sync with the theme stylesheets. (`token-contract`: `node packages/tokens/scripts/gen-theme-token-names.mjs --check`)
- Author token values in the DTCG source (`packages/tokens/tokens/`); the generated theme stylesheets must match a fresh `tokens:build`. (`tokens-fresh`: `node scripts/check-tokens-fresh.mjs`)
- The Trusted-Types alias snippet in docs/CSP-AND-NETWORK.md must resolve (in node_modules) to each package's DOM-free build. (`tt-aliases-resolve`: `node scripts/check-tt-aliases.mjs`)
- Keep the root, plugin manifests and MCP `SERVER_INFO` versions equal to the fixed package group's version. (`version-sync`: `node scripts/sync-version-extras.mjs --check`)

<!-- brand-ui:gen:check-rules:end -->
