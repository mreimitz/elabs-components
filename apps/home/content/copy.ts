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
    charts: "Charts",
    blocks: "Blocks",
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
  ctaSecondary: "Browse templates",
  ctaSecondaryHref: "/templates",
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

// RM-102 — "Works with your agent" matrix, install tabs and route cards. Source:
// docs/review/2026-09-18-homepage-concept.md §2, §4.4, §4.6. The two senses of "AI" (the
// agent building with brand-ui, and an agent-facing surface built WITH brand-ui) are kept
// separate here: this section is about the FIRST sense only (concept §3).
export const worksWithCopy = {
  heading: "Works with your agent",
  intro: "Six ways in, one spec — pick your host once and every command below matches it.",
  hosts: [
    { id: "claude-code", label: "Claude Code" },
    { id: "cursor", label: "Cursor" },
    { id: "vscode", label: "VS Code" },
    { id: "codex", label: "Codex" },
    { id: "other", label: "Other" },
  ],
  rows: {
    hostedMcp: {
      unit: "Hosted MCP",
      gives: "A remote MCP server — nothing to run locally.",
      action: "Add server",
    },
    localMcp: {
      unit: "Local MCP + CLI",
      gives: "The same tools from your machine, plus `audit --strict`.",
      action: "Run locally",
    },
    plugin: {
      unit: "Claude Code plugin",
      gives: "11 skills your agent picks up automatically.",
      action: "Add marketplace",
      otherHostNote: "Claude-Code-specific — use the hosted MCP row for other hosts.",
    },
    llmsTxt: {
      unit: "llms.txt",
      gives: "A plain-text map of the docs for any agent that reads it.",
      action: "Open",
    },
    registry: {
      unit: "Registry",
      gives: (blockCount: number) =>
        `${blockCount} shadcn-compatible blocks, copy-owned into your app.`,
      action: "Browse",
    },
    manifest: {
      unit: "Manifest",
      gives: "Every export, prop and gate, machine-readable.",
      action: "Open",
    },
  },
  routineHeading: "The daily routine",
  /**
   * Tooltip body per routine verb (`cli.routine`, split on " → ", supplies the ORDER — this
   * supplies the PROSE, paraphrased from `packages/cli/bin/brand-ui.mjs`'s own `SUBCOMMAND_HELP`,
   * which is not in `cli.json`). `audit`'s text covers the `--strict` form shown in the chip.
   */
  routineDoes: {
    info: "Project context: packages, themes, tokens, registry, rules.",
    search: "Finds a component, hook, registry item or archetype playbook by keyword.",
    docs: "Locates a component and prints its real props, read from source.",
    build: "Scaffolds a runnable app from a template — no interview.",
    audit: "Static token/style + content lint; `--strict` fails the build on any finding.",
  },
} as const;

export const installTabsCopy = {
  heading: "Install it your way",
  prompt: (mcpUrl: string) =>
    `Use brand-ui — MCP at ${mcpUrl}, docs at /llms.txt — to build a screen for our support queue.`,
} as const;

export const routeCardsCopy = {
  heading: "Where to next",
  adopt: {
    title: "Adopt",
    description: "Start here — pick a path, run the commands.",
    action: "Getting Started",
    /** `Docs/Getting Started` — same id `SiteFooter` links to (`shellCopy.footer.gettingStartedDocId`). */
    docId: "docs-getting-started--docs",
  },
  pointAgent: {
    title: "Point your agent",
    description: "Give your coding agent the matrix above.",
    action: "Jump to the matrix",
  },
  rebrand: {
    title: "Re-brand",
    description: "Swap the theme, keep every component.",
    action: "Theming guide",
    /**
     * `Foundations/Theming` — the closest live Storybook page to "the theme guide" (its
     * "Bring your own theme" section); `themes/README.md` (community theme families) has no
     * autodocs page of its own yet. Named as a substitution, not a stop, per the "closest
     * existing" precedent (RM-089-decisions.md wave-3 ruling 12).
     */
    docId: "foundations-theming--docs",
  },
  readSource: {
    title: "Read the source",
    description: "It’s the same code you would import.",
    action: "View on GitHub",
  },
} as const;

