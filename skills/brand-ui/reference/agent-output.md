# Rendering agent output (the @elabs-ai/components-ai contract)

Load this when the task renders what an agent produces: chat messages, tool calls,
reasoning, sources, an agent-emitted JSX string or an A2UI surface. A screen you write
yourself does not need it.

## The contract

`@elabs-ai/components-ai` renders **agent-produced** data; your app owns the model call (D5). When you
(or an agent) produce chat/GenUI output, emit one of the three **shipped** shapes below and
let the components render it — **there is no system prompt to copy**. Full routing lives in
`docs/DECISIONS.md` §D2 and the `ai-sdk-vs-a2ui` rule; the machine-readable version is
`brand-ui.manifest.json` (`agentOutput`); the live page is Storybook → _Docs/AI Output
Contract for Agents_. The contract below is generated from the manifest and stale-gated —
never hand-edit between the markers.

<!-- brand-ui:gen:agent-output:start -->

> **Generated** by `pnpm gen` from the CLI's agent-output module — edit there, not here. The `gen:check` gate fails on drift.

`@elabs-ai/components-ai` is a **presentation layer**: it renders a data model — your app owns the model calls (D5). There is **no system prompt to copy**; there are two shipped output shapes and a wiring pattern. Pick the path, emit the shape, let the components render it.

### Which path (D2)

| The agent is producing…                          | Emit          | Status                             |
| ------------------------------------------------ | ------------- | ---------------------------------- |
| A conversation (text, tools, reasoning, sources) | ai/UIMessage  | shipped                            |
| Ad-hoc UI as a JSX string                        | `JSXPreview`  | shipped (escape hatch)             |
| An agent-designed surface (UI as data)           | `A2uiSurface` | shipped (the safe generative path) |

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

When the agent emits UI as a JSX markup STRING. Flexible but less safe — prefer A2UI (data, validated) for an agent-designed surface.

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

### Path C · A2UI — an agent-DESIGNED surface (data, validated against the catalog)

The SAFE generative-UI path: the agent describes a screen as JSON — a tree of catalog types with props, children and `on.<event>` action bindings — brand-ui validates it against the catalog and renders it with the real components. No code, no className, no style in a surface.

- **Protocol:** `{ "a2ui": "1", "title"?: string, "root": node } · node = string | { type, id?, props?, children?, on? }`

| Prop          | Type                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| `surface`     | `A2uiSurfaceSpec \| string (JSON text, may be a streaming prefix)`             |
| `catalog`     | `A2uiCatalog? — defaults to uiCatalog; extend with createA2uiCatalog`          |
| `onAction`    | `(action: { name, payload? }, context: { event, value?, node, path }) => void` |
| `isStreaming` | `boolean?`                                                                     |
| `loading`     | `boolean?`                                                                     |
| `onError`     | `(errors: A2uiError[]) => void`                                                |

- **Safety:** Only catalog types render; every prop is checked against the type's schema (unknown props, enum values, required props); className/style/code never pass. Actions are names the HOST resolves in onAction — a surface cannot call anything.
- **Streaming:** Pass the JSON text as it arrives with isStreaming: the surface completes the partial document, draws every node that already validates and prunes the rest; nothing errors until the input settles.
- **Tooling:**
  - `brand-ui a2ui catalog [<Type>]` — the types, props, enums and events you may emit
  - `brand-ui a2ui schema` — JSON Schema (draft 2020-12) for structured output
  - `brand-ui a2ui validate <file>` — every problem with its path; exit 1 when invalid
  - `brand-ui a2ui example` — a starter surface
  - MCP tool `a2ui` with `{ verb: catalog|schema|validate|example }` on the hosted server

```tsx
// The agent emits JSON naming catalog types (brand-ui a2ui catalog) and host actions.
const surface = {
  a2ui: "1",
  title: "Order 4711",
  root: {
    type: "Card",
    children: [
      { type: "CardHeader", children: [{ type: "CardTitle", children: ["Order 4711"] }] },
      {
        type: "CardContent",
        children: [
          {
            type: "Grid",
            props: { columns: 2 },
            children: [
              {
                type: "MetricCard",
                props: { label: "Total", value: 1240, valueFormat: "currency", currency: "EUR" },
              },
              { type: "StatusBadge", props: { status: "awaiting-approval" } },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Button",
            on: { click: { name: "approve", payload: { id: 4711 } } },
            children: ["Approve"],
          },
        ],
      },
    ],
  },
};

<A2uiSurface surface={surface} onAction={(action) => approve(action.payload)} />;
```

