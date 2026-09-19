/**
 * copy.ts — hand-authored site copy, shared across items in the home-track wave (RM-089
 * decisions §"wave 1" ruling 2). Each item owns one export, under its own `// RM-NNN`
 * comment; the orchestrator resolves an add/add merge conflict here by concatenation in
 * ID order. This is the one exception to "Generated, not typed" (`.claude/rules/home.md`)
 * — copy is authored prose, not a count/list/install command, so it lives here instead of
 * `content/generated/*.json`.
 */

// RM-093 — page shell: nav, footer, page metadata. Source: docs/review/2026-09-18-homepage-
// concept.md §3 "Positioning" (the one-sentence line, verified against repo facts) and §4.6.
export const shellCopy = {
  wordmark: "brand-ui",
  /** The one-sentence positioning (concept §3), used for `<meta name="description">` and the OG image. */
  positioning:
    "brand-ui is an open-source React component system for the screens that are hard to build — data grids, dashboards, chat with tool calls, node canvases, maps, editors, terminals, process maps — all on one token system, and readable by coding agents through a CLI, an MCP server and a manifest.",
  /** The home page's own `<title>` (every other route uses the `%s — brand-ui` template). */
  titleDefault: "brand-ui — The hard screens, one system",
  nav: {
    skipToContent: "Skip to content",
    components: "Components",
    templates: "Templates",
    forAgents: "For agents",
    themesLink: "Themes",
    github: "GitHub",
    npm: "npm",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menuTitle: "Menu",
  },
  footer: {
    packagesHeading: "Packages",
    agentsHeading: "For agents",
    docsHeading: "Docs",
    projectHeading: "Project",
    attributionsHeading: "Open-source attributions",
    gettingStarted: "Getting started",
    mcpServerDoc: "brand-ui MCP server",
    storybookHome: "Storybook",
    llmsTxt: "llms.txt",
    mcpDiscovery: ".well-known/mcp.json",
    /**
     * Storybook's two standalone customer-facing doc pages have no per-component entry in
     * `content/generated/story-ids.json` (that map is component-keyed only, RM-090). Their ids
     * are the SAME deterministic slugifier `packages/cli/lib/story-ids.mjs#docsIdFromTitle`
     * produces from each page's own `<Meta title>` (`GettingStarted.mdx`: "Docs/Getting Started";
     * `Brand-UI-MCP-Server.mdx`: "Docs/brand-ui MCP Server") — authored here, not imported,
     * because that module also walks the filesystem to index every story file, and pulling it
     * into `layout.tsx` (rendered on every route) traced the whole repo into the server bundle.
     * If either page's title ever changes, update the matching constant here.
     */
    gettingStartedDocId: "docs-getting-started--docs",
    mcpServerDocId: "docs-brand-ui-mcp-server--docs",
    hostedMcp: "Hosted MCP",
    changelog: "Changelog",
    github: "GitHub",
    npm: "npm",
    license: "MIT · by elabs-ai",
    versionLabel: "version",
  },
  /** Stable, external, not derived from the manifest — same standing as the "/storybook/" literal already in `app/page.tsx`. */
  links: {
    github: "https://github.com/mreimitz/elabs-components",
    npm: "https://www.npmjs.com/package/@elabs-ai/components-ui",
    changelog: "https://github.com/mreimitz/elabs-components/releases",
  },
} as const;

/**
 * copy.ts — every sentence the page renders (RM-094 brief: "every sentence on the page lives
 * here"). Counts, package lists and install commands are NOT here: they come from
 * `content/generated/*.json` through `lib/content.ts`. `components/hero/copy.test.mjs` keeps
 * superlatives out of this file.
 */

