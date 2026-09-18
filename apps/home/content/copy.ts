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
  scene: {
    label: "Live example: an operations console built from the library",
    product: "Atlas Ops",
    org: "Acme",
    nav: { overview: "Overview", runs: "Runs", agents: "Agents", settings: "Settings" },
    title: "Overview",
    kpis: {
      runs: { label: "Agent runs", description: "Last 7 days" },
      success: { label: "Success rate", description: "Completed without retry" },
      spend: { label: "Model spend", description: "Against a $5,000 limit" },
    },
    chartTitle: "Runs per day",
    chartSeries: "Runs",
    tableCaption: "Recent runs",
    columns: { id: "Run", agent: "Agent", status: "Status", duration: "Duration" },
    chatLabel: "Assistant",
    userMessage: "Why did the invoice agent slow down on Thursday?",
    assistantMessage:
      "Thursday’s invoice runs waited on the ERP export: median queue time rose from 40 s to 3 min between 09:00 and 11:00. Runs after 11:00 are back to normal.",
    toolTitle: "query_runs",
    toolSummary: "agent = invoice · Thursday",
    toolResult: "112 runs · median queue 3 min 04 s · 0 failures",
    tiles: {
      queue: "Queue depth",
      model: "Default model",
      budget: "Budget used",
    },
    flowNode: { title: "Classify invoice", meta: "Step 2 of 4" },
  },
} as const;
