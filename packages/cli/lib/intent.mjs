/**
 * @elabs-ai/components-cli — per-component intent metadata (WP-03 #80).
 *
 * The agent-distinctive layer that prop tables and types CANNOT encode: a
 * component's PURPOSE, its RELATIONSHIPS (what it lives inside / next to),
 * its STATE→TOKEN mapping, and its ANTI-PATTERNS. Types tell an agent what's
 * *possible*; this tells it what's *correct* and *wrong*.
 *
 * SOURCE OF TRUTH: this is an **authored sidecar map**, deliberately seeded from
 * the existing prose design rules so the judgment already written down becomes
 * machine-readable and queryable per component:
 *   - skills/brand-ui-audit/reference/anti-patterns.md  (the anti-pattern catalog)
 *   - skills/brand-ui/SKILL.md                          (the component-selection table)
 *   - .claude/rules/*                                   (tokens-only, a11y, interaction)
 *
 * WHY a single authored file (not scattered `*.meta.json`):
 *   - Deterministic: one ordered map → byte-stable manifest output.
 *   - The CLI folds it in without crawling every package's source tree.
 *   - Coverage is intentionally INCREMENTAL — start with the highest-traffic
 *     components; an absent component degrades gracefully (no meta, no error).
 *
 * SCHEMA — `IntentMeta` (every field optional; keys folded in sorted order):
 *   {
 *     purpose:       string            // one-line "what it is for"
 *     category:      string            // action | input | overlay | layout | data |
 *                                      //   feedback | navigation | display | ai | chart | flow
 *     relationships: {
 *       usedInside?: string[]          // components this typically renders inside
 *       contains?:   string[]          // child parts/components it composes
 *       pairsWith?:  string[]          // siblings it is commonly used with
 *       avoidNextTo?:string[]          // what NOT to place beside it
 *     }
 *     stateTokens:   Record<string,string>   // interaction state → token/class
 *     antiPatterns:  string[]          // machine-readable "don't do this" rules
 *   }
 *
 * The manifest generator folds this in under each package's `intent` map (keyed
 * by component name); `brand-ui docs <Component>` prints it beside the prop table.
 */

/** @typedef {{
 *   purpose?: string,
 *   category?: string,
 *   relationships?: { usedInside?: string[], contains?: string[], pairsWith?: string[], avoidNextTo?: string[] },
 *   stateTokens?: Record<string, string>,
 *   antiPatterns?: string[],
 * }} IntentMeta */

/**
 * Authored intent metadata, keyed by component name (PascalCase, matching the
 * manifest export name). Start with the highest-traffic components per #80; this
 * map grows incrementally and never blocks generation when a component is absent.
 * @type {Record<string, IntentMeta>}
 */
