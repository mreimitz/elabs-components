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
