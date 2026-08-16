---
TYPE: issue
TITLE: "[ai] Add a `brand-ui context` generator — ground truth into the files agents read"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: WP-03
---

## Summary

Add a `brand-ui context` command that **generates** the manifest's ground truth into the files coding
agents already read — `CLAUDE.md` / `AGENTS.md` / `.cursor/rules` — **and a first-class `llms.txt`**
(per-package spokes + a root aggregate; see the decision record [`../../11-agent-docs-architecture.md`](../../11-agent-docs-architecture.md),
which promotes `llms.txt` from optional/E5 to required). This is the AgnosticUI `ag context` pattern: a
portable, **MCP-free**, version-controlled context surface that
gives any agent (Claude, Cursor, Copilot, Windsurf, Gemini) an always-present, accurate view of the
component surface — without needing the Storybook dev server up. It is the cheapest fix for the
"ground-truth MCP is ephemeral" gap (E3) and closes E7.

## Source

Research doc 02 §A (context generators) + the AgnosticUI review; gaps E3, E7. Evidence: `.mcp.json`
exposes only the Storybook MCP (dev-server-bound); no command emits a static context artifact today.

## Severity & impact

**P1.** Makes brand-ui usable by _any_ agent in _any_ session with zero setup and no running server —
the most portable possible ground-truth surface. Lower effort than the persistent MCP (issue-03) and
should ship first.

## Current state & why the gap exists

brand-ui's ground truth lives in `brand-ui.manifest.json` + the live Storybook MCP. The maintainer
skill teaches agents to run `brand-ui search`/`docs`, but nothing writes a durable context file the
agent sees automatically at session start. AgnosticUI demonstrates the pattern is viable and valued.

## Proposed solution

- Add `brand-ui context [--target claude|agents|cursor|all] [--write]` to `@qlik-coe-emea/qlabs-components-cli`, generating from
  the (enriched, per issue-01/02) manifest:
  - a **component catalogue** (name → package, one-line purpose, key props/variants, tokens consumed),
  - the **critical rules** digest (tokens-only, forwardRef/cn, a11y, theme-safety),
  - **composition pointers** (and, once WP-09 lands, the **playbook index** + intent map),
  - the **runnable command contract** (typecheck/lint/test/build) — overlaps WP-01 issue-03.
- Write it into a clearly-delimited, **auto-generated block** (e.g. between
  `<!-- brand-ui:context:start -->` / `:end` markers) inside `CLAUDE.md` / `AGENTS.md` and a
  `.cursor/rules/brand-ui.mdc`, so hand-written guidance and generated content coexist without
  clobbering each other.
- **Emit `llms.txt` as hub + spokes (per doc 11):** a generated `packages/<pkg>/llms.txt` for each
  package (its slice) + a thin **root `llms.txt`** that routes ("which package for what") and states the
  one-way composition graph. Same generator, same manifest source — the always-on tier beneath the live
  Storybook/MCP tier.
- Keep the generator in `pnpm build` / a `pnpm context` script.
- **Enforcement (the point):** this file must be **generated + stale-gated, never hand-edited** — wire
  the regeneration + CI stale-check via **WP-10** (fail the build if the generated block is out of
  date). A generated context file that drifts is worse than none.

## Affected files

- [ ] `packages/cli/lib/core.mjs` + `bin/brand-ui.mjs` (new `context` command)
- [ ] `CLAUDE.md`, `AGENTS.md` (auto-generated block with markers)
- [ ] `.cursor/rules/brand-ui.mdc` (new, generated)
- [ ] `llms.txt` — **first-class**: per-package `packages/<pkg>/llms.txt` + a root aggregate (generated; doc 11)
- [ ] CI stale-check for the context blocks **and** the `llms.txt` files (built in WP-10)

## Acceptance criteria

- [ ] `brand-ui context --write` regenerates the marked blocks in CLAUDE.md/AGENTS.md and the Cursor
      rule from the manifest, **and the per-package + root `llms.txt`** (hub + spokes, doc 11).
- [ ] The block contains accurate component/prop/variant/token data (sourced from the enriched
      manifest, not hand-typed).
- [ ] Hand-written content outside the markers is preserved.
- [ ] A CI stale-check (WP-10) fails if the generated block is out of date.
- [ ] No paid deps.

## Test to add

CLI unit test: running `context` twice is idempotent; the block reflects a known component's real
variants; content outside markers is untouched. The CI stale-check is the regression lock.

## Risks / ripple effects

- Don't bloat agent context windows — keep the generated block a concise catalogue + pointers, not the
  full prop tables (those stay queryable via `brand-ui docs` / MCP).
- Marker-block editing must be robust (never clobber human content). Depends on issue-01/02 for rich
  content; can ship a basic catalogue first.

## References

- research doc 02 §A; `docs/CONCEPT-ai-skills.md` (Phase 3); gaps E3, E7; pairs with WP-10 (stale-gate)
  and WP-01 issue-03 (command contract).
