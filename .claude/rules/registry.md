---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. The package-vs-registry DECISION (D4) stays always-on via the
# CLAUDE.md decision table + `decision-routing.md`; these detailed registry-authoring
# rules are load-bearing only when working under `registry/`. See
# `.claude/rules/quality-gates.md` "Enforcement over reminders" and the `rules:scoping:check` gate.
paths:
  - "registry/**"
---

# Registry rules

The internal registry (`registry/`) distributes copy-owned code via the
shadcn CLI. Schema: `registry/registry.json` (validated by `pnpm registry:validate`).

**Decision rule — package vs. registry:**

- **Package (`@elabs/components-*` import)** — stable, reusable primitives and well-defined
  components that many apps share. Versioned, imported, updated centrally.
- **Registry item (`npx shadcn add`)** — prototype-specific blocks/templates a
  team will tweak per app. Copy-owned; divergence is expected and fine.

**Item types we use:**

- `registry:ui` — self-contained primitive; imports `@/lib/utils` (`cn`).
- `registry:block` — a composition that imports installed `@elabs/components-*` packages
  (list them in `dependencies`). Use `registry:page`/`target` for routes.
- `registry:theme` — a token set via `cssVars` (light/dark).

**Rules:**

- Unique `name`; valid `type`; always include `title` + `description`.
- `files[].path` is relative to repo root and MUST exist on disk.
- `target` is required for `registry:page` and `registry:file`.
- `dependencies` lists real npm + `@elabs/components-*` packages the files import;
  `registryDependencies` lists other registry items (names or URLs).
- Run `pnpm registry:validate` after every change.
- Every block/template should have a co-located `*.stories.tsx` (or reference an
  existing story) so the item stays discoverable + verifiable across themes via
  Storybook MCP when the dev server is up (else verify manually). See
  @.claude/rules/storybook-mcp.md and `/new-registry-item`.
- **component vs block:** component = single primitive; block = multi-part feature
  using installed packages. (Full-screen **templates** are NOT registry items — they
  are generated from the Storybook `templates-*` stories into
  `docs/playbooks/templates/` via `pnpm gen:templates`.)
- **Delegated curation:** the **`brand-ui-registry-curator`** agent owns registry
  hygiene — adding/updating items, the component-vs-block-vs-template call, keeping
  `dependencies`/`registryDependencies` accurate, and keeping `registry.json` valid.
  `/new-registry-item` delegates to it for non-trivial items.
