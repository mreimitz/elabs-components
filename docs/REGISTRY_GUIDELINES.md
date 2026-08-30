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

## Distribution: hosted on GitHub Pages, versioned (#31)

The registry **is** served at a real URL. `registry/registry.items.json` sets
`homepage` to `https://mreimitz.github.io/elabs-components/r` — the base every
built item resolves under — and `.github/workflows/release.yml`'s
`publish-registry` job builds it (`pnpm registry:build`) and pushes the output
to the repo's `gh-pages` branch (`pnpm registry:publish`, i.e.
`scripts/publish-registry-pages.mjs`) on every version tag, right after that
version's npm packages publish successfully.

The path is **versioned**, so a block pinned to a version keeps resolving
across a later major:

```
https://mreimitz.github.io/elabs-components/r/<version>/<item>.json   # immutable per release
https://mreimitz.github.io/elabs-components/r/latest/<item>.json      # moving alias
```

So, once the maintainer has enabled GitHub Pages for this repo (**Settings →
Pages → "Deploy from a branch" → `gh-pages` → `/(root)`** — that switch is a
manual, outward-facing step this workflow deliberately does not flip):

```sh
npx shadcn add https://mreimitz.github.io/elabs-components/r/latest/data-table.json
# or pinned to a version:
npx shadcn add https://mreimitz.github.io/elabs-components/r/4.0.0/data-table.json
```

`pnpm registry:published:check` (wired into `.github/workflows/gates.yml`) gates
this: it fails a build only if a **published** item stops resolving (real
rot); until Pages is enabled and a version has shipped, it prints a skip
notice and passes, since there is nothing to check yet. See that script's
header comment for the full design.

The alternative that needs no hosting at all still works: copy the item's
source straight out of `registry/blocks/<name>/` into the consuming repo and
fix up import aliases.

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

## The registry IS published by a release (#106, superseded by #31)

`pnpm registry:validate` runs on every PR, and — since #31 —
`.github/workflows/release.yml` also runs `pnpm registry:build` and publishes
the output to GitHub Pages via its `publish-registry` job (see "Distribution"
above). #106 originally documented the opposite as a **deliberate** decision,
reasoned from "there is no hosted consumer path" — that premise stopped being
true once GitHub Pages became reachable for this hosting shape, so the
decision was reversed rather than left to rot as stale prose.

A release now moves **three** distribution surfaces in lockstep: the npm
packages, the plugin marketplace pointer, and the hosted registry — each keyed
to the same tagged version.
