# Generated content — do not edit

Every file in this folder is written by `scripts/gen-home.mjs` (`pnpm gen --only home`, part
of `pnpm gen`) from the repo's real state: `brand-ui.manifest.json`, `registry/registry.json`,
`scripts/check/rules/*.mjs`, `themes/*/theme.ts` and the `*.stories.tsx` files. `pnpm gen:check`
fails the build if any file here disagrees with a fresh regeneration.

Site code never imports these JSON files directly — read them through the typed functions in
`apps/home/lib/content.ts`.

| File                        | What it holds                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages.json`             | Each `@elabs-ai/components-*` package: short name, one-line description, layer, export count, heavy peer engines.                                                                                       |
| `counts.json`               | Every number the site shows (packages, component exports, registry blocks, templates, playbooks, theme families, tokens, skills, hosted MCP tools, gates), each with the repo path it was derived from. |
| `themes.json`               | The default family plus every downloadable theme family (`themes/*`): display name, whether it ships a typeface, and each mode's resolved `--primary`/`--background`.                                   |
| `gates.json`                | Every check rule and external check command: id, one-line rationale, category, source file.                                                                                                             |
| `cli.json`                  | The CLI's standalone verbs (grouped), the hosted vs. local-only MCP tool split, the `info → search → docs → build → audit` routine, and the hosted MCP url/command.                                     |
| `blocks.json`               | The registry's blocks: name, title, categories, dependencies, and the best-matching `docs/playbooks` archetype (see the note in `scripts/gen-home.mjs`).                                                |
| `playbooks.json`            | The archetype playbooks: intent, keywords, packages, doc file, template file.                                                                                                                           |
| `story-ids.json`            | Component name → Storybook docs page id, for every component with an autodocs page.                                                                                                                     |
| `install.json`              | The install snippets: CLI, hosted MCP, local MCP, plugin marketplace commands, registry homepage, one `pnpm add` per archetype.                                                                         |
| `agent-loop-recorded.json`  | The hosted MCP's answers to every call in the hand-authored `apps/home/content/agent-loop.json`, the agent loop's offline fallback (RM-099).                                                            |
| `emit-ui-examples.json`     | The A2UI editor's example menu, from the CLI's `a2ui example` and `content/examples/` (RM-101).                                                                                                         |
| `create-theme.json`         | The `/create-theme` plugin skill's schema: name, slash command, argument hint, and full invocation template (RM-103).                                                                                   |
| `catalog-index.json`        | The Storybook catalogue's component/visualization/block index: every item's section, package, family, group, slug, featured rank, and display metadata.                                                 |
| `catalog-nav.json`          | The catalogue's navigation tree: sections (components, explore), packages, families, and group counts for sidebar rendering.                                                                            |
| `catalog-pages.json`        | Catalogue metadata for every Storybook docs page: title, description, section, family, Storybook story id, and frontmatter field order.                                                                 |
| `story-aliases.json`        | Maps of Storybook story ids for redirection and alias purposes across catalogue sections.                                                                                                               |
| `catalog-redirects.json`    | Permanent 308 redirects (source → destination) for pages moved within the catalogue; generated from the layout.                                                                                         |
| `catalog-family-order.json` | The display order of component families in the Catalogue's Components section sidebar.                                                                                                                  |

Regenerate: `pnpm gen --only home`. Verify freshness: `pnpm gen:check` (or `pnpm gen --only home --check`).
