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
  root slot (`UserMessage` emits `data-slot="message"`). Gate `pnpm data-slot:check`.
- Controlled/uncontrolled mirrors the platform; if both, `isControlled = value !== undefined`,
  never flip modes.
- Export every public prop/type. Verify real props via `mcp__storybook__get-documentation`
  or the `.tsx` — never guess.
- `*.stories.tsx` exercises every variant + key state (default/hover/focus/disabled,
  loading/error/empty where relevant); gate `pnpm variants:check` — a new `cva` value
  ships its story.
- `"use client"` on any component using hooks/effects an RSC app may consume.
- A component's `index.ts` re-exports only its own surface — no barrels-of-everything.
- A public subpath export (e.g. `@elabs-ai/components-<pkg>/markdown/frontmatter`) is
  warranted only when it has a lighter/different dependency tree AND a real consumer
  needs the leaf alone — never for API organization. Add it in `exports` +
  `publishConfig.exports` + `tsup.config.ts`, run `pnpm manifest`, route through
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
- Every theme overrides every token (`pnpm theme-parity:check`). `color-scheme: light|dark`
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
  Gates: `pnpm decoration:check`, `pnpm decoration-collapse:check`, `pnpm elevation:check`.

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
- Gate `pnpm loading-states:check`: a manifest-listed component with a not-ready prop needs
  a story at the not-ready value.

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

Generated from `scripts/check/rules/*.mjs` (`pnpm check:docs`). Edit a rule's `doc`, never this block; `pnpm check` enforces each line.

### Themes

- Every theme block (`:root` and each `[data-theme]`) defines every semantic token; only `:root` machinery (`--decoration*`, `--deco-*`, `--paper-*`, `--duration-*`, `--t-*`, `--motion-*`, `--radius*`, `--font-*`) is exempt. (`theme-parity`)

### Components

- Every literal `aria-label` and `placeholder` in `@elabs-ai/components-ai` goes through `t()` — no baseline, no exceptions beyond `// i18n-exempt: <reason>`. (`ai-microcopy-a11y`)
- Draw chart furniture with `--chart-grid` at full opacity and `CHART_HAIRLINE_WIDTH` (never a dimming `opacity`/`strokeOpacity` or another numeric `strokeWidth`), and never alias `--chart-grid` to `var(--border)`; one element may opt out with `// chart-hairline-exempt: <reason>`. (`chart-hairline`)
- In `@elabs-ai/components-charts`, draw bars from a zero-including domain (`resolveBarValueDomain` / `resolveYDomain(…, { includeZero: true })`), scale area radii by `sqrt(value / max)`, and never call `Math.random` (use `seededRnd`); a reasoned exception carries `// honesty:allow <reason>`. (`charts-honesty`)
- Build a collapsing side panel on `useCollapsiblePanel` (`@elabs-ai/components-ui`); never hand-roll a `transition-[…width…]` tween plus an off-screen `[calc(var(--x)*-1)]` slide outside `packages/ui/src/components/collapsible-panel`. (`collapse-fork`)
- Route user-visible strings (`aria-label`, `placeholder`, `title`, JSX text) through the locale seam `t()` (ADR 0017); a genuinely untranslatable string carries `// i18n-exempt: <reason>`. (`microcopy`)
- Write the curly apostrophe ’ (never a straight `'` between letters) in JSX text and `aria-label`/`placeholder`/`title`/`description` values, stories included; opt out with `// microtypography-exempt: <reason>`. (`microtypography-apostrophe`)
- Write "…" (U+2026), never "...", in JSX text and `aria-label`/`placeholder`/`title`/`description` values, stories included; a genuine code sample carries `// microtypography-exempt: <reason>`. (`microtypography-ellipsis`)
- Use semantic color utilities (`text-info-text`, `bg-success/10`, `border-destructive`), never raw Tailwind palette utilities (`text-yellow-600`, `bg-red-500`) in package source. (`raw-palette`)
- Paint running status text with the ink rung `text-<tone>-text`; a bare `text-<tone>` (the 3:1 fill rung) is for marks only and never shares a class string with a text tell (`text-xs`, a type role, `font-*`, `truncate`). (`status-rung`)
- Give each region ONE separation gesture: never a bare `border` in the same class string as a non-default fill (`bg-surface-muted`, `bg-surface-elevated`, `bg-chat-user`, `bg-<status>/N`); rails (`border-s-*`), axis dividers and `border bg-card` are fine. (`surface-separation`)
- Compose `TimelineRoot`/`TimelineItem`/`Timeline` from `@elabs-ai/components-ui`; never declare a local `Timeline*` component or hand-roll an `absolute w-px` connector with a status-keyed style map outside `packages/ui/src/components/timeline`. (`timeline-fork`)

### Stories

- Every unit-decomposed chart story (waffle/field UnitChart, dot heatmap, `unit`-ed Bar/WaterfallChart, beaded DumbbellChart) states its unit ("one X = N") in `unitLabel`, `description` or `accessibleDescription`. (`chart-unit-caption`)

### Packages

- In `@elabs-ai/components-charts`, never declare a runtime export named like a `@elabs-ai/components-ui` component (use a chart-scoped name such as `ChartTooltipContent`) and never import `@base-ui/*`. (`charts-reuse`)
- Keep `@elabs-ai/components-charts/test` a faithful, engine-free double: export every real component from `src/test/index.ts`, never import @visx/d3/motion or a chart barrel at runtime from `src/test/**`, keep `./test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest. (`charts-test-double`)
- Declare ONE `lucide-react` version specifier across every workspace manifest (deps, peers, dev deps, `pnpm.overrides`, `resolutions`). (`lucide-version`)
- In `@elabs-ai/components-process` (layer 3), compose base packages: no local component named like a ui/flow/charts/data export, no raw SVG primitives, no `@xyflow/react` primitive flow wraps, no ai/maps/marketing/editor/viewer/terminal imports, and no engine or React import under `src/core/`; exempt one line with `// process-reuse-exempt: <reason>`. (`process-reuse`)
- Keep `@elabs-ai/components-process/test` complete and engine-free: re-export every double from `src/test/index.ts`, never import React Flow/visx/d3/motion or flow/charts/data/process barrels at runtime from `src/test/**`, keep `./test` in exports + publishConfig.exports + tsup, and keep `/test` subpaths out of the manifest. (`process-test-double`)

### Repo

- Every app aliases `decode-named-character-reference` and `hast-util-from-html-isomorphic` via `require.resolve(…)`, declares both as direct devDependencies, and `docs/CSP-AND-NETWORK.md` still documents both. (`tt-aliases`)

<!-- brand-ui:gen:check-rules:end -->
