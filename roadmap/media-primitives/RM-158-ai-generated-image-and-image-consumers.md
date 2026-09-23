---
id: RM-158
title: "ai `GeneratedImage` (+ `Image` alias) and Gallery / Attachments / AssetPreview / Queue / ModelProviderLogo on ui `Image`"
status: done
priority: P1
effort: M (2 days)
wave: 2
depends_on: [RM-155, RM-156]
blocks: [RM-160]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/ai/src/generated-image.tsx (new)
  - packages/ai/src/generated-image.stories.tsx (renamed from image.stories.tsx; title `AI/GeneratedImage`)
  - packages/ai/src/generated-image.test.tsx (renamed from image.test.tsx)
  - packages/ai/src/image.tsx (reduced to the deprecated specifier alias)
  - packages/ai/src/index.ts (L48 → export both `GeneratedImage` and the `Image` alias)
  - packages/ai/src/gallery.tsx (header L10–14; `GalleryImg` L149–207 → ui `Image`)
  - packages/ai/src/gallery.test.tsx (only if an assertion needs the new DOM)
  - packages/ai/src/attachments.tsx (L84, L92 → ui `Image`; L239 → ui `Video`)
  - packages/ai/src/attachments.stories.tsx (new — Grid / Inline / List / Preview)
  - packages/ai/src/attachments.test.tsx (new)
  - packages/ai/src/asset-preview.tsx (L245 → ui `Image`)
  - packages/ai/src/asset-preview.stories.tsx + asset-preview.test.tsx (an `Image` story and test case)
  - packages/ai/src/queue.tsx (`QueueItemImage` L131 → ui `Image`)
  - packages/ai/src/model-provider-logo.tsx (L148 → ui `Image`)
  - packages/ai/src/model-provider-logo.test.tsx (only if needed; fallback must stay the root `svg`)
  - packages/cli/lib/intent.mjs (add a `GeneratedImage` row carrying the old `Image` text)
  - scripts/check/contract-known-failures.json (remove `ai-image--default`, `ai-modelproviderlogo--default`)
  - scripts/check/baseline.json (via `pnpm check:update`, deliberately, after RM-159 merged)
  - .changeset/*.md (ai minor)
source: docs/review/2026-09-23-media-primitives-plan.md §4, §7 risks 1, 2, 7, 8; ADR 0041 §2 items 1, 3, 4, §5
---

# RM-158 ai `GeneratedImage` + the ai image consumers

## Finding

- `packages/ai/src/image.tsx` `Image` (L79) renders an AI-SDK `Experimental_GeneratedImage` as a base64 data URL with a skeleton, an `img.complete` guard and an `ImageOff` fallback; `gallery.tsx` `GalleryImg` (L149–207, render at L196) is a second copy, and its header (L10–14) says "don't merge".
- `attachments.tsx` L84 / L92 (96 / 20 px thumbnails) and L239 (a muted `<video>` thumbnail) have no error state, no story and no test.
- `asset-preview.tsx` L245 and `queue.tsx` `QueueItemImage` L131 draw bare `<img>`s with no error state; Queue types its props as `ComponentProps<"img">`.
- `model-provider-logo.tsx` L148 draws a remote SVG `<img>` with a dark `invert` class and a `BotIcon` fallback; its test asserts the fallback's `tagName === "svg"` and that the unknown-provider path has no `src`.
- `scripts/check/contract-known-failures.json` carries `ai-image--default` and `ai-modelproviderlogo--default`.

## Change

- **`generated-image.tsx`** (new): `GeneratedImage` = ui `Image` + `Experimental_GeneratedImage` → data-URL `src`; `showSkeleton` default `Boolean(width && height)`; root `data-slot="generated-image"` (overrides ui's `image`, possible because ui emits the slot before props); export `GeneratedImageProps`. `"use client"`, `forwardRef`.
- **`image.tsx`** reduced to exactly:

  ```ts
  /** @deprecated Use GeneratedImage */
  export {
    GeneratedImage as Image,
    type GeneratedImageProps as ImageProps,
  } from "./generated-image";
  ```

  Specifier form is mandatory: `ui-reuse` ignores re-exports, while `export const Image = GeneratedImage` counts as a local declaration and fails it (ADR 0041 §5; ADR 0024 §5a precedent). `index.ts` L48 exports both. Stories / tests renamed to `generated-image.*` under `AI/GeneratedImage`; the autodocs carry a deprecation note for `Image` (`docs/DEPRECATION.md` §1).

- **`gallery.tsx`**: header L10–14 rewritten ("surfaces differ by role; all compose ui `Image`"); `GalleryImg` → `<Image fit="cover" alt="">` in tiles (inside Gallery's own `AspectRatio`, relying on the `size-full` frame rule) and `<Image fit="contain" showSkeleton={false}>` in the lightbox.
- **`attachments.tsx`**: images → `<Image fit="cover" showSkeleton={false}>`; the video thumbnail → `<Video src muted preload="metadata" controls={false} fit="cover" aria-hidden tabIndex={-1} className="size-full" />`. Add `attachments.stories.tsx` (Grid / Inline / List / Preview) and `attachments.test.tsx`.
- **`asset-preview.tsx`** image case → `<Image fit="contain" loading="lazy">`, plus an `Image` story and a test case.
- **`queue.tsx`** `QueueItemImage` → ui `Image` at 32 px, `data-slot="queue-item-image"`, passing `alt={alt ?? ""}` explicitly (ADR 0041 §2 item 3).
- **`model-provider-logo.tsx`** → ui `Image` with `showSkeleton={false}`, `fallback={<BotIcon role="img" aria-label={…} />}`, the `invert` class kept; the remote base URL and `scripts/remote-origins-allowlist.json` untouched.
- **`intent.mjs`**: add a `GeneratedImage` row carrying the old ai `Image` text (the `Image` row itself was rewritten for ui in RM-155).
- **`contract-known-failures.json`**: remove `ai-image--default` and `ai-modelproviderlogo--default`.

## Acceptance

- `import { Image } from "@elabs-ai/components-ai"` still compiles and renders; the editor shows the `@deprecated` note on the specifier (verify in TS and Storybook — risk 2).
- No file in the repo imports both barrels **and** `Image` (risk 1) — grep and quote the result.
- `ModelProviderLogo`: unknown provider → no `src`, fallback root `tagName === "svg"`; logos still invert in dark.
- Attachments have a story and a test for the first time; the video thumbnail is `aria-hidden`, muted, has no controls and passes axe.
- The two known-failure entries are gone and the contract probes pass.

## Test / gate

`pnpm --filter @elabs-ai/components-ai typecheck lint test`; `pnpm check --rule data-slot,contract-known-failures,loading-states,remote-origins`; `pnpm gen && pnpm gen:check`; Storybook `run-story-tests` on `ai-generatedimage--*`, `ai-gallery--*`, `ai-attachments--*`, `ai-assetpreview--image`, `ai-modelproviderlogo--*` in light and dark.

## Orchestrator notes

Write set: ai image files only — disjoint from RM-159 (ai audio files) except `intent.mjs` (different rows) and `scripts/check/baseline.json`. **Merge RM-159 first**, then rebase and run `pnpm check:update` deliberately; never blind. Depends on RM-156 as well as RM-155 because the attachments thumbnail uses ui `Video`.
