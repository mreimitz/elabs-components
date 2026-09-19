---
"@elabs-ai/components-cli": minor
---

Smaller first reads for coding agents.

- `create` writes a short `brand-ui-context.md`: the routine, then one name per component for the packages the app installs (3–6 KB, was 29 KB listing every package). The app's `CLAUDE.md` and `AGENTS.md` point at `brand-ui docs <Name> --brief` for a component's parts and props, show the npm form of each command beside the pnpm one, and no longer tell the agent to run `brand-ui context`, which only works inside the brand-ui repository.
- `search` takes `--limit <n>` and `--offset <n>` (MCP `search`: `limit`, `offset`) to page through long component and type lists. A paged answer ends with the call for the next page (MCP: `nextOffset`). Without them the output is unchanged.
- The stdio MCP server's startup line names all seven tools, `a2ui` included.
- The Claude Code plugin's `brand-ui` skill is a short router (under 8 KB, was 44 KB). The agent-output contract, the chart guide and the component-selection table moved to reference files the agent loads when a task needs them, and its package list counts one per component, like the README and `llms.txt`.