// RM-094
export const heroCopy = {
  headline: "The hard screens, one system.",
  sub: "React components for dashboards, data grids, AI chat, node canvases, maps, editors and process maps — on one token system, and legible to coding agents.",
  ctaPrimary: "Get started",
  /** Storybook's "Docs/Getting Started" page (not a component, so not in story-ids.json). */
  ctaPrimaryStoryId: "docs-getting-started--docs",
  ctaSecondary: "Open a template",
  ctaSecondaryHref: "#tour",
  switchLabel: "Theme family",
  switchCaption:
    "Every screen on this page is the library. Switching themes changes one stylesheet.",
  chip: {
    label: "Connect your coding agent",
    copy: "Copy command",
    copied: "Copied",
    selectFallback: "Command selected — press Ctrl+C or ⌘C to copy",
    chooseHost: "Install for",
    menuLabel: "Install for",
    hosts: {
      claudeCode: "Claude Code",
      cursor: "Cursor",
      vscode: "VS Code",
      codex: "Codex",
      url: "Any MCP host (URL)",
    },
  },
  dials: {
    trigger: "Dials",
    title: "Tune the system",
    density: "Density",
    densityOptions: { compact: "Compact", comfortable: "Comfortable", spacious: "Spacious" },
    decoration: "Decoration",
    motion: "Motion",
    motionOptions: { system: "System", reduced: "Reduced", full: "Full" },
  },
  trust: {
    label: "Facts about the library",
    npm: "On npm",
    packages: (n: number) => `${n} packages`,
    license: "MIT",
    axe: "axe on every story",
    themes: (n: number) => `${n} brand themes`,
  },
  // Labels and sentence frames only — every name, number and message the scene shows is read
  // from the fixture set (`content/fixtures/**`, RM-095) in `components/hero/hero-stream.ts`.
  scene: {
    label: "Live example: a revenue analytics console built from the library",
    nav: { overview: "Overview", accounts: "Accounts", orders: "Orders", settings: "Settings" },
    title: "Overview",
    kpiSince: (week: string) => `Change since ${week}`,
    pointsUnit: "pts",
    /** The title carries the unit: the chart plots the fixture's percentages as plain numbers. */
    chartTitle: (metric: string, quarter: string) => `${metric} (%) — ${quarter}`,
    columns: {
      account: "Account",
      region: "Region",
      monthMrr: (month: string) => `${month} MRR`,
      change: "MRR change",
    },
    chatLabel: "Assistant",
    toolResult: (points: number, regions: number) => `${points} weekly points · ${regions} regions`,
    tiles: { pipeline: "Pipeline run" },
    flowStep: (step: number, steps: number) => `Step ${step} of ${steps}`,
  },
} as const;

// RM-096 — the surface tour (concept §4.2): movement title, per-tab labels, use cases, hints
// and the agent prompt. The MCP URL, archetype intents, story ids and commands are NOT here —
// they come from `content/generated/*.json` through `lib/content.ts` (see `tour/tabs.ts`).
export const tourCopy = {
  title: "Seven surfaces, one system",
  description:
    "Each tab is a full-size screen built from the library. Open it in Storybook, copy a prompt for your coding agent, or scaffold it.",
  tabs: {
    dashboard: {
      label: "Dashboard",
      useCase: "KPIs, charts and records in one screen, with tiles people can rearrange.",
      hint: "Drag a tile",
    },
    "ai-assistant": {
      label: "AI assistant",
      useCase: "A chat that renders tool calls, reasoning and sources, not only text.",
      hint: "Expand the tool call",
    },
    "data-app": {
      label: "Data app",
      useCase: "A table for browsing and operating on records: search, facets, bulk actions.",
      hint: "Sort a column",
    },
    "flow-workspace": {
      label: "Flow workspace",
      useCase: "A node canvas with an inspector, for pipelines and agent graphs.",
      hint: "Drag a node",
    },
    "process-explorer": {
      label: "Process explorer",
      useCase: "Process mining on an event log: the map, variants and throughput.",
      hint: "Hover a path",
    },
    settings: {
      label: "Settings",
      useCase: "Grouped forms with sections, descriptions and saved state.",
      hint: null,
    },
    marketing: {
      label: "Marketing",
      useCase: "A landing page: hero, feature grid, stats and a call to action.",
      hint: null,
    },
  },
  /** Screen-reader label of a tab whose surface has not landed yet (RM-097/098 replace these). */
  placeholder: (label: string) => `${label} preview`,
  /** The multi-line prompt "Copy prompt" writes: the hosted MCP URL, the archetype, its intent. */
  prompt: ({
    mcpUrl,
    archetype,
    intent,
    useCase,
  }: {
    mcpUrl: string;
    archetype: string;
    intent: string;
    useCase: string;
  }) =>
    [
      `Using brand-ui (MCP: ${mcpUrl}), build a ${archetype} screen.`,
      `Intent: ${intent}.`,
      `Use case: ${useCase}`,
      "Use only @elabs-ai/components-* components and semantic tokens; follow the brand-ui playbook for this archetype.",
    ].join("\n"),
  actions: {
    openInStorybook: "Open in Storybook",
    copyPrompt: "Copy prompt",
    promptCopied: "Prompt copied",
    promptCopyFailed: "Could not copy the prompt",
    scaffold: "Scaffold",
    copyCommand: "Copy scaffold command",
  },
} as const;

// RM-097 — the three tour surfaces (Dashboard, Data app, Settings): every literal the surfaces
// render, so `conventions/i18n-strings` has nothing left to flag in `tour/surfaces/**`. Data
// itself (KPI labels, order rows, member names) stays in `content/fixtures/**`; this is UI chrome
// only.
export const dashboardSurfaceCopy = {
  reset: "Reset",
} as const;

