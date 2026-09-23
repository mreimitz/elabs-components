---
id: RM-161
title: "Closure: D3, skills / docs, rules, ADR pointers, `pnpm gen`, browser sweep, review Outcome"
status: planned
priority: P1
effort: S–M (1–2 days)
wave: 3
depends_on: [RM-160]
blocks: []
agent: brand-ui-docs-writer
model: sonnet
touches:
  - docs/DECISIONS.md (L26 D3 row)
  - packages/cli/lib/render-docs.mjs (L74 FileViewer line)
  - scripts/gen-home.mjs (L100 FileViewer line)
  - skills/brand-ui/reference/components.md (L33)
  - .claude/rules/ai.md (one bullet)
  - .claude/rules/conventions.md (one line under Icons / Styling)
  - docs/ADR/0024-viewer-package.md (L357 pointer to ADR 0041)
  - docs/ADR/0041-media-primitives-in-ui.md (status + Maintainer confirmation ticks)
  - docs/review/2026-09-23-media-primitives-plan.md (`## Outcome`)
  - roadmap/media-primitives/README.md + RM-154 … RM-161 (status flips)
  - roadmap/README.md (track row state)
  - generated regions via `pnpm gen` (CLAUDE.md / AGENTS.md table, manifest, contract tests, catalog JSON, llms, README regions, docs/GATES.md)
  - .changeset/*.md (consolidated wording)
source: docs/review/2026-09-23-media-primitives-plan.md §8, Verification; ADR 0041 Maintainer confirmation
---

# RM-161 Closure

## Finding

- `docs/DECISIONS.md` D3 (L26) says nothing about media; the generated `CLAUDE.md` / `AGENTS.md` tables inherit that.
- The FileViewer description in `packages/cli/lib/render-docs.mjs` L74, `scripts/gen-home.mjs` L100 and `skills/brand-ui/reference/components.md` L33 predates audio / video playback through ui.
- `.claude/rules/ai.md` does not mention `GeneratedImage`, the `Image` alias form or the `AudioPlayer*` presets; `.claude/rules/conventions.md` has no line about raw media elements.
- `docs/ADR/0024-viewer-package.md` L357 still describes the media player as deferred.
- ADR 0041 is "Proposed"; checklist item (c) is open.

## Change

- `docs/DECISIONS.md` D3 row: add "images / audio / video render through ui `Image` / `Audio` / `Video`" (renders into `CLAUDE.md` / `AGENTS.md` via `pnpm gen` — never edit the generated table).
- `render-docs.mjs` L74, `gen-home.mjs` L100, `components.md` L33 FileViewer line → "any file (image, audio, video, text, JSON, CSV, docx, pptx, xlsx, pdf, code, markdown)".
- `.claude/rules/ai.md` bullet: "`AudioPlayer*` are presets over ui media; `GeneratedImage` for AI-SDK output, ui `Image` otherwise; the `Image` alias stays in specifier form (`ui-reuse`); a file importing both barrels picks one `Image`."
- `.claude/rules/conventions.md`: one line — "raw `<img>` / `<audio>` / `<video>` in a package fail `media-reuse`; compose ui `Image` / `Audio` / `Video`."
- ADR 0024 L357: pointer to ADR 0041.
- Put ADR 0041 checklist item (c) to the maintainer; record the answer and the date, tick (a)–(d), set Status to Accepted.
- Review doc `## Outcome`: what shipped per item, decisions taken on the way, what stays open (at least: `Transcription` on `useMediaState`; `media-player*` slot alignment in the next major; removal of the `Image` alias and ignored props in the next major), gate evidence and the browser sweep.
- Status flips in every RM file and both tables; full `pnpm gen`; consolidated changeset wording — Added (ui `Image`, `Audio`, `Video`, `MediaPlayer*`, `formatMediaTime`, `useMediaState`) · Changed (ai `AudioPlayer*` presets, no media-chrome, `--media-*` no longer honoured; ai / viewer / editor render through ui) · Deprecated (ai `Image` → `GeneratedImage`, `ImageProps` → `GeneratedImageProps`; media-chrome pass-through props) · Removed (optional peer `media-chrome`; a leftover install is inert).

## Acceptance

- Track-closure gates green, output quoted in the Outcome: `pnpm check` (incl. `ui-reuse`, `media-reuse`, `eager-heavy-deps`, `dep-direction`, `data-slot`, `contract-known-failures`, `microcopy`), `pnpm check:test`, `pnpm -r typecheck lint test`, `pnpm build`, `pnpm consumer:check`, `pnpm --filter @elabs-ai/components-docs test-storybook`, `pnpm gen:check`.
- `grep -rn media-chrome` returns only `CHANGELOG.md` history and the two ADR "superseded" notes.
- Browser sweep at 380 / 600 / 900 px, light and dark, keyboard path exercised, over `display-image--*`, `display-audio--*`, `display-video--*`, `display-mediaplayer--*`, `ai-generatedimage--*`, `ai-gallery--*`, `ai-attachments--*`, `ai-assetpreview--image`, `ai-modelproviderlogo--*`, `ai-audioplayer--*`, `viewer-fileviewer--image|audio|media-undecodable|rotated`, `core-linkpreviewcard--*` and the editor markdown-preview stories — quoted in the Outcome.

## Test / gate

`pnpm gen && pnpm gen:check`; `pnpm check`; the track-closure list above.

## Orchestrator notes

Docs-writer item; no component code. If the sweep finds a defect, file it back to the owning item rather than patching it here. One report at the end of the track.
