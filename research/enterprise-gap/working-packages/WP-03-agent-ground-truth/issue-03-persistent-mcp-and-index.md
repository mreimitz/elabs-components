---
TYPE: issue
TITLE: "[ai] Persistent brand-ui MCP server + static browsable component index"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: WP-03
---

## Summary

Two related ground-truth surfaces. (1) The only live MCP today is the **Storybook addon-mcp, which
exists only while `pnpm storybook` runs** (`.mcp.json` points at `http://localhost:6006/mcp`) and is
React-only/experimental — so in a fresh agent session with the server down, there's no always-on
ground-truth endpoint. The project's own roadmap names the fix: a persistent `brand-ui` MCP server
wrapping the existing CLI engine. (2) There's no static, browsable **component index** for humans or
agents skimming the repo without Storybook, and no per-component a11y/token notes surfaced in docs.

## Source

Static repo analysis, 2026-06-06 (gaps E3, D1, D2). Evidence: `.mcp.json` (Storybook MCP only);
`docs/CONCEPT-ai-skills.md` Roadmap ("Phase 3 option: a `brand-ui` MCP server wrapping the same CLI
engine"); no generated index under `docs/` or `apps/docs` beyond `Introduction.mdx`.

## Severity & impact

**P1.** A persistent MCP makes brand-ui agent-usable in any session/harness without booting Storybook;
the index gives humans and non-MCP agents a single readable catalog. Together they close the
"discoverable ground truth" gap that the ephemeral Storybook MCP leaves open.

## Current state & why the gap exists

The CLI engine (`@qlik-coe-emea/qlabs-components-cli`: `info`/`search`/`docs`/`tokens`/`audit`) already _is_ the backend an
MCP would wrap — the concept doc explicitly deferred the MCP to "Phase 3, optional, after skills +
CLI." The enriched manifest (issue-01/02) makes this far more valuable now.

## Proposed solution

**A. Persistent MCP server** (`packages/cli` or a sibling `packages/mcp`):

- A thin MCP server exposing the CLI engine as tools: `search`, `docs` (now with resolved props +
  anti-patterns from issue-01/02), `tokens`, `audit`, `info`.
- Runnable via `npx @qlik-coe-emea/qlabs-components-cli mcp` (stdio) so it works in Claude Code, Cursor, Codex, etc., with or
  without Storybook running. Document the `.mcp.json` / per-harness config.
- Reuse `lib/core.mjs` — no logic duplication; the MCP is a transport over the same engine.

**B. Static component index** (generated, committed):

- From the (enriched) manifest, generate a `docs/COMPONENTS.md` (or an MDX page in `apps/docs`)
  listing every component grouped by package, with its purpose, key props/variants, the tokens it
  consumes, and per-component a11y notes (keyboard/ARIA expectations). Regenerate in `pnpm build`;
  check freshness in CI.
- This doubles as the seed for a future **llms.txt** (gap E5) if docs are ever hosted.

## Affected files

- [ ] `packages/cli/` (add `mcp` subcommand) or `packages/mcp/` (new)
- [ ] `.mcp.json` (document the persistent server option alongside Storybook MCP)
- [ ] `docs/COMPONENTS.md` or `apps/docs/stories/Components.mdx` (new, generated)
- [ ] generator wiring in `packages/cli` + CI freshness check (WP-01)
- [ ] `docs/CONCEPT-ai-skills.md` (mark Phase 3 MCP as done; update Roadmap)

## Acceptance criteria

- [ ] `npx @qlik-coe-emea/qlabs-components-cli mcp` starts an MCP server exposing search/docs/tokens/audit, usable with the
      dev server **down**.
- [ ] A committed, generated component index lists all components with props/variants/tokens + a11y
      notes; CI fails if stale.
- [ ] Docs explain both MCP options (persistent CLI MCP vs Storybook MCP) and when to use each.
- [ ] No paid deps; reuses `lib/core.mjs`.

## Test to add

CLI/MCP smoke test: server lists tools and returns Button docs (with resolved props) over the
protocol; index generator test asserts a known component appears with its tokens.

## Risks / ripple effects

- MCP SDK is evolving — pin versions; keep the server thin so upgrades are cheap.
- Index generation depends on issue-01/02 enrichment — sequence after them within WP-03.

## References

- `docs/CONCEPT-ai-skills.md` (Roadmap Phase 3), `.mcp.json`, `packages/cli/lib/core.mjs`;
  research doc 02 §3/§10; gaps E3, D1, D2
