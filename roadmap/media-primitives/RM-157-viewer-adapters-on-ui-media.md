---
id: RM-157
title: "viewer image / docx / media adapters on the ui primitives"
status: planned
priority: P1
effort: S–M (1–2 days)
wave: 2
depends_on: [RM-155, RM-156]
blocks: [RM-160]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/viewer/src/adapters/image/image-adapter.tsx (renderer → aliased `UiImage`)
  - packages/viewer/src/adapters/image/image-adapter.test.tsx (only if an assertion needs the new DOM; ADR 0041 §2 items 1–3 should keep it green)
  - packages/viewer/src/adapters/docx/docx-adapter.tsx (L213 → `UiImage`)
  - packages/viewer/src/adapters/media/media-adapter.tsx (L91, L104 → ui `Audio` / `Video`; header L3–17 rewritten)
  - packages/viewer/src/adapters/media/media-adapter.test.tsx (native `controls` assertion → `[data-slot="media-player-controls"]`)
  - packages/viewer/src/file-viewer/file-viewer.stories.tsx (the `Audio` story JSDoc at L285)
  - .changeset/*.md (viewer minor)
source: docs/review/2026-09-23-media-primitives-plan.md §4; ADR 0041 §2 items 1–3, 6, 8
---

# RM-157 viewer adapters on ui `Image` / `Audio` / `Video`

## Finding

- `image-adapter.tsx` L123 draws its own `<img>` with zoom / rotation classes inside a `[container-type:size]` wrapper; its own `failed` state renders `StatePanel` (`viewer.error.imageFailed*`). Its `measure()` (L38–56) uses the **global** `Image` constructor and checks `typeof Image !== "function"` — a bare `import { Image }` would shadow it silently.
- `docx-adapter.tsx` L213 draws a bare `<img>` for embedded images, `aria-hidden` when decorative.
- `media-adapter.tsx` L91 / L104 use native `<audio controls>` / `<video controls>`; the header L3–17 says extracting the player down to ui is "tracked separately". Its own `failed` state → `StatePanel` (`viewer.media.*`).
- `media-adapter.test.tsx` asserts `toHaveAttribute("controls")`; `image-adapter.test.tsx` L108–115 reads `img.style.width` and classes on the `<img>`. `file-viewer.stories.tsx` L285 documents "NATIVE elements on purpose".

## Change

- `image-adapter.tsx`: `import { Image as UiImage } from "@elabs-ai/components-ui"` — **must alias** (see Finding). Renderer → `<UiImage fit="none" showSkeleton={false} alt width height …>` keeping the zoom / rotate classes (`max-h-full max-w-full` / `max-w-none`) and the `[container-type:size]` wrapper. Keep the adapter's own `failed` state → `StatePanel`, so ui's error UI never mounts (pass `onError` as today).
- `docx-adapter.tsx`: `<UiImage fallback={null} fit="none" loading="lazy">` with the same `aria-hidden` rule as today.
- `media-adapter.tsx`: `<Audio src controls aria-label={label} preload="metadata" onError={…}>` / `<Video …>` (same props; `tracks` only if the manifest carries any). Own `failed` → `StatePanel` (`viewer.media.*`) unchanged. Rewrite the header L3–17: "renders ui `Audio` / `Video`; ai `AudioPlayer` is a preset over the same parts". Manifests untouched.
- Tests: `media-adapter.test.tsx` — `toHaveAttribute("controls")` → `[data-slot="media-player-controls"]` present; `aria-label` now asserted on the `<audio>` element; alert text unchanged. `image-adapter.test.tsx` should hold unchanged under ADR 0041 §2 items 1–3.
- `file-viewer.stories.tsx`: rewrite the `Audio` story JSDoc (L285) — the viewer now renders the ui player.

## Acceptance

- `image-adapter.test.tsx` green without weakening any assertion; `measure()` still reaches the global `Image`.
- FileViewer audio / video show the ui docked bar (play, seek, time, volume) in both themes; an undecodable file still shows the viewer's own `StatePanel` alert, not ui's.
- `docx` embedded images render and stay `aria-hidden` where they were.

## Test / gate

`pnpm --filter @elabs-ai/components-viewer typecheck lint test`; `pnpm check --rule data-slot,dep-direction`; `pnpm gen && pnpm gen:check`; Storybook `run-story-tests` on `viewer-fileviewer--image`, `--audio`, `--media-undecodable`, `--rotated` in light and dark, keyboard path (Space / arrows on the video root) exercised in a play function.

## Orchestrator notes

Demo-first item of the track. Write set is `packages/viewer/` only — disjoint from RM-158 / RM-159. `viewer` already depends on `ui`; no `package.json` change.
