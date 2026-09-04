---
name: brand-ui
description: Build UI with the brand-ui component system (@elabs-ai/components-* packages — ui, data, ai, flow, maps, charts, marketing, editor, viewer, tokens, icons). Use when working in a project that depends on @elabs-ai/components-ui or any @elabs-ai/components-* package, when adding/composing components, building dashboards, data tables, AI/chat surfaces, React Flow canvases, MapLibre maps, code editors, file/document viewers, app shells, forms, or marketing sections, when theming with the token system, or when the user mentions brand-ui, @brand, light/dark themes, or "our design system". Provides live project context, the real component API, composition patterns, and the rules that keep components token-driven, accessible, and theme-safe.
user-invocable: false
allowed-tools:
  - Bash(npx @elabs-ai/components-cli *)
  - Bash(pnpm brand-ui *)
  - Bash(npx brand-ui *)
  - Bash(npx shadcn@latest *)
  - Bash(pnpm dlx shadcn@latest *)
---

# brand-ui

A source-owned, token-driven React component system: modern enterprise SaaS by
default, themeable to any brand. Packages: `@elabs-ai/components-ui` (foundation + app UI),
`@elabs-ai/components-data` (TanStack DataTable + filters), `@elabs-ai/components-ai` (AI Elements / chat),
`@elabs-ai/components-flow` (React Flow canvas), `@elabs-ai/components-maps` (MapLibre GL maps),
`@elabs-ai/components-charts` (KPI tiles + 13 charts + `ChartFrame`), `@elabs-ai/components-marketing`
(landing sections), `@elabs-ai/components-editor` (Monaco code editor),
`@elabs-ai/components-viewer` (FileViewer — display a file the app did not write),
`@elabs-ai/components-tokens` (themes +
`ThemeProvider`), `@elabs-ai/components-icons` (brand/product icons; generic UI glyphs use the
default icon library **Lucide** / `lucide-react`).

> Run the CLI with the project's runner. In this monorepo: `pnpm brand-ui <cmd>`.
> In a consuming project, add it with `pnpm add -D @elabs-ai/components-cli` (a
> public npm package — no registry setup, no token), then run
> `pnpm exec brand-ui <cmd>`. Or run it with no install at all:
> `npx -y @elabs-ai/components-cli <cmd>`. Examples below say `brand-ui`.

## Packages & themes at a glance

The factual catalogue below is generated from the manifest (`pnpm gen`) and
stale-gated — never hand-edit between the markers.

<!-- brand-ui:gen:catalogue:start -->
<!-- GENERATED from brand-ui.manifest.json by 'pnpm gen' (WP-10 #87). Edit package purposes in the CLI's render-docs module (PKG_PURPOSE), not here. The gen:check gate fails on drift. -->

**Themes (2):** dark, light (default) · **Radius:** `calc(var(--radius-base) * (1 - var(--decoration-factor)))` · **Tokens:** 230 · **Registry blocks:** 23

**Exported surface:** 1138 components · 82 hooks across 12 packages.

| Package                          | Components | Hooks | Use it for                                                                               |
| -------------------------------- | ---------: | ----: | ---------------------------------------------------------------------------------------- |
| `@elabs-ai/components-tokens`    |         19 |     6 | Semantic CSS-variable themes + ThemeProvider/useTheme.                                   |
| `@elabs-ai/components-icons`     |         32 |     0 | Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).            |
| `@elabs-ai/components-ui`        |        382 |    15 | Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).                           |
| `@elabs-ai/components-data`      |          6 |     0 | TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.                   |
| `@elabs-ai/components-ai`        |        442 |    14 | ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.               |
| `@elabs-ai/components-flow`      |         26 |     7 | Branded React Flow canvas, nodes, edges, controls, inspector.                            |
| `@elabs-ai/components-maps`      |         12 |     1 | MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters. |
| `@elabs-ai/components-charts`    |        155 |    35 | MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).                    |
| `@elabs-ai/components-marketing` |          6 |     0 | Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.                        |
| `@elabs-ai/components-editor`    |          8 |     1 | Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.                       |
| `@elabs-ai/components-viewer`    |         19 |     2 | FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.         |
| `@elabs-ai/components-terminal`  |         31 |     1 | Terminal surfaces: shell/agent output and coding-agent CLI look-alikes.                  |

