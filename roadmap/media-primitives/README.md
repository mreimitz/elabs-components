# Roadmap track — Media primitives in `ui`: `Image`, `Audio`, `Video` (`ui`, `ai`, `viewer`, `editor`)

Source review: `docs/review/2026-09-23-media-primitives-plan.md`.
Decision (ADR 0041, `docs/ADR/0041-media-primitives-in-ui.md`): image, audio and video display moves **down** into `ui` — an `Image` primitive and a compound media player (`MediaPlayer*` parts, `Audio` / `Video` presets, headless `useMediaState`) drawn from existing `ui` primitives with **no new dependency** — and every other package renders through it. `ai`'s `Image` becomes `GeneratedImage` with a one-minor `@deprecated` alias; `AudioPlayer*` become presets over the `ui` parts and media-chrome leaves `ai`; two new gates (`ui-reuse`, `media-reuse`) keep the copies from coming back. Video defaults to a docked control bar (the shadcnblocks video-player family's layout, not its engine); an overlay bar is one `placement` value away. Items follow the chart-interaction track's format (frontmatter + Finding / Change / Acceptance / Test-gate / Orchestrator notes). Status values: `planned`, `in-progress`, `done`, `dropped` — update the frontmatter and the table together.

Orchestration: `ORCHESTRATOR-PROMPT.md` in this folder is the kickoff prompt. Items are tracked in this folder only (frontmatter + table status); no GitHub issues; one report at the end. An item is done only on merged, gate-green, **browser-verified** evidence (Chromium, light + dark, 380 / 600 / 900 px, keyboard path exercised). **RM-154 is the decision item — the maintainer confirms ADR 0041's checklist; (a), (b) and (d) were decided on 2026-09-23, (c) is open until closure.**

## Items

| ID     | Title                                                                                                                    | Wave | Priority | Effort | Depends on    | Agent / model                       | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ---- | -------- | ------ | ------------- | ----------------------------------- | ------ |
| RM-154 | ADR 0041 + review doc + track skeleton (decision gate)                                                                   | 0    | P0       | S      | —             | brand-ui-component-builder / opus   | done   |
| RM-155 | ui `Image`: `fit`, reserved frame, skeleton, terminal-error fallback                                                     | 1    | P0       | M      | 154           | brand-ui-component-builder / sonnet | done   |
| RM-156 | ui media core: `useMediaState`, `MediaPlayer*`, `Audio`, `Video`, `formatMediaTime`, `ui.media.*` copy                   | 1    | P0       | L      | 154           | brand-ui-component-builder / opus   | done   |
| RM-157 | viewer image / docx / media adapters on the ui primitives                                                                | 2    | P1       | S–M    | 155, 156      | brand-ui-component-builder / sonnet | done   |
| RM-158 | ai `GeneratedImage` (+ `Image` alias) and Gallery / Attachments / AssetPreview / Queue / ModelProviderLogo on ui `Image` | 2    | P1       | M      | 155, 156      | brand-ui-component-builder / sonnet | done   |
| RM-159 | ai `AudioPlayer*` presets over ui media + media-chrome removal                                                           | 2    | P1       | M      | 156           | brand-ui-component-builder / sonnet | done   |
| RM-160 | ui LinkPreview thumbnail, editor `ImageMd`, `ui-reuse` + `media-reuse` gates                                             | 3    | P1       | M      | 157, 158, 159 | brand-ui-component-builder / sonnet | done   |
| RM-161 | Closure: D3, skills / docs, rules, ADR pointers, `pnpm gen`, browser sweep, review Outcome                               | 3    | P1       | S–M    | 160           | brand-ui-docs-writer / sonnet       | done   |

Agent names are the `.claude/agents/brand-ui-*.md` definitions; `model` in each file overrides the agent's default for that item.

## Waves

```
wave 0  └ RM-154 ADR 0041 + review + track          ← maintainer confirms the ADR checklist first
              ▼ merge
wave 1  ┬ RM-155 ui Image (sonnet)                   ┐ disjoint dirs: components/image · components/media-player;
        └ RM-156 ui media core + Audio/Video (opus)  ┘ index.ts / intent.mjs / messages.ts append-only under `// <Name> — RM-NNN`
              ▼ merge, full gates once, review lane (new furniture: Display/Image, Display/Audio, Display/Video; axe video-caption)
wave 2  ┬ RM-157 viewer adapters (sonnet)                            ┐ disjoint write sets: viewer/src/adapters ·
        ├ RM-158 ai image consumers + GeneratedImage (sonnet)        │ ai image files · ai audio files + docs.
        └ RM-159 ai AudioPlayer presets + media-chrome out (sonnet)  ┘ Merge 159 before 158 (both regenerate baseline.json)
              ▼ merge, full gates, pnpm consumer:check (zero optional peers), review lane 380/600/900 + keyboard
wave 3  ┬ RM-160 LinkPreview + editor ImageMd + gates  ← last, so media-reuse ships at zero findings
        └ RM-161 closure (docs-writer)
```

Critical path: RM-154 → RM-156 → RM-159 → RM-160 → RM-161 (≈ 9–11 agent-days). RM-157 is the item to demo first — FileViewer audio and video with real, themed controls is the visible win.

## Definition of done for the track

- Every new export (`Image`, `Audio`, `Video`, `MediaPlayer*`, `useMediaPlayer`, `useMediaState`, `formatMediaTime`, ai `GeneratedImage`) is in the CLI manifest (`brand-ui docs <component>` shows it) and has an intent row.
- `pnpm check` green, including `ui-reuse`, `media-reuse` (zero findings), `eager-heavy-deps`, `dep-direction`, `data-slot`, `contract-known-failures`, `microcopy`; `pnpm check:test` green with the new rule fixtures.
- `pnpm -r typecheck lint test`, `pnpm build`, `pnpm gen && pnpm gen:check`.
- `pnpm consumer:check` — proves `AudioPlayer` renders real controls with zero optional peers.
- `pnpm --filter @elabs-ai/components-docs test-storybook` — axe blocking, including `video-caption`.
- `grep -rn media-chrome` returns only `CHANGELOG.md` history and the two ADR "superseded" notes.
- Keyboard: every player shortcut is exercised in a play function.
- Real-runtime proof: a browser sweep of the touched story IDs at 380 / 600 / 900 px in light and dark, quoted in the review's `## Outcome`, never only unit tests.
