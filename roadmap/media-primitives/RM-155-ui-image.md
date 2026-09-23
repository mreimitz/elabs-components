---
id: RM-155
title: "ui `Image`: `fit`, reserved frame, skeleton, terminal-error fallback"
status: in-progress
priority: P0
effort: M (2 days)
wave: 1
depends_on: [RM-154]
blocks: [RM-157, RM-158, RM-160]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/ui/src/components/image/image.tsx (new)
  - packages/ui/src/components/image/index.ts (new)
  - packages/ui/src/components/image/image.stories.tsx (new)
  - packages/ui/src/components/image/image.test.tsx (new)
  - packages/ui/src/index.ts (append `// Image — RM-155` + `export * from "./components/image"`)
  - packages/cli/lib/intent.mjs (rewrite the existing `Image` row ~L2619–2628 for ui `Image`)
  - .changeset/*.md (ui minor)
source: docs/review/2026-09-23-media-primitives-plan.md §3.1; ADR 0041 §2 items 1–4, §3
---

# RM-155 ui `Image`

## Finding

- ai `image.tsx` has the only careful image implementation (skeleton, `img.complete` guard for cached decodes at L56, ARIA22 delayed status text at L50–54, `ImageOff` fallback), and `gallery.tsx` `GalleryImg` (L149–207) copies it. Every other site (`asset-preview.tsx` L245, `queue.tsx` L131, `attachments.tsx`, `model-provider-logo.tsx` L148, viewer `docx-adapter.tsx` L213, editor `ImageMd` L898, ui `LinkPreview` L51) draws a bare `<img>` with no error state.
- ai `image.tsx` L98–102 guarantees that `className="w-full"` resolves against the real parent when there is no skeleton — the new primitive must keep that.
- `packages/cli/lib/intent.mjs` has an `Image` row (~L2619) written for ai's base64 image.

## Change

`"use client"`; `forwardRef<HTMLImageElement>`, the internal ref merged via `packages/ui/src/lib/merge-refs.ts`.

```ts
export type ImageFit = "contain" | "cover" | "fill" | "none" | "scale-down";
export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt">, VariantProps<typeof imageVariants> {
  alt: string; // required; "" = decorative (runtime still `alt ?? ""`)
  fit?: ImageFit; // default "contain"
  showSkeleton?: boolean; // default Boolean(width && height) || aspectRatio !== undefined
  aspectRatio?: number; // reserves a box via AspectRatio; img gets size-full
  fallback?: ReactNode; // replaces the default ImageOff box after a terminal error
}
export const imageVariants = cva("block max-w-full", {
  variants: {
    fit: {
      contain: "object-contain",
      cover: "object-cover",
      fill: "object-fill",
      none: "object-none",
      "scale-down": "object-scale-down",
    },
  },
  defaultVariants: { fit: "contain" },
});
```

- **The `<img>` is the root of the component's own surface:** `data-slot="image"` (emitted **before** `{...props}`), `className` (merged last via `cn()`), `ref`, `...props`, `data-status="loading|loaded|error"`.
- **Frame** `<span data-slot="image-frame">` only when a box must be reserved — `showSkeleton` resolved true or `aspectRatio` set — decided from props, never from load state (no remount mid-load). Sizing: `aspectRatio` → `<AspectRatio ratio data-slot="image-frame" className="relative overflow-hidden">`; else `width && height` → `relative inline-block max-w-full` with inline size; else `relative block size-full` (a Gallery tile inside its own `AspectRatio`).
- **Loading:** `<Skeleton data-slot="image-skeleton" className="absolute inset-0 size-full rounded-[inherit]"/>`; one `sr-only role="status" aria-live="polite"` mounted only when `alt !== ""`, its text (`t("loading")`) set one tick later. `Image` mints no copy keys.
- **Cached:** mount effect `if (img.complete) naturalWidth > 0 ? loaded : (currentSrc ? error : noop)`.
- **Error** (terminal `error` event only): the `<img>` is removed; render `fallback` bare (no wrapper — `ModelProviderLogo`'s test asserts `tagName === "svg"`), or `<span data-slot="image-fallback" className="flex items-center justify-center bg-muted text-muted-foreground" style={{ width, height }}><ImageOff aria-hidden /></span>` with `role="img" aria-label={alt}` when `alt` is non-empty, else `aria-hidden`. `fallback={null}` renders nothing.
- **Falsy `src`:** render `fallback` immediately, no `<img>`.
- **`src` change** resets status — derive during render from stored `{ status, forSrc }`, no effect.
- No `loading?: boolean` (the native `loading="lazy|eager"` stays the platform attribute); no `radius` / `decoding` / `draggable` defaults.
- Stories (`Display/Image`, `tags: ["autodocs"]`, `component: Image`, args-only `Default`): Default (SVG data URL, alt, 320×200), Fit (all five values), WithAspectRatio, Thumbnails (20 / 32 / 96 px, `showSkeleton={false}`), Intrinsic (no size, `loading="lazy"`), Broken (play: `getByRole("img", { name })`, no `<img>` left), DecorativeBroken (`queryByRole("img")` is null), CustomFallback. No Loading story.
- `intent.mjs`: rewrite the existing `Image` row for ui `Image` (purpose, category `display`, relationships to `AspectRatio` / `Avatar`, stateTokens, antiPatterns: "zoom / rotation on `Image` → viewer shell (ADR 0026)", "a raw `<img>` in a package"). RM-158 adds the `GeneratedImage` row carrying the old text.
- Barrel: append-only under `// Image — RM-155`.

## Acceptance

ADR 0041 §2 items 1–4 hold and are each covered by a test:

1. With the skeleton off, `container.firstElementChild.tagName === "IMG"`; `className`, `style` and `ref` land on it.
2. `fit` emits only `object-*` classes; `fit="none"` exists.
3. `ComponentProps<"img">` with an explicit `alt` is assignable to `ImageProps`.
4. Falsy `src` → `fallback` immediately, no `<img>`; `fallback={null}` → nothing on error.

Plus: skeleton default rules; exactly one `role="status"` and only when `alt` is non-empty; load / error events; the `complete` path; fallback semantics; `src` reset; frame rules.

## Test / gate

`pnpm --filter @elabs-ai/components-ui typecheck lint test`; `pnpm check --rule data-slot,variant-coverage,loading-states,microcopy`; `pnpm gen && pnpm gen:check`; Storybook `run-story-tests` on `display-image--*` in light and dark. The `Default` story renders a frame (320×200 → skeleton on), so the outermost DOM node is `image-frame`: confirm the generated contract probe `display-image--default` passes; if it expects the root slot `image` on the outermost node, report rather than changing the frame rule.

## Orchestrator notes

Runs in parallel with RM-156 — disjoint directories; `packages/ui/src/index.ts` and `intent.mjs` are append-only under `// Image — RM-155`. Do not touch ai's `Image` here; RM-158 renames it.
