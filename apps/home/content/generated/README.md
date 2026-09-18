# Generated content — do not edit

Every file in this folder is written by `scripts/gen-home.mjs` (`pnpm gen --only home`, part
of `pnpm gen`) from the repo's real state: `brand-ui.manifest.json`, `registry/registry.json`,
`scripts/check/rules/*.mjs`, `themes/*/theme.ts` and the `*.stories.tsx` files. `pnpm gen:check`
fails the build if any file here disagrees with a fresh regeneration.

Site code never imports these JSON files directly — read them through the typed functions in
`apps/home/lib/content.ts`.

| File             | What it holds                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages.json`  | Each `@elabs-ai/components-*` package: short name, one-line description, layer, export count, heavy peer engines.                                                                                       |
| `counts.json`    | Every number the site shows (packages, component exports, registry blocks, templates, playbooks, theme families, tokens, skills, hosted MCP tools, gates), each with the repo path it was derived from. |
| `themes.json`    | The default family plus every downloadable theme family (`themes/*`): display name, whether it ships a typeface, and each mode's resolved `--primary`/`--background`.                                   |
| `gates.json`     | Every check rule and external check command: id, one-line rationale, category, source file.                                                                                                             |
| `cli.json`       | The CLI's standalone verbs (grouped), the hosted vs. local-only MCP tool split, the `info → search → docs → build → audit` routine, and the hosted MCP url/command.                                     |
| `blocks.json`    | The registry's blocks: name, title, categories, dependencies, and the best-matching `docs/playbooks` archetype (see the note in `scripts/gen-home.mjs`).                                                |
| `playbooks.json` | The archetype playbooks: intent, keywords, packages, doc file, template file.                                                                                                                           |
| `story-ids.json` | Component name → Storybook docs page id, for every component with an autodocs page.                                                                                                                     |
| `install.json`   | The install snippets: CLI, hosted MCP, local MCP, plugin marketplace commands, registry homepage, one `pnpm add` per archetype.                                                                         |

Regenerate: `pnpm gen --only home`. Verify freshness: `pnpm gen:check` (or `pnpm gen --only home --check`).