// RM-103 — the "One token system" band (concept §4.5, §5a "Scroll choreography 5"): a curated
// token row, the theme families as swatches, and the generated gate catalogue. The curated
// token list and every label are authored HERE — `TokenSpotlight` (`@elabs-ai/components-ui`)
// ships no default tokens or English copy of its own (wave-4 ruling 20/26, "no site strings
// in ui"); the family and gate DATA come from `content/generated/*.json` through `lib/content`.
export const tokenBandCopy = {
  heading: "One token system",
  intro:
    "Hover a token to see every place it lands on this page — the ground behind it tints to match.",
  // RM-103 W5-A (#583, ruling 43): `--foreground` and `--border` are left out on purpose. Even
  // with the consumer match fixed (own text only; bordered sides only) they mark 388 and 167
  // elements on `/` in default light (400 and 130 in qlik dark), over the 150-mark bar — a
  // highlight that outlines most of the page shows nothing.
  tokens: [
    { token: "--background", label: "Background" },
    { token: "--primary", label: "Primary" },
    { token: "--surface-2", label: "Surface 2" },
    { token: "--chart-1", label: "Chart 1" },
    { token: "--chart-2", label: "Chart 2" },
    { token: "--chart-3", label: "Chart 3" },
    { token: "--ring", label: "Ring" },
    { token: "--radius", label: "Radius" },
  ],
} as const;

export const themeSwatchesCopy = {
  heading: "Nine families, none of them the menu",
  intro: "Reference themes, ready to use as they are — or as a start for your own.",
  use: "Use",
  active: "Active",
  /** `themes/qlik/README.md` §"Fonts": Source Sans 3 is self-hosted (vendored), not a CDN import. */
  typefaceVendored: "Source Sans 3, vendored",
  typefaceSystem: "System stack",
  createTheme: {
    heading: "Bring your own brand",
    description:
      "An agent with the create-theme skill turns a brand's own material — links, a style sheet, screenshots — into a new family. Your logo stays yours: point three variables at it.",
    hostLabel: "Agent host",
  },
} as const;

export const gatesBandCopy = {
  categoryLabels: {
    stories: "Stories",
    packages: "Packages",
    components: "Components",
    themes: "Themes",
    repo: "Repo",
    registry: "Registry",
    external: "External commands",
  },
  footerPrefix: "The full list lives in",
  footerLinkText: "docs/GATES.md",
  footerSuffix: "on GitHub.",
} as const;

