---
name: brand-ui-registry
description: Curate the brand-ui shadcn-compatible registry (maintainer workflow). Use when deciding whether something belongs as an imported @qlik-coe-emea/qlabs-components-* primitive vs a copy-own registry block/template, when adding or editing a registry item, or when validating/building the registry for distribution. Use when the user says "add a registry item", "make this a block", "publish to the registry", or "package vs registry". For consuming registry items in an app, use the `brand-ui` skill (npx shadcn add).
user-invocable: true
argument-hint: "[add|validate|build] [name]"
allowed-tools:
  - Bash(pnpm brand-ui *)
  - Bash(pnpm registry:*)
  - Bash(pnpm dlx shadcn@latest *)
---

# brand-ui-registry (maintainer)

Front door to `.claude/commands/new-registry-item.md`, the `registry-curator`
agent, and `.claude/rules/registry.md`. The registry distributes **copy-own** code
via the shadcn CLI; stable primitives stay as imported `@qlik-coe-emea/qlabs-components-*` packages.

## Decision: package vs registry

- **Package (`@qlik-coe-emea/qlabs-components-*` import)** — stable, reusable primitives many apps share.
  Versioned, imported, updated centrally.
- **Registry item (`npx shadcn add`)** — prototype-specific blocks/templates a team
  will tweak per app. Copy-owned; divergence is expected.

Item types: `registry:ui` (self-contained primitive), `registry:block` (composition
importing installed `@qlik-coe-emea/qlabs-components-*` — list them in `dependencies`), and `registry:theme`
(token set via `cssVars`). Full-screen **templates** are NOT registry items — they are
generated from the Storybook `templates-*` stories into `docs/playbooks/templates/`
(`pnpm gen:templates`); don't re-add them here.

## Add / edit an item

1. Put source under `registry/` and add an entry to `registry/registry.json`:
   unique `name`, valid `type`, `title` + `description`, accurate `files[]` (paths
   relative to repo root, must exist), `dependencies` (real npm + `@qlik-coe-emea/qlabs-components-*`),
   `registryDependencies` (other items), `target` for `registry:page`/`file`.
2. Keep imports on the `@qlik-coe-emea/qlabs-components-*` alias, semantic tokens only.

## Validate + build

- `pnpm registry:validate` after every change (must pass).
- `pnpm registry:build` (or `pnpm dlx shadcn@latest build registry/registry.json`)
  to produce the hosted JSON.
- `brand-ui search <name>` should then surface the item; consumers add it with
  `npx shadcn@latest add <registry-url>/<name>.json`.

## Done

Valid `registry.json`, files exist on disk, validate passes, item discoverable via
`brand-ui search`. New shared primitives also belong in the manifest — if you moved
something into a package, run `pnpm brand-ui manifest --write`.
