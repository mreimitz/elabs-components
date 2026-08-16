/**
 * @qlik-coe-emea/qlabs-components-cli — the AGENT OUTPUT CONTRACT (how an agent structures output so the
 * `@qlik-coe-emea/qlabs-components-ai` GenUI components render it). The "emit this shape" sidecar.
 *
 * The GAP this fills: `@qlik-coe-emea/qlabs-components-ai` ships ~chat/GenUI components that render
 * AGENT-PRODUCED data, but nothing told an agent WHAT SHAPE to emit. This is the
 * machine-readable contract, folded into the manifest under `agentOutput` and
 * rendered into the `brand-ui` skill + a Storybook page + the `@qlik-coe-emea/qlabs-components-ai` llms
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
 *   - A2UI is NOT shipped (WP-11) — it is documented ONLY as a future path,
 *     never as a usable surface.
 *
 * GATE (the teeth — `agent-output:check`, `scripts/check-agent-output.mjs`):
 *   `stateToStatus` and `statusEnum` below are AUTHORED here but VERIFIED against
 *   source (`statusFromToolState` in packages/ai/src/tool.tsx + `STATUSES` in
 *   packages/ui/.../status-badge.tsx). A divergence FAILS CI — so this contract
 *   cannot silently drift from the components it documents.
 */

/**
 * The tool-state → Status projection brand-ui OWNS (statusFromToolState,
 * packages/ai/src/tool.tsx). Authored here so it ships in the manifest; the
 * `agent-output:check` gate asserts it equals the real switch (drift = CI fail).
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
 * The closed `@qlik-coe-emea/qlabs-components-ui` Status enum (STATUSES, status-badge.tsx) a tool part
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
 * `agent-output:check` gate asserts this example contains no `useChat(` so the
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

/**
 * The agent-output contract, in `docs/DECISIONS.md` §D2 order: the two SHIPPED
 * paths first, then the WP-11 future path. Deterministic (authored order, no
 * timestamps) so the manifest stays byte-stable.
 */
export const AGENT_OUTPUT = {
  paths: {
    conversation: {
      status: "shipped",
      title: "Conversation — the AI SDK UIMessage (the default)",
      summary:
        "Render what the agent SAID: a transcript of turns. The agent produces an AI SDK UIMessage; @qlik-coe-emea/qlabs-components-ai renders it. ~the default for any chat.",
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
        "Your app owns the runtime: useChat() (from `ai`, in YOUR app) produces messages: UIMessage[]; map each message's parts onto the components above. @qlik-coe-emea/qlabs-components-ai never calls the model.",
    },
    jsxPreview: {
      status: "shipped",
      title: "Ad-hoc JSX — JSXPreview (the escape hatch)",
      summary:
        "When the agent emits UI as a JSX markup STRING. Flexible but less safe — prefer A2UI once it ships (WP-11).",
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
      status: "not-shipped",
      title: "A2UI — an agent-DESIGNED surface (NOT YET — WP-11)",
      available: false,
      tracking: "WP-11",
      summary:
        "The SAFE generative-UI path: the agent describes a screen as data, validated against a catalog. NOT yet built. Until it ships, compose the surface yourself (Build-with) or use JSXPreview.",
    },
  },
  /** What an agent must NOT do — rendered as the DON'T list. */
  donts: [
    "Don't expect @qlik-coe-emea/qlabs-components-ai to call your model, stream, or manage transport — it renders the result; your app owns the runtime (D5).",
    "Don't paste a frozen system prompt from this contract — assemble tool defs / prompt fragments in YOUR app from the manifest + this block.",
    "Don't emit tags outside the JSXPreview `components` allow-list.",
    "Don't emit A2UI surfaces — not shipped (WP-11).",
    "Don't reach for JSXPreview/generative UI just because there's a chatbox — a chat that shows messages is still Build-with.",
    "Don't invent component props — verify via `brand-ui docs <Component>` or the Storybook MCP.",
  ],
};

/**
 * The structured `agentOutput` block folded into the manifest (parallels
 * `collectIntent`). Returns the authored contract verbatim — it is cross-cutting
 * (spans @qlik-coe-emea/qlabs-components-ai's two surfaces + @qlik-coe-emea/qlabs-components-ui's Status), so unlike `collectIntent`
 * it is NOT filtered per package. Deterministic: authored key order, no clock.
 * Name accuracy (`consumedBy` ∈ @qlik-coe-emea/qlabs-components-ai, the state/status maps) is enforced by
 * the `agent-output:check` gate, not by mutating the manifest here.
 * @returns {typeof AGENT_OUTPUT}
 */
export function collectAgentOutput() {
  return AGENT_OUTPUT;
}