_Counts are exact, from the manifest. Confirm component names/props with `brand-ui search <q>` / `brand-ui docs <Component>` — never guess the API._

<!-- brand-ui:gen:catalogue:end -->

## Step 0 — Load project context (do this first, once per session)

Run **`brand-ui info`** before writing UI. It reports which `@elabs-ai/components-*` packages
are present, the available themes + default, the token set, and the registry. Do
not re-run if you've already seen it this conversation.

Then, **do not guess the API.** brand-ui is source-owned and versioned — your
memory of its props is unreliable. To get the real surface:

- `brand-ui search <query>` — find components/hooks/registry items.
- `brand-ui docs <Component>` — print the component's real props from source.
- Or read the file the manifest points to. Never invent props.

> **Two equivalent ways to reach this ground truth.** The commands above are the
> **CLI**. The same engine is also exposed as a **persistent MCP server** — if the
> `mcp__brand-ui__*` tools are available (server `brand-ui` in `.mcp.json`, started
> with `brand-ui mcp`), prefer them: `mcp__brand-ui__info`, `…__search`, `…__docs`,
> `…__tokens`, `…__audit` return the same data over MCP and work **with the
> Storybook dev server down**. Use the **Storybook MCP** (`mcp__storybook__*`,
> only while `pnpm storybook` runs) for the _rendered_ view (previews, interaction +
> a11y tests); use **brand-ui MCP / CLI** for the _API_ (props, variants, tokens).
> When neither is available, fall back to the CLI commands or reading source.

## Principles

1. **Use an existing `@brand` component before writing markup.** `brand-ui search`
   first. There are 600+ exported components/parts across the packages.
2. **Compose, don't reinvent.** App shell = `SidebarProvider` + `Sidebar` +
   `SidebarInset`. Dashboard = `MetricGrid` + `DataTable`. Assistant = `ChatShell`
   - AI elements. Pipeline = `CanvasShell` + `FlowNode`/`FlowEdge`.
3. **Semantic tokens only.** `bg-background`, `text-muted-foreground`, `bg-primary`,
   `border-border`, `bg-card`. Never raw hex, `rgb()`, or `bg-[#…]`.
4. **Built-in variants before custom styles.** `variant="outline"`, `size="sm"`.

## Critical rules

Always enforced. Full detail with Incorrect/Correct pairs in
[reference/rules.md](reference/rules.md).

- **Semantic tokens, never raw color.** The only place raw colors live is the
  `@elabs-ai/components-tokens` theme stylesheet (`@elabs-ai/components-tokens/styles.css`). In app code use
  token-backed utilities. Run `brand-ui audit <path>` to catch violations.
- **`className` is for layout, not recoloring.** Don't override a component's
  colors or typography; use its variants/tokens.
- **`forwardRef` + `cn()` + spread `...props`** on any component you author or
  extend. Merge `className` last so callers can override layout.
- **Radix for interactive/overlay behavior.** Don't hand-roll focus traps,
  dismissal, or stacking — Dialog/Sheet/Popover/Dropdown handle it. No manual
  `z-index` on overlays.
- **Visible focus ring.** Every interactive element keeps
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
  Never `outline: none` without a replacement.
- **Theme-safe.** It must read correctly in every theme (light [default],
  dark). Rely on tokens, not `dark:`.
- **Spacing:** `flex`/`grid` + `gap-*`, not `space-x/space-y-*`. **Equal w/h:**
  `size-*`, not `w-N h-N`. **`cn()`** for conditional classes.
- **Accessibility:** real elements (`<button>`, `<a>`, `<input>`), labels on
  inputs (visible or `sr-only`), `aria-label` on icon-only controls,
  `aria-hidden` on decorative SVGs. Body text ≥ 4.5:1 in all themes.
- **`Avatar` needs `AvatarFallback`. Dialog/Sheet/Drawer need a Title** (use
  `sr-only` if visually hidden).

## Component selection

