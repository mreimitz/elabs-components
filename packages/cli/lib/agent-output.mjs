/**
 * @elabs-ai/components-cli — the AGENT OUTPUT CONTRACT (how an agent structures output so the
 * `@elabs-ai/components-ai` GenUI components render it). The "emit this shape" sidecar.
 *
 * The GAP this fills: `@elabs-ai/components-ai` ships ~chat/GenUI components that render
 * AGENT-PRODUCED data, but nothing told an agent WHAT SHAPE to emit. This is the
 * machine-readable contract, folded into the manifest under `agentOutput` and
 * rendered into the `brand-ui` skill + a Storybook page + the `@elabs-ai/components-ai` llms
 * spoke (one source → every surface, stale-gated).
 *
 * IT IS PATH-KEYED, NOT COMPONENT-KEYED (the D2 axis — `docs/DECISIONS.md` §D2):
 * an agent doesn't pick 58 components, it emits ONE of two shipped data shapes
 * and brand-ui renders it. The complement to `intent.mjs` (which is per-component,
 * BUILD-WITH metadata) — different audience (the model emitting data vs. the dev
 * composing JSX), different axis (data contract vs. composition rules).
 *
 * SCOPE GUARDRAILS (D5/ADR-0007 + D6/ADR-0008 — do NOT regress):
 *   - brand-ui is a PRESENTATION LAYER. This describes shapes; the consuming app
 *     owns the model call / transport / runtime. No `useChat`/`streamText` here.
 *   - The `ai` SDK is the AUTHORITY for `UIMessage`/`ToolUIPart`. This block does
 *     NOT redefine the SDK schema — it points at it and encodes only the
 *     brand-ui-OWNED projection: the tool-state→Status mapping, the role
 *     narrowing, the fields our components consume, and `SourceListItem`.
 *   - A2UI (the third path, shipped) is DATA, never code: a surface names catalog
 *     types and host actions; `<A2uiSurface>` validates and renders, the app
 *     resolves actions. `brand-ui a2ui catalog|schema|validate` are its tooling.
 *
 * `stateToStatus` and `statusEnum` below are AUTHORED here and must match
 *   source (`statusFromToolState` in packages/ai/src/tool.tsx + `STATUSES` in
 *   packages/ui/.../status-badge.tsx).
 */

/**
 * The tool-state → Status projection brand-ui OWNS (statusFromToolState,
 * packages/ai/src/tool.tsx). Authored here so it ships in the manifest; the
 * `agent-output-contract` rule (`pnpm check`) asserts it equals the real switch (drift = CI fail).
 * @type {Record<string, string>}
 */
export const TOOL_STATE_TO_STATUS = {
  "input-streaming": "pending",
  "input-available": "running",
  "approval-requested": "awaiting-approval",
  "approval-responded": "running",
  "output-available": "complete",
  "output-denied": "denied",
  "output-error": "failed",
};

/**
 * The closed `@elabs-ai/components-ui` Status enum (STATUSES, status-badge.tsx) a tool part
 * maps onto. Authored here; gate-verified against source (drift = CI fail).
 * @type {string[]}
 */
export const STATUS_ENUM = [
  "pending",
  "running",
  "complete",
  "awaiting-approval",
  "denied",
  "failed",
  "skipped",
];

/**
 * A worked `UIMessage[]` literal — the DATA an agent produces (NOT a `useChat`
 * call: the agent emits data, the app owns the runtime). Field names beyond the
 * brand-ui-consumed subset belong to the AI SDK (the authority). The
 * `agent-output-contract` rule (`pnpm check`) asserts this example contains no `useChat(` so the
 * D6 boundary stays honest.
 */
const CONVERSATION_EXAMPLE = [
  "const messages = [",
  '  { id: "m1", role: "user", parts: [{ type: "text", text: "Weather in Berlin?" }] },',
  "  {",
  '    id: "m2",',
  '    role: "assistant",',
  "    parts: [",
  '      { type: "reasoning", text: "User wants current weather — call the tool." },',
  "      {",
  '        type: "tool-getWeather",        // `tool-<name>`, or { type: "dynamic-tool", toolName }',
  '        toolCallId: "call_1",',
  '        state: "output-available",      // 7-state machine → StatusBadge',
  '        input: { city: "Berlin" },',
  '        output: { tempC: 18, summary: "Partly cloudy" },',
  "      },",
  '      { type: "text", text: "It is 18°C and partly cloudy in Berlin." },',
  '      { type: "source-url", sourceId: "s1", url: "https://example.com/berlin", title: "Berlin forecast" },',
  "    ],",
  "  },",
  "];",
].join("\n");

