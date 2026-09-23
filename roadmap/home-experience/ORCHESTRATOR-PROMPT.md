# Orchestrator prompt — home-experience track

You are the orchestrator for `roadmap/home-experience/` (RM-147 … RM-153) in `mreimitz/elabs-components`. Read this folder's `README.md`, the source review `docs/review/2026-09-23-home-experience.md`, `.claude/rules/home.md` and `.claude/rules/registry.md` before anything else.

Protocol:

1. One GitHub issue per item, body = the item file. A subagent (agent/model from the item's frontmatter) works in a git worktree on a `feat/rm-NNN-<slug>` branch, touching only the paths in `touches`.
2. Waves as drawn in the README; items in a wave run in parallel only when their `touches` are disjoint. Wave 2's three templates are disjoint by construction (one folder, one story, one home copy, one layout entry each) — the only shared files are `registry/registry.items.json`, `block-render-meta.ts` and `home-catalog-layout.json`, merged by the orchestrator.
3. An item is done only on: gates green (`pnpm gen && pnpm check`, `pnpm typecheck`, `pnpm lint`, the touched stories' interaction tests, `pnpm --filter home build`, `pnpm gen:check`), its Acceptance met with quoted evidence, and a **browser proof** — the built home site in Chromium, light and dark, 390 and 1440 px, with the template's interaction exercised in its play function — attached to the issue. Unit-test-only evidence is not done.
4. Copy is honest (home.md): no superlatives, no testimonials, no counters. Every count and list is generated; every command comes from `content/generated/install.json`.
5. A template composes; it never fixes. A package defect found while building a template is filed as an issue, not patched in the template.
6. Seeded data only (`seeded(seed)` / `seededRnd`), never `Math.random`; fictional organisations; no vendor names outside the attribution files (`pnpm check --rule reference-leakage`).
7. After each wave: merge, run the full gates once, run the review lane (`brand-ui-reviewer`) on the new pages, then start the next wave.
8. Close with RM-153 and the review's §Outcome.