// Gallery redesign — the home page's component, chart and block galleries, plus the `/charts`,
// `/components` and `/agents` routes. Counts and component lists are NOT here (generated);
// these are captions, labels and accessible names only.
export const galleryCopy = {
  seeInStorybook: "Open in Storybook",
  wall: {
    label: "Live components from the library, in the current theme",
    themeCaption: "Everything below is the library, rendered live. Pick a theme and it re-skins.",
    themeLabel: "Theme",
    modeLabel: "Colour mode",
    modes: { light: "Light", dark: "Dark" },
    kpi: {
      sparkLabel: (metric: string) => `${metric}, weekly, this quarter`,
      since: "since the start of the quarter",
    },
    chat: { label: "Assistant conversation", placeholder: "Ask about this quarter" },
    table: { title: "Recent orders", description: "The five most recent orders this quarter." },
    invite: {
      title: "Invite a teammate",
      description: "They get access to this workspace's dashboards.",
      email: "Work email",
      emailPlaceholder: "name@ashgrove.example",
      role: "Role",
      roles: { admin: "Admin", member: "Member", viewer: "Viewer" },
      regions: "Regions",
      regionsPlaceholder: "Add a region",
      digest: "Send the weekly KPI digest",
      submit: "Send invite",
      cancel: "Cancel",
    },
    calendar: { title: "Reporting period", description: "Pick the range every chart reads." },
    command: {
      placeholder: "Search actions and accounts",
      empty: "Nothing matches.",
      actions: "Actions",
      newInvoice: "New invoice",
      exportOrders: "Export orders",
      openSettings: "Open settings",
      accounts: "Accounts",
    },
    notifications: { title: "Notifications", description: "What this workspace emails you about." },
    team: {
      title: "Workspace members",
      description: "People with access to Ledger Insights.",
      manage: (name: string) => `Manage ${name}`,
      changeRole: "Change role",
      resend: "Resend invite",
      remove: "Remove from workspace",
    },
    pipeline: {
      title: "Nightly revenue sync",
      alertTitle: "Tax Compliance is rate-limited",
      alertBody: "The sync retries in ten minutes. No invoices are affected.",
      progressLabel: "Sync progress",
      steps: { extract: "Extract", reconcile: "Reconcile", publish: "Publish" },
    },
    controls: {
      title: "Forecast settings",
      confidence: "Confidence interval",
      horizon: "Horizon",
      horizons: { month: "Month", quarter: "Quarter", year: "Year" },
      basis: "Basis",
      bases: { bookings: "Bookings", billings: "Billings", cash: "Cash" },
      seasonality: "Adjust for seasonality",
      quality: "Rate this forecast",
    },
    faq: {
      title: "Billing questions",
      items: [
        {
          q: "When are invoices issued?",
          a: "On the first business day of the period, in the account's own time zone.",
        },
        {
          q: "How is usage metered?",
          a: "Events are counted hourly and rolled up to the invoice line at period close.",
        },
        {
          q: "Can a customer change plan mid-period?",
          a: "Yes. The change is prorated to the day and shows as its own invoice line.",
        },
      ],
    },
    verify: {
      title: "Confirm it is you",
      description: "Enter the six-digit code from your authenticator.",
      label: "One-time code",
      submit: "Verify",
    },
    order: {
      title: "Order detail",
      account: "Account",
      product: "Product",
      region: "Region",
      owner: "Owner",
      amount: "Amount",
      status: "Status",
    },
    empty: {
      title: "No overdue invoices",
      description: "Everything issued this quarter is paid or still within terms.",
      action: "View all invoices",
    },
    nav: {
      title: "Navigation",
      crumbs: { home: "Ledger Insights", accounts: "Accounts" },
      tabs: { overview: "Overview", invoices: "Invoices", usage: "Usage" },
      tabBody: {
        overview: "Health, owner and renewal date for this account.",
        invoices: "Every invoice issued to this account this quarter.",
        usage: "Metered events rolled up by product.",
      },
    },
  },
  sections: {
    charts: {
      title: "Charts",
      description:
        "Every chart container the library ships, drawn from one fictional company's quarter. Line, bar and pie are here; so are bump, waterfall, dumbbell, heatmap, treemap and sankey.",
      all: (n: number) => `All ${n} chart examples`,
    },
    components: {
      title: "Components",
      description:
        "The app UI underneath: forms, overlays, navigation, tables, chat parts. Source-owned, token-driven, keyboard-complete.",
      all: (n: number) => `Browse all ${n} exports`,
    },
    blocks: {
      title: "Blocks",
      description:
        "Copy-own compositions from the registry: command centers, maps, infographics, KPI cards, agent-ops panels. Installed with one command, then yours to edit.",
      all: "Browse blocks in Storybook",
      count: (n: number) => `${n} blocks`,
    },
    templates: {
      title: "Templates",
      description:
        "Seven full screens, one per archetype. Each tab is the real template; open it in Storybook, copy a prompt for your coding agent, or scaffold it.",
    },
    agents: {
      title: "Built for coding agents",
      description:
        "A CLI, an MCP server and a machine-readable manifest tell an agent which component to use and how. For screens an agent designs at runtime, it emits JSON that the library validates and renders.",
      more: "How agents use brand-ui",
      gates: (n: number) => `${n} convention rules run in CI`,
    },
    themes: {
      title: "Themes",
      description: "One token system. Swap a stylesheet and every component follows.",
    },
  },
  charts: {
    pageTitle: "Charts",
    pageDescription:
      "Every chart container in @elabs-ai/components-charts, grouped by the question the chart answers. All examples draw on the same fictional company and quarter.",
    filterLabel: "Filter charts by question",
    all: "All",
    groups: {
      time: "Change over time",
      compare: "Comparison",
      share: "Part to whole",
      distribution: "Distribution",
      flow: "Flow and hierarchy",
      single: "Single value",
    },
    tiles: {
      line: { shape: "Several series over time", label: "Weekly logo churn for three regions" },
      area: {
        shape: "Volume over time",
        label: "Weekly logo churn, EMEA and LATAM, as filled areas",
      },
      composed: {
        shape: "Two linked measures",
        label: "Net new ARR per week as bars with its three-week average as a line",
      },
      live: { shape: "A series still arriving", label: "Billing API requests, last 30 seconds" },
      candlestick: { shape: "Open, high, low, close", label: "Daily share price, September" },
      bump: { shape: "Rank over time", label: "Product rank by net new ARR, June to September" },
      bar: { shape: "A few categories, compared", label: "Bookings by region and type" },
      dumbbell: {
        shape: "Two points per category",
        label: "Renewal rate by region, last quarter against this quarter",
      },
      waterfall: { shape: "A bridge between totals", label: "Opening to closing ARR bridge" },
      radar: {
        shape: "One entity, several dimensions",
        label: "Account health for two customer segments",
      },
      parallel: {
        shape: "Many entities, many dimensions",
        label: "Five plans across price, seats and NPS",
      },
      bullet: {
        shape: "Progress against a target",
        label: "Quota attainment by region",
        bands: { below: "Below plan", near: "Near plan", ahead: "At or above plan" },
      },
      pie: { shape: "Share of a whole", label: "Revenue share by product family" },
      ring: {
        shape: "Several progress values",
        label: "Renewals closed against renewals due, by region",
        center: "Renewals closed",
      },
      unit: {
        shape: "A whole, counted",
        label: "Revenue share by product family, one dot per percent",
      },
      treemap: {
        shape: "Hierarchy and share",
        label: "ARR by product family and module",
        description: "Four product families, two modules each, sized by ARR.",
      },
      funnel: { shape: "Stage-to-stage drop-off", label: "Trial to paid conversion funnel" },
      heatmap: { shape: "Category by category", label: "Invoices issued by weekday and hour" },
      scatter: { shape: "Two measures per record", label: "Deal size against sales-cycle length" },
      strip: { shape: "Every record, by group", label: "Days to pay per invoice, by region" },
      box: { shape: "Five-number summary", label: "Days to pay by region, as box plots" },
      sankey: {
        shape: "Routes through stages",
        label: "Invoice routes from channel to outcome",
        value: (n: number) => `${n} invoices`,
      },
      network: {
        shape: "What connects to what",
        label: "Billing platform services",
        description: "Seven services in three groups, arranged on a ring.",
      },
      tree: { shape: "Membership in a hierarchy", label: "Revenue organisation" },
      gauge: { shape: "One value on a dial", label: "EMEA quota attainment", center: "EMEA quota" },
    },
  },
  components: {
    pageTitle: "Components",
    pageDescription:
      "Live examples first, then every exported component by package, each linked to its Storybook page.",
    examples: "Examples",
    packages: "Packages",
    index: "Every component, by category",
    indexNote: "Names link to the component's Storybook docs page.",
    exports: (n: number) => `${n} exports`,
  },
  agents: {
    pageTitle: "For agents",
    pageDescription:
      "How a coding agent finds, uses and checks brand-ui: a live tool-call trace, the generative-UI editor, and the install matrix for every host.",
  },
  attributions: {
    pageTitle: "Open-source attributions",
    footerLink: "Open-source attributions",
  },
} as const;