/** A worked `JSXPreview` example: a JSX STRING + the allow-list that gates it. */
const JSX_PREVIEW_EXAMPLE = [
  "// The agent emits a JSX markup STRING; you pass the allow-list.",
  'const jsx = `<Stat label="Revenue" value="$1.2M" delta="+12%" />`;',
  "",
  "<JSXPreview jsx={jsx} components={{ Stat }}>",
  "  <JSXPreviewContent />",
  "  <JSXPreviewError />",
  "</JSXPreview>;",
].join("\n");

/** A worked A2UI example: the DATA an agent emits for an agent-designed surface. */
const A2UI_EXAMPLE = [
  "// The agent emits JSON naming catalog types (brand-ui a2ui catalog) and host actions.",
  "const surface = {",
  '  a2ui: "1",',
  '  title: "Order 4711",',
  "  root: {",
  '    type: "Card",',
  "    children: [",
  '      { type: "CardHeader", children: [{ type: "CardTitle", children: ["Order 4711"] }] },',
  "      {",
  '        type: "CardContent",',
  "        children: [{",
  '          type: "Grid", props: { columns: 2 },',
  "          children: [",
  '            { type: "MetricCard", props: { label: "Total", value: 1240, valueFormat: "currency", currency: "EUR" } },',
  '            { type: "StatusBadge", props: { status: "awaiting-approval" } },',
  "          ],",
  "        }],",
  "      },",
  "      {",
  '        type: "CardFooter",',
  '        children: [{ type: "Button", on: { click: { name: "approve", payload: { id: 4711 } } }, children: ["Approve"] }],',
  "      },",
  "    ],",
  "  },",
  "};",
  "",
  "<A2uiSurface surface={surface} onAction={(action) => approve(action.payload)} />;",
].join("\n");

/**
 * The agent-output contract, in `docs/DECISIONS.md` §D2 order: the default
 * conversation path, the escape hatch, then the A2UI surface path. Deterministic (authored order, no
 * timestamps) so the manifest stays byte-stable.
 */
