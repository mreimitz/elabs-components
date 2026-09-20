/**
 * start-copy.ts — the copy of `/start` and of the prompt card the detail pages share. Its own
 * module, not `copy.ts`: the app shell imports `copy.ts`, so everything there ships in the
 * initial chunk of every page, and this text is only read on the pages that show it.
 */
// `/start` — the site's own Getting Started: connect an agent once, then one of three routes,
// each with the commands and one prompt to paste. The prompts themselves are `content/prompts.ts`;
// every command is `install.json`.
export const startCopy = {
  nav: "Get started",
  pageTitle: "Get started",
  pageDescription:
    "Connect your coding agent once, pick what you are doing, and paste one prompt. Every command on this page is copyable and comes from the same source the CLI prints.",
  connect: {
    eyebrow: "Step 1 — once per machine",
    title: "Connect your agent",
    lead: "Your agent needs a way to look up real props instead of guessing them. Pick one; both give it the same lookups.",
    mcpTitle: "Any agent: the hosted MCP server",
    mcpBody:
      "Nothing to install. Choose your host and paste the line into its terminal or its MCP settings.",
    pluginTitle: "Claude Code: the plugin",
    pluginBody: (count: number) =>
      `Type these two lines into Claude Code. It adds ${count} skills that route new apps, migrations and everyday component work, plus three reviewer agents.`,
    pluginAdd: "Add the marketplace",
    pluginInstall: "Install the plugin",
    skillsTitle: "Other agents: the skills on their own",
    skillsBody:
      "Cursor, Codex and other hosts that read Agent Skills can add them from the repository.",
    skillsAdd: "Add the skills",
    noAgent: "No agent? The same commands work by hand — every route below lists them.",
    more: "How agents use brand-ui",
  },
  routes: {
    eyebrow: "Step 2 — pick your route",
    title: "What are you doing?",
    tabsLabel: "Routes",
    commands: "The commands",
    byHand: "Wiring it by hand",
    pm: "Package manager",
  },
  newProject: {
    tab: "New project",
    lead: "One command writes a runnable Vite + React app on a template, with tokens, Tailwind and the agent context files already wired. The prompt does the same and then builds your app on top.",
    template: "Template",
    describe: "What are you building?",
    describePlaceholder:
      "A support queue for a five-person team: an overview with open and overdue counts, a ticket table with filters, and a ticket detail page.",
    scaffold: "Scaffold",
    run: "Install and run",
    templates: "See every template",
  },
  migrate: {
    tab: "Existing project",
    lead: "Both commands only read your code. They write a migration plan you can review before anything changes; the prompt then moves the app over one phase at a time.",
    notes: "What matters most? (optional)",
    notesPlaceholder: "Start with the orders screens. The login page must not change.",
    scan: "Profile the app",
    map: "Write the plan",
    base: "Install the base",
  },
  component: {
    tab: "One component or package",
    lead: "Already have an app and want one thing from the library? Install its package, wire the stylesheet once, and let the agent read the real props first.",
    pick: "Component, chart or package",
    pickPlaceholder: "DataTable",
    pkg: "Package",
    where: "Where does it go? (optional)",
    wherePlaceholder: "The orders page: a sortable table of orders with a status filter.",
    install: "Install",
    docs: "Read its real props",
    browse: "Browse all components",
    wholePackage: "The whole package",
  },
  wiring: {
    title: "The one-time wiring",
    lead: "Skipping the @source line is the most common first failure: Tailwind does not scan node_modules, so every component renders unstyled.",
    css: "Your CSS entry",
    root: "Your app root",
  },
  prompt: {
    title: "Prompt for your coding agent",
    hint: "Paste it into Claude Code, Cursor, Codex or any other coding agent. Text in [brackets] is yours to fill in.",
    copy: "Copy prompt",
    copied: "Copied",
    failed: "Select the text and copy it by hand",
  },
  next: {
    title: "Where to next",
    templates: "Templates",
    templatesBody: "Full screens to start from.",
    components: "Components",
    componentsBody: "Every component, with variants and when to use it.",
    agents: "For agents",
    agentsBody: "The install matrix, the live tool-call trace and the gates.",
    storybook: "Storybook",
    storybookBody: "The reference: every state, in every theme.",
  },
} as const;
