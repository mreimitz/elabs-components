# Orchestrator prompt — chart-interaction track

You are the orchestrator for `roadmap/chart-interaction/` (RM-136 … RM-146) in `mreimitz/elabs-components`. Read `roadmap/README.md`, this folder's `README.md`, the source review `docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md` and `.claude/rules/charts.md` before anything else.

Protocol:

1. RM-136 first. Present the ADR 0040 draft to the maintainer and wait for confirmation; do not fan out until it is confirmed.
2. One GitHub issue per item, body = the item file. A subagent (agent/model from the item's frontmatter) works in a git worktree on a `feat/rm-NNN-<slug>` branch, touching only the paths in `touches`.
3. Waves as drawn in the README; items in a wave run in parallel only when their `touches` are disjoint.
4. An item is done only on: gates green (`pnpm check`, `pnpm --filter @elabs-ai/components-charts test`, `typecheck`, `lint`, `audit --strict` on its stories), its Acceptance met with quoted evidence, and a **browser proof** — Storybook run in Chromium, light and dark, 380 / 600 / 900 px, with the keyboard path exercised — attached to the issue. Unit-test-only evidence is not done.
5. After each wave: merge, run the full gates once, run the review lane (`brand-ui-reviewer`) on the new furniture, then start the next wave.
6. Never add theme- or product-specific code; a theme changes defaults through tokens or frame props only.
7. Close with RM-146 and update `roadmap/README.md`'s track table.