export const AGENT_OUTPUT = {
  paths: {
    conversation: {
      status: "shipped",
      title: "Conversation — the AI SDK UIMessage (the default)",
      summary:
        "Render what the agent SAID: a transcript of turns. The agent produces an AI SDK UIMessage; @elabs-ai/components-ai renders it. ~the default for any chat.",
      model: "ai/UIMessage",
      modelAuthority:
        "Vercel AI SDK — import type only (D6). brand-ui does NOT redefine UIMessage/ToolUIPart; the SDK is authoritative for their shape.",
      owns: "brand-ui owns ONLY the projection: the tool-state→Status mapping, the role narrowing, the fields its components consume, and SourceListItem.",
      consumedBy: ["Conversation", "Message", "Tool", "Reasoning", "Sources"],
      roles: ["user", "assistant", "system"],
      parts: [
        {
          kind: "text",
          consumedBy: ["Message", "MessageResponse"],
          note: "Plain/markdown text; MessageResponse streams it (Streamdown).",
        },
        {
          kind: "reasoning",
          consumedBy: ["Reasoning", "ReasoningContent"],
          note: "A reasoning string; pass isStreaming to auto-open + show a duration.",
        },
        {
          kind: "tool",
          typePattern: "tool-<name> | dynamic-tool",
          consumedBy: ["Tool", "ToolHeader", "ToolInput", "ToolOutput"],
          consumesFields: ["type", "state", "input", "output", "errorText"],
          stateToStatus: TOOL_STATE_TO_STATUS,
          statusEnum: STATUS_ENUM,
          note: "A pre-rendered React-element `output` is deprecated — emit a JSON payload and render it with ToolResultCard.",
        },
        {
          kind: "source-url",
          consumedBy: ["Sources", "Source", "SourceList"],
          ownedType: "SourceListItem",
          itemShape: { href: "string", title: "string?" },
          note: "brand-ui-owned grounding item — not an SDK source part.",
        },
      ],
      example: CONVERSATION_EXAMPLE,
      wiring:
        "Your app owns the runtime: useChat() (from `ai`, in YOUR app) produces messages: UIMessage[]; map each message's parts onto the components above. @elabs-ai/components-ai never calls the model.",
    },
    jsxPreview: {
      status: "shipped",
      title: "Ad-hoc JSX — JSXPreview (the escape hatch)",
      summary:
        "When the agent emits UI as a JSX markup STRING. Flexible but less safe — prefer A2UI (data, validated) for an agent-designed surface.",
      component: "JSXPreview",
      props: {
        jsx: "string",
        isStreaming: "boolean?",
        components: "allow-list — Record<string, Component>",
        bindings: "record?",
        onError: "fn?",
      },
      streaming:
        "When isStreaming, partial tags auto-close (completeJsxTag) and a parse error falls back to the last good render — emit progressively; don't worry about closing every tag per chunk.",
      safety:
        "Renders ONLY tags present in the `components` allow-list you pass — the app decides what is renderable. Never widen it to arbitrary tags.",
      example: JSX_PREVIEW_EXAMPLE,
      wiring:
        "Pass the agent's JSX string to `<JSXPreview jsx={…} components={allowList} />`. The allow-list is yours.",
    },
    a2ui: {
      status: "shipped",
      title: "A2UI — an agent-DESIGNED surface (data, validated against the catalog)",
      available: true,
      summary:
        "The SAFE generative-UI path: the agent describes a screen as JSON — a tree of catalog types with props, children and `on.<event>` action bindings — brand-ui validates it against the catalog and renders it with the real components. No code, no className, no style in a surface.",
      component: "A2uiSurface",
      protocol:
        '{ "a2ui": "1", "title"?: string, "root": node } · node = string | { type, id?, props?, children?, on? }',
      props: {
        surface: "A2uiSurfaceSpec | string (JSON text, may be a streaming prefix)",
        catalog: "A2uiCatalog? — defaults to uiCatalog; extend with createA2uiCatalog",
        onAction: "(action: { name, payload? }, context: { event, value?, node, path }) => void",
        isStreaming: "boolean?",
        loading: "boolean?",
        onError: "(errors: A2uiError[]) => void",
      },
      tooling: [
        "`brand-ui a2ui catalog [<Type>]` — the types, props, enums and events you may emit",
        "`brand-ui a2ui schema` — JSON Schema (draft 2020-12) for structured output",
        "`brand-ui a2ui validate <file>` — every problem with its path; exit 1 when invalid",
        "`brand-ui a2ui example` — a starter surface",
        "MCP tool `a2ui` with `{ verb: catalog|schema|validate|example }` on the hosted server",
      ],
      streaming:
        "Pass the JSON text as it arrives with isStreaming: the surface completes the partial document, draws every node that already validates and prunes the rest; nothing errors until the input settles.",
      safety:
        "Only catalog types render; every prop is checked against the type's schema (unknown props, enum values, required props); className/style/code never pass. Actions are names the HOST resolves in onAction — a surface cannot call anything.",
      example: A2UI_EXAMPLE,
      wiring:
        "Read the catalog (`brand-ui a2ui catalog` or the MCP `a2ui` tool), emit the surface as a tool result or message part, validate it (`brand-ui a2ui validate`), render with `<A2uiSurface surface={…} onAction={…} />`. Apps add their own types with createA2uiCatalog (a chart, a domain card).",
    },
  },
  /** What an agent must NOT do — rendered as the DON'T list. */
  donts: [
    "Don't expect @elabs-ai/components-ai to call your model, stream, or manage transport — it renders the result; your app owns the runtime (D5).",
    "Don't paste a frozen system prompt from this contract — assemble tool defs / prompt fragments in YOUR app from the manifest + this block.",
    "Don't emit tags outside the JSXPreview `components` allow-list.",
    "Don't put className, style, JSX or code in an A2UI surface — it is data; a type or prop outside `brand-ui a2ui catalog` fails validation.",
    "Don't reach for JSXPreview/generative UI just because there's a chatbox — a chat that shows messages is still Build-with.",
    "Don't invent component props — verify via `brand-ui docs <Component>` or the Storybook MCP.",
  ],
};

/**
 * The structured `agentOutput` block folded into the manifest (parallels
 * `collectIntent`). Returns the authored contract verbatim — it is cross-cutting
 * (spans @elabs-ai/components-ai's two surfaces + @elabs-ai/components-ui's Status), so unlike `collectIntent`
 * it is NOT filtered per package. Deterministic: authored key order, no clock.
 * Name accuracy (`consumedBy` ∈ @elabs-ai/components-ai, the state/status maps) is enforced by
 * the `agent-output-contract` rule (`pnpm check`), not by mutating the manifest here.
 * @returns {typeof AGENT_OUTPUT}
 */
export function collectAgentOutput() {
  return AGENT_OUTPUT;
}