export const dataAppSurfaceCopy = {
  /** `"{count} orders"`, `count` already `Intl.NumberFormat`-formatted by the caller. */
  orderCount: (count: string) => `${count} orders`,
  regionFacetTitle: "Region",
  statusFacetTitle: "Status",
  /** `"{count} selected"` in the bulk-action bar, `count` already locale-formatted. */
  selectedCount: (count: string) => `${count} selected`,
  clearSelection: "Clear selection",
} as const;

export const settingsSurfaceCopy = {
  sectionsNavLabel: "Settings sections",
  sections: {
    workspace: "Workspace",
    members: "Members",
    notifications: "Notifications",
    apiKeys: "API keys",
    danger: "Danger zone",
  },
  workspace: {
    description: (workspaceName: string) => `Details every member of ${workspaceName} can see.`,
    nameLabel: "Workspace name",
  },
  members: {
    description: "Everyone with access to this workspace.",
    name: "Name",
    email: "Email",
    role: "Role",
  },
  notifications: {
    description: "Control which alerts reach the team.",
  },
  apiKeys: {
    description: "Keys used by services connecting to this workspace.",
    label: "Label",
    key: "Key",
    createdBy: "Created by",
    created: "Created",
  },
  danger: {
    transferDescription: "Hand the owner role to another member.",
    deleteDescription: "This cannot be undone.",
    /** The `AlertDialogDescription`'s second sentence: `Type “{name}” to confirm.` */
    typeToConfirm: (workspaceName: string) => `Type “${workspaceName}” to confirm.`,
    cancel: "Cancel",
  },
} as const;

// RM-098 — copy specific to the AI assistant, flow workspace, process explorer and marketing
// tabs (`tourCopy.tabs` above already carries the shared per-tab label/useCase/hint, RM-096).
export const tourSurfaceCopy = {
  aiAssistant: {
    /** D5 (`decisions.md`): the composer never calls a model — it only renders one. */
    composerPlaceholder: "This demo doesn’t call a model — it renders one.",
    composerSubmitLabel: "Send is disabled — this demo renders a fixed transcript",
    toolSummary: "2 regions returned",
  },
  flowWorkspace: {
    demoLabel: "Flow workspace demo",
    inspectorTitle: "Inspector",
    inspectorEmpty: "Select a node to see its details.",
    narrow: "This canvas is best on a wider screen — try 1024px or up.",
  },
  processExplorer: {
    demoLabel: "Process explorer demo",
    viewToggleLabel: "View",
    mapView: "Map",
    conformanceView: "Conformance",
    narrow: "This map is best on a wider screen — try 1024px or up.",
    /** `share` is a formatted percent read from the fixture, never typed (RM-098 acceptance). */
    slowVariantNote: (share: string) =>
      `${share} of cases take a manual-review detour and run about twice as long.`,
    /* `casesButton`/`casesTitle`/`casesDescription`: `CaseTable` moved into a bottom `Sheet`
       (docs/playbooks/templates/process-explorer.tsx's own drill-down pattern) instead of
       always-inline — the tour's shared `h-128 md:h-160` frame (`tour.tsx`, every tab) has no
       room left for map + variant rail + case table all at once once the 6-metric KPI strip
       claims its two rows, so the table is a drill-down, not a fourth always-visible region. */
    casesButton: "Case table",
    casesTitle: "Cases",
    casesDescription: "The filtered case list — export or scan alongside the map.",
  },
  marketing: {
    demoLabel: "Marketing demo",
    caption:
      "You’re looking at it — this page is the marketing archetype, from the same components.",
  },
} as const;

