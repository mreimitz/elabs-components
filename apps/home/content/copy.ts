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