> Read the catalog (`brand-ui a2ui catalog` or the MCP `a2ui` tool), emit the surface as a tool result or message part, validate it (`brand-ui a2ui validate`), render with `<A2uiSurface surface={…} onAction={…} />`. Charts: merge CHARTS_A2UI_BINDINGS + CHARTS_A2UI_CATALOG_SCHEMA from @elabs-ai/components-charts with createA2uiCatalog (AutoChart, ChartCard, MetricGrid, Sparkline, BulletChart, Gauge); apps add their own types the same way (a KPI block, a domain card).

### Wire it into YOUR runtime

The app owns the model. `useChat()` (from `ai`, **in your app**) gives you `messages: UIMessage[]`; render them with Path A. To drive a tool-calling model, assemble your tool definitions / prompt fragments **in your app** from `brand-ui.manifest.json` (`agentOutput` + per-component `intent`) — brand-ui ships the machine-readable contract; your app composes the prompt. Any runtime that produces `UIMessage`-shaped data (or a JSX string) works — brand-ui is transport-agnostic.

### Don't

- Don't expect @elabs-ai/components-ai to call your model, stream, or manage transport — it renders the result; your app owns the runtime (D5).
- Don't paste a frozen system prompt from this contract — assemble tool defs / prompt fragments in YOUR app from the manifest + this block.
- Don't emit tags outside the JSXPreview `components` allow-list.
- Don't put className, style, JSX or code in an A2UI surface — it is data; a type or prop outside `brand-ui a2ui catalog` fails validation.
- Don't reach for JSXPreview/generative UI just because there's a chatbox — a chat that shows messages is still Build-with.
- Don't invent component props — verify via `brand-ui docs <Component>` or the Storybook MCP.

_Verify every component name/prop with `brand-ui docs <Component>` or the Storybook MCP — never guess._

<!-- brand-ui:gen:agent-output:end -->

## Agent-designed surfaces (A2UI)

When the agent must **design** a screen at runtime — an order card with actions, a KPI
row for the question just asked — it emits an A2UI surface: JSON, not code. Read the
catalog first, emit `{ "a2ui": "1", "root": … }` using only catalog types and props, bind
interaction as `on.<event>` → `{ name, payload }`, validate, and let `<A2uiSurface>`
(`@elabs-ai/components-ai`) render it. The host app receives every action in `onAction`
and decides what it means (D5). Never put `className`, `style` or code in a surface.

For an **analytics** surface — a question answered with numbers — compose from the charts
half of the catalog (`brand-ui a2ui catalog AutoChart` … `Gauge`; the app merges
`CHARTS_A2UI_BINDINGS` from `@elabs-ai/components-charts`): run `chart-for "<data shape>"`
before choosing an `AutoChart` `type`, put every chart in a `ChartCard` and state its
`source`, lead with ONE hero (a `MetricCard`/`MetricGrid` row or the app's KPI block) and
let the charts explain it, give KPI blocks facts (actual, target, prior year, weekly) and
never a delta you computed yourself, and end with the follow-up questions as `Button`s
(`on.click` → the host asks the next question). Storybook: _AI / A2UI Analytics_.

<!-- brand-ui:gen:a2ui:start -->

> **Generated** by `pnpm gen` from the CLI's a2ui module — edit there, not here.

| Command                                   | What it does                                                                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand-ui a2ui catalog [<Type>] [--json]` | Lists every type an agent may emit in a surface — props with enums and defaults, required props, events (`on.click` → the host action), whether it takes children — or the full entry for one type. |
| `brand-ui a2ui schema`                    | Prints the A2UI surface v1 JSON Schema (draft 2020-12; also published as `@elabs-ai/components-ai/a2ui/schema.json`) — feed it to a structured-output mode.                                         |
| `brand-ui a2ui validate <file> [--json]`  | Runs `validateA2uiSurface`: one `path code message` line per problem (unknown type/prop/event, enum value, missing required prop, children on a leaf); exit 1 when invalid.                         |
| `brand-ui a2ui example`                   | Prints a small valid surface (Card → Grid of MetricCards → Button with an `on.click` action) to start from.                                                                                         |

<!-- brand-ui:gen:a2ui:end -->
