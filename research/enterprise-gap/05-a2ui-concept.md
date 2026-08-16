# 05 · A2UI support concept for brand-ui

> Part of the **enterprise-gap** research pack. Deep-dive on **A2UI** (Google's agent-driven-UI
> protocol) and a concrete concept for how brand-ui can support it. Extends the generative-UI
> frontier flagged in [`02-ai-agentic-friendliness-research.md`](./02-ai-agentic-friendliness-research.md)
> (§C). Actioned as **WP-11** in [`working-packages/WP-11-a2ui-support/`](./working-packages/WP-11-a2ui-support/).
> Researched 2026-06-06 against a2ui.org (v0.8 stable / v0.9 draft).

## TL;DR

**A2UI is a strong fit for brand-ui, and `@qlik-coe-emea/qlabs-components-ai` is already its baseline — A2UI should be built
as enhanced functionality on `@qlik-coe-emea/qlabs-components-ai`, not a greenfield package, and adopted as phase-gated R&D,
not a core commitment.** A2UI's model is "agents send _declarative component descriptions_ referencing
a _client-controlled catalog_; the client renders them with its own native, themed widgets." brand-ui
— token-driven, themeable, accessible, React, with a generated manifest — is close to an ideal A2UI
_catalog + renderer_; and `@qlik-coe-emea/qlabs-components-ai` **already does a primitive version of this** via its
`JSXPreview` component (agent-emitted UI + a `components` allow-list + `bindings` + streaming). **A2UI
is the safe, declarative, standardized successor to `JSXPreview`** — so the renderer belongs _in_
`@qlik-coe-emea/qlabs-components-ai`, reusing its streaming/host machinery, and several existing `@qlik-coe-emea/qlabs-components-ai` blocks (`Artifact`,
`Tool`, `Message`, `Canvas`) gain A2UI rendering rather than being rebuilt (see §5). The work is
bounded (Google ships `@a2ui/web_core` so you don't reimplement the protocol) and slots into the
self-maintaining machinery (the **catalog is generated from the manifest**). Caveats: A2UI is **young
and moving** (v0.9 draft; the `theme` field is still `z.any()`), most brand-ui components are
**deliberately out of scope** (the catalog is a curated allow-list — exactly your instinct),
`@qlik-coe-emea/qlabs-components-ai`'s AI-SDK runtime vs A2UI's web_core/AG-UI path is a **real integration point**, and
supporting A2UI is **necessary but not sufficient**: it only pays off alongside an agent that emits
A2UI.

## 1. What A2UI actually is

A2UI ("Agent-to-UI") is an **open (Apache 2.0) streaming protocol for agent-driven interfaces**,
created by Google with CopilotKit and the community. It answers: _how can an AI agent safely send a
rich, interactive UI across a trust boundary?_ Instead of returning text, or executing
agent-generated code (unsafe), the agent emits **declarative JSON** describing components from a
**catalog the client controls**, and the client renders them with its own native widgets. "UI as
data, not code."

Four properties define it:

- **Secure by design.** Agents can only reference pre-approved components in the client's catalog —
  no arbitrary code, no UI-injection. Output is validated against the catalog (twice: agent-side
  pre-send, client-side on receipt).
- **LLM-friendly.** UIs are a **flat adjacency list** of components with ID references (not nested
  trees), so an LLM can stream and incrementally update them without emitting perfect nested JSON.
- **Framework-agnostic.** One agent response renders on Angular, Flutter, Lit, React, or native
  mobile — each client maps catalog types to its own widgets.
- **Progressive.** Components stream in and render as they arrive.

Versions: **v0.8 (stable)** and **v0.9 (current/draft)** — v0.9 adds `createSurface`, custom
catalogs, client-side functions, and a flatter component format. Status is genuinely early.

## 2. The architecture (and the surface brand-ui must implement)

The pieces, in A2UI's vocabulary:

- **Surface** — a cohesive UI (a form, dashboard, dialog, sidebar, chat panel). Created with
  `createSurface` (v0.9), bound to one **catalogId**.
- **Component** — `{ id, component: "Button", ...props }` (v0.9 flat form). Containers reference
  children by **ID** (`children: ["a","b"]`), not by nesting — the adjacency list.
- **Data model** — per-surface state. Component props are either **literals** or **data-bound**
  (`{ "path": "/user/name" }`); `updateDataModel` mutates it; dynamic lists render a template over a
  data array.
- **Catalog** — a **JSON Schema file** declaring the components (each component's props _as JSON
  Schema_), functions, and a theme schema available to the agent. `catalogId` is a **versioned URI**
  used as a stable identifier (it is _not_ fetched at runtime — both sides know it at build time).
  **This is the contract, and the curation point.**
- **Catalog negotiation** — the client advertises `supportedCatalogIds` in every message; the agent
  picks the best match and locks it for the surface's life.
- **Messages** — a JSONL stream: `createSurface` / `updateComponents` / `updateDataModel`
  (v0.9). **Actions** — a user interaction with an `action` produces a `userAction` payload (with
  resolved data context) sent back to the agent.
- **Transports** — A2A (Agent2Agent), **AG-UI** (CopilotKit; the React path), and **MCP** (A2UI over
  MCP / inside MCP Apps).
- **Renderer** — the client implementation. **Google ships `@a2ui/web_core`**, a framework-agnostic
  package providing the `MessageProcessor`, `SurfaceModel`, `DataModel`/`DataContext`,
  `ComponentModel` (adjacency-list → tree), TypeScript types + schema validation, and the v0.9
  expression parser. Per Google's own guide, a web renderer therefore only has to do **three
  things**:
  1. **Map A2UI component types → your framework's components** (`Button` → brand-ui `<Button>`),
  2. **Subscribe to `web_core` state and re-render**,
  3. **Forward user actions** back through the `MessageProcessor`.

  Building a renderer without `web_core` means reimplementing ~3,000 lines; with it, brand-ui's job
  shrinks to the mapping + theming layer. **This is why supporting A2UI is bounded work.**

## 3. Why brand-ui is an unusually good fit

A2UI's **styling philosophy maps onto brand-ui almost exactly**. A2UI is explicitly
_renderer-controlled styling_: "**agents describe _what_ to show; renderers decide _how_ it looks**."
Agents send **semantic hints** (`usageHint: "h1"`, `variant: "primary"`) and are explicitly
forbidden from sending visual properties (`fontSize`, `color` are documented as "Bad / not
supported"). Theming is the catalog/renderer's job; the web basic catalog themes via CSS variables,
supports dark mode, and the official best practices are literally "use design tokens" and "maintain
WCAG AA (4.5:1)."

That is brand-ui's entire model:

- brand-ui components are **semantic-token-driven** — so a renderer that maps A2UI types to brand-ui
  components gets **theming, dark mode, and all six themes for free**, because the components read
  tokens through `ThemeProvider`. The agent never sends a color (good for security _and_ brand
  consistency); brand-ui's tokens decide the look.
- A2UI's semantic hints (`primary`, `h1`, …) map directly onto brand-ui's **`cva` variants** — the
  variant system _is_ the semantic-hint target.
- A2UI's accessibility best practices (AA contrast, keyboard, light/dark) are already brand-ui
  quality gates (and the `brand-ui-audit` tooling enforces them).
- A2UI catalogs are JSON Schema describing component props — which is exactly what **WP-03's enriched
  manifest** produces. The catalog can be **generated from the manifest**, not hand-written.

In short: brand-ui is close to a reference example of what A2UI calls "define your own catalog that
mirrors your design system" — which the docs explicitly recommend over adapting the generic Basic
Catalog.

## 4. The component mapping — what's usable, what isn't

Your instinct is correct: **not all components are usable, and that's by design.** The catalog is a
curated allow-list. Three tiers:

### Tier 1 — direct adapters (ship first; clean fit)

Stateless, declarative, prop-driven components that map almost 1:1 to A2UI basic/extended types:

| A2UI type                           | brand-ui component                       | Notes                                                                   |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `Text`                              | `Label` / typography                     | `variant`/`usageHint` → text styles                                     |
| `Button`                            | `Button`                                 | A2UI `variant`/`primary` → `cva` variant; `action` → `onClick` dispatch |
| `Card`                              | `Card` (+ `CardHeader`/`CardContent`)    | single `child`                                                          |
| `Badge`                             | `Badge`                                  | leaf, non-breaking to add                                               |
| `Avatar`                            | `Avatar` (+ `AvatarFallback`)            |                                                                         |
| `Alert`                             | `Alert`                                  |                                                                         |
| `Divider`                           | `Separator`                              | `axis` → orientation                                                    |
| `Image`                             | image primitive                          | `fit`/`variant`                                                         |
| `Icon`                              | `@qlik-coe-emea/qlabs-components-icons`  | name → icon map (catalog declares the icon set)                         |
| `TextField`                         | `Input` / `Textarea`                     | `textFieldType` → type; `validationRegexp`                              |
| `CheckBox`                          | `Checkbox`                               | bound boolean                                                           |
| `Slider`                            | `Slider`                                 | min/max/value                                                           |
| `ChoicePicker` (v0.9)               | `Select` / `Combobox` / `RadioGroup`     | by `maxAllowedSelections`                                               |
| `Switch` (custom)                   | `Switch`                                 | extend catalog                                                          |
| `Tabs`                              | `Tabs`                                   | `tabItems`                                                              |
| `Modal`                             | `Dialog` / `Sheet`                       | `entryPointChild` + `contentChild`                                      |
| `Row` / `Column` / `List`           | flex/grid wrappers                       | `justify`/`align`/`weight`                                              |
| `Progress` / `Skeleton` / `Tooltip` | same                                     | leaves                                                                  |
| (state)                             | `EmptyState`/`ErrorState`/`LoadingState` | map to A2UI states                                                      |

### Tier 2 — custom catalog components (need a purpose-built A2UI component)

Complex/data-bound components that don't fit a generic type and ship as **custom catalog components**
(the pattern A2UI demonstrates with charts/maps in its "Rizzcharts" sample):

- **`DataTable`** (`@qlik-coe-emea/qlabs-components-data`) — a custom component bound to a `/rows` data array + a column
  schema. High value (dashboards/data apps), real work (sorting/filtering semantics over the data
  model).
- **Charts** (`@qlik-coe-emea/qlabs-components-charts` `ChartCard` + the WP-05 chart set) — a custom component, exactly A2UI's
  canonical "agent picks a chart to answer a numeric question" example.
- **`MetricCard` / `MetricGrid`** — custom KPI components.
- **`DateTimeInput`** → brand-ui `Calendar`/`DatePicker`.
- **`Breadcrumb` / `Pagination`** — map with light adaptation.

### Tier 3 — out of scope (do not expose to agents)

Imperative, stateful, ref-driven, or not "agent-runtime UI" — exposing these would be unsafe,
nonsensical, or unmappable to a declarative tree:

- **`@qlik-coe-emea/qlabs-components-editor`** (Monaco `CodeEditor`/`DiffEditor`/`CodeWorkspace`) — imperative, heavy,
  security-sensitive; not something an agent should declaratively assemble.
- **`@qlik-coe-emea/qlabs-components-flow`** (React Flow canvas) — an imperative graph with pan/zoom/selection state, not a
  declarative component tree. (If ever needed, it's a single opaque custom component, not a catalog
  of nodes.)
- **`Command` palette, `Carousel`, `Resizable`/`SplitPanel`, context menus, `Sonner`/toast** —
  imperative or interaction models that don't fit the declarative/streamed model.
- **`@qlik-coe-emea/qlabs-components-marketing`** — these are human-authored campaign surfaces, not agent-runtime UI (a
  separate catalog could exist, but it's not the use case).
- **`@qlik-coe-emea/qlabs-components-ai` is a special case — it is the _baseline_, not Tier-3.** It plays **three** roles, not
  "host only" (see §5.0): (1) it is the natural **home for the A2UI renderer** — its `JSXPreview`
  already renders agent-emitted UI with a `components` allow-list, `bindings`, and streaming, so A2UI
  is its safe, declarative successor; (2) it is the **host surface** — A2UI renders _inside_ a
  `Message`/`Artifact`/`Tool`, while `ChatShell`/`Conversation` stay app-side; (3) several of its
  blocks are themselves good **catalog components** for agent-output surfaces (`Tool`, `Artifact`,
  `Plan`, `Confirmation`, `Task`).

**Rule of thumb:** a component belongs in the catalog if it is (a) presentational/declarative, (b)
prop-driven with serializable props, (c) safe for an agent to assemble, and (d) themed by tokens. The
gate in WP-11/WP-10 encodes exactly this as an explicit `a2ui.exposed` opt-in per component.

## 5. The concept: A2UI rendering built into `@qlik-coe-emea/qlabs-components-ai` + a generated catalog

**Revised after a closer look at `@qlik-coe-emea/qlabs-components-ai` — it changes the home of this work.** Rather than a
greenfield `@qlik-coe-emea/qlabs-components-a2ui` package, the A2UI **renderer/host belongs in `@qlik-coe-emea/qlabs-components-ai`**: it already owns
the agent↔UI boundary, streaming, the AI-SDK runtime wiring, and (via `JSXPreview`)
agent-emitted-UI rendering. The work becomes three parts: a generated **catalog** (the emittable
widget vocabulary, drawn mostly from `@qlik-coe-emea/qlabs-components-ui`), a **renderer in `@qlik-coe-emea/qlabs-components-ai`** (a safe, declarative
sibling to `JSXPreview`), and **adapters** mapping catalog types to brand-ui components. (The
catalog + adapter code can live under `@qlik-coe-emea/qlabs-components-ai/a2ui` as a sub-path export; only spin out a separate
`@qlik-coe-emea/qlabs-components-a2ui` if you need A2UI rendering without the chat stack — most consumers won't.)

### 5.0 `@qlik-coe-emea/qlabs-components-ai` is the baseline — `JSXPreview` is the proof

`@qlik-coe-emea/qlabs-components-ai` already ships **`JSXPreview`**: it takes an agent-emitted `jsx` string, a **`components`
allow-list**, **`bindings`** (data), streaming auto-completion of partial tags, and last-good-render
error fallback. That is a home-grown, primitive generative-UI engine whose parts map almost 1:1 onto
A2UI:

| `JSXPreview` (today)                            | A2UI (the standard)                                             |
| ----------------------------------------------- | --------------------------------------------------------------- |
| agent-emitted **JSX string**, parsed at runtime | agent-emitted **declarative JSON**, validated against a catalog |
| `components` prop (manual allow-list)           | **catalog** (generated allow-list + prop schemas)               |
| `bindings` prop                                 | **data model** + data binding (`{path}`)                        |
| `completeJsxTag` streaming auto-close           | **progressive rendering**                                       |
| `onError` / last-good fallback                  | **graceful degradation** + `VALIDATION_FAILED` reporting        |

The one thing `JSXPreview` does that A2UI deliberately _doesn't_: it renders agent **markup strings**
(via `react-jsx-parser`) — the "UI as code" path A2UI replaces with "UI as data validated against a
catalog." So **A2UI is the safe, standardized, interactive evolution of `JSXPreview`.** The renderer
should sit right next to it, reuse its streaming/error host pattern, and `JSXPreview`'s `components`
map _is_ the renderer side of the catalog — the same adapter set feeds both. Existing blocks
(`Artifact`, `Tool`, `Message`/`MessageResponse`, `Canvas`/`Node`/`Edge`, `schema-display`) are the
containers that **gain A2UI rendering** — enhanced, not replaced. This is the "enhanced functionality
on components we already have" path, and it's cheaper and more coherent than a greenfield package.

### (a) The brand-ui catalog — generated, not authored

A versioned `catalog.json` (JSON Schema conforming to the A2UI Catalog schema) exposing the Tier-1/2
components with their props, semantic-hint enums (from `cva` variants), and a theme schema.
**Generated from the WP-03 enriched manifest** + a per-component `a2ui` opt-in in the component
`meta` (WP-03 issue-02), e.g.:

```jsonc
// in a component's meta
"a2ui": {
  "exposed": true,
  "a2uiType": "Button",
  "propsMap": { "variant": "variant", "child": "children", "action": "onClick" }
}
```

`catalogId`: a stable URI like `https://<brand>/a2ui/brand-ui/v1/catalog.json`. Because it's
generated, adding/flagging a component updates the catalog automatically — and a **CI stale-gate**
(WP-10) fails if the committed catalog drifts from the manifest. No hand-maintained allow-list.

### (b) The React renderer — in `@qlik-coe-emea/qlabs-components-ai`, thin over `@a2ui/web_core`

`@qlik-coe-emea/qlabs-components-ai` adds `<A2uiSurface>` / `useA2ui` (a **declarative sibling to `JSXPreview`**) that:

- uses `web_core`'s `MessageProcessor` + `SurfaceModel` for the protocol/state/validation (don't
  reimplement — `JSXPreview` shows the host pattern, but A2UI's engine is `web_core`),
- maps each catalog type → a brand-ui **adapter** component,
- renders inside the app's existing `ThemeProvider` (so A2UI surfaces inherit the active theme),
- **mounts inside `@qlik-coe-emea/qlabs-components-ai`'s `Message` / `Artifact` / `Tool` output** (it _is_ the agent's response),
- resolves data bindings and **forwards `userAction`s** to the agent runtime,
- implements **graceful degradation** (unknown component → safe fallback, never crash) and
  **catalog negotiation** (advertises `supportedCatalogIds`).

**Runtime nuance (be honest):** `@qlik-coe-emea/qlabs-components-ai` is built on the **Vercel AI SDK / AI Elements** stack
(`ai` peer dep, Streamdown), while A2UI's reference React renderer uses **`@a2ui/web_core` + AG-UI**
transport. They coexist cleanly — `web_core` is transport-agnostic, so you feed it the A2UI message
stream however it arrives (the AI-SDK data stream, AG-UI, A2A, or MCP) and mount the result in an
AI-Elements `Message`. Reconciling the two streaming models is the integration point to validate in
the Phase-0 spike.

### (c) Adapters — per-component mapping

Small co-located functions translating A2UI semantic props → brand-ui props, e.g.
`Button{variant:"primary", action}` → `<Button variant="default" onClick={dispatch(action)}>`. Each
adapter ships with a contract test that renders it from sample A2UI JSON in all six themes (examples
-as-tests).

```
A2UI JSON (agent) ──stream──►  @a2ui/web_core (protocol / state / validation)
                                     │  resolved component tree + data
                                     ▼
   @qlik-coe-emea/qlabs-components-ai <A2uiSurface>  ──►  adapters  ──►  @qlik-coe-emea/qlabs-components-ui components  ──►  ThemeProvider (tokens)
   (sibling to JSXPreview,                                         rendered, themed, accessible UI
    mounted in Message / Artifact / Tool)
        ▲
   userAction ──► forwarded to the agent runtime (AI-SDK stream / AG-UI / A2A / MCP)
```

## 6. How it wires into the self-maintaining repo (enforcement over reminders)

Per your standing requirement, A2UI support must not become another manual inventory:

- **Catalog generated from the manifest** + the `a2ui.exposed` opt-in → adding/flagging a component
  regenerates the catalog. (Extends WP-03 manifest + WP-10 generators.)
- **Gates (WP-10 pattern):** CI fails if (1) the committed catalog is stale vs the manifest; (2) a
  component flagged `a2ui.exposed` lacks an adapter or an A2UI render test; (3) the catalog doesn't
  pass A2UI JSON-Schema validation; (4) an adapter's contract test fails in any of the six themes.
- **Skill/CLI wiring:** `brand-ui` CLI gains `brand-ui a2ui-catalog` (generate/validate); the
  `brand-ui` skill learns that the A2UI catalog exists and how an agent targets it.

So "expose a component to A2UI" becomes a one-line `meta` flag + an adapter, and everything else
(catalog entry, validation, tests, docs) is generated and gated.

## 7. Phasing

- **Phase 0 — spike (de-risk the moving target).** A throwaway POC (in `apps/playground`, next to
  `@qlik-coe-emea/qlabs-components-ai`'s `JSXPreview`): render the A2UI Basic Catalog with ~6 brand-ui components
  (Text/Button/Card/Input/Row/Column) via `web_core` + the official React renderer, themed. Confirms
  the model, exposes version churn, and validates the AI-SDK ↔ web_core streaming integration before
  committing.
- **Phase 1 — catalog + renderer MVP in `@qlik-coe-emea/qlabs-components-ai`.** The generated brand-ui v0.9 catalog (Tier-1
  components), the `<A2uiSurface>` renderer added to **`@qlik-coe-emea/qlabs-components-ai`** (sibling to `JSXPreview`,
  mountable in `Message`/`Artifact`/`Tool`), data binding + actions, graceful degradation, six-theme
  stories/tests, and one AG-UI transport demo wired to a sample agent in the playground.
- **Phase 2 — custom components.** `DataTable`, charts, `MetricGrid`, `DateTimeInput` as custom
  catalog components.
- **Phase 3 — productionize.** Catalog versioning + negotiation + validation/error reporting; the
  agent-side catalog publication; MCP-Apps interop; docs.

## 8. Risks & honest caveats

- **A2UI is young and moving.** v0.8 stable, **v0.9 is draft**; the `theme` property is literally
  `z.any()` today (open issue #1118), and basic-catalog components "are not wired to use the agent
  theme" yet. Building now means tracking a moving spec. **Mitigation:** keep the A2UI renderer in a
  contained module of `@qlik-coe-emea/qlabs-components-ai` (e.g. `@qlik-coe-emea/qlabs-components-ai/a2ui`), pin to `web_core`'s v0.9, keep it off the
  core's critical path, treat as phase-gated R&D.
- **Adoption is unproven.** Google-led with CopilotKit/AG-UI backing and MCP-Apps interop — credible,
  but not yet a safe-bet standard. **Don't** refactor core brand-ui for it.
- **Library support is necessary but not sufficient.** A2UI only pays off with an **agent that emits
  A2UI**. The library provides the catalog + renderer; the agent runtime (ADK/AG-UI/A2A) is a
  separate, app-owned dependency. Scope expectations accordingly.
- **Most components are out of scope** (Tier 3). That's correct, not a gap — but it means A2UI support
  covers a _subset_ of brand-ui, and the value concentrates in forms/dashboards/data/chat surfaces.
- **Effort is bounded but real.** `web_core` removes the protocol burden, but adapters, the catalog
  generator, data-binding/action wiring, custom components, and cross-theme tests are genuine work
  (estimate: Phase 0 small; Phase 1 medium; Phase 2 medium-large).

## 9. Recommendation

**Build it on `@qlik-coe-emea/qlabs-components-ai`, and only after the foundation.** A2UI is the right generative-UI standard
to bet on (security model, LLM-friendly, framework-agnostic, real backing), and brand-ui is genuinely
well-positioned to be a high-quality catalog/renderer thanks to its token-driven, accessible, React
architecture — and `@qlik-coe-emea/qlabs-components-ai` is already the baseline (`JSXPreview` is the existing primitive). So
build A2UI rendering as **enhanced functionality inside `@qlik-coe-emea/qlabs-components-ai`** (a contained `@qlik-coe-emea/qlabs-components-ai/a2ui`
module, sibling to `JSXPreview`), not a greenfield package — reusing its streaming/host machinery and
upgrading `Artifact`/`Tool`/`Message` to render A2UI surfaces. But it sits **after** the NOW/NEXT
foundation: it depends on the **enriched manifest (WP-03)** to generate the catalog and on the
**self-maintaining machinery (WP-10)** to keep it honest, and it shouldn't compete with
CI/coverage/tokens for priority. Sequence it as **LATER, phase-gated** work (**WP-11**), starting with
a Phase-0 spike to measure the moving-target risk (and the AI-SDK ↔ web_core streaming integration)
before committing to Phase 1.

---

_Sources:_ [a2ui.org](https://a2ui.org/) ·
[What is A2UI](https://a2ui.org/introduction/what-is-a2ui/) ·
[Concepts: Components & Structure](https://a2ui.org/concepts/components/) ·
[Concepts: Catalogs](https://a2ui.org/concepts/catalogs/) ·
[Guide: Renderer Development (web_core)](https://a2ui.org/guides/renderer-development/) ·
[Guide: Theming & Styling](https://a2ui.org/guides/theming/) ·
[Reference: Component Gallery](https://a2ui.org/reference/components/) ·
[Use A2UI with any agent framework (AG-UI)](https://a2ui.org/guides/a2ui-with-any-agent-framework/) ·
[GitHub: a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) ·
[Google Developers Blog: Introducing A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/) ·
[A2UI v0.9 announcement](https://developers.googleblog.com/a2ui-v0-9-generative-ui/) ·
[CopilotKit: build with A2UI + AG-UI](https://www.copilotkit.ai/blog/build-with-googles-new-a2ui-spec-agent-user-interfaces-with-a2ui-ag-ui)