// The catalogue: sidebar, search, and the generated detail pages for components, charts, blocks
// and templates. Names, purposes, props and examples come from `catalog-*.json`; these are the
// labels around them.
/** One line per template family, in the words of the team that would build it. */
export const templateFamilyCopy: Record<string, string> = {
  Analytics:
    "Workspaces for revenue, finance and BI teams: a desk of numbers with the table that explains them.",
  Operations:
    "Screens that stay open all day: control towers, incident rooms and process explorers, where a selection drives everything else.",
  Customers: "Account and service products: the record before the call, the queue during it.",
  "Product Teams": "Tools a team runs its own work in: projects, the board, who is carrying what.",
  "AI Products":
    "Products with a model inside: an agentic workspace, an operations center for a fleet of agents, a terminal session.",
  Starters:
    "The archetypes `brand-ui create` scaffolds. Plain on purpose: the shape of a screen, ready for your content.",
};

/** One line per block family, in the words of the person choosing between them. */
export const blockFamilyCopy: Record<string, string> = {
  "KPI Cards": "One number, one question. Pick the card by what the reader is asking of it.",
  "Stat Cards": "A figure with its trend or its geography, sized for a dashboard row.",
  Infographics:
    "An argument, not a chart: a headline that states the finding and one view built to prove it.",
  "Editorial Charts": "Long-form chart recipes built from the charts package's marks layer.",
  "Command Centers":
    "A whole desk on one screen: headline numbers, the run against plan, and what decides it.",
  "Maps and Geo": "Networks, routes and fleets on the map they run on.",
  "Process and Flow": "Canvases you build on and process maps you explore.",
  "Data Surfaces": "Tables with the toolbar, the chart and the comparison already wired.",
  Documents:
    "Files in the product: a library with a preview, an answer you can check against its sources, a review that points at the clause.",
  "Agent Ops": "What an agent did, what it cost, where it failed and where a human decides.",
  "Generative UI":
    "Screens an agent designs as data (A2UI): validated against a catalog, streamed in, and wired to actions the app owns.",
  "AI and Terminal": "Chat, code and console surfaces for working with a model.",
  "Forms and Setup": "Multi-step forms and the screens that connect a product to others.",
  Application:
    "The screens every product needs and nobody wants to design twice: boards, lists, checklists, empty states.",
  Authentication:
    "The way in: sign in, sign up, reset, verify. Real validation, real states, and no server call of their own.",
  "Account and Settings":
    "Profile, members, notifications and billing, with the edge cases handled.",
  Commerce: "From the product grid to the receipt, with stock, totals and delivery that add up.",
  Marketing: "A landing page in sections, from the navbar to the footer.",
};

