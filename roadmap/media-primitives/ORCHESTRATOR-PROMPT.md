# Orchestrator prompt — media-primitives track

You are the orchestrator for `roadmap/media-primitives/` (RM-154 … RM-161) in `mreimitz/elabs-components`. Read `roadmap/README.md`, this folder's `README.md`, ADR 0041 (`docs/ADR/0041-media-primitives-in-ui.md`), the source review `docs/review/2026-09-23-media-primitives-plan.md` and `.claude/rules/conventions.md` (plus `ai.md` for RM-158 / RM-159) before anything else.

Protocol:

1. RM-154 first. ADR 0041's checklist items (a), (b) and (d) were decided with the maintainer on 2026-09-23; (c) — the ai presets keep their `audio-player*` slots this minor — is the open judgement and is put to the maintainer at closure. Wave 1 may start once RM-154 is merged.
2. Items are tracked in this folder only (frontmatter + table status); no GitHub issues. A subagent (agent/model from the item's frontmatter) gets the item file verbatim plus ADR 0041, works in a git worktree on a `feat/rm-NNN-<slug>` branch, and touches only the paths in `touches`. If it must edit a file outside them, it stops and reports instead.
3. Waves as drawn in the README; items in a wave run in parallel only when their `touches` are disjoint. Shared files (`packages/ui/src/index.ts`, `packages/cli/lib/intent.mjs`, `packages/ui/src/components/locale-provider/messages.ts`) are append-only under a `// <Name> — RM-NNN` comment; merge conflicts are adjacent-line and resolved by keeping both. In wave 2, merge RM-159 before RM-158 — both regenerate `scripts/check/baseline.json`; run `pnpm check:update` deliberately after each, never blind.
4. An item is done only on: gates green (`pnpm --filter <pkg> typecheck lint test` for every touched package, `pnpm check --rule <ids in the item>`, `pnpm gen && pnpm gen:check`), its Acceptance met with quoted evidence, and a **browser proof** — Storybook `run-story-tests` on the touched story IDs in Chromium, light and dark, 380 / 600 / 900 px, with the keyboard path exercised in a play function. Unit-test-only evidence is not done.
5. After each wave: merge, run the full gates once (`pnpm check`, `pnpm check:test`, `pnpm -r typecheck lint test`, `pnpm build`, `pnpm consumer:check`, `pnpm --filter @elabs-ai/components-docs test-storybook`), run the review lane (`brand-ui-reviewer`) on the new furniture, then start the next wave.
6. Tokens only: no raw colours, no hand-rolled shadows, no black letterbox literal. No new dependency. Zoom and rotation stay in the viewer (ADR 0026).
7. The agent flips `status` in its own RM file; the orchestrator updates this folder's table at merge.
8. Close with RM-161: the review's `## Outcome`, `roadmap/README.md`'s track row, and one report at the end — merged items, gate results, browser evidence, and anything that could not stay inside its `touches`.
