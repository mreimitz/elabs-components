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
 *                                      //   feedback | navigation | display | ai | chart | flow |
 *                                      //   terminal
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
      "Hand-building a search field on it — a leading icon plus a clear button is SearchInput in @elabs-ai/components-data.",
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
      "Using it to carry an execution status — that is StatusBadge, whose closed seven-state vocabulary pairs a distinct glyph with every tone so the state survives greyscale.",
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
      "Reaching for it for a coding-agent CLI surface — the console frame is TerminalConsole, which makes every region inside it flush.",
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
      "Reaching for it in a console transcript — the console scrolling transcript region is TerminalSurface.",
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
      "Reaching for it in a console transcript — one line of a console transcript is TerminalTranscriptRow, not a chat bubble.",
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
      "Reaching for it in a console transcript — the console skin of a tool call is TerminalToolCall in @elabs-ai/components-terminal; this package must never be imported from there.",
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
      contains: [
        "PromptInput",
        "PromptInputTextarea",
        "PromptInputTools",
        "PromptInputSubmit",
        "PromptInputMode",
        "PromptInputEffort",
        "PromptInputSlash",
      ],
      pairsWith: ["Conversation", "ModelPicker"],
    },
    stateTokens: { submit: "status=ready|submitted|streaming|error" },
    antiPatterns: [
      "Hand-rolling a PromptInput footer per app — Composer is the shipped assembly; reach for it first.",
      "Dropping to PromptInput to get a mode, effort or slash-command control — Composer exposes all three as props (mode, effort, slashCommands/onSlashCommand); drop to PromptInput only for a bespoke shell.",
      "Expecting a model name in the footer by default — the old static `model` pill is gone; pass a ModelPicker (@elabs-ai/components-ui) to the `modelPicker` slot.",
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
    category: "terminal",
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

  ModelProviderLogo: {
    purpose: "The mark of an AI model provider, sized for a row in a model list.",
    category: "ai",
    relationships: {
      usedInside: ["ModelPicker", "CommandItem"],
      contains: ["ModelProviderLogoGroup"],
      pairsWith: ["ModelPicker", "CommandDialog"],
      avoidNextTo: [
        "ServiceLogo — that one is the registry-driven mark for any OTHER third-party service, and never fetches at runtime",
      ],
    },
    stateTokens: {
      blocked:
        "onError swaps the img for a neutral Lucide glyph (or the caller's `fallback`) — never a broken-image icon",
    },
    antiPatterns: [
      "Shipping the default models.dev URL into a deployment with a restrictive img-src — self-host and pass `src`, or set `fallback` (docs/CSP-AND-NETWORK.md).",
      "Reaching for it as a general service-logo slot — a non-AI-provider mark is ServiceLogo (@elabs-ai/components-icons), which is registry-driven and never fetched.",
      "Translating provider brand names in the surrounding row — mark them i18n-exempt instead.",
      "Building a model palette by wrapping it in a bespoke selector component — an inline pill is ModelPicker, a ⌘K palette is CommandDialog + Command* composed directly.",
    ],
  },

  ApprovalCard: {
    purpose:
      "The named human-in-the-loop variant of Confirmation — a titled, described approval card, binary or N-option with scope.",
    category: "ai",
    relationships: {
      contains: [
        "ApprovalCardRequest",
        "ApprovalCardTitle",
        "ApprovalCardDescription",
        "ApprovalCardActions",
        "ApprovalCardApprove",
        "ApprovalCardDeny",
        "ApprovalCardOptions",
        "ApprovalCardTarget",
        "ApprovalCardReason",
      ],
      pairsWith: ["Confirmation", "Tool", "DiffView", "PermissionModeSelect"],
    },
    stateTokens: {
      scope:
        "each option's blast radius (once / session / always / deny) is a SENTENCE linked by aria-describedby, never a colour",
      pending:
        "role=group + aria-labelledby while the human decides — the card holds focusable controls, so it is not a live region",
    },
    antiPatterns: [
      "Reaching for it in a console transcript — the console skin is TerminalPermission, which reads the same promoted ApprovalScope model.",
      "Building a second approve/deny widget — ApprovalCard and Confirmation ship from the same module; extend, don't fork.",
      "Running the action the card describes on render — the card emits a decision; the app performs it (D5).",
      "Leaving the request mounted after the human answers — swap to ApprovalCardAccepted/ApprovalCardRejected so the outcome stays legible.",
      "Hand-rolling roving focus across the options — the option list is a real Radix RadioGroup; arrow-key wrap is the primitive's job.",
      "Offering 'always' and 'once' with the same words — the scope sentence is what stops a session-wide grant from reading like a single yes.",
      "Making the deny reason a separate step — the reason field writes into the card's own state and rides along with whichever choice is committed.",
    ],
  },

  Plan: {
    purpose:
      "A Card-shaped, collapsible plan the agent proposes before it starts executing — and the decision the human returns.",
    category: "ai",
    relationships: {
      contains: [
        "PlanHeader",
        "PlanTitle",
        "PlanTrigger",
        "PlanContent",
        "PlanFooter",
        "PlanStatusLine",
        "PlanApprove",
        "PlanRequestChanges",
        "PlanComment",
      ],
      pairsWith: ["Task", "ChainOfThought", "Shimmer", "ApprovalCard"],
    },
    stateTokens: {
      approved: "border-s-4 border-s-success rail on the card",
      "changes-requested": "border-s-4 border-s-warning rail on the card",
      awaiting: "border-s-4 border-s-border-strong rail on the card",
    },
    antiPatterns: [
      "Reaching for it in a console transcript — the console counterpart of a three-state agent checklist is TerminalTodoList.",
      "Rendering a parse/validation error while the plan is still arriving — a half-streamed plan is not a failure (loading-states.md).",
      "Using Plan for a finished run — a settled trace is a Task; Plan is the intent, not the record.",
      "Hand-rolling the streaming affordance — pass `isStreaming` and let the shipped Shimmer carry it.",
      "Wrapping a pending decision in an assertive live region — it contains focusable controls, so it is a labelled group; only the settled outcome announces.",
      "Encoding the decision by rail colour alone — the status line states it in text as well.",
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
      "Reaching for it in a console transcript — the console counterpart of an agent checklist is TerminalTodoList.",
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
      "Reaching for it to let a person EDIT code — this is a read-only view of a code-execution tool part; the real editing surface is CodeEditor in @elabs-ai/components-editor.",
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

  TerminalTranscriptRow: {
    purpose:
      "One line of an agent transcript on top of TerminalRow: a closed kind axis (user/agent/output/error) that carries who spoke and whether it failed as a glyph, a colour and an accessible label.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalSurface", "TerminalRow"],
      avoidNextTo: ["a second row claiming the same settled turn's error"],
    },
    stateTokens: {
      output: "text-terminal-muted",
      error: "text-terminal-ansi-red",
    },
    antiPatterns: [
      'Rendering `kind="error"` while a turn is still streaming — errors are for settled, terminal failures only (`.claude/rules/loading-states.md`).',
      "Relying on colour alone to distinguish `error` — the glyph and the `gutterLabel` word are the load-bearing channels; colour is redundant.",
      "Reaching for a vendor mode/effort union on `kind` — the axis is closed to `user`/`agent`/`output`/`error`, nothing else (#117 acceptance criterion).",
      "Formatting `exitCode` yourself into a string — pass the number and let the component render the affordance.",
    ],
  },

  TerminalTodoList: {
    purpose:
      "A three-state checklist (done/active/pending) rendered as a real <ol>/<li>, where each row's state is a glyph AND an announced word riding TerminalRow's gutterLabel, so it survives greyscale and reaches assistive tech.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalRow", "TerminalSurface"],
    },
    stateTokens: {
      done: "text-terminal-muted line-through",
      active: "font-semibold",
    },
    antiPatterns: [
      "Minting a fourth `done|active|todo` union — it reuses `@elabs-ai/components-ui`'s `TimelineStatus` (`done|active|pending`) so the vocabulary can't drift from Timeline's.",
      "Rendering the state as a Lucide icon — the upstream grammar IS the literal ✔ / ◼ / ◻ characters; the fidelity axis reproduces that exactly.",
      "Hand-rolling a second `sr-only` span for the state word — it rides `TerminalRow`'s existing `gutterLabel`, which already suppresses the glyph correctly per variant.",
      "Reproducing upstream's `\"  ⎿ \"` / four-space character padding — that is `ch`-unit alignment; `TerminalRow`'s gutter grid track does the same job without it.",
    ],
  },

  TerminalEventLine: {
    purpose:
      "The CLI dress of an agent lifecycle/hook event line: a fixed marker glyph, a label, and an optional phase/hook-count/duration, sharing AgentEvent's outcome and hook-count model so the two skins stay in sync.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalRow", "TerminalSurface"],
      avoidNextTo: ["AgentEvent (that is the chat skin of the same model, not a row sibling)"],
    },
    stateTokens: {
      hooksFailed: "text-destructive-text",
      hooksOk: "text-terminal-muted",
    },
    antiPatterns: [
      "Importing AgentEvent or anything from `@elabs-ai/components-ai` — `terminal` and `ai` are layer-2 DAG siblings; the shared model lives in `@elabs-ai/components-ui` instead.",
      "Rendering the outcome word only when it is bad — `succeeded` gets the same glyph-plus-sr-only-word treatment as `blocked`/`failed`, never a silently unmarked default.",
      "Treating a `hooks` summary's `passed < ran` as merely informational — that mismatch is an independent failure signal (a distinct glyph plus an `sr-only` count), regardless of the row's own `outcome`.",
      "Renaming `hooks` to `checks` to match AgentEvent literally — the rendered vocabulary IS the literal upstream word \"hooks\", and this component's bracket is a terser summary, never AgentEvent's per-check breakdown list.",
    ],
  },

  TerminalWorking: {
    purpose:
      "The in-turn footer row pinned last in a transcript: a spinner/diamond glyph, a label, elapsed time, token spend and a stop control — the three facts and an exit the human needs while the agent runs.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalSurface", "TerminalRow", "TerminalTranscriptRow"],
    },
    stateTokens: {
      trailing: "text-terminal-muted tabular-nums",
    },
    antiPatterns: [
      "Running a setInterval to advance the spinner or tick elapsedMs — the spinner is a pure CSS keyframe and elapsedMs is a caller-supplied snapshot (D5); this component owns no timer.",
      "Announcing the ticking elapsed time or token count in the live region — exactly one role=status announces `label`; the stats are plain, non-live text or assistive tech is flooded on every re-render.",
      "Inventing a keyboard shortcut for the stop control — `stopShortcut` is caller-supplied (mirrors SessionHeader's/PermissionModeSelect's `keyHint`); the component never hardcodes a binding.",
      "Hand-rolling a second compact-number formatter for `tokens` — it renders through `useLocale().formatNumber`, not a bespoke compacter.",
    ],
  },

  TerminalStatusBar: {
    purpose:
      "The ambient chrome row along the bottom of a console surface: branch and working directory on the left, connection/context/turn progress on the right, every fact independently optional.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalSurface"],
    },
    stateTokens: {
      disconnectedGlyph: "text-terminal-ansi-bright-red",
      disconnectedText: "text-terminal-foreground",
    },
    antiPatterns: [
      "Reaching for `@elabs-ai/components-ai`'s `Context` component or its tokenlens math — `terminal` and `ai` are layer-2 DAG siblings; `context` takes two ALREADY-FORMATTED display strings the caller computed, never raw token counts to abbreviate.",
      "Relying on colour alone for `connections.disconnected` — it renders a distinct glyph (UnplugIcon, not PlugZapIcon) plus its own visible text label, recoverable in greyscale and by a screen reader.",
      'Adding a second `role="status"` on an inner segment — the container itself is already the one live region; a nested one duplicates announcements.',
      "Rendering the right-cluster divider as a literal `│` character — that is a box-drawing glyph as text; it is a plain `bg-terminal-border` rule instead.",
    ],
  },

  TerminalBanner: {
    purpose:
      "The console-dress launch card above an empty transcript: identity (name, model, version, workspace), capabilities, what's new and quick actions with key hints — every section independently optional.",
    category: "terminal",
    relationships: {
      contains: ["TerminalRow"],
      pairsWith: ["TerminalSurface", "TerminalTranscriptRow", "TerminalWorking"],
    },
    stateTokens: {
      quickAction: "hover:bg-terminal-selection hover:text-terminal-foreground",
      whatsNewLink: "text-terminal-ansi-bright-cyan",
    },
    antiPatterns: [
      "Using `<fieldset>`/`<legend>` to sit the title in the border — that misreports a decorative heading as a form-control group to assistive tech; it renders a real Heading beside a real border instead.",
      "Rendering a vendor bitmap logo — the component ships no mark of its own; `logo` is a caller-supplied `ReactNode` slot, never a baked-in wordmark (#117 acceptance criterion).",
      "Truncating `workspace` to one line — long paths WRAP so the full value stays reachable, matching the family's wrap-over-truncate fidelity axis rather than SessionHeader's single-line truncation.",
      "Importing `SessionHeader` or anything from `@elabs-ai/components-ai` — `terminal` and `ai` are layer-2 DAG siblings; the shared vocabulary (`SessionCapability`/`SessionWhatsNewItem`/`SessionQuickAction`) lives in `@elabs-ai/components-ui` instead.",
    ],
  },

  TerminalToolCall: {
    purpose:
      "A single tool invocation dressed as a CLI line: a status glyph (success/error/pending), the tool name plus its optional argument in parentheses, a result summary on a `⎿` row, and detail behind a real disclosure.",
    category: "terminal",
    relationships: {
      contains: ["TerminalRow"],
      pairsWith: ["TerminalSurface", "TerminalRow"],
      avoidNextTo: ["Tool (that is the chat skin of the same fact, not a row sibling)"],
    },
    stateTokens: {
      success: "text-terminal-ansi-green",
      error: "text-terminal-ansi-red",
      pending: "text-terminal-ansi-yellow",
    },
    antiPatterns: [
      "Relying on the recoloured `⏺` alone to tell success from error — only `success` keeps that literal glyph; `error`/`pending` each get their own shape (`✗`/`○`) plus `gutterLabel`'s announced word, never colour alone.",
      'Setting `role="alert"` while `status="pending"` — a still-running call is not a settled failure (`.claude/rules/loading-states.md`); only `error` fires the alert.',
      "Reaching for the 7-state canonical `Status` or `TimelineStatus` — neither matches this grammar's exact `success`/`error`/`pending` vocabulary or its live-not-yet-settled meaning of `pending`.",
      'Reproducing upstream\'s inert `"(ctrl+o to expand)"` hint as decorative text — the expand affordance is a real, localized, focusable `CollapsibleTrigger`, so a keyboard user never needs to know a CLI chord.',
      "Putting expansion state in `TerminalSurface`'s context — it is per-row Radix `Collapsible` state, same as every other disclosure in this family.",
    ],
  },

  TerminalDiffHunk: {
    purpose:
      "An inline unified diff hunk in console dress: a header naming the file, then one row per line — a line-number column, a polarity marker, and the line text — with a collapsed run of context lines behind a real disclosure.",
    category: "terminal",
    relationships: {
      contains: ["TerminalRow"],
      pairsWith: ["TerminalSurface", "TerminalRow"],
      avoidNextTo: [
        "DiffView (that is the chat skin of the same shared diff model, not a row sibling)",
      ],
    },
    stateTokens: {
      add: "bg-terminal-ansi-green/10",
      del: "bg-terminal-ansi-red/10",
    },
    antiPatterns: [
      'Re-deriving the `"added: "`/`"removed: "` polarity words locally — they ride the promoted `diffLineAccessibleLabel()` shared with DiffView (`@elabs-ai/components-ai`); a second implementation drifts from it.',
      "Rendering the line number as a `ch`-unit padded string — it is a plain layout box in the content cell, never text-column arithmetic.",
      "Truncating a long line instead of wrapping it — `min-w-0` plus `whitespace-pre-wrap` on the text cell is what lets it wrap under the content column.",
      "Putting the collapsed-context-run's expansion in `TerminalSurface`'s context, or hand-rolling a one-way 'show more' button — it is a real, per-row Radix `Collapsible`, same as every other disclosure in this family.",
    ],
  },

  TerminalPermission: {
    purpose:
      "The per-call scoped approval prompt: title, command preview, question, then numbered options whose SCOPE (once/session/deny) is stated in real label text and chosen through a real Radix RadioGroup, never a hand-rolled focus walk.",
    category: "terminal",
    relationships: {
      contains: ["TerminalRow", "TerminalSurface"],
      pairsWith: ["TerminalSurface", "TerminalRow"],
      avoidNextTo: [
        "ApprovalCardOptions (that is the chat skin of the same shared approval model, not a row sibling)",
      ],
    },
    antiPatterns: [
      "Importing ApprovalCardOptions/Confirmation or anything from `@elabs-ai/components-ai` — `terminal` and `ai` are layer-2 DAG siblings; the shared model (`ApprovalScope`/`ApprovalOption`/`APPROVAL_SCOPE_DESCRIPTION_KEYS`) lives in `@elabs-ai/components-ui` instead.",
      "Walking `parentElement.children[i]` for roving focus — a real Radix `RadioGroup` owns keyboard navigation, matching the family's fidelity axis.",
      "Naming a vendor product in the deny option's label — the third option declines and redirects the agent using the vendor-free `ApprovalScope` vocabulary, never the upstream product name (#117 acceptance criterion).",
      "Always rendering the reason field — it only reveals, through a real Radix `Collapsible`, once the deny-scoped option is the one selected.",
    ],
  },

  TerminalComposer: {
    purpose:
      "The prompt composer for the agent-session family: a text input well, an optional mode indicator, an optional ordered effort scale, a shortcut-hint row, and a submit affordance that becomes a stop affordance while busy.",
    category: "terminal",
    relationships: {
      contains: ["TerminalSurface"],
      pairsWith: ["TerminalSurface"],
      avoidNextTo: [
        "PromptInput (that is the chat skin of the same composer concept, not a console-transcript sibling)",
      ],
    },
    stateTokens: {
      effortFilled: "border-terminal-accent! bg-terminal-accent",
      effortHollow: "border-terminal-border! bg-transparent",
      modeTrigger: "hover:bg-terminal-selection hover:text-terminal-foreground",
      submit: "bg-terminal-accent text-terminal-accent-foreground",
      caret: "caret-terminal-cursor",
    },
    antiPatterns: [
      'Shipping a vendor mode/effort union such as `"auto" | "accept-edits" | "plan"` in a public type — `modes`/`effortLevels` are entirely app-supplied `OperatingMode[]`/`EffortLevel[]` (#117 acceptance criterion).',
      "Using the native `disabled` attribute for the resting empty-composer state — it drops a focused control from the tab order after every keyboard submit; the affordance is `aria-disabled`, matching `PromptInputSubmit`'s contract.",
      "Adding an `onPaste` handler that calls `preventDefault()` — paste is never blocked, and the caret is the browser's own, tinted via `caret-terminal-cursor`, never a hand-drawn glyph.",
      "Relying on the effort scale's fill/size ramp alone — each rung also carries `aria-label={level.label}` and the current level's name renders as real visible text, so the level reaches assistive tech as words, not only as a filled shape.",
      "Importing `PromptInputMode`/`PromptInputEffort` or anything from `@elabs-ai/components-ai` — `terminal` and `ai` are layer-2 DAG siblings; the shared vocabulary (`OperatingMode`/`EffortLevel`/`effortRungForIndex`) lives in `@elabs-ai/components-ui` instead.",
    ],
  },

  TerminalOverlay: {
    purpose:
      "The console-dress modal frame: a real Radix Dialog painted on the terminal ground, with a title row, arbitrary caller content, and an optional key-hint legend along the bottom — a frame, not a catalogue of panels.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalSurface", "KeyboardShortcuts"],
    },
    stateTokens: {
      chrome: "bg-terminal-background text-terminal-foreground",
      legend: "border-terminal-border text-terminal-muted",
    },
    antiPatterns: [
      "Keeping DialogContent's baked-in close icon — it is styled with `text-muted-foreground`, a token calibrated for `--card`/`--background`, never the terminal ground (the same class of bug a sibling already had to repair on this ground); it is hidden and replaced with a close control styled from the terminal token group.",
      "Adding a `border` alongside the dialog's `shadow-ring-*` — an overlay floats; the elevation rule bans a border beside a ring shadow (the 'double edge').",
      "Rendering the footer's key glyphs as the only carrier of an action's meaning — each hint's action reaches assistive tech as real words; the glyph is decorative.",
      "Building the settings-modal catalogue itself here — this component is the ground, the dismissal and the legend only; the content is the caller's (a stated #117 non-goal).",
    ],
  },

  TerminalSlashMenu: {
    purpose:
      "The `/`-command palette for the console composer: a popover listbox anchored to TerminalComposer's own textarea, filtered by prefix, navigated with wrapping/clamped arrow keys, and spliced into the text on Enter — the caret never leaves the field.",
    category: "terminal",
    relationships: {
      contains: ["TerminalComposer"],
      pairsWith: ["TerminalComposer"],
      avoidNextTo: [
        "PromptInputSlash (that is the chat skin of the same trigger-palette concept, not a console-transcript sibling)",
      ],
    },
    stateTokens: {
      content: "bg-terminal-background text-terminal-foreground",
      activeItem: "bg-terminal-selection",
      activeMarker: "text-terminal-accent",
    },
    antiPatterns: [
      "Re-declaring `SlashCommand`/`defaultSlashCommandFilter`/`stepIndex`/`findTriggerQuery`/`replaceTriggerRun` locally — all five are promoted to `@elabs-ai/components-ui` precisely so this package and `@elabs-ai/components-ai` cannot drift; import them.",
      "Detecting the `/` trigger from a keydown handler instead of deriving it from committed text + caret — a keydown-driven trigger has to `preventDefault()` every printable character, which breaks IME composition, undo, spellcheck and paste.",
      'Calling `findTriggerQuery` with the default word boundary — a slash palette needs `{ boundary: "line-start" }`, or `cd /usr` would wrongly open the popup mid-command.',
      "Distinguishing the active row with `bg-terminal-selection` alone — a sighted user in greyscale needs a second channel too, so a reserved-width `❯` marker (this family's established 'current' glyph) renders only on the active row.",
      "Querying the textarea with `querySelector` — `TerminalComposer`'s `textareaRef` prop exists precisely so a caret-tracking wrapper never needs to.",
      "Leaving a row's description at `text-terminal-muted` once it is active — `--terminal-selection` is only authored to guarantee AA for `--terminal-foreground`/`--terminal-ansi-white` (see that token's comment in `themes.css`), and `--terminal-muted` measures 3.61:1 on it, a real axe failure a unit test cannot see. The active row upgrades to `text-terminal-foreground`.",
    ],
  },

  TerminalConsole: {
    purpose:
      "The console FRAME (ADR 0033): the one resting surface a coding-agent console draws — edge, radius, ground and elevation — so a transcript, banner, permission prompt, composer and status bar sit inside it as flush regions separated by a single seam instead of as separately framed cards.",
    category: "terminal",
    relationships: {
      contains: [
        "TerminalSurface",
        "TerminalBanner",
        "TerminalComposer",
        "TerminalPermission",
        "TerminalStatusBar",
      ],
    },
    stateTokens: {
      frame: "rounded-lg border-terminal-border bg-terminal-background shadow-sm",
      seam: "border-t border-terminal-border",
    },
    antiPatterns: [
      "Stacking a second framed piece inside it — a region never draws its own radius, border, shadow or ground; ADR 0033's whole point is exactly one edge per console.",
      "Adding a `variant`, transcript state, expansion state or a clock to its context — it publishes one static boolean, forever, the same prohibition `TerminalSurface`'s `variant` context carries.",
      "Negating a region's frame with `rounded-none border-0 shadow-none` instead of omitting it — `TerminalSurface`'s frame-aware branch OMITS those classes; a caller who wants a framed region back adds them through `className`.",
      "Nesting a console inside another console — a split view of two sessions is two consoles side by side in a layout, never a frame inside a frame.",
    ],
  },

  TerminalSurface: {
    purpose:
      "The console ground for the agent-session family: the terminal surface, the mono type role and the two-column gutter grid, established once and published to every row inside.",
    category: "terminal",
    relationships: {
      contains: ["TerminalRow"],
      pairsWith: ["Terminal", "InteractiveTerminal"],
    },
    stateTokens: {
      surface: "bg-terminal-background text-terminal-foreground border-terminal-border",
      elevation: "shadow-sm",
    },
    antiPatterns: [
      "Adding a second value to its context — it publishes `variant` and nothing else; transcript state, expansion state and a clock all belong to the caller or to the row (D5).",
      "Expecting it to scroll — it owns no scroll container on purpose, so a caller's virtualizer for a long transcript is never fought.",
      "Declaring `--terminal-gutter` in themes.css — it is a local layout custom property, not a theme token; it does not vary by theme.",
      "Reaching for a spinner while `loading` — the not-ready rung is layout-shaped skeleton rows rendered through the real TerminalRow, behind exactly one live region.",
    ],
  },

  TerminalRow: {
    purpose:
      "The two-column [gutter][content] grid primitive every console row is built from, with the gutter's meaning carried as words for assistive tech.",
    category: "terminal",
    relationships: {
      pairsWith: ["TerminalSurface"],
    },
    stateTokens: {
      gutter: "text-terminal-muted",
      rail: "border-s-2 border-terminal-border",
    },
    antiPatterns: [
      "Passing a meaningful glyph as `gutter` with no `gutterLabel` — the glyph is aria-hidden, so the row's meaning would exist only as decoration (WCAG 1.4.1).",
      "Aligning columns with `ch` units or padding — the gutter is a grid track, which is what makes a wrapped continuation line align for free.",
      "Dropping `min-w-0` from the content cell — without it, and the grid's `minmax(0,1fr)`, a long path pushes the row out of the surface instead of wrapping.",
      "Writing box-drawing characters as a border — a screen reader reads them aloud and they collapse at a font fallback; the `boxed` variant uses a real border.",
    ],
  },

  Terminal: {
    purpose: "Read-only ANSI console output with copy/clear actions and stick-to-bottom streaming.",
    category: "terminal",
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

  AudioVisualizer: {
    purpose: "Canvas-drawn live mic-level / waveform meter, driven entirely by a `levels` prop.",
    category: "ai",
    relationships: {
      pairsWith: ["MicSelector", "SpeechInput"],
    },
    antiPatterns: [
      "Passing it a MediaStream or calling getUserMedia inside it — it is presentation-only; feed it `levels` your own analyser loop already computed (D5).",
      "Reaching for the opt-in useAudioLevel hook from inside this component — the hook only ever creates an AudioContext when a caller-supplied stream is handed to IT, and it stays a separate export the component never imports.",
      "Relying on colour alone for level — bar/wave HEIGHT carries the amplitude; colour is decorative, never the only channel.",
      "Expecting the scrolling waveform to keep animating under prefers-reduced-motion — the reduced-motion path renders a static bar chart of the current levels instead of interpolating, so the state stays legible rather than frozen mid-frame.",
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

  TokenUsage: {
    purpose:
      "Context-window usage readout for a model turn — used vs max tokens, with a hover breakdown.",
    category: "ai",
    relationships: {
      usedInside: ["Composer", "PromptInput"],
      contains: ["TokenUsageTrigger", "TokenUsageContent", "TokenUsageInput", "TokenUsageCache"],
      pairsWith: ["ModelPicker"],
    },
    antiPatterns: [
      "Confusing it with ContextPanel — this is the context-WINDOW usage ring; ContextPanel is the chat workspace's right rail of produced assets.",
      "Rendering it as a bare percentage — the trigger is a gauge plus the numbers; a naked number is unreadable at a glance.",
      "Feeding it estimated token counts — it is a factual readout; if the usage is unknown, do not render it.",
      "Putting it inside the transcript — usage is composer chrome, not message content.",
    ],
  },

  Sidebar: {
    purpose:
      "The sidebar PRIMITIVE set you assemble yourself — provider, rail, header/content/footer regions and the menu parts.",
    category: "layout",
    relationships: {
      contains: [
        "SidebarHeader",
        "SidebarContent",
        "SidebarFooter",
        "SidebarMenu",
        "SidebarMenuButton",
        "SidebarTrigger",
        "SidebarInset",
      ],
      pairsWith: ["SidebarProvider", "AppSidebar"],
      avoidNextTo: ["AppSidebar"],
    },
    antiPatterns: [
      "Rebuilding the Sidebar -> SidebarHeader -> SidebarContent -> SidebarFooter skeleton by hand — that skeleton IS AppSidebar, which takes typed header/footer slots.",
      "Rendering it outside SidebarProvider — the open state, the keyboard shortcut and the cookie persistence all live on the provider.",
      "Conditionally mounting it to collapse it — the collapse is a width tween on an always-mounted rail; a conditional mount cannot animate.",
    ],
  },
  AppSidebar: {
    purpose:
      "The opinionated application sidebar: the Sidebar skeleton behind typed header and footer slots, with the navigation as children.",
    category: "layout",
    relationships: {
      usedInside: ["SidebarProvider"],
      contains: ["SidebarHeader", "SidebarContent", "SidebarFooter"],
      pairsWith: ["SidebarInset", "Sidebar"],
      avoidNextTo: ["Sidebar"],
    },
    antiPatterns: [
      "Reaching for it when the shell is genuinely bespoke — then compose the Sidebar primitive set directly instead of fighting the typed slots.",
      "Passing a whole nav tree through the header slot — header is the identity row; the navigation is children.",
      "Forgetting SidebarInset for the content pane — the canvas must read brighter than the chrome, which is what stops an app shell going flat.",
    ],
  },
  ViewToolbar: {
    purpose:
      "The row above a list, table or board — status and filters on the left, actions on the right, every control its own tab stop.",
    category: "layout",
    relationships: {
      contains: ["ViewToolbarFilters", "FilterChip", "ResultCount"],
      pairsWith: ["DataTable", "SearchInput", "FacetFilter"],
      avoidNextTo: ["Toolbar"],
    },
    antiPatterns: [
      "Giving it role=toolbar — it deliberately does not claim that role; a dense row that should cost ONE tab stop with arrow-key roving is Toolbar.",
      "Putting the primary page action in it — this row acts on the VIEW; a page-level action belongs in the page header.",
      "Hiding the result count while filters are applied — the count is how a person tells an empty filter from an empty dataset.",
    ],
  },
  StatusBadge: {
    purpose:
      "The closed seven-state execution-status vocabulary, each state carrying its own icon as well as its own tone.",
    category: "display",
    relationships: {
      pairsWith: ["Badge", "AgentTimeline", "Tool"],
      avoidNextTo: ["Badge"],
    },
    antiPatterns: [
      "Using it for a neutral label or a count — that is Badge; this one asserts an execution state.",
      "Inventing an eighth status by passing a custom label into the canonical enum — map an out-of-vocabulary state ONCE, near your domain, through the {label, tone, icon} form.",
      "Relying on the tone alone to distinguish two states — the glyph is the second channel that keeps them apart in greyscale.",
    ],
  },
  DiffEditor: {
    purpose:
      "The Monaco side-by-side diff surface — the only diff in the library that can be typed into.",
    category: "input",
    relationships: {
      pairsWith: ["CodeEditor", "CodeWorkspace"],
      avoidNextTo: ["DiffView"],
    },
    antiPatterns: [
      "Reaching for it to READ a patch — that is DiffView in @elabs-ai/components-ai, which needs no editor engine at all.",
      "Reaching for it to approve or reject hunks — that is ChangeReview, which owns the trust gate.",
      "Rendering it in a jsdom unit test — it is Monaco; test the surrounding wiring and leave the editor to a browser story.",
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
      "Confusing it with TokenUsage — this is the workspace's right RAIL of produced assets; TokenUsage is the context-WINDOW usage ring, and carried the name Context until it was renamed.",
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
      "Reaching for it to show a patch — nothing here is line-level; reading lines of a diff is DiffView and approving hunks is ChangeReview.",
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
      "Reaching for it in a console transcript — a console renders the same moment through TerminalToolCall in @elabs-ai/components-terminal.",
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

  PermissionModeSelect: {
    purpose:
      "Standing permission-policy chooser — how far the agent may act on its own, not whether one call proceeds.",
    category: "ai",
    relationships: {
      pairsWith: ["ApprovalCard", "Confirmation", "PromptInputMode"],
      usedInside: ["Dialog", "Sheet", "Form"],
    },
    stateTokens: {
      selected: "border-primary on the chosen mode's card",
      surface: "bg-card per mode row, border-border at rest",
      consequence: "text-meta text-muted-foreground — the sentence saying what the mode permits",
    },
    antiPatterns: [
      "Shipping a CLI's mode vocabulary as a type union — the modes are app-defined data, not a library enum.",
      "Rendering a mode without its consequence sentence — an unstated effect is the failure this component exists to prevent.",
      "Marking the in-force mode by colour alone — the current marker must reach the accessible name.",
      "Using it for a single tool call — that is ApprovalCard; this is the policy that decides how often ApprovalCard appears.",
    ],
  },

  TurnStatus: {
    purpose:
      "In-turn footer reporting the three facts a running turn owes the user: elapsed time, cost, and how to stop it.",
    category: "ai",
    relationships: {
      usedInside: ["Conversation", "ChatShell"],
      pairsWith: ["SessionStatusBar", "Shimmer", "PromptInputStop", "TokenUsage"],
    },
    stateTokens: {
      working: "bg-primary on the activity dot; text-muted-foreground for the metrics",
      settled: "bg-success on the dot; the completed-turn sentence in text-body text-foreground",
    },
    antiPatterns: [
      "Announcing every elapsed tick to a live region — announce the label and the settled sentence only, or assistive tech floods.",
      "Rendering more than one live region per turn — one region carries the whole status, never one per field.",
      "Hiding the stop affordance behind a hover — it must be a focusable button reachable while the turn runs.",
      "Fabricating a token count from elapsed time — report what the runtime reports, or omit the field.",
    ],
  },

  SessionStatusBar: {
    purpose:
      "Ambient session row — workspace, branch, model and integration-connection progress, docked above or below the transcript.",
    category: "ai",
    relationships: {
      usedInside: ["ChatShell"],
      pairsWith: ["TurnStatus", "TokenUsage", "SessionHeader"],
      contains: ["TokenUsage"],
    },
    stateTokens: {
      surface: "bg-surface-muted with a border-t hairline — recessed chrome, not a raised card",
      segment: "text-meta text-muted-foreground",
    },
    antiPatterns: [
      "Re-implementing token or cost maths — dock the shipped Context component as a child instead; two answers to one question is worse than none.",
      "Rendering an empty shell when every segment is absent — the bar renders nothing at all.",
      "Putting the stop affordance here — stopping belongs to the running turn, not to ambient chrome.",
    ],
  },

  SessionHeader: {
    purpose:
      "Session launch card — model, workspace, capabilities, what's new and quick actions, shown above the greeting in an empty session.",
    category: "ai",
    relationships: {
      usedInside: ["ChatShell", "Conversation"],
      pairsWith: ["ChatGreeting", "SessionStatusBar", "Suggestion"],
    },
    stateTokens: {
      surface: "bg-card text-card-foreground — a raised card above the canvas",
      link: "text-primary-text for what's-new links, underlined on hover",
      focus: "ring-2 ring-ring ring-offset-2 ring-offset-background on quick actions",
    },
    antiPatterns: [
      "Leaving it mounted once the conversation starts — it is the empty-session surface, not persistent chrome.",
      "Using it as the app header — ChatShell's header slot is a fixed-height bar; this is a block in the transcript.",
      "Listing a capability the app cannot actually perform — the list is a promise the session has to keep.",
    ],
  },

  PromptInputMode: {
    purpose:
      "Composer control for the agent's operating mode — an app-defined enum of how autonomously it may act.",
    category: "ai",
    relationships: {
      usedInside: ["PromptInputTools", "PromptInput", "Composer"],
      pairsWith: ["PromptInputEffort", "ModelPicker", "PermissionModeSelect"],
    },
    stateTokens: {
      label: "text-body for the active mode name",
      hint: "text-meta text-muted-foreground for the key hint and description",
    },
    antiPatterns: [
      "Shipping a CLI's mode names as a type union — the vocabulary is data the app supplies.",
      "Hand-rolling roving focus over the mode list — the menu's radio group already owns arrow keys and announcement.",
      "Using it to express a standing policy — that is PermissionModeSelect, a settings surface, not a composer chip.",
    ],
  },

  PromptInputEffort: {
    purpose:
      "Composer control for an ordered reasoning-budget scale whose indicator fills as the level rises.",
    category: "ai",
    relationships: {
      usedInside: ["PromptInputTools", "PromptInput", "Composer"],
      pairsWith: ["PromptInputMode", "ModelPicker"],
    },
    stateTokens: {
      filled: "bg-primary border-primary — every step at or before the selected level",
      unfilled: "bg-transparent border-border-strong — a hollow outline for the rest",
      label: "text-body for the current level's name, always rendered as visible text",
    },
    antiPatterns: [
      "Encoding the level by hue alone — the ordinal fill and the step size are the channels that survive greyscale.",
      "Shipping a fixed effort vocabulary — the levels are app-defined data.",
      "Omitting the accessible name for the scale — the group needs one; the component ships no default because the name is app vocabulary.",
    ],
  },

  AgentEvent: {
    purpose:
      "One lifecycle or hook event on the agent timeline — what fired around a tool call, and whether its checks passed.",
    category: "ai",
    relationships: {
      usedInside: ["AgentTimeline"],
      pairsWith: ["AgentStep", "Tool", "TurnStatus", "ChangeReview"],
    },
    stateTokens: {
      outcome:
        "mapped onto AgentStep's closed Status — ok reads complete, blocked reads denied, failed reads failed",
      check: "a visible pass/fail WORD beside the glyph, so the verdict survives greyscale",
    },
    antiPatterns: [
      "Reaching for it in a console transcript — the console skin is TerminalEventLine, which reads the same promoted AgentEventPhase model.",
      "Adding an eighth status for an event outcome — map onto AgentStep's closed Status instead; the rail owns the vocabulary.",
      "Building a second timeline spine — an event is a step on the existing AgentTimeline rail, not a parallel structure.",
      "Writing a second duration formatter — durations come from formatElapsed in @elabs-ai/components-ui.",
      "Declaring a local check-result type — CheckResult and CheckSummary are shared with ChangeReview and imported, never redeclared.",
      "Carrying pass/fail by tone alone — the status word is the channel that survives greyscale (1.4.1).",
    ],
  },
  KeyboardShortcuts: {
    purpose:
      "Grouped, searchable presentation of an application's shortcut set — the sheet the Kbd atom belongs in.",
    category: "display",
    relationships: {
      usedInside: ["Dialog", "Sheet", "Popover"],
      contains: ["Kbd", "Collapsible", "StatePanel"],
      pairsWith: ["Toolbar", "AppShell"],
    },
    stateTokens: {
      action: "text-body text-foreground for the action, text-muted-foreground for supporting text",
      focus: "ring-2 ring-ring on the group triggers and the search field",
    },
    antiPatterns: [
      "Rendering a raw key string instead of Kbd — the atom carries the platform glyphs and the translate opt-out.",
      "Showing a group's count without its items — a count with nothing behind it is a claim the sheet cannot keep.",
      "Leaving an empty filter result blank — an empty search renders a real empty state, not a blank region.",
    ],
  },
  DiffView: {
    purpose:
      "A line-level unified diff inside an agent transcript — what the agent changed, with correct old/new line numbers.",
    category: "ai",
    relationships: {
      usedInside: ["Message", "Tool", "ChangeReview", "Conversation"],
      pairsWith: ["CodeBlock", "ChangeReview", "Confirmation", "AgentEvent"],
    },
    stateTokens: {
      add: "bg-success/10 row tint plus a text-success-text marker glyph and an sr-only polarity word",
      del: "bg-destructive/10 row tint plus a text-destructive-text marker glyph and an sr-only polarity word",
      loading: "layout-shaped skeleton rows at the real row height, announced once at the region",
    },
    antiPatterns: [
      "Carrying add/del by row tint alone — the +/− glyph and the sr-only polarity word are the channels that survive greyscale (1.4.1).",
      "Rendering a parse error while isStreaming — a half-arrived line is incomplete, not invalid; errors fire only on settled input.",
      "Forking highlightCode — intra-line colour comes from CodeBlock's Shiki helper, imported, never copied.",
      "Building a separate full-screen diff component — the pager prop IS the reading surface; one component, two modes.",
      "Importing ChangeReview's ChangeHunk (or the reverse) — the two are joined by the renderHunk seam, never by a package edge.",
    ],
  },
  WorkspacePicker: {
    purpose:
      "Choose the workspace or project directory a session runs against, from recents or a typed path.",
    category: "input",
    relationships: {
      usedInside: ["AppShell", "SessionHeader", "Toolbar"],
      contains: ["ModelPicker", "Input", "Button"],
      pairsWith: ["TeamSwitcher", "ModelPicker", "SessionStatusBar"],
    },
    stateTokens: {
      current:
        "the in-force workspace appends a WORD into the row meta, so it reaches the option's accessible name",
      empty:
        "the free-text path submit is aria-disabled, never natively disabled, so it stays a focusable tab stop",
    },
    antiPatterns: [
      "Re-implementing the picker list — WorkspacePicker composes ModelPicker; a second searchable-popover list is the duplication this component exists to avoid.",
      "Marking the current workspace with a glyph alone — the marker is a word in the accessible name (1.4.1).",
      "Reading the filesystem — the component takes a workspace list as a prop and never enumerates directories itself.",
      "Natively disabling the path submit — an empty field uses aria-disabled plus a handler guard, so focus is never stranded.",
    ],
  },
  PromptInputSlash: {
    purpose:
      "The slash-command palette over a composer — type `/`, filter by prefix, pick a command with the keyboard.",
    category: "ai",
    relationships: {
      usedInside: ["PromptInput", "Composer"],
      contains: [
        "PromptInputSlashTextarea",
        "PromptInputCommand",
        "PromptInputCommandList",
        "PromptInputCommandItem",
      ],
      pairsWith: ["PromptInputMode", "PromptInputEffort", "MentionInput"],
    },
    stateTokens: {
      active:
        "the highlighted command is reported to the textarea via aria-activedescendant — focus never leaves the input",
      empty: "a real empty state with a sentence, never a blank popover",
    },
    antiPatterns: [
      "Moving DOM focus into the list — the textarea keeps focus and points at the active option with aria-activedescendant; a palette that steals focus loses the caret.",
      "Passing aria-label or id to the command list — cmdk overwrites both; use its own `label` prop and read the rendered id back off the node.",
      "Leaving aria-activedescendant set after the palette closes — a stale id points at a node that no longer exists.",
      "Hand-rolling the trigger scan — the caret/trigger machinery is shared with MentionInput (findTriggerQuery in @elabs-ai/components-ui), not re-derived here.",
      "Submitting the composer on Enter while the palette is open — Enter selects the command; the textarea's own onKeyDown-before-submit order is what makes that possible.",
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
