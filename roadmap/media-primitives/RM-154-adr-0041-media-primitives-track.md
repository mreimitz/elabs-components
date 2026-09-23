---
id: RM-154
title: "ADR 0041 + review doc + track skeleton (decision gate)"
status: done
priority: P0
effort: S (1 day)
wave: 0
depends_on: []
blocks: [RM-155, RM-156]
agent: brand-ui-component-builder
model: opus
touches:
  - docs/ADR/0041-media-primitives-in-ui.md (new)
  - docs/review/2026-09-23-media-primitives-plan.md (new)
  - roadmap/media-primitives/README.md (new)
  - roadmap/media-primitives/ORCHESTRATOR-PROMPT.md (new)
  - roadmap/media-primitives/RM-154-adr-0041-media-primitives-track.md … RM-161-closure-docs-gen-browser-sweep.md (new)
  - roadmap/README.md (one track row appended)
source: docs/review/2026-09-23-media-primitives-plan.md §1–§8
---

# RM-154 ADR 0041 — media primitives in `ui`

## Finding

- Image, audio and video display is implemented seven-plus times, each with its own (or no) loading, error and accessibility handling: ai `image.tsx`, `gallery.tsx` `GalleryImg` (L149–207, a second copy), `attachments.tsx` (L82–99, L216–260, no story or test), `asset-preview.tsx` (L243–252), `queue.tsx` (L128–138), `model-provider-logo.tsx` (L125–166), `audio-player.tsx` + `_audio-player-media-chrome.tsx`; viewer `image-adapter.tsx`, `media-adapter.tsx` (native `controls`; header L3–17 defers a ui player), `docx-adapter.tsx` (L211–222); editor `markdown-preview.tsx` `ImageMd` (L896–906); ui `link-preview.tsx` `Thumbnail` (L46–62).
- `ui` has no image, audio or video primitive. ADR 0012, ADR 0024 §4 / §5a and ADR 0034 rule 2 already move a need shared by two layer-2 packages down into `ui`.
- Without one contract first, the two wave-1 builders and three wave-2 migrations would each invent a shape.

## Change

Write the track's planning artefacts; no code:

1. ADR 0041 with the decision (primitives in `ui`, no new dependency), **§2 Contract the migrations rely on** (nine load-bearing items), the `Image` API, the media core (incl. the docked / overlay `placement` axis — the shadcnblocks video-player family's layout, 2026-09-23), the `GeneratedImage` rename + specifier alias, the media-chrome removal with its prop map and the "why minor" argument, the `data-slot` compat choice for the ai presets, the `ui-reuse` / `media-reuse` gates, and the leave-alone list.
2. The review doc with inventory, why `ui`, API summary + parts table, migration map, removal + prop map, gates, risks, items index and an empty `## Outcome`.
3. `roadmap/media-primitives/` README, orchestrator prompt and RM-154 … RM-161; the track row in `roadmap/README.md`.

## Acceptance

- ADR 0041 status "Proposed (implementation in flight; maintainer confirms the checklist at track closure)", with the four-item Maintainer confirmation checklist: (a) name `Image`, (b) media-chrome removal as a minor, (c) ai presets keep `audio-player*` slots this minor, (d) name `GeneratedImage` — (a), (b), (d) recorded as decided on 2026-09-23, (c) open.
- Every RM file carries full frontmatter and the five sections; a builder can implement it from the RM file plus the ADR.
- No file under `packages/`, `scripts/` or `.changeset/` changed.

## Test / gate

Docs only. Prettier leaves the files unchanged; `pnpm check:changed` green on the diff.

## Orchestrator notes

Checklist item (c) is the one open judgement; put it to the maintainer at closure (RM-161), not before wave 1. The plan's stale "Numbering" section (ADR 0040, RM-147) is superseded: ADR 0040 and RM-147 … RM-153 are taken.