// RM-099 — the "Ask your agent" live loop (concept §4.3, §5a choreography 4, §8 decision 4).
// The honesty line is D5 (`docs/DECISIONS.md`): the site renders, it never owns a model call.
export const agentLoopCopy = {
  eyebrow: "For agents",
  heading: "Ask your agent — and watch the calls",
  lede: "Pick a prompt and run it. The page calls the same hosted MCP server your coding agent would, shows each call as a tool card, then renders the block the answer points to — in the theme you have on.",
  promptLabel: "Example prompt",
  promptPlaceholder: "Pick an example prompt above",
  selectLabel: "Choose an example prompt",
  onlyListedHint:
    "Only the listed prompts run — you can edit the text, but the calls come from the prompt you picked.",
  onlyListedTrigger: "Why only the listed prompts?",
  run: "Run",
  reset: "Reset",
  traceHeading: "Tool calls",
  traceIdle: "Run a prompt to see the MCP calls it makes.",
  renderHeading: (title: string) => `Rendered: ${title}`,
  renderIdle: "The rendered block appears here.",
  recorded: "recorded",
  recordedHint: "The live server was unreachable, so this card shows the recorded response.",
  elapsed: (ms: number) => `${ms} ms`,
  arguments: "Arguments",
  result: "Result",
  pending: "Calling…",
  running: (prompt: string) => `Running “${prompt}”…`,
  done: "Done — block rendered.",
  loadingBlock: "Loading the block…",
  surfaceTitles: {
    "region-map": "Revenue by region",
    "dashboard-sheet": "A four-tile dashboard sheet",
  } as Record<string, string>,
  regionMapLabel: "Revenue by region map",
  honestyLine:
    "brand-ui never owns model calls. This demo calls the same hosted MCP your agent would; the picking was done ahead of time.",
  honestyLinkLabel: "Why: decision D5",
  honestyLinkHref: `${shellCopy.links.github}/blob/main/docs/DECISIONS.md`,
  /** Default `labels` for the copy-owned registry blocks the loop renders (site lint: every
   * literal comes from copy). Wording is the blocks' own, moved here unchanged. */
  blocks: {
    asOf: {
      asOf: (when: string, source?: string) =>
        `As of ${when}${source ? ` · Source: ${source}` : ""}`,
    },
    movers: {
      loading: "Loading movers cards…",
      title: "Biggest movers this quarter",
      scaleBefore: "Bars scaled to",
      scaleAfter: "vs last quarter, zero at center.",
    },
    trendReference: {
      loading: "Loading KPI cards…",
      legendThisYear: "Solid: this year",
      legendLastYear: "Faint: last year",
      legendNormalRange: "Shaded: normal range",
      legendTargetPace: "Dashed: target pace",
      quarterToDate: "Quarter-to-date total",
      weekly: "Weekly, last 13 weeks",
    },
    statusThreshold: {
      loading: "Loading the KPI card…",
      target: (value: string) => `${value} target`,
    },
    cohortRetention: {
      loading: "Loading the cohort retention heatmap…",
      heading: "Do customers stay?",
      cohortsBadge: (count: number) => `${count} monthly cohorts`,
      finding: (
        cohort: string,
        gapPp: number,
        direction: string,
        peerCount: number,
        month: number,
      ) =>
        `${cohort} held ${gapPp}pp ${direction} retention than ${peerCount === 1 ? "its peer" : "its peers"} by month ${month}`,
      retained: (highlightPct: number, peerAvgPct: number, peers: string, context: string) =>
        `${highlightPct}% retained vs ${peerAvgPct}% for ${peers}, ${context}.`,
      footnote:
        "Each cell is the share of a cohort still active N months after signup; blank cells are months a cohort has not reached yet, not zero retention.",
    },
  },
} as const;

// RM-101
/** "Let the agent emit the UI" — the A2UI and DashboardSpec live editors in the agents section. */
export const emitUiCopy = {
  eyebrow: "Let the agent emit the UI",
  heading: "Edit what an agent would emit, and watch it validate and render",
  lede: "Both editors run the library’s own validators on every pause in your typing. The errors below the editor are the validator’s, word for word.",
  tabsLabel: "Spec format",
  tabs: {
    a2ui: {
      label: "A2UI",
      what: "A surface the agent designs at runtime, validated against the catalog, rendered by the library.",
    },
    dashboardSpec: {
      label: "DashboardSpec",
      what: "A serializable sheet an agent can emit and a person can rearrange.",
    },
  },
  schemaLabel: "Copy schema",
  schemaHosts: { cli: "Installed CLI", npx: "npx" },
  schemaChip: {
    copy: "Copy schema command",
    copied: "Copied",
    selectFallback: "Command selected — press Ctrl+C or ⌘C to copy",
    chooseHost: "Run with",
    menuLabel: "Run with",
  },
  monacoLabel: (format: string) => `${format} editor`,
  /** Toast shown when a Button in the rendered A2UI surface fires its `on.click` action. */
  action: (name: string) => `action: ${name}`,
  /** Labels for the examples menu, by example id (`content/generated/emit-ui-examples.json`). */
  examples: {
    a2ui: {
      "cli-example": "Order approval (brand-ui a2ui example)",
      "kpi-grid": "KPI card grid",
      form: "Form",
    },
    dashboardSpec: {
      minimal: "Minimal (the golden spec)",
      kpis: "Six-tile KPI sheet",
    },
  },
  playground: {
    a2ui: { editor: "A2UI surface (JSON)", preview: "Rendered A2UI surface" },
    dashboardSpec: { editor: "DashboardSpec (JSON)", preview: "Rendered dashboard sheet" },
    errors: "Validator errors",
    loadExample: "Load example",
    reset: "Reset",
    valid: "Valid",
    errorCount: (count: number) => (count === 1 ? "1 error" : `${count} errors`),
    parseError: "Parse error",
    showingLastValid: "Showing last valid",
    nothingValid: "Nothing valid to render yet.",
    line: (line: number) => `line ${line}`,
  },
  /** The six-tile example sheet over `fixtures/kpis.ts`. */
  kpiSheet: {
    title: "Ashgrove, this quarter",
    arrTrend: "ARR, weekly",
    backlogTrend: "Support backlog, weekly",
  },
};
