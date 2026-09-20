# Onboarding review: can an agent, and a human, actually get started? — 2026-09-20

Scope: `apps/home`, the skills, the Claude Code plugin, the hosted and local MCP, the CLI,
`llms.txt`, README and the Storybook Getting Started page — walked the way an outside
coding agent and an outside human would meet them.

Method: nothing here is from reading alone. I installed the published CLI (4.2.0) into an
empty project, installed the plugin from the public GitHub marketplace into a clean Claude
Code profile (2.1.278), ran a real headless agent session against it, built and rendered
the app it produced in Chromium, ran the migration commands on a small Next fixture built with one of the third-party libraries the migrate command converts from,
and called the live endpoints. Where a finding is from reading only, it says so.

## Verdict

The engine is good and the path through it is not yet clear.

A fresh agent with the plugin, given one sentence ("start a support-queue dashboard here,
don't ask me questions"), picked `brand-ui-new-app`, wrote an app-spec, scaffolded with the
npm CLI, looked up real props with `docs`, and reached a clean `tsc`, `eslint` and
`audit --strict`. I built it and opened it: it runs and looks like a product. That is the
claim of the library, and it holds.

What does not hold is the front door. The site has no Getting Started of its own, the
install commands it shows are partly placeholders, the plugin delivers zero MCP tools in a
consumer project, the documented registry URL is a 404, and the published CLI lacks two
commands the README leads with. A human cannot copy three prompts and go; an agent that
follows the site literally hits dead ends before it hits the good part.

## Measured

| Check                                                                             | Result                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm i -D @elabs-ai/components-cli` in an empty project                           | 1 package, under 1 s. `info`, `search`, `docs` all correct                                                                                                                                                                                                                                                                                                  |
| `/plugin marketplace add mreimitz/elabs-components` + install                     | Works, 3 s. Installs the **whole monorepo** as the plugin (52 MB cache, 70 MB marketplace clone)                                                                                                                                                                                                                                                            |
| Skills visible in a consumer session                                              | 11 — including maintainer-only `brand-ui-component` and `brand-ui-registry`, which `plugin.json` does not list (the `skills/` folder is auto-discovered)                                                                                                                                                                                                    |
| MCP tools visible in that session                                                 | **None.** The plugin's `.mcp.json` is the repo's own: `node packages/cli/bin/brand-ui.mjs mcp` (relative path, fails outside the monorepo: `Cannot find module …/consumer/packages/cli/bin/brand-ui.mjs`) plus Storybook on `localhost:6006`                                                                                                                |
| Plugin hook in a project that does not use brand-ui                               | Fires anyway. On a plain Next file built with another component library it tells the agent "Fix these before moving on" about `text-2xl` and `bg-gray-50`. The plugin is user-scoped, so this happens in every project the user has                                                                                                                         |
| End-to-end agent run, new app                                                     | Success: runnable Vite app, `tsc` / `eslint` / `audit --strict` clean, renders. 31 turns, about $1.07. Ran out of its 30-turn budget before starting the dev server itself                                                                                                                                                                                  |
| Same run, quality                                                                 | The bar chart's y-axis shows category labels instead of counts — wrong chart wiring that typecheck and `audit --strict` both passed                                                                                                                                                                                                                         |
| `npx … create my-app --template dashboard` (Getting Started "Path 0", `llms.txt`) | `Unknown command: create`, exit 1 on npm 4.2.0. Same for `a2ui` (README "Built for coding agents"). Both exist in the repo; 56 changesets are unreleased                                                                                                                                                                                                    |
| `npx shadcn add https://mreimitz.github.io/elabs-components/r/...`                | 404 for `/r/registry.json`, `/r/latest/registry.json` and `/r/latest/ai-chat-shell.json`, from two networks. Three different URL shapes are documented (`/r/<item>`, `/r/latest/<item>`, site-relative `/r/registry.json`); none resolves                                                                                                                   |
| Hosted MCP `https://elabs-ai.com/mcp`                                             | Works. 5 tools (`info`, `search`, `docs`, `tokens`, `chart_for`). No `a2ui` yet, no `instructions` in `initialize`, no MCP prompts                                                                                                                                                                                                                          |
| Live `elabs-ai.com`                                                               | Still the Storybook build. `/agents`, `/resources`, `/storybook/`, `/llms/ui` are 404. Live `llms.txt` still says "install from GitHub Packages" and "Themes (2)". Expected until RM-105, but it is what people see today                                                                                                                                   |
| `scan` → `map` on the fixture                                                     | Works and the plan is sensible. Three defects: top-level help implies `scan --out` produces `scan.json` (it does not; you need `scan --json > scan.json`), `HTMLButtonElement` is counted as a component and reported as a migration gap, and the scan reports "0 colour, 0 font-size" raw values on a file containing `bg-blue-600`, `text-sm`, `text-2xl` |

## Agent perspective

**What works.** The skill router is the right idea and it triggered without being named.
The skills lean on the CLI rather than on remembered props, and the CLI is fast and
truthful. The scaffold leaves `CLAUDE.md`, `AGENTS.md` and `brand-ui-context.md` in the new
app, so an agent without the plugin still inherits the rules. The repo's regenerated
`llms.txt` is a good single page: hosted MCP, stdio, plugin, `create`, A2UI, discovery.

**What breaks the path.**

1. The plugin is the repository. `marketplace.json` has `"source": "./"`, so a consumer
   receives the monorepo, its maintainer `.mcp.json`, and every folder under `skills/`.
   `scripts/build-plugin.mjs` already produces the right artefact (`release/plugin`: 7
   user-facing skills, 3 agents, an `.mcp.json` that uses `npx -y @elabs-ai/components-cli mcp`).
   The marketplace should point at that — a `plugin/` folder committed on release, or a
   small dedicated repo — not at the root.
2. No MCP through the plugin. The skills mention `mcp__brand-ui__*` in 8 places and
   Getting Started promises "two MCP servers". In a consumer session there are none. The
   agent recovers by shelling out to `npx`, which costs a process start per lookup (the
   run above made about 20 of them).
3. The hook is not scoped. It should exit silently unless the nearest `package.json`
   depends on an `@elabs-ai/components-*` package. As shipped it lectures agents in
   unrelated projects, which is the fastest way to get the plugin uninstalled.
4. The site's install matrix carries placeholders. `install.json` has
   `/plugin marketplace add <path-to-this-repo>` (from `scripts/gen-home.mjs`; the same
   literal is in `docs/SKILLS.md`, `docs/CONSUMING.md`, `build-plugin.mjs`,
   `build-agent-kit.mjs`). Getting Started has the real one,
   `mreimitz/elabs-components`. The install line also differs: `brand-ui` vs
   `brand-ui@brand-ui`.
5. The copy-prompt on the site says "docs at /llms.txt". Pasted into an agent that is not
   on the site, a relative path means nothing. Use the absolute URL.
6. The MCP server says nothing about how to use itself. `initialize` has no
   `instructions`, so a host that only adds the URL gets five tools and no routine. One
   paragraph — "call `search` before writing UI, `docs` before using a component, tokens
   only, finish with `audit --strict` locally" — is the cheapest improvement on this list.
7. "11 skills your agent picks up automatically" is hard-coded in `content/copy.ts`.
   `plugin.json` lists 9; 11 load only because of the leak in item 1. It should be a
   generated count of the user-facing set.
8. Other hosts have no skill path. For Cursor, VS Code and Codex the matrix offers MCP
   only. The agent kit exists for exactly this but is not on the site, and
   `npx skills add <path-to-this-repo>` is again a placeholder.

## Human perspective

There is a good Getting Started — `apps/docs/stories/GettingStarted.mdx`: pick-your-path
table, Path 0 to D, correct plugin commands, the Tailwind `@source` warning, a
commands-and-when table. But it lives in Storybook, and the home site only links to it from
a card at the very bottom ("Where to next → Adopt"). The site's routes are `/`,
`/components`, `/blocks`, `/charts`, `/templates`, `/agents`, `/resources`,
`/attributions`. There is no `/docs` or `/get-started`, and nothing in the left rail says
"start here".

Against the three things asked:

| Need                         | Today                                                                                             | Gap                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start a new project          | `create` (unreleased on npm), the `brand-ui-new-app` skill, a 4-line prompt on each template page | No single copyable prompt on the site that covers install + scaffold + verify. The template prompt assumes the MCP is already connected and the packages installed                                            |
| Migrate an existing project  | `brand-ui-migrate` skill, `scan` / `map` / `codemod`                                              | **Not on the site at all.** No page, no prompt, no mention in the matrix                                                                                                                                      |
| Use one component or package | Detail pages show the import line and props                                                       | No `pnpm add @elabs-ai/components-<pkg>` line on component pages, no reminder of the `@source` + tokens CSS wiring (the most common first failure), and no per-component prompt. Only templates have a prompt |

For someone with no terminal habits the current flow also assumes too much: `pnpm`
everywhere (no `npm` equivalent shown), no note on where `/plugin …` is typed, no Windows
remarks. The scaffold itself behaved on Linux; I did not test Windows or macOS in this pass.

## What I would change, in order

1. **Ship the release.** 56 changesets are pending; README, `llms.txt` and Getting Started
   on `main` describe `create` and `a2ui`, which npm does not have. Until then the first
   command a reader copies fails.
2. **Make the marketplace install the built plugin**, not the repo; add the `npx` MCP to
   it; scope the hook to brand-ui projects. Add a release-smoke step that installs the
   plugin into a clean profile and asserts: only user-facing skills, `brand-ui` MCP
   connected, hook silent in a non-brand-ui fixture. Everything in the "Measured" table
   can be a scripted check.
3. **Fix the registry URL once.** Either `/r` on the site (RM-105) or GitHub Pages, one
   shape, generated into `install.json`, the CLI `info` footer, Getting Started and
   `llms.txt` from one constant — and a smoke check that fetches it.
4. **Add `/start` to the home site** and put it first in the left rail. Three tabs — New
   project, Existing project, One component — each with: what you need, the two or three
   commands (npm and pnpm), and one prompt to paste. Port the content from
   `GettingStarted.mdx`; keep Storybook as reference.
5. **Write the prompts once, generate them everywhere.** A `prompts.json` (new-app,
   migrate, use-component, use-package, re-theme, audit) feeding the `/start` page, a
   "Prompt" button on every component / chart / block detail page (filled with that
   page's name and package), `llms.txt`, and MCP `prompts/list` so hosts expose them as
   slash commands. Prompts must be self-contained: absolute URLs, the install line, the
   done-gate.
6. **Give the MCP a voice:** `instructions` on `initialize`, and an `a2ui` tool on the
   hosted server once released.
7. **Replace every `<path-to-this-repo>`** in generated and hand docs with the real
   source, and generate the skill count.
8. **CLI papercuts from the migration run:** have `scan --out` also write `scan.json` (or
   fix the help), stop counting TypeScript generics as components, and count Tailwind
   palette / size utilities as raw values in `scan` the way the hook and the audit do.
9. **Close the audit blind spot the agent run exposed:** a chart whose value axis renders
   category labels passed every gate. Worth a `docs BarChart` anti-pattern entry at least,
   and ideally an audit rule for axis/`dataKey` mismatch.

## Not verified

Windows and macOS behaviour; Cursor, VS Code and Codex with the hosted MCP (only the raw
protocol was exercised); the `apps/home` site rendered in a browser (I read its source and
generated content — the visual side was reviewed separately); the agent-kit zip; an
agent-driven run of the migrate skill (only its CLI steps were run).
