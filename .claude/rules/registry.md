---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. The package-vs-registry DECISION (D4) stays always-on via the
# CLAUDE.md decision table + `decision-routing.md`; these detailed registry-authoring
# rules are load-bearing only when working under `registry/` (or on the Blocks stories
# that render it). See `.claude/rules/quality-gates.md` "Enforcement over reminders"
# and the `rules:scoping:check` gate.
paths:
  - "registry/**"
  - "apps/docs/stories/blocks/**"
---

# Registry rules

`registry/` distributes copy-owned code via the shadcn CLI. Schema: `registry/registry.json`
(`pnpm registry:validate`). Guide: `docs/REGISTRY_GUIDELINES.md`.

- **D4:** stable primitives many apps share → **package** (`@elabs-ai/components-*` import;
  versioned, updated centrally). Prototype-specific blocks/templates a team tweaks per app
  → **registry item** (`npx shadcn add`; copy-owned, divergence expected).

## Blocks-only

- Every item is a `registry:block` (a route file inside one may be `registry:page`).
- **No `registry:ui` primitives** — import from `@elabs-ai/components-ui`; a copy shadows
  the upstream shadcn `button` name in `registryDependencies`.
- **No `registry:theme` items** — a theme is a stylesheet from `@elabs-ai/components-tokens`;
  palette-only consumers import it (`docs/CONSUMING.md` §5.1, ADR
  `docs/ADR/0029-open-theme-registry.md`).
- **Full-screen templates are NOT registry items** — generated from the Storybook
  `templates-*` stories into `docs/playbooks/templates/` via `pnpm gen:templates`.

## `registry.json` is GENERATED — never hand-edit it

- Author identity/prose in **`registry/registry.items.json`**: `name`, `type`, `title`,
  `description`, `root`, `categories`, optional top-level `homepage`.
- `pnpm gen:registry` (`scripts/gen-registry.mjs`) derives the rest from block source:
  `files[]` (block tree minus `*.stories.*` / `*.test.*` / `*.spec.*`); `files[].target`
  (`components/<item-name>/<path within the block>`); `dependencies[]` (actual imports +
  transitive `@elabs-ai/*` **peer** deps); `registryDependencies[]` (only cross-item
  `@/components/<item>/…` refs naming a real item).
- `homepage` passes through; the shadcn CLI **requires** it on a root registry. It is the
  repo's GitHub Pages base (`scripts/publish-registry-pages.mjs` publishes;
  `pnpm registry:published:check` gates). A fork with no public host may omit it — never
  invent one.
- Narrow escape hatches: **`fileOverrides`** — per-file `type`/`target` (a route outside
  `components/`); **`extraDependencies`** — a **third-party** runtime peer a block never
  imports by name. Brand peers are automatic; only third-party ones are declared.
- Check: `pnpm gen:registry:check` (compares parsed values, not bytes); self-test
  `pnpm gen:registry:check:test`.

## Shared code: the `@/` alias

- Shared parts live in ONE item (`stat-card-parts`). A relative import **may not cross an
  item boundary** (`scripts/check-registry-resolve.mjs` resolves against each item's own
  `files`). Cross-item: `import … from "@/components/stat-card-parts/trend-badge"`.
- The source tree MIRRORS the install tree: `registry/blocks/<item>/<rest>` ↔
  `components/<item>/<rest>`. Keep block files flat under the item folder (no inner
  `components/` subfolder); `target` derives from this (self-tested).

## Storybook renders the shipped file

- Every block has a story at `apps/docs/stories/blocks/<item>.stories.tsx` importing the
  real registry file via `@/components/…` — never a reimplementation — verifiable across
  themes via Storybook MCP (@.claude/rules/storybook-mcp.md, `/new-registry-item`).
  `apps/docs` is the only legal host (`scripts/check-dep-direction.mjs`: no package imports
  a block).
- Wiring: `apps/docs/.storybook/main.ts` (Vite alias `@/components` → `registry/blocks`);
  `apps/docs/tsconfig.json` (matching `paths`); `apps/docs/.storybook/preview.css`
  (`@source` for `registry/blocks/**`, else unstyled).
- `registry/` is a **private workspace member** (`registry/package.json`) so blocks resolve
  imports — not published, no scripts; deps pinned to the derived list by
  `scripts/gen-registry.test.mjs`.

## Rules

- Unique `name`; always `registry:block`; always author `title` + `description` in
  `registry.items.json`.
- `files[].path` is relative to repo root and MUST exist on disk.
- Never hand-write `files`, `dependencies` or `registryDependencies` — run `pnpm gen:registry`.
- After any change under `registry/`:
  `pnpm gen:registry && pnpm registry:validate && pnpm registry:resolve:check`
  (the pre-commit hook enforces this).
- **Delegated curation:** the **`brand-ui-registry-curator`** agent owns registry hygiene —
  adding/updating items, the block-vs-template call, keeping `registry.items.json` honest.
  `/new-registry-item` delegates to it.

History and measurements: docs/rules-history/registry.md
