# Registry guidelines

The registry (`registry/`) distributes **copy-owned** code via the shadcn CLI,
complementing the **imported** `@elabs-ai/components-*` packages.

## Structure

```
registry/
  registry.json     # the manifest (validated by pnpm registry:validate)
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
3. `pnpm registry:validate` — confirms shape and that every `files[].path` exists.
4. (Optional) `pnpm dlx shadcn@latest build registry/registry.json --output registry/__output`
   to emit the per-item JSON for static hosting.

## Distribution: self-hosted (no turnkey URL)

This repo does **not** serve `registry/registry.json` or the per-item JSON at any
URL — there is no `/r/*.json` endpoint and no docs-deploy step in CI that would
publish one (the repo is private, so a public host isn't an option either). A
consumer's `npx shadcn add <url>/<item>.json` therefore only works after **they**
run `pnpm registry:build` (`pnpm dlx shadcn@latest build registry/registry.json
--output registry/__output`) and serve the `registry/__output/` directory from a
host they control, then point `shadcn add` at that host. The alternative that
needs no hosting at all: copy the item's source straight out of
`registry/blocks/<name>/` (or `registry/components/<name>/`) into the consuming
repo and fix up import aliases. Never document a bare
`npx shadcn add https://<placeholder>/...json` as if it resolves out of the box —
`pnpm registry:validate` fails on a placeholder `homepage`.

## How to test an item

- `pnpm registry:validate` (structure + file existence).
- Dry-run install into a scratch app: `npx shadcn add <url-or-name>`.
- Confirm the copied file type-checks against the consumer's deps.

## Component vs. block vs. template

- **Component** — one primitive (single concern). Often `registry:ui`.
- **Block** — a multi-part feature using installed packages (a chat surface, a
  data table with toolbar). `registry:block`.
- **Template** (full-screen archetype) — NOT a registry item. Generated from the
  Storybook `templates-*` stories into `docs/playbooks/templates/` via
  `pnpm gen:templates` (single source of truth = the story).

## Package vs. registry

- Stable, broadly-shared, centrally-updated → **package** (`@elabs-ai/components-*`).
- Prototype-specific, per-app customization expected → **registry** block.

## The registry is not published by a release (#106)

`pnpm registry:validate` runs on every PR, but `.github/workflows/release.yml`
neither runs `pnpm registry:build` nor attaches `registry/__output` to the GitHub
Release. That is a **decision, not an omission**: there is no hosted consumer path
for the built registry JSON — `README.md` and the Getting Started story tell
consumers to build and **self-host** it — so shipping it as a release asset would
create an artifact nobody resolves.

So a release moves **two** distribution surfaces in lockstep (the npm packages and
the plugin marketplace pointer), and deliberately not this third one. If a hosted
registry ever gains a real consumer, that is a new piece of work: add
`pnpm registry:build` + a zipped asset to `release.yml`, and say so here.
