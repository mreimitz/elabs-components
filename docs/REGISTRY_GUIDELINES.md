# Registry guidelines

The registry (`registry/`) distributes **copy-owned** code via the shadcn CLI,
complementing the **imported** `@elabs-ai/components-*` packages.

## Structure

```
registry/
  registry.json     # the manifest (validated by pnpm check --rule registry-validate)
  components/        # registry:ui — self-contained primitives
  blocks/            # registry:block — compositions using @elabs-ai/components-* packages
  templates/         # whole pages/features composed of blocks
  themes/            # (token sets are declared inline via cssVars)
```

`registry.json` follows the shadcn schema: a top-level `name` + an `items[]`
array; each item has `$schema`, `name`, `type`, `title`, `description`,
`dependencies`, `registryDependencies`, and `files[]` (`path`, `type`, optional
`target`). Theme items use `cssVars`.

## How items are structured

- **`registry:ui`** (e.g. `button`) — a single self-contained file that imports
  `@/lib/utils` (`cn`). Lists its npm `dependencies`. Copied into the consumer's
  `components/ui`.
- **`registry:block`** (e.g. `app-shell`, `ai-chat-shell`, `data-table`,
  `flow-canvas`, `marketing-hero`) — a composition that imports installed
  `@elabs-ai/components-*` packages (declared in `dependencies`). The consumer copies and
  customizes it. Use `registry:page` + `target` for routed pages.
- **`registry:theme`** (e.g. `default-theme`) — token sets via
  `cssVars.light` / `cssVars.dark`.

## How to add an item

1. Create the source file(s) under the right folder.
2. Add an entry to `registry/registry.json` (use the `/new-registry-item` command).
3. `pnpm check --rule registry-validate` — confirms shape and that every `files[].path` exists.
4. (Optional) `pnpm dlx shadcn@latest build registry/registry.json --output registry/__output`
   to emit the per-item JSON for static hosting.

## Distribution: served by the website at `/r`

The registry **is** served at a real URL. `registry/registry.items.json` sets
`homepage` to `https://elabs-ai.com/r` — the base every built item resolves
under — and the website's own build puts the items there:
`pnpm registry:build` emits `registry/__output/*.json`, and
`apps/home/scripts/copy-registry-output.mjs` copies that into
`apps/home/public/r/`, which Next serves as static files. So a release of the
website ships the registry; there is no second deploy to keep in step.

Both public addresses serve it identically:

```
https://elabs-ai.com/r/registry.json               # the index
https://elabs-ai.com/r/<item>.json                 # one item
https://elabs-components.vercel.app/r/<item>.json   # the same files
```

```sh
npx shadcn add https://elabs-ai.com/r/data-table.json
```

The path is **not** versioned: `/r` always serves the currently deployed
release, and the site only ever deploys a released version. A consumer that
needs an exact past revision pins it in git, not in the URL.

The alternative that needs no hosting at all still works: copy the item's
source straight out of `registry/blocks/<name>/` into the consuming repo and
fix up import aliases.

## How to test an item

- `pnpm check --rule registry-validate` (structure + file existence).
- Dry-run install into a scratch app: `npx shadcn add <url-or-name>`.
- Confirm the copied file type-checks against the consumer's deps.

## Component vs. block vs. template

- **Component** — one primitive (single concern). Often `registry:ui`.
- **Block** — a multi-part feature using installed packages (a chat surface, a
  data table with toolbar). `registry:block`.
- **Template** (full-screen archetype) — NOT a registry item. Generated from the
  Storybook `templates-*` stories into `docs/playbooks/templates/` via
  `pnpm gen` (single source of truth = the story).

## Package vs. registry

- Stable, broadly-shared, centrally-updated → **package** (`@elabs-ai/components-*`).
- Prototype-specific, per-app customization expected → **registry** block.

## The registry IS published by a release (#106, superseded)

`pnpm check --rule registry-validate` runs on every PR, and a release deploys
the website, which serves the built registry at `/r` (see "Distribution"
above). #106 originally documented the opposite as a **deliberate** decision,
reasoned from "there is no hosted consumer path" — that premise stopped being
true, so the decision was reversed rather than left to rot as stale prose.

For a while the registry was ALSO pushed to a `gh-pages` branch under a
versioned path. That copy was never reachable — the Pages source was never
switched and its deploy credential was never added, so every one of those URLs
answered 404 — and it was a second deploy answering a question the website
already answers. 5.0.0 removed it; `/r` is the one place the registry lives.

A release moves **three** distribution surfaces in lockstep: the npm packages,
the plugin marketplace pointer, and the website (which carries the registry and
the hosted MCP) — each keyed to the same tagged version.