export const INTENT = {
  Button: {
    purpose: "Primary action trigger — the canonical way to invoke an action.",
    category: "action",
    relationships: {
      usedInside: ["Form", "Dialog", "Card", "AlertDialog", "Toolbar"],
      pairsWith: ["Spinner"],
      avoidNextTo: ["another primary Button"],
    },
    stateTokens: {
      hover: "bg-primary/90 (variant default)",
      focus: "ring-2 ring-ring",
      disabled: "opacity-50 pointer-events-none",
    },
    antiPatterns: [
      "Two primary Buttons in the same action group — demote one to secondary/outline.",
      'Button used for navigation — use a link instead (asChild + <a>, or the variant="link").',
      "destructive variant for an irreversible action with no confirm step — wrap in AlertDialog.",
      "Icon-only Button without an aria-label — the control has no accessible name.",
    ],
  },

  Dialog: {
    purpose: "Modal overlay for focused tasks/flows that block the page until dismissed.",
    category: "overlay",
    relationships: {
      contains: [
        "DialogContent",
        "DialogHeader",
        "DialogTitle",
        "DialogDescription",
        "DialogFooter",
      ],
      pairsWith: ["Button", "Form"],
    },
    stateTokens: {
      overlay:
        "DialogOverlay: bg-foreground/50 + backdrop-blur-sm (a semantic token — never a raw black)",
      surface:
        "DialogContent: bg-card text-card-foreground + shadow-ring-lg (ADR 0020 — a floating surface bakes its hairline into the shadow; it carries NO border)",
      focus: "ring-2 ring-ring (the close button)",
    },
    antiPatterns: [
      "Dialog without a DialogTitle — screen readers announce no name (use sr-only if visually hidden).",
      "Nesting a Dialog inside a Dialog — use a single flow or a Sheet/Drawer for the secondary surface.",
      "Confirming a destructive action in a plain Dialog — use AlertDialog (it traps focus on the safe action).",
    ],
  },

  AlertDialog: {
    purpose:
      "Confirmation overlay for destructive / irreversible actions — friction proportional to consequence.",
    category: "overlay",
    relationships: {
      contains: [
        "AlertDialogContent",
        "AlertDialogTitle",
        "AlertDialogAction",
        "AlertDialogCancel",
      ],
      pairsWith: ["Button"],
    },
    stateTokens: {
      overlay: "AlertDialogOverlay: bg-foreground/50 + backdrop-blur-sm",
      surface:
        "AlertDialogContent: bg-card text-card-foreground + shadow-ring-lg (ADR 0020 — the hairline is the shadow's last layer, so there is no border)",
      focus: "ring-2 ring-ring — inherited: Action/Cancel are buttonVariants",
    },
    antiPatterns: [
      "Firing the destructive action immediately on click — require the AlertDialog confirm (or an undo window).",
      "Making the destructive action the default-focused button — focus the Cancel/safe action first.",
    ],
  },

  Input: {
    purpose: "Single-line text field — the base form input.",
    category: "input",
    relationships: {
      usedInside: ["Form", "FormItem"],
      pairsWith: ["Label", "FormMessage"],
    },
    stateTokens: {
      rest: "border-input + bg-background (the subtle form-field hairline, ADR 0010)",
      focus: "ring-2 ring-ring + ring-offset-1 ring-offset-background (the border does NOT change)",
      disabled: "opacity-50 cursor-not-allowed + bg-muted",
      invalid: "border-destructive + ring-destructive (aria-invalid)",
    },
    antiPatterns: [
      "Input without an associated Label (visible or sr-only) — it has no accessible name.",
      "Blocking paste (onPaste + preventDefault) — never block paste.",
      "Wrong type/inputmode — use type=email/tel/url/number + inputmode so mobile keyboards + validation match.",
      "Missing autocomplete + a meaningful name on a real form field.",
    ],
  },

  Select: {
    purpose: "Single-choice dropdown from a known set of options.",
    category: "input",
    relationships: {
      usedInside: ["Form", "FormItem", "EditorToolbar"],
      contains: ["SelectTrigger", "SelectContent", "SelectItem"],
      pairsWith: ["Label"],
    },
    stateTokens: { focus: "ring-2 ring-ring", disabled: "opacity-50" },
    antiPatterns: [
      "Using Select for free-form or searchable values — use Combobox when the user may type/search.",
      "Select without a Label — no accessible name.",
    ],
  },

  Combobox: {
    purpose:
      "Searchable single/multi select — Select with typeahead over a large or async option set.",
    category: "input",
    relationships: { usedInside: ["Form"], pairsWith: ["Label"] },
    stateTokens: {
      focus: "ring-2 ring-ring — inherited: the trigger is a Button",
      highlighted:
        "data-[selected=true]:bg-accent + text-accent-foreground — inherited from CommandItem",
    },
    antiPatterns: [
      "Using Combobox for a tiny fixed option set — a plain Select is simpler and lighter.",
      "Restyling the trigger/panel by hand — Combobox is a Popover + Command assembly; style through those parts.",
    ],
  },

  Checkbox: {
    purpose: "Binary on/off toggle within a form (multi-select within a group).",
    category: "input",
    relationships: { usedInside: ["Form"], pairsWith: ["Label"] },
    stateTokens: { checked: "bg-primary text-primary-foreground", focus: "ring-2 ring-ring" },
    antiPatterns: [
      "Checkbox and its Label not sharing one hit target — clicking the label must toggle the box (no dead zone).",
      "Using a Checkbox for mutually-exclusive choices — use RadioGroup.",
    ],
  },

  RadioGroup: {
    purpose: "Mutually-exclusive single choice from a small visible set.",
    category: "input",
    relationships: { usedInside: ["Form"], contains: ["RadioGroupItem"], pairsWith: ["Label"] },
    stateTokens: {
      rest: "border-input (the subtle form-field hairline)",
      checked:
        "data-[state=checked]:border-primary + a fill-primary indicator dot (the item is NOT filled)",
      focus: "ring-2 ring-ring",
    },
    antiPatterns: [
      "Using a RadioGroup for many options — use Select/Combobox past ~7 options.",
      "RadioGroup items without labels sharing a hit target.",
    ],
  },

  Switch: {
    purpose: "Immediate on/off setting toggle (applies on change, not on submit).",
    category: "input",
    relationships: { pairsWith: ["Label"] },
    stateTokens: { checked: "bg-primary", focus: "ring-2 ring-ring" },
    antiPatterns: [
      "Switch that needs a separate Save to apply — use a Checkbox in a form instead; a Switch should apply immediately.",
    ],
  },

  Form: {
    purpose: "Validated form scaffold (Field/Label/Control/Message) wiring inputs to a schema.",
    category: "input",
    relationships: {
      contains: ["FormField", "FormItem", "FormLabel", "FormControl", "FormMessage"],
      pairsWith: ["Button", "Input", "Select"],
    },
    stateTokens: { invalid: "text-destructive (FormMessage)" },
    antiPatterns: [
      "Disabling submit until valid — keep submit enabled until the request starts, then show a spinner.",
      "Errors not rendered inline next to the field; not focusing the first error on submit.",
      "Warning the user before navigating away from unsaved changes is missing.",
    ],
  },

  Card: {
    purpose: "Surface grouping related content into a bordered, padded block.",
    category: "layout",
    relationships: {
      contains: ["CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"],
    },
    stateTokens: { background: "bg-card text-card-foreground", border: "border-border" },
    antiPatterns: [
      "Card inside a Card (nested cards) — flatten; cards are not a generic wrapper.",
      "Card-for-everything — use a Card only when a bordered surface is the right affordance.",
      "Identical icon-tile-above-heading Card grids repeated endlessly — vary structure.",
    ],
  },

  Badge: {
    purpose: "Compact status/label chip (status, count, category).",
    category: "display",
    relationships: { usedInside: ["DataTable", "Card", "SidebarMenuItem"] },
    stateTokens: {},
    antiPatterns: [
      "Using a Badge as a clickable control — use a Button (Badge is not interactive).",
      "Encoding status by color alone — pair the color with text/icon for non-color users.",
    ],
  },

  Tabs: {
    purpose: "Switch between peer views in the same context without navigating away.",
    category: "navigation",
    relationships: { contains: ["TabsList", "TabsTrigger", "TabsContent"] },
    stateTokens: {
      list: "TabsList: bg-muted text-muted-foreground",
      active: "data-[state=active]: bg-surface-elevated text-foreground shadow-sm",
      focus: "ring-2 ring-ring + ring-offset-2 ring-offset-background",
    },
    antiPatterns: [
      "Tabs for sequential steps — use a stepper/wizard; tabs are for peer, non-sequential views.",
      "More than ~7 tabs — consider a Select or a sidebar nav.",
    ],
  },

  Tooltip: {
    purpose: "Transient hover/focus hint with supplementary (non-essential) text.",
    category: "overlay",
    relationships: { usedInside: ["TooltipProvider"], pairsWith: ["Button"] },
    stateTokens: {},
    antiPatterns: [
      "Putting essential information ONLY in a Tooltip — it is unreachable on touch and transient; keep critical content visible.",
      "Tooltip on a non-focusable element — it won't show on keyboard focus.",
    ],
  },

  Sheet: {
    purpose: "Edge-anchored panel (left/right/top/bottom) for secondary flows beside the page.",
    category: "overlay",
    relationships: {
      contains: ["SheetContent", "SheetHeader", "SheetTitle"],
      pairsWith: ["Button"],
    },
    stateTokens: {
      overlay:
        "SheetOverlay: bg-foreground/50 + backdrop-blur-sm (a semantic token — never a raw black)",
      surface:
        "SheetContent: bg-card text-card-foreground + shadow-ring-lg, plus the anchored edge only (border-t / border-b / border-l / border-r per side)",
      focus: "ring-2 ring-ring (the close button)",
    },
    antiPatterns: [
      "Sheet without a SheetTitle — no accessible name.",
      "Scroll chaining to the page behind it — set overscroll-behavior: contain.",
    ],
  },

  Popover: {
    purpose: "Anchored, dismissible floating panel for lightweight contextual content.",
    category: "overlay",
    relationships: { contains: ["PopoverTrigger", "PopoverContent"] },
    stateTokens: {
      surface:
        "PopoverContent: bg-popover text-popover-foreground + shadow-ring-md (ADR 0020 — no border; the ring rung carries the edge)",
      focus: "PopoverContent is outline-none — the focus ring belongs to the trigger you supply",
    },
    antiPatterns: [
      "Reimplementing dismissal/positioning by hand — let the Radix Popover own focus + outside-click.",
      "Expecting PopoverContent to render its own focus ring — it is outline-none by design; the trigger carries the ring.",
    ],
  },

  Toolbar: {
    purpose:
      "A dense row of controls that acts on nearby content, collapsed into ONE tab stop with arrow-key navigation between the controls.",
    category: "action",
    relationships: {
      contains: ["ToolbarButton", "ToolbarSeparator", "ToolbarToggleGroup", "ToolbarToggleItem"],
      pairsWith: ["Button", "Toggle", "Tooltip"],
      avoidNextTo: ["ViewToolbar"],
    },
    // No `stateTokens` while the deprecated `Toolbar` alias still ships from
    // @elabs-ai/components-ai: two modules export the name, so a
    // class-level claim cannot be pinned to one of them and would be checked
    // against the wrong file. Add them when the alias is removed.
    antiPatterns: [
      "Using it for the ordinary control row above a list or table — that is ViewToolbar, where every control is its own tab stop.",
      "Omitting aria-label — a toolbar is one tab stop, so an unnamed one announces nothing about what it acts on.",
      "Putting a text input or a link inside it — the roving tabindex swallows the arrow keys those controls need.",
      "Reaching for it to attach actions to a canvas node — that is NodeToolbar in @elabs-ai/components-ai.",
    ],
  },

  AppShell: {
    purpose: "Top-level application frame — sidebar + header + content region.",
    category: "layout",
    relationships: {
      contains: ["Sidebar", "SidebarInset"],
      pairsWith: ["MetricGrid", "DataTable"],
    },
    stateTokens: {
      frame: "AppShell itself is bg-background text-foreground (the content canvas)",
      chrome:
        "bg-sidebar — owned by the composed Sidebar, and it must stay RECESSED below the canvas (L(--background) − L(--sidebar) ≥ 0.02, `pnpm surface-elevation:check`)",
    },
    antiPatterns: [
      "Deep wrapper nesting inside the shell — keep the DOM shallow; one element, one job.",
      "Painting the shell's chrome recess in the component — the chrome→canvas hierarchy is a THEME property; fix --sidebar's lightness, not AppShell.",
    ],
  },

  DataTable: {
    purpose:
      "TanStack-backed data grid with sorting, filtering, pagination and a render-prop toolbar.",
    category: "data",
    relationships: {
      pairsWith: ["SearchInput", "FacetFilter", "ColumnPicker", "Badge"],
      usedInside: ["AppShell", "Card"],
    },
    stateTokens: {
      rowHover:
        "hover:bg-foreground/10 (a foreground-tint wash, so it beats the zebra stripe in the same direction on light AND dark)",
      rowSelected: "data-[state=selected]:bg-accent",
      header:
        "bg-surface-muted when sticky, else bg-surface-muted/60 + border-b border-border-strong (the header bottom is the SOLE cue between header and first row → the strong rung, #173)",
      rowDivider:
        "zebra={false}: border-b border-border-strong last:border-b-0; zebra rows use bg-foreground/5 instead (the stripe replaces the divider)",
    },
    antiPatterns: [
      "Forking table state into the toolbar — pass the table instance via toolbar={(table) => …}; don't duplicate sorting/filter state.",
      "Hand-rolling virtualization for >50 rows — the DataTable owns it.",
      "Status cells as raw colored text — render a Badge so it reads in every theme.",
      "Decorating a dense table with callouts/hatch — decoration density goes DOWN as information density goes UP.",
    ],
  },

  SearchInput: {
    purpose: "Controlled search box that drives a DataTable's global filter.",
    category: "data",
    relationships: { pairsWith: ["DataTable"] },
    stateTokens: { focus: "ring-2 ring-ring" },
    antiPatterns: [
      "Keeping uncontrolled internal state — SearchInput is controlled (value + onChange); reflect filter state into the table.",
    ],
  },

  ChatShell: {
    purpose: "Assistant/chat application frame composing the conversation + composer surfaces.",
    category: "ai",
    relationships: { contains: ["Conversation", "PromptInput", "Message"] },
    stateTokens: {},
    antiPatterns: [
      "Calling a model inside the component — @elabs-ai/components-ai is presentational/runtime-agnostic; wire useChat in the app.",
      "Hand-rolling the composer footer inside the shell — compose Composer; it is the shipped chat input.",
      "Putting an animated/collapsible context rail in ChatShell.aside — the aside is for a STATIC rail; compose ContextPanelProvider + ContextPanel as a SIBLING of the shell.",
    ],
  },

  Conversation: {
    purpose: "Auto-stick-to-bottom chat transcript region.",
    category: "ai",
    relationships: {
      contains: [
        "ConversationContent",
        "ConversationEmptyState",
        "ConversationScrollButton",
        "Message",
      ],
    },
    stateTokens: {},
    antiPatterns: [
      "Giving Conversation no sized flex parent — it needs a bounded, flex parent to stick to bottom.",
      "Rendering [] with no ConversationEmptyState — every list needs a real empty state.",
      "Driving scroll position by hand — Conversation owns stick-to-bottom; ConversationScrollButton is the escape hatch.",
    ],
  },

  PromptInput: {
    purpose: "Chat composer FORM (Enter submits) emitting a message to the app's runtime.",
    category: "ai",
    relationships: {
      contains: [
        "PromptInputBody",
        "PromptInputTextarea",
        "PromptInputFooter",
        "PromptInputSubmit",
      ],
    },
    stateTokens: { submit: "status=ready|submitted|streaming|error" },
    antiPatterns: [
      "Treating PromptInput as a controlled textarea — it is a form; use onSubmit, not value/onChange plumbing.",
      "Submitting model calls from the component — emit the message; the app owns transport.",
      "Passing children to PromptInputSubmit for every status — the Stop affordance goes invisible while generating; pass it for the resting state only.",
      "Expecting className to land on the visible well — className styles the outer <form>; use surfaceClassName to reach the well.",
    ],
  },

  MessageResponse: {
    purpose: "Renders streamed assistant markdown (Streamdown) inside a Message.",
    category: "ai",
    relationships: { usedInside: ["Message", "MessageContent"] },
    stateTokens: {},
    antiPatterns: [
      'External links without target="_blank" rel="noopener noreferrer".',
      "Using MessageResponse for arbitrary nodes — it renders streamed MARKDOWN; put non-markdown children in MessageContent.",
      "Surfacing a parse error on half-arrived markdown — an unclosed fence is not an error; let the stream settle first.",
    ],
  },

  CanvasShell: {
    purpose: "Branded React Flow canvas wrapper with token-driven background + sane defaults.",
    category: "flow",
    relationships: {
      contains: ["ZoomControls", "Legend"],
      pairsWith: ["FlowNode", "FlowEdge", "InspectorPanel"],
    },
    stateTokens: { background: "--canvas / --canvas-grid" },
    antiPatterns: [
      "Hardcoding node/edge colors — use the flow-node/flow-edge tokens so the canvas matches the theme.",
      "Hiding the React Flow attribution without the appropriate license.",
      "Forgetting to import @xyflow/react/dist/style.css once in the consuming app.",
    ],
  },

  FlowNode: {
    purpose: "Branded custom React Flow node (title/subtitle/kind/icon/tone).",
    category: "flow",
    relationships: { usedInside: ["CanvasShell"] },
    stateTokens: { selected: "ring-2 ring-ring" },
    antiPatterns: ["Raw colors on the node — use flow-node tokens."],
  },

  MetricCard: {
    purpose: "Single KPI tile — label, value, delta/trend.",
    category: "chart",
    relationships: { usedInside: ["MetricGrid", "Card"] },
    stateTokens: { value: "tabular-nums" },
    antiPatterns: [
      "Numbers without tabular-nums — figures jitter across a row; use tabular-nums for any number column.",
      "Encoding up/down by color alone — pair with an arrow/sign.",
      "Re-declaring a KPI tile in another package — MetricCard is owned by @elabs-ai/components-ui; charts and editor re-export it (ADR 0012).",
    ],
  },

  ChartFrame: {
    purpose:
      "Opt-in chart wrapper adding expand / flip-to-table / download-CSV to any chart child.",
    category: "chart",
    relationships: { contains: ["ChartCard"], pairsWith: ["MetricGrid"] },
    stateTokens: {},
    antiPatterns: [
      "Expecting ChartFrame to read the chart's context — it is the PARENT of the chart's provider; pass the same data to both via props.",
      "Importing @elabs-ai/components-data into a chart — charts → ui only; flip-to-table uses the @elabs-ai/components-ui Table.",
      "Expecting the table/download controls with no `data` — they hide by design when data is absent or empty; pass the same rows you gave the chart.",
    ],
  },

  CodeEditor: {
    purpose: "Monaco-backed editable code editor (controlled/uncontrolled), themed from tokens.",
    category: "display",
    relationships: { usedInside: ["CodeWorkspace"], pairsWith: ["EditorToolbar", "DiffEditor"] },
    stateTokens: {},
    antiPatterns: [
      "Passing Monaco a hardcoded theme — the bridge reads the active data-theme tokens; never override it.",
      "Using CodeEditor for read-only display — use CodeBlock (@elabs-ai/components-ai, Shiki) for non-editable code.",
      'Forgetting the worker setup (import "@elabs-ai/components-editor/monaco-environment") — IntelliSense is off without it.',
    ],
  },

  // ── @elabs-ai/components-viewer — read a file the app did not write ──
  // Sourced from .claude/rules/viewer-components.md and docs/ADR/0024-viewer-package.md.

  FileViewer: {
    purpose:
      "Render a file the app did not write (upload, signed URL, agent output) — detects the format, loads the matching adapter on demand, draws it with brand-ui components.",
    category: "display",
    relationships: {
      contains: ["FileViewerToolbar", "FileViewerContent"],
      pairsWith: ["FileViewerProvider", "FileViewerSkeleton", "FileViewerError", "FileViewerEmpty"],
    },
    stateTokens: {
      frame: "bg-card + border-border + shadow-sm — a resting raised surface, not a float",
      "toolbar divider":
        "border-border-strong — the sole structural cue between toolbar and content (same fill, no elevation change), so the WCAG 1.4.11 strong rung",
    },
    antiPatterns: [
      "Adding a per-format branch to FileViewerContent — a format is an adapter registration (registry.register), never a switch in the shell.",
      "Making a parser a plain dependency — every parser engine is an OPTIONAL peer, so a consumer who skips it gets the panel naming the package instead of a build error.",
      "Returning HTML from an adapter — adapters emit a DATA model that brand-ui components render; that is the only reason an arbitrary file inherits the theme.",
      "Using FileViewer to edit — it is read-only; authoring code is CodeEditor (@elabs-ai/components-editor).",
      "Clearing an error with the `loading` prop — a parent's loading is additive; it can add the not-ready state but never hide a real failure.",
    ],
  },

  // ── @elabs-ai/components-ai — the complex agent/chat surfaces ────
  // Sourced from .claude/rules/ai-chat-components.md, .claude/rules/loading-states.md
  // and docs/DECISIONS.md D2/D5 (render the model's output; never own the model call).

  Message: {
    purpose:
      "One conversation turn — `from` decides the side, fill and slot; wraps the turn's content.",
    category: "ai",
    relationships: {
      usedInside: ["ConversationContent"],
      contains: ["MessageContent", "MessageAvatar", "MessageResponse", "MessageActions"],
      pairsWith: ["UserMessage", "AgentMessage", "Tool", "Reasoning", "Sources"],
    },
    stateTokens: {
      user: "group-[.is-user]:bg-chat-user + text-chat-user-foreground (via the `is-user` marker class)",
      assistant:
        'NO fill — the assistant branch is only group-[.is-assistant]:text-foreground; its separation is AgentMessage emphasis="answer" → border-s-4 border-s-primary ps-4',
    },
    antiPatterns: [
      "Hand-rolling a bubble div — Message already encodes the user/assistant fork (side, fill, data-slot).",
      'Adding a bg-card fill to the assistant turn — the assistant branch is deliberately unfilled; reach for AgentMessage emphasis="answer" (a left rail), not a redundant surface.',
      "Deleting the `is-user` marker class in favour of the data-slot — the `group-[.is-user]:` selectors compile against the class; the attribute is its twin, not a replacement.",
      "Rendering raw model markdown in MessageContent — use MessageResponse so streamed markdown, code and links render safely.",
      "Calling a model inside the component — @elabs-ai/components-ai is presentational; the app owns useChat/transport (D5).",
    ],
  },

  Tool: {
    purpose:
      "Renders one AI SDK ToolUIPart — header (type + state), the input, and the output or error.",
    category: "ai",
    relationships: {
      usedInside: ["Message", "GroupedParts"],
      contains: ["ToolHeader", "ToolContent", "ToolInput", "ToolOutput"],
      pairsWith: ["Reasoning", "Task"],
    },
    stateTokens: {
      state: 'ToolHeader state="input-streaming|input-available|output-available|output-error"',
    },
    antiPatterns: [
      "Rendering a tool call as plain text — use Tool so the state, input and output stay legible and collapsible.",
      "Showing ToolOutput errorText while the call is still streaming — errors fire only on a terminal, settled failure.",
      "Executing the tool inside the component — Tool renders the part; the app's runtime runs the tool (D5).",
      "Dumping raw JSON into ToolOutput with no empty state — a tool that returned nothing still needs a rendered result.",
    ],
  },

  Reasoning: {
    purpose:
      "Collapsible 'thinking' disclosure that auto-opens while the model streams and reports elapsed duration.",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      contains: ["ReasoningTrigger", "ReasoningContent"],
      pairsWith: ["Shimmer", "ChainOfThought", "Tool"],
    },
    stateTokens: { streaming: "isStreaming → auto-open + optional Shimmer affordance" },
    antiPatterns: [
      "Leaving Reasoning permanently expanded — it is a disclosure; collapse it once the answer lands.",
      "Passing an array of strings to ReasoningContent expecting markdown — only a single string is parsed as markdown; any other node renders as-is.",
      "Surfacing a parse error on half-streamed reasoning — suppress transient errors while isStreaming.",
    ],
  },

  Composer: {
    purpose:
      "The standard chat input — a PromptInput pre-assembled with attachments, tools and submit.",
    category: "ai",
    relationships: {
      usedInside: ["ChatShell"],
      contains: ["PromptInput", "PromptInputTextarea", "PromptInputTools", "PromptInputSubmit"],
      pairsWith: ["Conversation", "ModelSelector"],
    },
    stateTokens: { submit: "status=ready|submitted|streaming|error" },
    antiPatterns: [
      "Hand-rolling a PromptInput footer per app — Composer is the shipped assembly; reach for it first.",
      "Passing children to PromptInputSubmit for every status — the Stop affordance goes invisible while generating; pass it for the resting state only.",
      "Treating the composer as a controlled textarea — it is a form; use onSubmit, not value/onChange plumbing.",
      "Reaching for surfaceClassName on Composer — it has no such prop; className styles the outer card frame and Composer owns the inner well's shape (surfaceClassName lives on PromptInput).",
    ],
  },

  ChatGreeting: {
    purpose:
      "The centered, display-scale first-run greeting for an empty chat scene — a headline, not a status message.",
    category: "ai",
    relationships: {
      usedInside: ["ChatShell"],
      pairsWith: ["Composer", "Suggestions"],
      avoidNextTo: [
        "ConversationEmptyState — that is the generic 'no messages yet' panel; only one empty-state voice per scene",
      ],
    },
    stateTokens: {
      orb: "an aria-hidden bg-primary/15 blur, opt out with orb={false} for dense/embedded use",
      accent:
        "the accent phrase is text-primary-text (TEXT rung, #399) plus bold + underline — the non-hue channel that keeps it legible in a theme whose --primary is near-white",
    },
    antiPatterns: [
      "Reaching for it as a status message — ConversationEmptyState is the 'no messages yet' panel; this is the display-scale greeting anatomy.",
      "Carrying the accent on colour alone — the shipped accent pairs the hue with weight + an underline precisely because a monochrome theme's --primary is indistinguishable from the headline ink (WCAG 1.4.1).",
      "Leaving level={1} when the route already renders its own h1 — Heading decouples level from size, so raise the level and keep the display rung.",
      "Keeping the orb on inside a dense embedded panel — it is a 40-unit blur sized for a full first-run scene.",
    ],
  },

  Artifact: {
    purpose:
      "Panel surface for a durable object the agent produced (document, code, preview) with title, description and actions.",
    category: "ai",
    relationships: {
      contains: [
        "ArtifactHeader",
        "ArtifactTitle",
        "ArtifactDescription",
        "ArtifactActions",
        "ArtifactContent",
        "ArtifactClose",
      ],
      pairsWith: ["Sandbox", "WebPreview", "CodeBlock"],
    },
    stateTokens: {
      surface:
        "bg-background + border + shadow-sm — the border is the SOLE structural cue under decoration (the shadow is zeroed there)",
      header: "ArtifactHeader: bg-muted/50 + border-b",
    },
    antiPatterns: [
      "Using an Artifact for a short inline answer — keep that in the Message; an Artifact is for a produced object.",
      "Dropping Artifact's border because it reads redundant on light — under decoration the shadow is zeroed and the border becomes the sole structural cue.",
      "Nesting an Artifact inside a message bubble — place it beside the conversation (ChatShell.aside or a sibling panel).",
    ],
  },

  Sources: {
    purpose: "Collapsible citation list for the sources an answer was grounded in.",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      contains: ["SourcesTrigger", "SourcesContent", "Source"],
      pairsWith: ["InlineCitation", "MessageResponse"],
    },
    stateTokens: {},
    antiPatterns: [
      "Scattering bare links through the message body — use Sources so the count collapses and the list stays scannable.",
      "Passing a Source without an href — SourceProps is ComponentProps<'a'> and it always renders an <a>; there is no id/label shape and nothing renders verbatim.",
      "Hand-counting the sources into SourcesTrigger — pass SourceList `sources={[{ href, title }]}` and let it own the count and the trigger copy.",
      'Overriding a Source\'s target/rel — it already ships target="_blank" rel="noopener noreferrer".',
    ],
  },

  JSXPreview: {
    purpose:
      "Escape-hatch renderer for agent-emitted JSX STRINGS — maximum flexibility, least safety (D2).",
    category: "ai",
    relationships: {
      contains: ["JSXPreviewContent", "JSXPreviewSkeleton", "JSXPreviewError"],
      avoidNextTo: ["a second generative surface in the same message"],
    },
    stateTokens: {
      loading: "JSXPreviewSkeleton (reserve the box)",
      streaming: "isStreaming → build up; parse errors suppressed until the tag completes",
    },
    antiPatterns: [
      "Making JSXPreview the default generative path — render a conversation (UIMessage) or, once it lands, A2UI; this is the escape hatch (D2).",
      "Rendering JSXPreviewError on a half-arrived tag — an incomplete tag is not an error; suppress it until the input settles.",
      "Omitting JSXPreviewSkeleton — the preview must reserve its final space instead of popping in.",
      "Passing untrusted JSX without deciding the trust boundary in the app — the component renders what it is given.",
    ],
  },

  Gallery: {
    purpose:
      "Image/asset grid with a +N overflow tile that opens a lightbox Dialog (carousel + metadata).",
    category: "ai",
    relationships: { usedInside: ["Message"], pairsWith: ["Attachments", "AssetPreview"] },
    stateTokens: {
      loading: "per-image Skeleton until onLoad; expectedCount reserves the tiles",
    },
    antiPatterns: [
      "Letting images pop in with no per-image skeleton — reserve each box (AspectRatio + Skeleton) until onLoad or the grid shifts.",
      "Rendering a bare grid for an empty list — every list needs a real empty state.",
      "<img> without explicit width/height — it is the grid's largest CLS source.",
    ],
  },

  InteractiveTerminal: {
    purpose: "Streaming terminal surface for agent shell output, with an optional input line.",
    category: "ai",
    relationships: { pairsWith: ["Terminal", "Tool", "Sandbox"] },
    stateTokens: {
      streaming: "imperative — ref.current.write(chunk) as output arrives (no isStreaming prop)",
      readOnly: "readOnly → stdin disabled, writes still render (read-only log)",
    },
    antiPatterns: [
      "Spawning a shell or process from the component — it renders a stream; the app owns the runtime (D5).",
      "Looking for an isStreaming/output prop — this surface is imperative: hold the InteractiveTerminalHandle ref and call write() per chunk (the declarative sibling is Terminal).",
      "Reaching the terminal engine through a static import — heavy engines must be reached by a dynamic import() (the heavy-deps ratchet).",
    ],
  },

  AgentTimeline: {
    purpose: "Chronological rail of agent steps and checkpoints — what the agent did, in order.",
    category: "ai",
    relationships: { contains: ["AgentStep", "Checkpoint"], pairsWith: ["Plan", "Task", "Tool"] },
    stateTokens: {
      status:
        "the rail NODE, owned by the composed @elabs-ai/components-ui Timeline (NODE_STYLE): pending border-border bg-background · running border-info bg-info ring-2 ring-info/25 · complete border-success bg-success · awaiting-approval border-warning bg-warning ring-1 ring-warning/40 · failed border-destructive bg-destructive ring-4 ring-destructive/20 · denied border-border bg-muted border-dashed · skipped border-border bg-muted border-dotted (every status carries a non-hue cue — a ring width or a border style — so it survives greyscale, #387)",
    },
    antiPatterns: [
      "Hand-rolling a connector + status-map rail — reuse the @elabs-ai/components-ui Timeline (the timeline-fork gate blocks a second one).",
      "Reaching for a border-s-* accent rail to show step status — AgentTimeline is a thin TimelineRoot/TimelineItem wrapper; status is the node dot (plus the StatusBadge), never a left rail.",
      "Encoding step status by color alone — pair the color with an icon or label.",
      "Rendering a blank rail while the run is starting — show the not-ready state, never an empty region.",
    ],
  },

  Confirmation: {
    purpose:
      "In-conversation approve/deny request for an action the agent wants a human to authorize.",
    category: "ai",
    relationships: {
      contains: [
        "ConfirmationRequest",
        "ConfirmationApprove",
        "ConfirmationDeny",
        "ConfirmationAccepted",
        "ConfirmationRejected",
      ],
      pairsWith: ["ApprovalCard", "Tool"],
    },
    stateTokens: { decided: "ConfirmationAccepted / ConfirmationRejected replace the request" },
    antiPatterns: [
      "Performing the action on render or auto-approving — the point is the human decision; emit the choice, don't act.",
      "Focusing the approve/destructive action by default — focus the safe choice first.",
      "Leaving the request rendered after a decision — swap to ConfirmationAccepted/ConfirmationRejected so the outcome is legible.",
    ],
  },

  ModelSelector: {
    purpose: "Command-palette picker for the active model, grouped by provider.",
    category: "ai",
    relationships: {
      usedInside: ["Composer", "PromptInputTools"],
      contains: ["ModelSelectorTrigger", "ModelSelectorContent", "ModelSelectorItem"],
    },
    stateTokens: {
      surface: "the CommandDialog shell: border-none + outline-border (an outline, not a border)",
      highlighted:
        "data-[selected=true]:bg-accent + text-accent-foreground — inherited from CommandItem",
    },
    antiPatterns: [
      "Calling a provider API from the selector — it emits a selection; the app owns model configuration (D5).",
      "Using a plain Select for a long provider list — ModelSelector gives typeahead and grouping.",
      "Translating provider/model brand names — mark them i18n-exempt instead.",
    ],
  },

  ApprovalCard: {
    purpose:
      "The named human-in-the-loop variant of Confirmation — a titled, described approve/deny card.",
    category: "ai",
    relationships: {
      contains: [
        "ApprovalCardRequest",
        "ApprovalCardTitle",
        "ApprovalCardDescription",
        "ApprovalCardActions",
        "ApprovalCardApprove",
        "ApprovalCardDeny",
      ],
      pairsWith: ["Confirmation", "Tool"],
    },
    antiPatterns: [
      "Building a second approve/deny widget — ApprovalCard and Confirmation ship from the same module; extend, don't fork.",
      "Running the action the card describes on render — the card emits a decision; the app performs it (D5).",
      "Leaving the request mounted after the human answers — swap to ApprovalCardAccepted/ApprovalCardRejected so the outcome stays legible.",
    ],
  },

  Plan: {
    purpose: "A Card-shaped, collapsible plan the agent proposes before it starts executing.",
    category: "ai",
    relationships: {
      contains: ["PlanHeader", "PlanTitle", "PlanTrigger", "PlanContent", "PlanFooter"],
      pairsWith: ["Task", "ChainOfThought", "Shimmer"],
    },
    antiPatterns: [
      "Rendering a parse/validation error while the plan is still arriving — a half-streamed plan is not a failure (loading-states.md).",
      "Using Plan for a finished run — a settled trace is a Task; Plan is the intent, not the record.",
      "Hand-rolling the streaming affordance — pass `isStreaming` and let the shipped Shimmer carry it.",
    ],
  },

  Task: {
    purpose: 'Collapsed "what got done" run summary, rendered on the canonical AgentTimeline rail.',
    category: "ai",
    relationships: {
      contains: ["TaskTrigger", "TaskContent", "TaskItem", "TaskItemFile"],
      usedInside: ["Conversation"],
      pairsWith: ["AgentTimeline", "Plan"],
    },
    antiPatterns: [
      "Hand-rolling a `border-s-2` content rail — the execution trace rides AgentTimeline/AgentStep (#192).",
      "Leaving every Task expanded in a settled transcript — only the produced artifact and the final answer stay open.",
      "Bordering the inline file chip — the fill is the gesture; a border on a filled chip is the redundant-border anti-pattern.",
    ],
  },

  ChainOfThought: {
    purpose: "Step-by-step live reasoning trace with per-step status and search results.",
    category: "ai",
    relationships: {
      contains: [
        "ChainOfThoughtHeader",
        "ChainOfThoughtContent",
        "ChainOfThoughtStep",
        "ChainOfThoughtSearchResults",
      ],
      pairsWith: ["Reasoning", "AgentTimeline", "Task"],
      avoidNextTo: ["a second open reasoning disclosure for the same turn"],
    },
    antiPatterns: [
      "Using it as the model's transport — it renders steps the app already has; it never calls a model (D5).",
      "Duplicating Reasoning — Reasoning is the collapsed thinking disclosure, ChainOfThought is the enumerated step ledger; pick one per turn.",
      "Emitting an error step for a step that simply has not arrived yet — suppress transient errors while streaming.",
    ],
  },

  Sandbox: {
    purpose: "Collapsible, tabbed view of the files/commands a code-running tool worked on.",
    category: "ai",
    relationships: {
      contains: ["SandboxHeader", "SandboxTabs", "SandboxTabsList", "SandboxContent"],
      pairsWith: ["Tool", "Terminal", "CodeBlock"],
    },
    antiPatterns: [
      "Executing anything — Sandbox renders a tool's reported state; it is not a runtime (D5).",
      "Passing a free-form status string — the header takes the AI SDK `ToolUIPart['state']`, so the badge stays consistent with Tool.",
      "Using it for a single file — reach for CodeBlock; the tab bar is only worth it for a multi-file result.",
    ],
  },

  WebPreview: {
    purpose: "Framed preview of a URL the agent produced, with a URL bar and a console drawer.",
    category: "ai",
    relationships: {
      contains: ["WebPreviewNavigation", "WebPreviewUrl", "WebPreviewBody", "WebPreviewConsole"],
      pairsWith: ["Artifact", "Sandbox"],
    },
    antiPatterns: [
      "Fetching or proxying the URL yourself — the body is an iframe; the app decides what is safe to frame.",
      "Framing an untrusted origin without a sandbox attribute — the component styles the frame, it does not sandbox it for you.",
      "Treating the console drawer as a log store — it renders what you pass; keep the buffer in the app.",
    ],
  },

  Terminal: {
    purpose: "Read-only ANSI console output with copy/clear actions and stick-to-bottom streaming.",
    category: "ai",
    relationships: {
      contains: ["TerminalHeader", "TerminalContent", "TerminalCopyButton", "TerminalClearButton"],
      pairsWith: ["InteractiveTerminal", "Sandbox"],
    },
    antiPatterns: [
      "Reaching for it when the user must TYPE — that is InteractiveTerminal; Terminal is output-only.",
      "Stripping the ANSI codes before passing them — the component renders them; pre-stripping throws away the colour.",
      "Re-implementing auto-scroll in the consumer — `autoScroll` is owned by the component and must yield when the user scrolls up.",
    ],
  },

  InlineCitation: {
    purpose: "Inline source marker whose hover card carries the quote and the source carousel.",
    category: "ai",
    relationships: {
      contains: ["InlineCitationText", "InlineCitationCard", "InlineCitationCarousel"],
      pairsWith: ["Sources", "MessageResponse"],
    },
    stateTokens: { hover: "group-hover:bg-accent on the cited run of text" },
    antiPatterns: [
      "Assuming a citation is a URL — an opaque id or a label is legitimate and renders verbatim; don't `new URL()` it.",
      "Putting essential information only in the hover card — hover content is supplementary and unreachable on touch.",
      'Opening an external source without `rel="noopener noreferrer"` on the `target="_blank"` link.',
    ],
  },

  CodeBlock: {
    purpose: "Shiki-highlighted code block with a copy button, filename and language selector.",
    category: "ai",
    relationships: {
      contains: ["CodeBlockHeader", "CodeBlockContent", "CodeBlockCopyButton"],
      pairsWith: ["Snippet", "Artifact", "MarkdownView"],
      avoidNextTo: ["a document the user is meant to READ — that is MarkdownView"],
    },
    antiPatterns: [
      "Rendering a produced document with it — markdown assets go through MarkdownView; CodeBlock is for code.",
      "Hand-rolling a copy button — CodeBlockCopyButton already handles the copied-state swap and its label.",
      "Loading the highlighter eagerly on a page that may never show code — Shiki is a heavy dependency (heavy-deps:check).",
    ],
  },

  Snippet: {
    purpose: "One-line copyable command or value, built on the ui InputGroup.",
    category: "ai",
    relationships: {
      contains: ["SnippetInput", "SnippetCopyButton", "SnippetText"],
      pairsWith: ["CodeBlock"],
    },
    antiPatterns: [
      "Using it for multi-line code — it is a single-line input group; reach for CodeBlock.",
      "Making the field editable — it is a copy affordance, not a form control; don't wire it to form state.",
      "Duplicating the copy button — the shipped SnippetCopyButton owns the copied-state feedback.",
    ],
  },

  Shimmer: {
    purpose: 'Motion-aware shimmering TEXT affordance for an in-progress ("Thinking…") line.',
    category: "ai",
    relationships: { pairsWith: ["Plan", "Reasoning", "Task"] },
    antiPatterns: [
      "Using it as a skeleton — a layout-shaped placeholder is `Skeleton`; Shimmer is text-only (loading-states.md).",
      "Wrapping non-string children — it takes a string; anything else defeats the per-character sweep.",
      "Adding your own animation on top — the sweep already gates on `useReducedMotion`; a second one will not.",
    ],
  },

  Agent: {
    purpose:
      "Accordion-shaped disclosure describing a sub-agent: its instructions, tools and output.",
    category: "ai",
    relationships: {
      contains: ["AgentHeader", "AgentContent", "AgentInstructions", "AgentTools", "AgentOutput"],
      pairsWith: ["Tool", "AgentTimeline", "Task"],
    },
    antiPatterns: [
      "Confusing it with AgentTimeline — Agent describes WHO ran, the timeline shows WHAT happened step by step.",
      "Invoking the described tools from the component — it renders the AI SDK `Tool` definitions; the app executes them (D5).",
      "Leaving every sub-agent expanded — the accordion exists so a multi-agent transcript stays readable.",
    ],
  },

  MarkdownView: {
    purpose: "Branded, read-only renderer for a produced markdown document (not a code view).",
    category: "ai",
    relationships: {
      usedInside: ["AssetPreview", "ContextPanel"],
      pairsWith: ["Artifact", "CodeBlock"],
    },
    antiPatterns: [
      "Rendering a produced document with CodeBlock instead — documents are read, not syntax-highlighted (research 09).",
      "Passing untrusted HTML through it expecting sanitization — it renders markdown; the app owns what it trusts.",
      "Using it for streamed chat prose — that is MessageResponse; MarkdownView is for a settled asset.",
    ],
  },

  // ── @elabs-ai/components-charts ──────────────────────────────────
  // Sourced from .claude/rules/chart-components.md + .claude/rules/loading-states.md
  // (the chart-scoped `status` alias) + the styling rule's tokens-only line.

  AutoChart: {
    purpose:
      "Spec-driven chart — hand it a serializable ChartSpec and it picks and renders the right chart.",
    category: "chart",
    relationships: { usedInside: ["ChartFrame", "ChartCard"], pairsWith: ["MetricGrid"] },
    stateTokens: { series: "--chart-1 … --chart-5" },
    antiPatterns: [
      "Hand-picking a chart type when the spec already encodes the intent — AutoChart is the agent-facing entry point.",
      "Putting raw colors in a spec's series — the chart-1…chart-5 tokens are the palette in every theme.",
      "Passing an empty dataset with no not-ready signal — render the loading state instead of an empty frame.",
    ],
  },

  ChartCard: {
    purpose: "Titled card surface around a chart — header, description, and the chart body.",
    category: "chart",
    relationships: { usedInside: ["ChartFrame", "MetricGrid"], pairsWith: ["AutoChart"] },
    stateTokens: {
      background:
        "bg-card text-card-foreground — inherited: ChartCard IS a Card (it adds only layout)",
    },
    antiPatterns: [
      "Nesting a ChartCard inside a Card — it already IS the surface.",
      "Hand-building expand / flip-to-table / download controls on the card — wrap it with ChartFrame instead.",
      "Leaving the body blank when data is absent — render the loading/empty state; a blank card reads as broken.",
    ],
  },

  ChartDatapointProvider: {
    purpose:
      "Opt-in wrapper that makes a chart's datapoints activatable — mounted only when the consumer passes onDatapointClick or copyValueOnActivate.",
    category: "chart",
    relationships: { contains: ["ChartDatapointLayer"], pairsWith: ["ChartFrame"] },
    antiPatterns: [
      "Mounting it around every chart by default — a chart with no drill-down handler adds no context, no layer and no DOM, and that opt-out path is the point.",
      "Rendering more than ~500 targets — the provider warns in dev because a keyboard target per datapoint stops being navigable long before it stops rendering.",
      "Reading the click handler out of a state variable that changes every render — the provider keeps the context value stable via refs so an inline arrow function does not churn every shape.",
    ],
  },

  ChartDatapointLayer: {
    purpose:
      "The keyboard/AT half of the chart interaction contract — real buttons in a sibling layer over the aria-hidden chart SVG (#349).",
    category: "chart",
    relationships: { usedInside: ["ChartDatapointProvider"] },
    stateTokens: {
      focus: "each target is a real button: focus-visible:ring-2 ring-ring, outline-none",
    },
    antiPatterns: [
      "Putting tabIndex on an SVG shape instead — every chart body is aria-hidden, so a focusable child inside it is the axe aria-hidden-focus violation, and axe is blocking here.",
      "Letting the layer take pointer events — it is pointer-events:none so the SVG underneath keeps mousemove; swallowing them silently kills hover tooltips on line/area charts.",
      "Giving every datapoint its own tab stop — the layer is a roving tabindex (one target at 0, the rest -1, arrows to move); a 500-point series must not add 500 tab stops.",
      "Measuring target geometry with getBBox/getBoundingClientRect — targets carry the geometry the shapes already computed from the scales; a layout read in render is the banned path.",
    ],
  },

  MetricGrid: {
    purpose: "Responsive grid of KPI tiles — the summary row at the top of a dashboard.",
    category: "chart",
    relationships: {
      contains: ["MetricCard"],
      usedInside: ["AppShell"],
      pairsWith: ["ChartFrame", "DataTable"],
    },
    stateTokens: { value: "tabular-nums" },
    antiPatterns: [
      "More than ~5 tiles in one row — KPIs answer 'how are we doing', not 'everything we measure'.",
      "Numbers without tabular-nums — figures jitter across the row.",
      "Re-declaring a KPI tile locally — MetricCard is owned by @elabs-ai/components-ui and re-exported here (ADR 0012).",
    ],
  },

  BarChart: {
    purpose: "Categorical comparison — composed from Bar + BarXAxis/BarYAxis inside its provider.",
    category: "chart",
    relationships: {
      contains: ["Bar", "BarXAxis", "BarYAxis", "ChartTooltip", "ChartLegend"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    stateTokens: { series: "--chart-1 … --chart-5" },
    antiPatterns: [
      "Truncating the value axis so small differences look large — a bar axis starts at zero.",
      "Hardcoding series colors — use the chart-1…chart-5 tokens so every theme works.",
      "Rendering an empty frame before data arrives — use the shipped chart skeleton utilities.",
    ],
  },

  LineChart: {
    purpose: "Trend over a continuous (usually time) axis.",
    category: "chart",
    relationships: {
      contains: ["Line", "XAxis", "YAxis", "ChartTooltip", "Legend"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    stateTokens: { status: 'status="loading" → LineChartLoading skeleton; "ready" → the plot' },
    antiPatterns: [
      "A LineChart over unordered categories — a line asserts continuity; use a BarChart.",
      "More than ~5 series in one plot — past the chart-1…chart-5 palette the series stop being distinguishable; facet instead.",
      "Distinguishing series by color alone — add markers or direct labels for non-color users.",
    ],
  },

  AreaChart: {
    purpose: "Cumulative or part-of-whole trend over time — a filled line.",
    category: "chart",
    relationships: {
      contains: ["Area", "XAxis", "YAxis", "ChartTooltip"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    stateTokens: { status: 'status="loading" → AreaChartLoading skeleton; "ready" → the plot' },
    antiPatterns: [
      "Stacking areas that are not parts of one whole — a stack asserts summation; use lines.",
      "Overlapping opaque areas — either stack them or switch to a LineChart.",
      'Leaving status="loading" unhandled — AreaChartLoading is the shipped skeleton.',
    ],
  },

  PieChart: {
    purpose: "Part-of-whole split across a handful of categories.",
    category: "chart",
    relationships: {
      contains: ["PieSlice", "PieCenter", "PieProvider"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    stateTokens: { series: "--chart-1 … --chart-5" },
    antiPatterns: [
      "More than ~5 slices — a bar chart compares better; a pie is not a ranking.",
      "A pie for values that don't sum to a meaningful whole.",
      "Identifying slices by color alone — put the label and value on or beside the slice.",
    ],
  },

  SankeyChart: {
    purpose: "Flow diagram — how quantity moves between stages or nodes.",
    category: "chart",
    relationships: {
      contains: ["SankeyNode", "SankeyLink", "SankeyTooltip", "SankeyProvider"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    stateTokens: { series: "--chart-1 … --chart-5" },
    antiPatterns: [
      "A Sankey for a simple two-column comparison — reach for a bar chart.",
      "Raw colors on nodes/links — resolve the chart tokens so the dark theme reads correctly.",
      "So many nodes that the labels collide — aggregate the tail into one 'other' node.",
    ],
  },

  Gantt: {
    purpose: "Schedule grid — tasks as bars over time, with a task table beside them.",
    category: "chart",
    relationships: { usedInside: ["ChartFrame"], pairsWith: ["DataTable"] },
    stateTokens: { loading: "loading → skeleton rows + overlay spinner" },
    antiPatterns: [
      "Mutating task dates inside the component on drag — Gantt is emit-only; the app owns the model (D5).",
      "Bar labels that rely on the bar fill for contrast — check the label against the bar color in every theme.",
      "Rendering the grid without `loading` while rows are still fetching — skeleton rows must hold the layout.",
    ],
  },

  Sparkline: {
    purpose: "Tiny, axis-less trend that lives inside a KPI tile or a table cell.",
    category: "chart",
    relationships: { usedInside: ["MetricCard", "DataTable"] },
    stateTokens: {},
    antiPatterns: [
      "Adding axes and tooltips to a Sparkline — if it needs them it is a LineChart.",
      "A Sparkline as the only carrier of a number — pair it with the value (MetricCard).",
      "Fixing its width in pixels — let the tile or cell own the box so it reflows.",
    ],
  },

  ComposedChart: {
    purpose:
      "One cartesian frame that layers several series types (bars + lines + areas) together.",
    category: "chart",
    relationships: {
      contains: ["XAxis", "YAxis", "Grid", "ChartLegend", "ChartTooltip"],
      usedInside: ["ChartFrame", "ChartCard"],
      pairsWith: ["AutoChart"],
    },
    antiPatterns: [
      "Stacking series on two silently-different y-scales — label the second axis or the comparison lies.",
      "Layering more than ~3 series types in one frame — split it into small multiples instead.",
      "Colouring series by hand — resolve --chart-1..5 so the dark theme stays legible.",
    ],
  },

  FunnelChart: {
    purpose: "Stage-by-stage drop-off through an ordered pipeline.",
    category: "chart",
    relationships: { usedInside: ["ChartFrame", "ChartCard"], pairsWith: ["ChartLegend"] },
    antiPatterns: [
      "Using it for unordered categories — a funnel asserts a sequence; unordered data belongs in a bar chart.",
      "Encoding stage identity by colour alone — label each stage; colour is not a legend.",
      "Hiding the absolute counts behind percentages only — a funnel without its base number cannot be judged.",
    ],
  },

  RadarChart: {
    purpose: "Multi-metric profile comparison on a shared radial axis.",
    category: "chart",
    relationships: {
      contains: ["RadarAxis", "RadarGrid", "RadarArea", "RadarLabels"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    antiPatterns: [
      "Plotting metrics with different units on one radar — normalize first or the shape is meaningless.",
      "Overlaying more than ~3 profiles — the filled areas occlude each other; use small multiples.",
      "Relying on the filled area to be readable at low opacity — check the fill against every theme's canvas.",
    ],
  },

  Gauge: {
    purpose: "Single-value dial against a known range — a KPI with an explicit ceiling.",
    category: "chart",
    relationships: { usedInside: ["MetricCard", "ChartCard"], pairsWith: ["MetricGrid"] },
    antiPatterns: [
      "A gauge for a value with no meaningful maximum — that is a MetricCard, not a dial.",
      "A gauge per KPI in a grid — a row of dials reads worse than a MetricGrid; use one for the headline only.",
      "Encoding the threshold by colour alone — pair the band with a label or a tick.",
    ],
  },

  ScatterChart: {
    purpose: "Point cloud for correlation between two continuous measures.",
    category: "chart",
    relationships: {
      contains: ["XAxis", "YAxis", "Grid"],
      usedInside: ["ChartFrame", "ChartCard"],
    },
    antiPatterns: [
      "Connecting the points — a line asserts a sequence a scatter does not have.",
      "Plotting tens of thousands of raw points — bin or sample; the browser and the reader both give up.",
      "Distinguishing groups by colour only at default opacity — overlapping marks collapse; add shape or facets.",
    ],
  },

  ChoroplethChart: {
    purpose: "Region-shaded map for a measure that is defined per geographic area.",
    category: "chart",
    relationships: { usedInside: ["ChartFrame", "ChartCard"], pairsWith: ["ChartLegend"] },
    antiPatterns: [
      "Shading raw counts instead of a rate — area size becomes the story and the map lies.",
      "A rainbow ramp for a sequential measure — use one ordered ramp so darker always means more.",
      "Shipping it without a legend — a shaded region carries no value without the scale.",
    ],
  },

  ChartLegend: {
    purpose:
      "Series key with label, value and an optional progress bar; pattern-aware under decoration.",
    category: "chart",
    relationships: { usedInside: ["ChartCard", "ChartFrame"], pairsWith: ["ChartTooltip"] },
    antiPatterns: [
      "Dropping the legend on a multi-series chart — colour without a key is not a legend.",
      "Ordering legend items differently from the series — the eye maps them positionally.",
      "Passing a raw hex as the item colour — resolve the chart token so high decoration gets its pattern swatch.",
    ],
  },

  ChartTooltip: {
    purpose: "Hover readout for the point/series under the pointer.",
    category: "chart",
    relationships: { usedInside: ["ChartFrame", "ChartCard"], pairsWith: ["ChartLegend"] },
    antiPatterns: [
      "Putting information ONLY in the tooltip — hover content is unreachable by keyboard and on touch.",
      "Showing every series in a shared tooltip on a dense chart — filter to the hovered series.",
      "Formatting numbers by hand — use Intl so locale and units stay consistent with the axis.",
    ],
  },

  // ── @elabs-ai/components-maps ────────────────────────────────────
  // Sourced from .claude/rules/map-components.md (token paints, attribution, WebGL).

  MapCanvas: {
    purpose: "Root MapLibre canvas — theme-aware basemap; the ref is the raw MapLibre Map.",
    category: "data",
    relationships: {
      contains: ["MapMarker", "MapControls", "MapClusterLayer", "MapGeoJSON", "MapRoute"],
    },
    stateTokens: { loading: 'loading → Spinner overlay (role="status")' },
    antiPatterns: [
      "Hiding MapLibre's attribution control — the default Carto basemap styles/tiles require it.",
      "Importing maplibre-gl CSS in the app — MapCanvas imports its own CSS plus the brand popup overrides.",
      "Rendering it in an RSC/SSR path with no client boundary — MapLibre needs WebGL.",
    ],
  },

  MapMarker: {
    purpose: "A point on the map, optionally carrying content, a label, a popup or a tooltip.",
    category: "display",
    relationships: {
      usedInside: ["MapCanvas"],
      contains: ["MapMarkerContent", "MapMarkerLabel", "MapMarkerPopup", "MapMarkerTooltip"],
    },
    stateTokens: { default: "--primary via the token resolver (WebGL can't read CSS variables)" },
    antiPatterns: [
      "Hardcoding a marker color — resolve a semantic token; WebGL can't read CSS variables directly.",
      "Hundreds of individual markers — switch to MapClusterLayer above roughly 50 points.",
    ],
  },

  MapPopup: {
    purpose: "Standalone anchored popup on the map (not bound to a marker).",
    category: "overlay",
    relationships: { usedInside: ["MapCanvas"], pairsWith: ["MapMarker"] },
    stateTokens: {},
    antiPatterns: [
      "Putting essential information only in a popup — it is transient; keep critical content on the page.",
      "Styling the popup with raw colors — the brand popup overrides are token-driven (maps.css).",
    ],
  },

  MapClusterLayer: {
    purpose: "Clusters dense point data into count bubbles that split apart as you zoom in.",
    category: "data",
    relationships: { usedInside: ["MapCanvas"], pairsWith: ["MapMarker"] },
    stateTokens: { steps: "--success → --warning → --destructive, --background strokes/labels" },
    antiPatterns: [
      "Hardcoding the cluster step colors — the steps resolve from the status tokens.",
      "Clustering a handful of points — plain MapMarkers read better below roughly 50 points.",
    ],
  },

  // ── @elabs-ai/components-marketing ───────────────────────────────
  // Sourced from skills/brand-ui-audit/reference/anti-patterns.md (the marketing
  // register-gated tells + the content "Jane Doe effect" section).

  Hero: {
    purpose: "Above-the-fold marketing headline, subcopy and the primary call to action.",
    category: "layout",
    relationships: { pairsWith: ["LogoStrip", "FeatureGrid", "CTASection"] },
    stateTokens: {},
    antiPatterns: [
      "Filler verbs in the headline — name what the product literally does instead.",
      "A hero image without explicit width/height (and fetchpriority) — it is the page's largest layout-shift risk.",
      "Version/beta eyebrows in the hero — a marketing-surface tell; drop it unless the brief is about the launch.",
    ],
  },

  FeatureGrid: {
    purpose: "Grid of capability cards below the hero.",
    category: "layout",
    relationships: { pairsWith: ["Hero", "UseCaseCard", "CTASection"] },
    stateTokens: {},
    antiPatterns: [
      "Three identical icon-tile-above-heading cards — the canonical landing-page tell; vary the structure (bento, split, asymmetry).",
      "Shipping placeholder feature copy as real content — a dead showcase reads as a demo.",
    ],
  },

  CTASection: {
    purpose: "Closing conversion band — one message, one action.",
    category: "layout",
    relationships: { pairsWith: ["Hero", "FeatureGrid"], avoidNextTo: ["another CTASection"] },
    stateTokens: {},
    antiPatterns: [
      "Two competing primary Buttons in the band — demote one to secondary/outline.",
      "Manufactured urgency or scarcity copy — that is a dark pattern, not a conversion technique.",
    ],
  },

  // ── @elabs-ai/components-icons ───────────────────────────────────
  // Sourced from .claude/rules/icons.md (Lucide is the default; this package is
  // for brand/product vocabulary) + the AppIcon convention.

  Icon: {
    purpose:
      "The brand/product-vocabulary icon primitive — 24×24, stroke = currentColor, so it themes with text.",
    category: "display",
    relationships: { pairsWith: ["Button", "Badge"] },
    stateTokens: { color: "currentColor (inherits the text token)" },
    antiPatterns: [
      "Reaching here for a generic glyph (chevron, close, search, menu) — those come from lucide-react.",
      "A meaning-bearing icon with no title — an untitled Icon is decorative and hidden from assistive tech by design.",
      "A raw color on an icon — it inherits currentColor so it adapts per theme.",
    ],
  },

  BrandLogo: {
    purpose: "The product's mark/lockup, drawn from tokens so it adapts to every theme.",
    category: "display",
    relationships: { usedInside: ["AppIcon", "Sidebar", "Hero"] },
    stateTokens: { color: "currentColor / brand tokens" },
    antiPatterns: [
      "Hardcoding a brand fill — the mark uses currentColor/tokens so it adapts per theme.",
      "Hand-rolling the mark↔lockup swap in app chrome — AppIcon wraps BrandLogo and morphs on sidebar collapse.",
    ],
  },

  AppIcon: {
    purpose:
      "The standard app/brand mark for app chrome — theme-aware, morphs mark↔lockup on sidebar collapse.",
    category: "display",
    relationships: { usedInside: ["Sidebar", "AppShell"], contains: ["BrandLogo"] },
    stateTokens: { collapsed: "mark only; expanded: full lockup" },
    antiPatterns: [
      "Hand-rolling BrandLogo plus a lucide box in app chrome — AppIcon is the standard app mark.",
      "Using AppIcon as a brand-neutral scaffold placeholder or a multi-tenant team switcher — it is the product's own mark.",
    ],
  },

  // ── @elabs-ai/components-tokens ──────────────────────────────────
  // Sourced from .claude/rules/theming.md + the decoration dial policy.

  ThemeProvider: {
    purpose:
      "Writes `data-theme` on a root element and persists the choice; `useTheme()` reads/sets it.",
    category: "layout",
    relationships: { contains: ["AppShell"], pairsWith: ["DecorationProvider"] },
    stateTokens: { theme: 'data-theme="light|dark"' },
    antiPatterns: [
      "Fixing a flat or wrong-looking surface inside a component — change the theme's token, not the component.",
      "Adding `dark:` overrides in a component — semantic tokens make every theme work, not only dark.",
      "Assuming a Storybook decorator supplies this context — the global decorator only sets data-theme, so a useTheme story must wrap itself.",
    ],
  },

  DecorationProvider: {
    purpose:
      "Sets the `--decoration` dial (0–10) for a region — reprographic texture, orthogonal to color.",
    category: "layout",
    relationships: { pairsWith: ["ThemeProvider"] },
    stateTokens: { decoration: 'data-decoration="0…10"' },
    antiPatterns: [
      "Raising decoration on a dense data surface — decoration density goes DOWN as information density goes UP.",
      "Minting a second expressiveness knob — `--decoration` IS the expressiveness axis (ADR 0020); never add a parallel dial.",
    ],
  },

  // ── @elabs-ai/components-ai surfaces (#60 coverage ratchet) ──────
  // Authored from each module's own source, not from its name. Every entry below
  // carries the ≥3 anti-patterns the complex-surface bar asks for; `stateTokens`
  // is present only where a class was READ off the module (rule 5 resolves it
  // against real source, so a guessed token fails the gate rather than shipping).

  AssetPreview: {
    purpose:
      "Type-keyed preview of ONE produced asset — markdown/code/sql/csv/image — inside the Artifact chrome.",
    category: "ai",
    relationships: {
      usedInside: ["ContextPanel"],
      pairsWith: ["ProducedAssetTree", "Artifact", "MarkdownView", "CodeBlock"],
    },
    antiPatterns: [
      "Rendering produced markdown through CodeBlock/Shiki — a document is a document; only the explicit Raw toggle shows source.",
      "Holding the selected asset in local state — selection lives in ContextPanelProvider, which the tree and the preview both read.",
      "Switching on the file extension in the consumer — pass the `ContextAsset` and let the preview key off `type`.",
    ],
  },

  Attachment: {
    purpose:
      "One user-supplied file/source chip — media-category icon, preview, hover details and a remove affordance.",
    category: "ai",
    relationships: {
      usedInside: ["PromptInput", "Message"],
      contains: ["AttachmentPreview", "AttachmentInfo", "AttachmentRemove", "AttachmentHoverCard"],
      pairsWith: ["AttachmentEmpty"],
    },
    antiPatterns: [
      "Hand-rolling the remove button — AttachmentRemove owns the hit target and its accessible name.",
      "Using Attachment for something the AGENT produced — that is an AssetPreview/ProducedAssetTree, not an attachment.",
      "Rendering a file list with no AttachmentEmpty — an empty attachment strip must render a real empty state, never nothing.",
    ],
  },

  AudioPlayer: {
    purpose:
      "Themed audio transport for generated/recorded speech, built on media-chrome's MediaController.",
    category: "ai",
    relationships: {
      contains: ["AudioPlayerControlBar", "AudioPlayerPlayButton", "AudioPlayerTimeRange"],
      pairsWith: ["Transcription", "SpeechInput"],
    },
    antiPatterns: [
      "Restyling it with utility classes or raw colors — the skin is the `--media-*` custom properties, already mapped to brand tokens.",
      "Autoplaying agent audio — playback is a user action; start it from a control, not on mount.",
      "Shipping audio with no transcript — pair it with Transcription so the content is readable, not only audible.",
    ],
  },

  BrandMotionConfig: {
    purpose:
      "Feeds descendant Motion components the brand transition (duration/ease mirrored from the motion tokens).",
    category: "ai",
    relationships: { pairsWith: ["ThemeProvider"] },
    antiPatterns: [
      "Passing a hand-picked duration/ease per animation — the point of the provider is one tokened default.",
      "Assuming milliseconds — Motion durations are SECONDS here, unlike the CSS `--duration-*` tokens.",
      "Relying on it for reduced motion — it sets timing, not preference; movement still needs its `motion-reduce:` neutralizer.",
    ],
  },

  Checkpoint: {
    purpose: "A restore-point divider in a transcript — a labelled rule the user can jump back to.",
    category: "ai",
    relationships: {
      usedInside: ["Conversation"],
      contains: ["CheckpointIcon", "CheckpointTrigger"],
      avoidNextTo: ["AgentStep"],
    },
    stateTokens: { rule: "text-muted-foreground (a quiet divider, never a status color)" },
    antiPatterns: [
      "Using a Checkpoint as an executed step — it is a divider/restore point; a step that RAN is an AgentStep on the AgentTimeline rail.",
      "Colouring it by status — a checkpoint has no outcome; keep it muted so real status stays legible.",
      "Restoring without confirmation — jumping back discards later turns, so it is a destructive action (confirm or offer undo).",
    ],
  },

  Commit: {
    purpose: "A version-control commit rendered in chat — hash, author, message and changed files.",
    category: "ai",
    relationships: {
      usedInside: ["Message", "ToolResultCard"],
      contains: ["CommitHeader", "CommitContent", "CommitFiles", "CommitCopyButton"],
      pairsWith: ["CodeBlock"],
    },
    stateTokens: { surface: "bg-background + rounded-lg border (a collapsible block, not a Card)" },
    antiPatterns: [
      "Expanding every commit by default — the file list is behind the collapsible for a reason; long diffs drown the turn.",
      "Signalling additions/deletions with color alone — the +/− counts carry the meaning, so keep the glyph and the number.",
      "Re-implementing copy-to-clipboard — CommitCopyButton already owns the copy affordance and its feedback state.",
    ],
  },

  Context: {
    purpose:
      "Context-window usage readout for a model turn — used vs max tokens, with a hover breakdown.",
    category: "ai",
    relationships: {
      usedInside: ["Composer", "PromptInput"],
      contains: ["ContextTrigger", "ContextContent", "ContextInputUsage", "ContextCacheUsage"],
      pairsWith: ["ModelSelector"],
    },
    antiPatterns: [
      "Rendering it as a bare percentage — the trigger is a gauge plus the numbers; a naked number is unreadable at a glance.",
      "Feeding it estimated token counts — it is a factual readout; if the usage is unknown, do not render it.",
      "Putting it inside the transcript — usage is composer chrome, not message content.",
    ],
  },

  ContextPanel: {
    purpose:
      "The chat workspace's right context rail — sources, produced assets and a root↔detail drill-in.",
    category: "ai",
    relationships: {
      usedInside: ["ChatShell"],
      contains: [
        "ContextPanelProvider",
        "ContextPanelHeader",
        "ContextPanelBody",
        "ContextPanelSection",
        "ContextPanelDetail",
      ],
      pairsWith: ["ContextPanelTrigger", "AssetPreview", "ProducedAssetTree"],
    },
    antiPatterns: [
      "Conditionally mounting the panel to hide it — it stays mounted and collapses by width, because an unmounted panel cannot animate.",
      "Keeping open/view/selection state outside the provider — an external trigger drives the panel through ContextPanelProvider, not through prop-drilling.",
      "Building a second collapse mechanism — the canonical width tween is the one collapse implementation.",
    ],
  },

  EnvironmentVariable: {
    purpose: "One environment variable row — name, masked value, required flag and copy.",
    category: "ai",
    relationships: {
      usedInside: ["EnvironmentVariables"],
      contains: [
        "EnvironmentVariableName",
        "EnvironmentVariableValue",
        "EnvironmentVariableCopyButton",
      ],
      pairsWith: ["Badge", "Switch"],
    },
    antiPatterns: [
      "Rendering secrets unmasked by default — reveal is an explicit user action (the group's show-values switch).",
      "Logging or echoing the value elsewhere in the transcript — the masked row exists precisely so the secret is not in the scrollback.",
      "Marking required-ness with color only — the required flag is a Badge with text, not a red dot.",
    ],
  },

  FileTree: {
    purpose:
      "Hierarchical file/folder list for a workspace — `code` (IDE source tree) or `document` (produced assets) look.",
    category: "ai",
    relationships: {
      contains: ["FileTreeFolder", "FileTreeFile", "FileTreeIcon", "FileTreeName"],
      pairsWith: ["CodeBlock", "ProducedAssetTree"],
    },
    antiPatterns: [
      "Using the `code` visual for produced documents — `document` drops the mono/box treatment so a report does not read as source.",
      "Boxing the document variant back up — spacing and a section label separate it; a border there is the redundant-border anti-pattern.",
      "Treating it as a file picker — it is presentational; selection and open live with the consumer.",
    ],
  },

  GroupedParts: {
    purpose:
      "Renders an ordered message part list, folding adjacent reasoning/tool parts into collapsible traces.",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      pairsWith: ["Reasoning", "Tool", "AgentTimeline"],
    },
    antiPatterns: [
      "Asking the model to emit groups — grouping is a client-side view transform, never an output format.",
      "Reordering parts to make the grouping tidier — the part order is the record of what happened.",
      "Rebuilding the reasoning/tool rendering in the render-prop — omit it and the defaults compose Reasoning and Tool for you.",
    ],
  },

  Image: {
    purpose: "Renders a model-generated image from its base64 payload.",
    category: "ai",
    relationships: { usedInside: ["Message", "ToolResultCard"], pairsWith: ["Gallery"] },
    antiPatterns: [
      "Omitting `alt` — a generated image with no accessible name is invisible to assistive tech.",
      "Rendering it with no reserved box — a data URI decodes late, so give the image its width/height (or an aspect box) to avoid layout shift.",
      "Using it for a remote URL — it builds a `data:` src from base64; a hosted image is a plain <img>/Gallery item.",
    ],
  },

  MessageCompare: {
    purpose:
      "Side-by-side 2-4 column comparison of model responses to the same prompt — the one-at-a-time sibling of MessageBranch.",
    category: "ai",
    relationships: {
      contains: ["MessageCompareColumn"],
      pairsWith: ["MessageFeedback", "MessageResponse", "MessageBranch"],
    },
    stateTokens: {
      divider:
        "border-b (default border color, the subtle rung) between a column's header and body — same as the package's other header/body dividers",
      error:
        'text-destructive-text (TEXT rung, not -foreground) paired with AlertTriangleIcon + role="alert" — colour is never the only channel',
    },
    antiPatterns: [
      "Reaching for MessageCompareProvider/useMessageCompare() from a sibling control — both are unexported internal details; MessageCompare always owns a private instance, so use the controlled syncScroll/onSyncScrollChange props instead.",
      "Passing a columns count that disagrees with the number of MessageCompareColumn children — the grid renders from the actual children, not from columns, so a mismatch renders silently with no dev warning.",
      "Expecting a shared 'stick to bottom' driver across columns — each column's scroll is independent by construction; the only cross-column motion is the opt-in syncScroll proportional broadcast.",
      "Lifting MessageFeedback state above the column boundary — each MessageCompareColumn composes its own independent MessageFeedback instance with no shared vote state.",
    ],
  },

  MessageEdit: {
    purpose: "Edit-in-place for a user message — swaps the bubble between content and an editor.",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      contains: [
        "MessageEditProvider",
        "MessageEditTrigger",
        "MessageEditForm",
        "MessageEditContent",
      ],
      pairsWith: ["MessageBranch"],
    },
    antiPatterns: [
      "Mutating the original message on edit — it emits `onEditSubmit(newText)`; the consumer creates a branch.",
      "Leaving the edited turn as the only history — pair it with MessageBranch so the earlier version stays reachable.",
      "Re-implementing the key handling — Enter submits, Shift+Enter newlines, Esc cancels, and focus returns to the trigger.",
    ],
  },

  MessageFeedback: {
    purpose: "Thumbs up/down on a single assistant message.",
    category: "ai",
    relationships: { usedInside: ["Message", "MessageActions"], pairsWith: ["MessageAction"] },
    antiPatterns: [
      "Expecting it to persist the vote — it emits `onSubmit({ type })`; storage is the host's.",
      "Re-enabling the buttons after a vote — feedback is submit-once, and the root reports it via `data-submitted`.",
      "Putting it on a user turn — feedback is about the assistant's answer.",
    ],
  },

  MessageForm: {
    purpose:
      "A model-emitted, zod-validated form rendered inside a chat message; returns structured values on submit.",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      contains: [
        "MessageFormProvider",
        "MessageFormFields",
        "MessageFormSubmit",
        "MessageFormFallback",
      ],
      pairsWith: ["MessageTable", "AutoChart"],
    },
    antiPatterns: [
      "Letting a malformed spec throw — model output is untrusted; an invalid spec renders MessageFormFallback.",
      "Surfacing validation errors while the spec is still streaming — half-arrived fields are dropped, not reported as errors.",
      "Letting the model choose the look — it authors the spec; the component owns layout, tokens and focus handling.",
    ],
  },

  MessageTable: {
    purpose: "A model-emitted, column-oriented data table rendered as message content.",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      pairsWith: ["MessageForm", "AutoChart", "ToolResultCard"],
      avoidNextTo: ["DataTable"],
    },
    antiPatterns: [
      "Reaching for the DataTable instead — that is app chrome; this is message content, deliberately lighter.",
      "Throwing on a malformed spec — it falls back (MessageTableFallback), renders an em-dash for a missing cell, and drops half-arrived rows.",
      "Start-aligning numeric columns — numerics are end-aligned with tabular-nums so they compare down the column.",
    ],
  },

  Persona: {
    purpose: "The animated agent avatar/presence mark (Rive), used as the assistant's identity.",
    category: "ai",
    relationships: {
      usedInside: ["Message", "ChatShell"],
      pairsWith: ["MessageAvatar", "Shimmer"],
    },
    antiPatterns: [
      "Statically importing the Rive runtime — it is behind a dynamic import so the WebGL2 runtime and its .wasm stay out of every consumer's entry chunk (ADR 0019).",
      "Using it as the only in-progress signal — pair it with a real streaming affordance (Shimmer) that survives reduced motion.",
      "Dropping it in as decoration on every surface — it is the agent's identity, not a spinner.",
    ],
  },

  ProducedAssetTree: {
    purpose: "The `document`-flavoured tree of assets the agent produced, for the context rail.",
    category: "ai",
    relationships: {
      usedInside: ["ContextPanel"],
      pairsWith: ["AssetPreview", "FileTree"],
    },
    antiPatterns: [
      "Using the source-code FileTree look for produced documents — this is the document tree; the mono/box treatment belongs to source.",
      "Rendering it without a preview target — the tree is one half of a two-level pattern; selection drives AssetPreview.",
      "Inferring the icon from the file extension — the asset `type` selects it.",
    ],
  },

  Queue: {
    purpose:
      "The pending work list — queued user messages and agent to-dos, grouped and collapsible.",
    category: "ai",
    relationships: {
      contains: ["QueueSection", "QueueList", "QueueItem", "QueueItemAttachment"],
      pairsWith: ["Composer", "Plan"],
    },
    stateTokens: { itemHover: "hover:bg-muted (a row wash — the item is not a Card)" },
    antiPatterns: [
      "Using the Queue as a plan — a Plan is what the agent INTENDS; the queue is what is waiting to be sent/done.",
      "Rendering a queued message with no way to remove it — queued work must stay cancellable.",
      "Nesting it in the transcript — the queue is composer-adjacent chrome, not a turn.",
    ],
  },

  SchemaDisplay: {
    purpose:
      "An HTTP endpoint contract in chat — method, path, parameters, request and response shapes.",
    category: "ai",
    relationships: {
      usedInside: ["Message", "ToolResultCard"],
      contains: [
        "SchemaDisplayHeader",
        "SchemaDisplayParameters",
        "SchemaDisplayRequest",
        "SchemaDisplayResponse",
      ],
      pairsWith: ["CodeBlock", "Badge"],
    },
    antiPatterns: [
      "Pasting the raw OpenAPI JSON instead — that is a CodeBlock; this renders the contract as a readable table.",
      "Signalling the method with color only — the method is a Badge with its verb spelled out.",
      "Expanding every nested property — deep shapes stay behind the collapsible so the endpoint stays scannable.",
    ],
  },

  SelectionToolbar: {
    purpose:
      "A floating toolbar over selected transcript text, offering Quote as the default action.",
    category: "ai",
    relationships: { usedInside: ["Conversation"], pairsWith: ["Composer", "PromptInput"] },
    antiPatterns: [
      "Keeping it visible after the selection collapses — it is anchored to the selection rect and dismisses with it.",
      "Writing into the composer from the toolbar — it emits `onQuote(selectedText)`; the consumer decides what to insert.",
      "Wrapping the whole app in it — wrap the transcript region, or every selection in the UI sprouts a toolbar.",
    ],
  },

  StackTrace: {
    purpose: "A parsed error stack — error type, message and frames, with internals folded away.",
    category: "ai",
    relationships: {
      usedInside: ["Message", "ToolResultCard"],
      contains: ["StackTraceHeader", "StackTraceFrames", "StackTraceCopyButton"],
      pairsWith: ["CodeBlock", "Terminal"],
    },
    antiPatterns: [
      "Dumping the raw stack into a CodeBlock — pass the string here and the frames become readable and copyable.",
      "Expanding internal frames by default — the app frames are the signal; runtime internals stay collapsed.",
      "Rendering a stack while the tool call is still streaming — an error slot fires only on a terminal, settled failure.",
    ],
  },

  StreamingSuggestions: {
    purpose: "The suggestion strip while the set is still being generated.",
    category: "ai",
    relationships: { contains: ["SuggestionLoading"], pairsWith: ["Suggestion", "Suggestions"] },
    antiPatterns: [
      "Rendering an empty strip until the first suggestion lands — show the loading affordance so the row holds its space.",
      "Letting a half-arrived suggestion be clickable — a partial label is not an action.",
      "Animating the shimmer without a reduced-motion path — the streaming affordance is motion-gated.",
    ],
  },

  Suggestion: {
    purpose: "One tappable follow-up prompt the user can send with a click.",
    category: "ai",
    relationships: {
      usedInside: ["Suggestions", "Composer"],
      pairsWith: ["StreamingSuggestions", "PromptInput"],
    },
    antiPatterns: [
      "Styling a suggestion as a primary Button — it is an optional shortcut, not the turn's main action.",
      "Offering a long paragraph as a suggestion — it must read at a glance; truncation hides the meaning.",
      "Leaving suggestions on screen after the user has typed — they are a starting affordance, not permanent chrome.",
    ],
  },

  Test: {
    purpose: "One test-case row inside a test-results block — name, status and duration.",
    category: "ai",
    relationships: {
      usedInside: ["TestSuite", "TestResults"],
      contains: ["TestStatus", "TestName", "TestDuration", "TestError"],
      pairsWith: ["StatusBadge", "StackTrace"],
    },
    antiPatterns: [
      "Inventing a status string — the row speaks the closed 7-state status vocabulary, the same one StatusBadge uses.",
      "Colour-coding pass/fail with no icon or label — status must survive a monochrome theme.",
      "Showing the failure stack inline for every row — the error detail belongs behind the row's disclosure.",
    ],
  },

  ToolResultCard: {
    purpose:
      "The artifact a tool PRODUCED, presented as the headline — raised surface, no border, children carry the payload. Its header row is title | actions | status, where actions are scoped to the whole artifact (expand, download, open).",
    category: "ai",
    relationships: {
      usedInside: ["Message"],
      pairsWith: ["Tool", "AutoChart", "MessageTable", "Artifact", "ExpandDialog"],
    },
    antiPatterns: [
      "Adding a border to it — elevation IS the separation gesture here; a border on a raised fill is the redundant-border anti-pattern.",
      "Using it for a step that merely ran — that is Tool (rail + inspect); this hosts the produced object.",
      "Importing a chart/table package to render the payload inside it — it stays dependency-light; the consumer passes the node.",
      "Putting the payload's own controls in actions — actions is scoped to the artifact as a whole (expand, download, open); a chart's flip/zoom belongs to the chart's own frame.",
    ],
  },

  Transcription: {
    purpose: "Time-coded speech segments, highlighted against playback position and seekable.",
    category: "ai",
    relationships: {
      contains: ["TranscriptionSegment"],
      pairsWith: ["AudioPlayer", "SpeechInput"],
    },
    antiPatterns: [
      "Rendering the transcript as one paragraph — the segments carry the timings that make it seekable.",
      "Driving playback from the transcript's own state — it emits seeks; the player owns the clock.",
      "Marking the active segment with colour alone — the current segment must be identifiable without hue.",
    ],
  },

  // The in-chat agent WORKSPACE GRAPH (ADR 0018). This React Flow surface lives in
  // `@elabs-ai/components-ai` on purpose: an author-built diagram is
  // `@elabs-ai/components-flow` (CanvasShell/FlowNode); this is the graph an
  // agent renders inside a conversation. Picking the wrong one is the #1 mistake here,
  // so every entry names the boundary.

  Canvas: {
    purpose:
      "The in-chat agent workspace graph surface (React Flow) — the canvas an agent renders inside a conversation (ADR 0018).",
    category: "ai",
    relationships: {
      usedInside: ["ChatShell"],
      contains: ["Node", "Edge", "Controls", "Panel", "NodeToolbar", "Connection"],
      avoidNextTo: ["CanvasShell"],
    },
    antiPatterns: [
      "Reaching for it to build an author-made diagram — that is CanvasShell/FlowNode in the flow package; this one is the agent's in-chat graph.",
      "Re-enabling pan-on-drag — it pans on scroll and drags a SELECTION, so a drag that pans would break rubber-band select.",
      "Repainting the backdrop with a literal colour — the background is already painted from the theme's canvas token.",
    ],
  },

  Connection: {
    purpose: "The in-flight connection line drawn while the user drags a new edge on the Canvas.",
    category: "ai",
    relationships: { usedInside: ["Canvas"], pairsWith: ["Edge", "Node"] },
    antiPatterns: [
      "Styling it like a committed Edge — the pending line must read as provisional until it lands.",
      "Hard-coding its stroke — it draws with the focus/ring token so it stays visible in every theme.",
      "Rendering it outside a Canvas — it is React Flow's connection-line slot, not a standalone SVG.",
    ],
  },

  Controls: {
    purpose: "Zoom / fit / lock controls for the agent workspace Canvas.",
    category: "ai",
    relationships: { usedInside: ["Canvas"], pairsWith: ["Panel", "NodeToolbar"] },
    stateTokens: {
      surface: "bg-card + rounded-md border (a raised control cluster over the canvas)",
      buttonHover: "hover:bg-secondary",
    },
    antiPatterns: [
      "Building a second zoom control in a Panel — one control cluster per canvas, or the two disagree.",
      "Dropping the keyboard path — every canvas action must stay reachable without a pointer.",
      "Stacking it under the canvas content — it is chrome and must stay above the graph and clickable.",
    ],
  },

  Edge: {
    purpose: "A connection between two workspace-graph nodes — animated/temporary or committed.",
    category: "ai",
    relationships: { usedInside: ["Canvas"], pairsWith: ["Node", "Connection"] },
    stateTokens: { temporary: "stroke-ring + dashed (a proposed, not-yet-committed link)" },
    antiPatterns: [
      "Encoding edge meaning in colour alone — a dashed/solid distinction survives a monochrome theme; a hue does not.",
      "Labelling every edge — labels are for the edges whose relation is not obvious from the nodes.",
      "Routing edges by hand — the bezier path is derived from the handles; move the node, not the path.",
    ],
  },

  Node: {
    purpose: "A workspace-graph node — a Card with source/target handles, headed and slotted.",
    category: "ai",
    relationships: {
      usedInside: ["Canvas"],
      contains: [
        "NodeHeader",
        "NodeTitle",
        "NodeDescription",
        "NodeContent",
        "NodeFooter",
        "NodeAction",
      ],
      pairsWith: ["Edge", "NodeToolbar"],
      avoidNextTo: ["FlowNode"],
    },
    antiPatterns: [
      "Confusing it with FlowNode — FlowNode is the author-built canvas node in the flow package; this is the in-chat agent graph's node (ADR 0018).",
      "Declaring handles it does not use — `handles` drives the connectable sides, so a stray one invites an impossible edge.",
      "Pouring a whole document into the body — a node is a summary; the detail belongs in a panel or an Artifact.",
    ],
  },

  Panel: {
    purpose: "A floating overlay panel pinned to a corner of the workspace Canvas.",
    category: "ai",
    relationships: { usedInside: ["Canvas"], pairsWith: ["Controls", "NodeToolbar"] },
    stateTokens: { surface: "bg-card + rounded-md border (raised above the canvas ground)" },
    antiPatterns: [
      "Using it as the app's side rail — that is ContextPanel; this floats over the graph.",
      "Filling a corner panel with a long scrollable list — it overlays the graph the user is trying to read.",
      "Stacking several panels in one corner — they occlude each other; give each corner one job.",
    ],
  },

  NodeToolbar: {
    purpose: "The contextual action bar attached to a selected workspace-graph node.",
    category: "ai",
    relationships: { usedInside: ["Canvas"], pairsWith: ["Node", "Controls"] },
    antiPatterns: [
      "Using it as the canvas-wide toolbar — it is a NODE toolbar and is positioned against the selected node.",
      "Reaching for it when you want the WAI-ARIA keyboard toolbar — that is Toolbar in @elabs-ai/components-ui.",
      "Putting destructive node actions in it with no confirm/undo — deleting a node loses its edges too.",
      "Filling it with icon-only buttons and no labels — every icon-only control needs an accessible name.",
    ],
  },

  MicSelector: {
    purpose: "Input-device picker for voice capture — a searchable Command list in a Popover.",
    category: "ai",
    relationships: {
      contains: ["MicSelectorTrigger", "MicSelectorContent", "MicSelectorList", "MicSelectorItem"],
      pairsWith: ["SpeechInput", "VoiceSelector"],
    },
    antiPatterns: [
      "Enumerating devices before the user asks — device labels need permission, so an unprompted list reads as empty/garbled.",
      "Rendering the raw `deviceId` — show the human label; the id is machine detail.",
      "Skipping MicSelectorEmpty — no devices (or no permission) is a real state, not a blank popover.",
    ],
  },

  OpenIn: {
    purpose:
      "A menu that hands the current prompt off to an external chat product via a deep link.",
    category: "ai",
    relationships: {
      contains: ["OpenInTrigger", "OpenInContent", "OpenInItem", "OpenInLabel"],
      pairsWith: ["Composer", "PromptInput"],
    },
    antiPatterns: [
      "Adding a provider by pasting a new origin inline — every shipped https origin has to be allow-listed and documented (`pnpm origins:check`).",
      "Sending anything but the prompt — the deep link leaves your app, so it must not carry conversation or user data.",
      "Presenting it as a primary action — it is an escape hatch beside the answer, not the way to continue the chat.",
    ],
  },

  PackageInfo: {
    purpose: "A dependency and its version change — name, current→new version and change type.",
    category: "ai",
    relationships: {
      contains: [
        "PackageInfoHeader",
        "PackageInfoName",
        "PackageInfoVersion",
        "PackageInfoChangeType",
      ],
      pairsWith: ["Badge", "Commit"],
    },
    antiPatterns: [
      "Showing the change type as a coloured dot — major/minor/patch is a Badge with the word in it.",
      "Rendering a version bump with only the new version — the current→new pair is the whole point.",
      "Using it for a package LIST with no grouping — a long flat list of bumps is unreadable; group by change type.",
    ],
  },

  SpeechInput: {
    purpose:
      "Push-to-talk capture for the composer — Web Speech API where available, MediaRecorder elsewhere.",
    category: "ai",
    relationships: {
      usedInside: ["Composer", "PromptInput"],
      pairsWith: ["MicSelector", "Transcription", "Spinner"],
    },
    antiPatterns: [
      "Assuming the Web Speech API exists — Firefox/Safari take the MediaRecorder path, which returns a Blob your host must transcribe.",
      "Leaving recording running with no visible state — capture is a privacy-relevant mode and must be obvious and stoppable.",
      "Treating a transcription round-trip as instant — show the in-flight state; a silent pause reads as a broken button.",
    ],
  },

  VoiceSelector: {
    purpose:
      "Voice picker for speech output — searchable list with per-voice attributes and preview.",
    category: "ai",
    relationships: {
      contains: [
        "VoiceSelectorTrigger",
        "VoiceSelectorContent",
        "VoiceSelectorList",
        "VoiceSelectorPreview",
      ],
      pairsWith: ["AudioPlayer", "MicSelector"],
    },
    antiPatterns: [
      "Listing voices with no preview — a name tells the user nothing about how the voice sounds.",
      "Auto-playing a preview on hover — playback is a click, not a pointer side effect.",
      "Describing a voice by gender/age alone — the attributes are supplementary; the label is the identity.",
    ],
  },
};

/**
 * Fold the authored intent map into a package's components. Returns a NEW map
 * keyed by component name → IntentMeta, INCLUDING ONLY components that both (a)
 * have authored intent and (b) are actually exported by this package — so the
 * manifest never lists intent for a component a package doesn't ship. Keys are
 * emitted sorted for deterministic output. Absent components degrade gracefully.
 *
 * @param {{ name: string }[]} components  the package's exported components
 * @returns {Record<string, IntentMeta>}
 */
export function collectIntent(components) {
  const out = {};
  const names = new Set(components.map((c) => c.name));
  for (const name of Object.keys(INTENT).sort((a, b) => a.localeCompare(b))) {
    if (names.has(name)) out[name] = INTENT[name];
  }
  return out;
}
