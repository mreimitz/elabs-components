---
paths:
  - "registry/**"
  - "apps/docs/stories/blocks/**"
---

# Registry rules

`registry/` distributes copy-owned code via the shadcn CLI. Schema: `registry/registry.json`
(validated by `pnpm check`). Guide: `docs/REGISTRY_GUIDELINES.md`.

- **D4:** stable primitives many apps share → **package** (import, versioned centrally).
  Prototype-specific blocks/templates a team tweaks per app → **registry item** (copy-owned,
  divergence expected).

## Blocks-only

- Every item is `registry:block` (a route file inside one may be `registry:page`).
- No `registry:ui` primitives — import from `@elabs-ai/components-ui`.
- No `registry:theme` items — a theme is a stylesheet from `@elabs-ai/components-tokens`.
- Full-screen templates are NOT registry items — generated from `templates-*` stories into
  `docs/playbooks/templates/` via `pnpm gen`.

## `registry.json` is GENERATED — never hand-edit it

- Author identity/prose in `registry/registry.items.json` (`name`, `type`, `title`,
  `description`, `root`, `categories`).
- `pnpm gen` derives `files[]`, `files[].target`, `dependencies[]`,
  `registryDependencies[]` from block source.
- Escape hatches: `fileOverrides` (per-file type/target), `extraDependencies` (a
  third-party runtime peer never imported by name).
- Check: `pnpm gen:check`.

## Shared code: the `@/` alias

- Shared parts live in ONE item; a relative import may NOT cross an item boundary. Cross-item
  reference: `import … from "@/components/<item>/<file>"`.
- Source tree mirrors the install tree: `registry/blocks/<item>/<rest>` ↔
  `components/<item>/<rest>`.

## Storybook renders the shipped file

- Every block has a story at `apps/docs/stories/blocks/<item>.stories.tsx` importing the
  real registry file via `@/components/…` — never a reimplementation.
- `apps/docs` is the only legal host — no package imports a block
  (`pnpm check --rule dep-direction`).

## Rules

- Unique `name`, always `registry:block`, always author `title` + `description`.
- `files[].path` is relative to repo root and MUST exist on disk.
- Never hand-write `files`/`dependencies`/`registryDependencies` — run `pnpm gen`.
- After any change under `registry/`: `pnpm gen && pnpm check` (validates `registry.json`
  and runs `registry-resolve`).
- New item: `/new-registry-item` scaffolds it; the block-vs-template call is D4 above.

History: `docs/rules-history/registry.md`.