export const catalogCopy = {
  sections: {
    templates: "Templates",
    blocks: "Blocks",
    charts: "Charts",
    components: "Components",
  },
  sectionLead: {
    templates:
      "Whole products, not page outlines. The use-case templates are built from the registry's blocks inside the workspace shell, with every control wired; the starters are the plain archetypes the CLI scaffolds.",
    blocks:
      "Copy-own compositions from the registry, grouped by what they are for: numbers, arguments, command centers, maps, process, agent operations. One command puts the source in your repo.",
    charts:
      "Pick a chart by the question it answers. Every type has its own page: what it is for, when to avoid it, and every variant, live.",
    components:
      "Every exported component, by package. Each has a page with its purpose, when to use it, what it works with, live variants and its API.",
  },
  sidebar: {
    label: "Catalogue",
    filter: "Filter the catalogue",
    filterPlaceholder: "Filter…",
    empty: "Nothing matches that filter.",
    open: "Browse",
    sheetTitle: "Catalogue",
  },
  search: {
    trigger: "Search",
    title: "Search brand-ui",
    description: "Find a component, chart, block or template by name or by what it does.",
    placeholder: "Search components, charts, blocks, templates…",
    empty: "Nothing found. Try the name of a component or what you need it to do.",
    goTo: "Pages",
    pages: {
      home: "Home",
      agents: "For agents",
      themes: "Themes",
      storybook: "Storybook",
    },
  },
  frame: {
    loading: "Loading the live example",
    openStory: "Open in Storybook",
    openFull: "Open on its own in a new tab",
    expand: "Enlarge this example",
    details: "Details",
    previous: "Previous example",
    next: "Next example",
    position: (n: number, total: number) => `${n} of ${total}`,
    page: (name: string) => `${name} page`,
    docs: "Storybook docs",
    source: "Source on GitHub",
    pending: "This example ships with the next Storybook release.",
    missingTitle: (n: number, total: number) =>
      n === total
        ? `${total === 1 ? "The example" : `All ${total} examples`} here ${total === 1 ? "is" : "are"} newer than the published Storybook`
        : `${n} of ${total} examples here are newer than the published Storybook`,
    missingBody: (names: string) => `Live with its next release: ${names}.`,
    missingLocal: "Working from the repository? Build them now with",
    missingCommand: "pnpm site:stories",
    missingLocalTail: "and start the site again.",
    previewOf: (name: string) => `Live example: ${name}`,
  },
  detail: {
    overview: "Overview",
    useFor: "Use it for",
    avoid: "Avoid",
    worksWith: "Works with",
    contains: "Contains",
    usedInside: "Used inside",
    pairsWith: "Pairs with",
    avoidNextTo: "Avoid next to",
    examples: "Examples",
    examplesCount: (n: number) => `${n} live ${n === 1 ? "example" : "examples"}`,
    api: "API",
    props: "Props",
    variants: "Variants",
    extends: "Also accepts",
    theming: "Theming",
    themingLead: "The tokens each state resolves to. Change the token and every theme follows.",
    install: "Install",
    import: "Import",
    dependencies: "Dependencies",
    source: "Source",
    onThisPage: "On this page",
    storybook: "Open in Storybook",
    llms: "Plain-text docs for agents",
    prop: "Prop",
    type: "Type",
    description: "Description",
    required: "required",
    state: "State",
    token: "Token",
    defaultValue: "default",
    noApi: "This page documents a composition; its parts have their own pages.",
    related: "More in this group",
    packages: "Packages",
    scaffold: "Scaffold it",
    prompt: "Prompt for your coding agent",
    blocksUsed: "Open the full screen",
  },
  index: {
    count: (n: number) => `${n} ${n === 1 ? "page" : "pages"}`,
    examples: (n: number) => `${n} ${n === 1 ? "example" : "examples"}`,
    allIn: (name: string) => `All of ${name}`,
  },
  charts: {
    chooser: "What do you want to show?",
    chooserLead:
      "Start from the question, not the chart name. Each group lists the types that answer it, drawn from the same fictional company's quarter.",
    building: "Axes, legends, tooltips and marks",
    buildingLead:
      "The parts every chart composes: axes and ticks, legends, tooltips, annotations, brushes, small multiples, editorial marks, KPI tiles and the spec-driven AutoChart.",
    questions: {
      time: "How did it change over time?",
      compare: "How do these compare?",
      share: "What is it made of?",
      distribution: "How is it spread?",
      flow: "How does it connect or flow?",
      single: "Where does one number stand?",
    },
  },
  home: {
    building: "What are you building?",
    buildingLead:
      "Every kind of screen below is a real template in the library. Open one to see it full size, the blocks and components it is made of, and the command that scaffolds it.",
    open: "Open template",
    maps: {
      title: "Maps",
      lead: "Token-themed MapLibre: markers, clusters, routes, arcs, GeoJSON regions and a globe, all following the active theme.",
      all: "All map components",
    },
    blocks: { all: "All blocks" },
    charts: { all: "All chart types" },
    components: { all: "All components" },
  },
} as const;

// The site frame: the registry's flagship app shell (nav rail, top bar, summoned dock).
export const siteShellCopy = {
  product: "brand-ui",
  org: "Component library",
  primaryNav: "Primary",
  groups: { explore: "Explore", components: "Components", more: "More" },
  nav: {
    overview: "Overview",
    agents: "For agents",
    themes: "Themes",
    storybook: "Storybook",
    github: "GitHub",
    npm: "npm",
    attributions: "Attributions",
    resources: "Resources",
  },
  resourcesLead:
    "Every package's plain-text docs, the agent endpoints, the guides and the project links, in one place.",
  collapseNav: "Collapse navigation",
  expandNav: "Expand navigation",
  showDock: "Show the agent panel",
  hideDock: "Hide the agent panel",
  dock: {
    title: "Connect your agent",
    description: "Point a coding agent at brand-ui, then tune how the site renders it.",
    connect: "Install for your host",
    routine: "The agent's daily routine",
    appearance: "Appearance",
    more: "How agents use brand-ui",
  },
} as const;
