# SESSION BRIEF — Vibe-Coder Plugin, Phase 3 (implementation)

> A self-contained handover for a fresh session. Status verified 2026-06-20.
> This is the **recommended next large WP**: the largest genuinely-unstarted,
> fully-spec'd, self-contained chunk, and the headline "ship a coding plugin
> alongside the components" deliverable. Its keystone dependency (WP-03) is LIVE.

## Goal

Ship the user-facing agentic-coding plugin: one `.claude-plugin/` artifact that gives
"vibe coders" guided flows in Claude Code + Cowork. Backlog Phases 1–2 (filing issues)
are **done** — this is **Phase 3: implement, in dependency order, each issue as a PR
that `Closes #N`**.

## Authoritative specs (read first — complete, on disk)

- Runbook: `research/vibe-coder-plugin/00-HANDOVER.md`
- Design pack: `research/vibe-coder-plugin/README.md` + the `01`–`04` docs
- Per-VP specs: `research/vibe-coder-plugin/working-packages/VP-0{1,2,3,4}-*/epic.md` + `issue-*.md`

## Build order (the actual work)

| #   | VP                                   | Issues                                                                                                   | Status                          | Blocked?                                  |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| 1   | **VP-01 Foundation** (#54)           | #120 `brand-ui-start` router + plugin wiring · #121 CLI engine stubs (`scaffold`/`scan`/`map`/`codemod`) | not started                     | **No — fully unblocked**                  |
| 2   | **VP-02 Greenfield `new-app`** (#55) | #122 staged interview + living `app-spec` · #123 `scaffold` → born-compliant app                         | partial (skill skeleton exists) | mostly — uses existing registry templates |
| 2   | **VP-04 Visual loop** (#57)          | inline (loop ref · Storybook-MCP preview helper · artifact preview)                                      | not started                     | **No** — Storybook MCP exists             |
| 3   | **VP-03 Brownfield `migrate`** (#56) | #124 scan+map · #125 codemod-driven migration                                                            | not started                     | defer — wants richer manifest + guidance  |

Build **VP-02 and VP-04 together** (greenfield consumes the visual loop).

## What already exists to build on

- `.claude-plugin/plugin.json` + `marketplace.json` — manifest wired (`skills: "./skills"`).
- `skills/brand-ui-new-app/SKILL.md` — **partial VP-02** (the 7-stage interview is documented;
  not yet wired to scaffold/visual-loop).
- `packages/cli/bin/brand-ui.mjs` + `lib/` (manifest, context, intent, audit, gen) — **needs** the
  new `scaffold/scan/map/codemod` engine (#121).
- Live WP-03 surface: `brand-ui.manifest.json` (now carries `props` + intent/anti-patterns/
  relationships), the `context`/`llms.txt` generators, the registry (24 items).

## Dependencies & honest gaps

- **WP-03 (manifest/context/intent): LIVE** — the plugin's ground truth.
- **WP-13 templates / WP-09 playbooks: partial** — VP-02 scaffolding works on existing registry
  templates but is thinner until these land. Known template gaps are filed: **#199** (silent
  placeholders) and **#200** (no marketing/landing template). Layer richer scaffolds in later.
- **VP-03 (brownfield)** wants the enriched manifest + WP-12 guidance solid — keep it last.

## Guardrails (repo rules — non-negotiable)

- **Presentation-layer scope (D5):** the plugin orchestrates skills/CLI/MCP — it must **never wire
  model calls** into `@qlik-coe-emea/qlabs-components-*`; `ai` stays types-only. See `.claude/rules/scope-and-non-goals.md`.
- **Deterministic engine, not LLM improv:** `scaffold/scan/map/codemod` are real `@qlik-coe-emea/qlabs-components-cli`
  functions (#121), not prompt magic.
- **Born-compliant output:** scaffolded apps pass the WP-10 gates (tokens, a11y, theme-safe across
  the **three** themes: qlik-bright, qlik-dark, blueprint).
- **Visual loop = real renders:** VP-04 previews via Storybook MCP across the three theme slugs —
  not mockups.
- **Process:** one issue = one PR (`Closes #N`); finders report / builders fix; run the DoD review
  battery before "done"; use the prescribed skills/agents (`/new-component`,
  `brand-ui-component-builder`, `/review-component`, …).
- **New convention ships with its enforcement** (a gate/generator, not just a doc).

## First steps

1. Read `00-HANDOVER.md` + the `VP-01` epic and its two issue specs.
2. Implement **#121** (CLI engine: `scaffold/scan/map/codemod` skeletons + typed contracts) —
   everything else calls these.
3. Implement **#120** (the `brand-ui-start` router skill + plugin wiring) — the user entry point.
4. Then VP-02 (#122 interview → #123 scaffold) **with** VP-04 (visual loop), reusing the partial
   `brand-ui-new-app` skill.
5. Register/regenerate discovery surfaces (`pnpm manifest`, `pnpm gen`, the skill catalogue) and
   keep gates green.

## Working-tree caveat

Branch off **clean `main`** (or a worktree). As of 2026-06-20 the tree may carry an in-flight
theme-removal change and a concurrent session's `apps/workbench` deletion — don't entangle plugin
work with those; confirm the concurrent session has settled.