| Need                   | Use (package)                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action                 | `Button` variants (`@elabs-ai/components-ui`)                                                                                                                                                                                           |
| Form inputs            | `Input`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Textarea`, `InputOTP`, `Calendar`, `DatePicker`, `Form` (`@elabs-ai/components-ui`)                                                                       |
| Grouped input + addon  | `InputGroup` + `InputGroupInput`/`InputGroupTextarea` + `InputGroupAddon` (`@elabs-ai/components-ui`)                                                                                                                                   |
| 2–5 option toggle      | `ToggleGroup` (`@elabs-ai/components-ui`)                                                                                                                                                                                               |
| Data table             | `DataTable` + `SearchInput`/`FacetFilter`/`ColumnPicker` (`@elabs-ai/components-data`)                                                                                                                                                  |
| Display                | `Card`, `Badge`, `Avatar`, `Table`, `Progress`, `Skeleton` (`@elabs-ai/components-ui`)                                                                                                                                                  |
| Icons                  | **`lucide-react`** (default — generic UI glyphs) · `@elabs-ai/components-icons` (`Icon`/`createIcon`/`BrandLogo` — brand/product icons). No other icon set; see the brand-ui icons rule                                                 |
| Navigation             | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination` (`@elabs-ai/components-ui`)                                                                                                                                             |
| App shell              | `SidebarProvider`/`Sidebar`/`SidebarInset` + `sidebar-02/04/05` blocks                                                                                                                                                                  |
| Overlays               | `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `Popover`, `Tooltip`, `HoverCard`                                                                                                                                                           |
| Command palette        | `Command` inside `Dialog`                                                                                                                                                                                                               |
| Feedback               | `Alert`, `Sonner` toast, `EmptyState`, `ErrorState`, `LoadingState`, `Spinner`                                                                                                                                                          |
| AI / chat              | `ChatShell`, `Conversation`, `Message`, `PromptInput`, `Reasoning`, `Tool`, `Sources` (`@elabs-ai/components-ai`)                                                                                                                       |
| Flow canvas            | `CanvasShell`, `FlowNode`, `FlowEdge`, `ZoomControls`, `InspectorPanel` (`@elabs-ai/components-flow`)                                                                                                                                   |
| KPIs / charts          | `MetricCard`, `MetricGrid`, `ChartCard`, `ChartFrame` + 13 chart types (`@elabs-ai/components-charts`) — see Charts section below                                                                                                       |
| Marketing              | `Hero`, `FeatureGrid`, `StatsBand`, `CTASection`, `LogoStrip` (`@elabs-ai/components-marketing`)                                                                                                                                        |
| Code editor            | `CodeEditor`, `DiffEditor`, `CodeWorkspace` (`@elabs-ai/components-editor`; import `@elabs-ai/components-editor/monaco-environment` once)                                                                                               |
| Markdown authoring     | `MarkdownWorkspace`, `MarkdownEditor`, `MarkdownPreview`, `Timeline`, `MetricBlock` (`@elabs-ai/components-editor/markdown`); `parseFrontmatter`/`serializeFrontmatter` (`@elabs-ai/components-editor/markdown/frontmatter`, YAML only) |
| File / document viewer | `FileViewer` + `FileViewerProvider`/`FileViewerToolbar`/`FileViewerContent` (`@elabs-ai/components-viewer`) — images, text, JSON, CSV today; formats are added by registering an adapter                                                |

Confirm exact names with `brand-ui search`; the registry also has copy-own blocks
(`brand-ui search` shows `registry:*` items).

## Two consumption modes

1. **Import (stable primitives):** `import { Button, Card } from "@elabs-ai/components-ui"`.
   Once at the app root: `import "@elabs-ai/components-tokens/styles.css"` and wrap in
   `<ThemeProvider defaultTheme="light">`. React Flow consumers also
   `import "@xyflow/react/dist/style.css"`.
2. **Copy-own (prototype blocks):** `npx shadcn@latest add <registry-url>/<item>.json`.
   After adding, **read the files** and fix imports to the project's alias, verify
   composition against the Critical rules, and remove any raw colors.

## Theming

Themes are `data-theme` blocks; `ThemeProvider`/`useTheme` (from `@elabs-ai/components-tokens`)
set and persist the choice. Every visual decision is a token — to re-brand, change
token values, never hardcode in components. See [reference/theming.md](reference/theming.md).

## Workflow

1. **Context** — `brand-ui info` (once).
2. **Intent → playbook** (whole screens only) — before composing a full screen,
   run `brand-ui search <what you are building>` ("dashboard", "chatbot",
   "landing page", "admin console"). A matching **playbook** tells you which
   components, in which order, wired which way. Read
   `docs/playbooks/<archetype>.md`, start from its
   `docs/playbooks/templates/<archetype>.tsx`, and don't re-make the decisions it
   lists as already made. The same routing table is in the generated context file
   under _Playbooks (intent → archetype)_. Skip this step for a single component.
3. **Find** — `brand-ui search <need>`; prefer an existing component/block.
4. **API** — `brand-ui docs <Component>` (or read the source) for real props.
5. **Compose** — use compound components + variants + tokens.
6. **Verify** — `brand-ui audit <path>` (static), and for visual/contrast across
   themes use the **brand-ui-audit** skill.

## Rendering agent output (the @elabs-ai/components-ai contract)

`@elabs-ai/components-ai` renders **agent-produced** data; your app owns the model call (D5). When you
(or an agent) produce chat/GenUI output, emit one of the two **shipped** shapes below and
let the components render it — **there is no system prompt to copy**. Full routing lives in
`docs/DECISIONS.md` §D2 and the `ai-sdk-vs-a2ui` rule; the machine-readable version is
`brand-ui.manifest.json` (`agentOutput`); the live page is Storybook → _Docs/AI Output
Contract for Agents_. The contract below is generated from the manifest and stale-gated —
never hand-edit between the markers.

<!-- brand-ui:gen:agent-output:start -->

> **Generated** by `pnpm gen` from the CLI's agent-output module — edit there, not here. The `gen:check` gate fails on drift.

`@elabs-ai/components-ai` is a **presentation layer**: it renders a data model — your app owns the model calls (D5). There is **no system prompt to copy**; there are two shipped output shapes and a wiring pattern. Pick the path, emit the shape, let the components render it.

### Which path (D2)

| The agent is producing…                          | Emit         | Status                 |
| ------------------------------------------------ | ------------ | ---------------------- |
| A conversation (text, tools, reasoning, sources) | ai/UIMessage | shipped                |
| Ad-hoc UI as a JSX string                        | `JSXPreview` | shipped (escape hatch) |
| An agent-designed surface (UI as data)           | A2UI         | **not yet — WP-11**    |

_Mental model: AI SDK = what the agent **said**; A2UI = a screen the agent **designed**. A chat that shows messages is still "build-with" — don't reach for generative UI just because there's a chatbox._

### Path A · Conversation — the AI SDK UIMessage (the default)

Render what the agent SAID: a transcript of turns. The agent produces an AI SDK UIMessage; @elabs-ai/components-ai renders it. ~the default for any chat.

- **Authority:** Vercel AI SDK — import type only (D6). brand-ui does NOT redefine UIMessage/ToolUIPart; the SDK is authoritative for their shape.
- **brand-ui owns:** brand-ui owns ONLY the projection: the tool-state→Status mapping, the role narrowing, the fields its components consume, and SourceListItem.
- **Roles** (`Message from`): `user` · `assistant` · `system`
- **Rendered by:** `Conversation`, `Message`, `Tool`, `Reasoning`, `Sources`

| Part `type`  | Rendered by                                     | Notes                                                                                                        |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `text`       | `Message`, `MessageResponse`                    | Plain/markdown text; MessageResponse streams it (Streamdown).                                                |
| `reasoning`  | `Reasoning`, `ReasoningContent`                 | A reasoning string; pass isStreaming to auto-open + show a duration.                                         |
| `tool`       | `Tool`, `ToolHeader`, `ToolInput`, `ToolOutput` | A pre-rendered React-element `output` is deprecated — emit a JSON payload and render it with ToolResultCard. |
| `source-url` | `Sources`, `Source`, `SourceList`               | brand-ui-owned grounding item — not an SDK source part.                                                      |

A **tool part** is typed `tool-<name> | dynamic-tool` and carries `type`, `state`, `input`, `output`, `errorText`. Its `state` maps onto the closed `@elabs-ai/components-ui` `Status` enum:

| Tool `state`         | → `Status`          |
| -------------------- | ------------------- |
| `input-streaming`    | `pending`           |
| `input-available`    | `running`           |
| `approval-requested` | `awaiting-approval` |
| `approval-responded` | `running`           |
| `output-available`   | `complete`          |
| `output-denied`      | `denied`            |
| `output-error`       | `failed`            |

_A pre-rendered React-element `output` is deprecated — emit a JSON payload and render it with ToolResultCard._

The data the agent emits (a `UIMessage[]` — the AI SDK owns this shape):

```ts
const messages = [
  { id: "m1", role: "user", parts: [{ type: "text", text: "Weather in Berlin?" }] },
  {
    id: "m2",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "User wants current weather — call the tool." },
      {
        type: "tool-getWeather", // `tool-<name>`, or { type: "dynamic-tool", toolName }
        toolCallId: "call_1",
        state: "output-available", // 7-state machine → StatusBadge
        input: { city: "Berlin" },
        output: { tempC: 18, summary: "Partly cloudy" },
      },
      { type: "text", text: "It is 18°C and partly cloudy in Berlin." },
      {
        type: "source-url",
        sourceId: "s1",
        url: "https://example.com/berlin",
        title: "Berlin forecast",
      },
    ],
  },
];
```

Map each turn's parts onto the components (**in your app** — `@elabs-ai/components-ai` never calls the model):

```tsx
{
  messages.map((m) => (
    <Message key={m.id} from={m.role}>
      <MessageContent>
        {m.parts.map((part, i) => {
          if (part.type === "reasoning")
            return (
              <Reasoning key={i}>
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          if (part.type.startsWith("tool-"))
            return (
              <Tool key={i}>
                <ToolHeader type={part.type} state={part.state} />
                <ToolContent>
                  <ToolInput input={part.input} />
                  <ToolOutput output={part.output} errorText={part.errorText} />
                </ToolContent>
              </Tool>
            );
          if (part.type === "text") return <MessageResponse key={i}>{part.text}</MessageResponse>;
          return null;
        })}
      </MessageContent>
    </Message>
  ));
}
```

> Your app owns the runtime: useChat() (from `ai`, in YOUR app) produces messages: UIMessage[]; map each message's parts onto the components above. @elabs-ai/components-ai never calls the model.

### Path B · Ad-hoc JSX — JSXPreview (the escape hatch)

When the agent emits UI as a JSX markup STRING. Flexible but less safe — prefer A2UI once it ships (WP-11).

| Prop          | Type                                     |
| ------------- | ---------------------------------------- |
| `jsx`         | `string`                                 |
| `isStreaming` | `boolean?`                               |
| `components`  | `allow-list — Record<string, Component>` |
| `bindings`    | `record?`                                |
| `onError`     | `fn?`                                    |

- **Safety:** Renders ONLY tags present in the `components` allow-list you pass — the app decides what is renderable. Never widen it to arbitrary tags.
- **Streaming:** When isStreaming, partial tags auto-close (completeJsxTag) and a parse error falls back to the last good render — emit progressively; don't worry about closing every tag per chunk.

```tsx
// The agent emits a JSX markup STRING; you pass the allow-list.
const jsx = `<Stat label="Revenue" value="$1.2M" delta="+12%" />`;

<JSXPreview jsx={jsx} components={{ Stat }}>
  <JSXPreviewContent />
  <JSXPreviewError />
</JSXPreview>;
```

> Pass the agent's JSX string to `<JSXPreview jsx={…} components={allowList} />`. The allow-list is yours.

### A2UI — an agent-DESIGNED surface (NOT YET — WP-11)

> The SAFE generative-UI path: the agent describes a screen as data, validated against a catalog. NOT yet built. Until it ships, compose the surface yourself (Build-with) or use JSXPreview.

### Wire it into YOUR runtime

The app owns the model. `useChat()` (from `ai`, **in your app**) gives you `messages: UIMessage[]`; render them with Path A. To drive a tool-calling model, assemble your tool definitions / prompt fragments **in your app** from `brand-ui.manifest.json` (`agentOutput` + per-component `intent`) — brand-ui ships the machine-readable contract; your app composes the prompt. Any runtime that produces `UIMessage`-shaped data (or a JSX string) works — brand-ui is transport-agnostic.

### Don't

- Don't expect @elabs-ai/components-ai to call your model, stream, or manage transport — it renders the result; your app owns the runtime (D5).
- Don't paste a frozen system prompt from this contract — assemble tool defs / prompt fragments in YOUR app from the manifest + this block.
- Don't emit tags outside the JSXPreview `components` allow-list.
- Don't emit A2UI surfaces — not shipped (WP-11).
- Don't reach for JSXPreview/generative UI just because there's a chatbox — a chat that shows messages is still Build-with.
- Don't invent component props — verify via `brand-ui docs <Component>` or the Storybook MCP.

_Verify every component name/prop with `brand-ui docs <Component>` or the Storybook MCP — never guess._

<!-- brand-ui:gen:agent-output:end -->

## Charts (@elabs-ai/components-charts)

`@elabs-ai/components-charts` provides 13 composable chart containers, `ChartFrame` (an
expand/flip-to-table/download-CSV wrapper), and the KPI tile primitives
(`MetricCard`, `MetricGrid`, `ChartCard`). All visuals are token-driven —
series colors come from `--chart-1..5` so every chart is theme-safe without
any inline styles. The package depends only on `@elabs-ai/components-ui` and `@elabs-ai/components-tokens`;
it must NOT import from `@elabs-ai/components-data` (sibling dep rule).

### Which chart when

| Chart              | Use when                                                       |
| ------------------ | -------------------------------------------------------------- |
| `AreaChart`        | Trend over time with magnitude / filled area emphasis          |
| `LineChart`        | Trend or multi-series comparison over time                     |
| `BarChart`         | Categorical comparison; supports vertical, horizontal, stacked |
| `ScatterChart`     | Correlation between two continuous variables                   |
| `PieChart`         | Part-to-whole for a small number of categories                 |
| `RingChart`        | Part-to-whole with a center slot for a summary value           |
| `FunnelChart`      | Stage drop-off / conversion funnel                             |
| `RadarChart`       | Multivariate attribute comparison across categories            |
| `CandlestickChart` | OHLC financial / time-series open-high-low-close data          |
| `ComposedChart`    | Mixed bar columns + lines on a shared time scale               |
| `LiveLineChart`    | Streaming / real-time data updated at high frequency           |
| `ChoroplethChart`  | Geographic data mapped to regions (world/country polygons)     |
| `SankeyChart`      | Flow allocation between nodes (budget, traffic, energy)        |

### Composition pattern

Charts follow a provider-children model: the chart container owns a
`ChartProvider` internally; composition primitives (`Area`, `Line`, `Bar`, …)
are passed as children and read scale/data from context.

```tsx
// Verified against the @elabs-ai/components-charts area-chart example
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from "@elabs-ai/components-charts";
import { curveNatural } from "@visx/curve";

const data = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 80 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 140 },
];

