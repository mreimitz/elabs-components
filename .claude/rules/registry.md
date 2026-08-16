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

The internal registry (`registry/`) distributes copy-owned code via the
shadcn CLI. Schema: `registry/registry.json` (validated by `pnpm registry:validate`).

**Decision rule — package vs. registry:**

- **Package (`@elabs-ai/components-*` import)** — stable, reusable primitives and well-defined
  components that many apps share. Versioned, imported, updated centrally.
- **Registry item (`npx shadcn add`)** — prototype-specific blocks/templates a
  team will tweak per app. Copy-owned; divergence is expected and fine.

## The registry is blocks-only

Every item is a `registry:block` (a route file inside one may be `registry:page`).
Two categories are deliberately **not** in the registry:

- **Primitives.** D4 already routes stable primitives to `@elabs-ai/components-ui`,
  so a `registry:ui` item would be a second copy of something the package already
  owns. The one that shipped (`button`) was a stale fork of the package Button —
  missing variants and motion tokens, breaking four current rules — and it also
  **shadowed the upstream shadcn `button` name**, so a block declaring
  `registryDependencies: ["button"]` silently resolved to the fork instead of
  upstream. Deleted. Import from `@elabs-ai/components-ui` instead.
- **Themes.** A theme ships as a stylesheet from `@elabs-ai/components-tokens`. A
  `registry:theme` item hand-copies token values into `cssVars`, which is a second
  home for the same colours; both shipped items had already drifted from
  `themes.css`, and neither name matched a shipped theme. Deleted. A consumer who
  wants only the palette imports the stylesheet or follows `docs/CONSUMING.md`
  §5.1 (theming is open — ADR `docs/ADR/0029-open-theme-registry.md`).

## `registry.json` is GENERATED — never hand-edit it

Prose and identity are authored in **`registry/registry.items.json`** (`name`,
`type`, `title`, `description`, `root`, `categories`). Everything derivable is
derived from the block source by `pnpm gen:registry`
(`scripts/gen-registry.mjs`):

- `files[]` — the block folder tree, minus `*.stories.*` / `*.test.*` / `*.spec.*`.
- `files[].target` — `components/<item-name>/<path within the block>`.
- `dependencies[]` — parsed from the actual imports, plus the transitive closure
  of `@elabs-ai/*` **peer** dependencies (a block that imports
  `@elabs-ai/components-charts` needs `@elabs-ai/components-tokens` installed too).
- `registryDependencies[]` — only cross-item `@/components/<item>/…` references
  that name a real item.

This exists because the hand-written manifest lied: `sidebar-02` declared five
`registryDependencies` copied from shadcn's own sidebar-02 that none of its files
import, `sidebar-04`/`sidebar-05` shipped incomplete file sets, and dependency
lists named packages the code never imported while omitting ones it did.

Top-level, `registry.items.json` also carries an optional **`homepage`**, passed
straight through. The shadcn CLI **requires** it on a root registry —
`pnpm registry:build` refuses without one — but it is a published-location fact,
not something derivable from source, so it stays unset rather than invented while
this repo has no canonical public URL. Set it there when the URL exists.

Two authored escape hatches, both narrow:

- **`fileOverrides`** — per-file `type`/`target`, for a route that must land at
  `app/(app)/page.tsx` rather than under `components/`.
- **`extraDependencies`** — a **third-party peer** a block genuinely needs at
  runtime but never imports by name (`@elabs-ai/components-editor` owns
  `globalThis.MonacoEnvironment` and cannot render without `monaco-editor`).
  Brand peers are automatic; only third-party ones are declared.

Check with `pnpm gen:registry:check` (compares parsed values, not bytes, because
Prettier reflows the committed file). Self-tested by `pnpm gen:registry:check:test`.

## One copy of shared code: the `@/` alias

Registry blocks may share parts (`stat-card-parts` holds the single
`trend-badge.tsx` / `stat-card-chart.tsx` / `stat-card-hover-bridge.tsx` that
three stat-card blocks used to each carry a byte-identical copy of).

A relative import **may not cross an item boundary** — `check-registry-resolve.mjs`
builds each item's install-tree key set from that item's own `files`, so
`../stat-card-parts/trend-badge` resolves in the source tree and breaks after
install. Cross-item references use the consumer-side alias instead:

```ts
import { TrendBadge } from "@/components/stat-card-parts/trend-badge";
```

For that to work the **source tree MIRRORS the install tree**:
`registry/blocks/<item>/<rest>` ↔ `components/<item>/<rest>`. Keep block files flat
under the item folder (no `components/` subfolder inside a block), so the two
trees stay isomorphic. The generator derives `target` from that convention and the
self-test asserts it.

## Storybook renders the shipped file, not a copy

A block's story lives at `apps/docs/stories/blocks/<item>.stories.tsx` and imports
the real registry file through the same `@/components/…` alias. `apps/docs` is the
only legal host: `check-dep-direction.mjs` forbids a package importing a registry
block. Three pieces of wiring make it work, all already in place:

- `apps/docs/.storybook/main.ts` — the Vite alias `@/components` → `registry/blocks`.
- `apps/docs/tsconfig.json` — the matching `paths` entry, so `pnpm typecheck`
  covers block source.
- `apps/docs/.storybook/preview.css` — `@source "…/registry/blocks/**/*.{ts,tsx}"`,
  or the blocks render unstyled and the story proves nothing.

`registry/` is itself a **private pnpm workspace member** (`registry/package.json`)
purely so the blocks can resolve their own imports — a tree outside `apps/docs`
cannot reach `apps/docs/node_modules`. It is not published and has no scripts. Its
dependency list is pinned to the derived one by `gen-registry.test.mjs`.

A story that reimplements its block instead of importing it is the failure this
replaced: six of them had drifted, and the registry files themselves had zero
rendered coverage.

## Rules

- Unique `name`; always `registry:block`; always author `title` + `description`
  in `registry.items.json`.
- `files[].path` is relative to repo root and MUST exist on disk.
- Never hand-write `files`, `dependencies` or `registryDependencies` — run
  `pnpm gen:registry`.
- After any change under `registry/`: `pnpm gen:registry && pnpm registry:validate && pnpm registry:resolve:check`.
  The pre-commit hook does this automatically and blocks on failure.
- Every block should have a story under `apps/docs/stories/blocks/` that renders
  the shipped file, so the item stays verifiable across themes via Storybook MCP.
  See @.claude/rules/storybook-mcp.md and `/new-registry-item`.
- **Full-screen templates are NOT registry items** — they are generated from the
  Storybook `templates-*` stories into `docs/playbooks/templates/` via
  `pnpm gen:templates`.
- **Delegated curation:** the **`brand-ui-registry-curator`** agent owns registry
  hygiene — adding/updating items, the block-vs-template call, and keeping
  `registry.items.json` honest. `/new-registry-item` delegates to it.