<div className="h-72 w-full">
  <AreaChart data={data} style={{ height: "100%" }}>
    <Grid horizontal />
    <Area
      dataKey="desktop"
      curve={curveNatural}
      stroke="var(--chart-1)"
      fill="var(--chart-1)"
      fillOpacity={0.4}
    />
    <Area
      dataKey="mobile"
      curve={curveNatural}
      stroke="var(--chart-2)"
      fill="var(--chart-2)"
      fillOpacity={0.4}
    />
    <XAxis />
    <ChartTooltip />
  </AreaChart>
</div>;
```

Key composition primitives per chart family:

- **Area/Line/Composed** — `Area`, `Line`, `SeriesBar`, `XAxis`, `YAxis`, `Grid`, `ChartTooltip`
- **Bar** — `Bar`, `BarXAxis`, `BarYAxis`, `Grid`, `ChartTooltip`
- **Pie/Ring** — `PieSlice`/`Ring`, `PieCenter`/`RingCenter`, `ChartTooltip`
- **Scatter** — `Scatter`, `XAxis`, `YAxis`, `Grid`, `ChartTooltip`
- **Radar** — `RadarArea`, `RadarAxis`, `RadarGrid`, `RadarLabels`
- **Candlestick** — `Candlestick`, `XAxis`, `YAxis`, `Grid`, `ChartTooltip`
- **LiveLine** — `LiveLine`, `LiveXAxis`, `LiveYAxis`
- **Sankey** — `SankeyNode`, `SankeyLink`, `SankeyTooltip`
- **Choropleth** — `ChoroplethFeatureComponent`, `ChoroplethGraticule`, `ChoroplethTooltip`

### `useChart` hooks

Three hooks give composition primitives access to the chart's internal state.
**They throw when called outside a `ChartProvider`** — which means they throw
inside `ChartFrame` (ChartFrame renders above the chart's provider). Never
call them from a `ChartFrame` prop or a parent component; instead pass
`data`/`columns` as props directly to `ChartFrame`.

| Hook               | Re-renders on hover?   | Use for                                                         |
| ------------------ | ---------------------- | --------------------------------------------------------------- |
| `useChartStable()` | No                     | Axes, grids, fill primitives — cold consumers                   |
| `useChartHover()`  | Yes (every mouse move) | Tooltip, crosshair — hot consumers                              |
| `useChart()`       | Yes                    | Convenience: merged stable + hover; use only when you need both |

Return shape (selected fields from `ChartContextValue`):

```ts
const { data, xScale, yScale, width, height, tooltipData } = useChart();
// tooltipData: { point, index, x, yPositions } | null
```

### ChartFrame

`ChartFrame` wraps any chart child and adds three toolbar controls — expand
(full-screen modal), flip-to-table, and download CSV. Controls are hidden
automatically when `data` is absent or empty (feature degradation).

```tsx
import {
  ChartFrame,
  BarChart,
  Bar,
  BarXAxis,
  Grid,
  ChartTooltip,
} from "@elabs-ai/components-charts";

const data = [
  { month: "Jan", revenue: 12000 },
  { month: "Feb", revenue: 15500 },
];
const columns = [
  { key: "month", header: "Month" },
  { key: "revenue", header: "Revenue ($)" },
];

// Pass the SAME data to both ChartFrame and the chart — they can't share context.
<ChartFrame title="Revenue" description="Jan–Jun 2025" data={data} columns={columns}>
  <BarChart data={data} xDataKey="month">
    <Grid horizontal />
    <Bar dataKey="revenue" fill="var(--chart-1)" />
    <BarXAxis />
    <ChartTooltip />
  </BarChart>
</ChartFrame>;
```

Key props: `title`, `description`, `data`, `columns` (`{ key, header? }[]`),
`features` (`["expand","table","download"]` — default all), `height` (inline body
px, default 260), `detail` (right-pane content in the modal), `onDownload`
(custom CSV handler; default is a local RFC-4180 serializer), `renderTable`
(custom table renderer; default is `@elabs-ai/components-ui` `Table`).

### KPI tiles

**`MetricCard`** — compact KPI tile. Props: `label`, `value`, `description?`,
`delta?` (signed string, e.g. `"+12.4%"`), `deltaDirection?`
(`"up"|"down"|"neutral"`), `positiveIsGood?` (flip color for metrics where down
is good), `icon?`, `visual?` (inline slot for a sparkline or chart).

**`MetricGrid`** — responsive grid wrapper for a row of `MetricCard`s. Props:
`columns` (2|3|4, default 4), `reveal` (stagger-in animation, default false).

**`ChartCard`** — presentational Card shell for any chart child. Props: `title`,
`description?`, `actions?` (header-right slot for pickers/menus), `children`
(the chart), `height` (body px, default 260). Chart-library-agnostic — pass any
chart as children and use `--chart-1..5` tokens for series colors.

**Stat-card registry blocks** — copy-own compositions of a `MetricCard` +
embedded sparkline chart, for dashboards that need chart-backed KPI tiles:

```
npx shadcn@latest add <registry-url>/stat-card-area-01.json
npx shadcn@latest add <registry-url>/stat-card-line-01.json
npx shadcn@latest add <registry-url>/stat-card-choropleth-01.json
```

After adding, read the copied files and fix `@/…` aliases to your project path.

### Token surface

Series colors: `var(--chart-1)` through `var(--chart-5)` (five slots defined in
every theme). Supporting tokens: `--chart-label` (axis/legend text),
`--chart-grid` (grid lines), `--chart-background` (chart area), `--chart-foreground`,
`--chart-foreground-muted`, `--chart-crosshair`, `--chart-tooltip-background`.

Pass series colors as `stroke="var(--chart-1)"` / `fill="var(--chart-1)"` — never
raw hex. A monochrome theme renders chart series as a lightness ramp; use the
tokens and every theme renders correctly for free.

## References

- [reference/rules.md](reference/rules.md) — critical rules with Incorrect/Correct pairs.
- [reference/composition.md](reference/composition.md) — app shell, dashboard, chat, flow, forms patterns.
- [reference/theming.md](reference/theming.md) — tokens, ThemeProvider, themes, contrast.
