# ADR 0041 — Media primitives in `ui`: `Image`, `Audio`, `Video`, `MediaPlayer*`

- **Status:** Proposed (implementation in flight; maintainer confirms the checklist at track closure)
- **Date:** 2026-09-23
- **Deciders:** Manuel Reimitz (maintainer); drafted for RM-154 by the media-primitives track
- **Context:** `docs/review/2026-09-23-media-primitives-plan.md` (inventory, API summary,
  migration map, risks)
- **Issue:** RM-154 (no GitHub issue — the track is tracked in `roadmap/media-primitives/` only).
  Blocks RM-155 and RM-156; every other item of the track builds on it.
- **Related:** ADR [0012](./0012-metric-card-canonical-home.md) (a need shared by two layer-2
  packages moves _down_ into `ui`, never sideways), ADR [0019](./0019-lazy-engine-boundaries.md)
  and ADR [0032](./0032-optional-peer-dependency-policy.md) (media-chrome as a lazy optional
  peer — superseded for that engine by §6), ADR [0024](./0024-viewer-package.md) §5a (the
  `Toolbar` → `NodeToolbar` rename with a one-minor alias — the precedent for §5), ADR
  [0026](./0026-viewer-view-state-and-chrome-parts.md) (view state belongs to the shell — zoom and
  rotation stay in the viewer), [`DEPRECATION.md`](../DEPRECATION.md)

## Context

Image, audio and video display is implemented seven-plus times across the repo, each copy with
its own (or no) loading, error and accessibility handling. `ui` has no image, audio or video
primitive at all.

| Site                                                                                              | What it does today                                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/ai/src/image.tsx` `Image`                                                               | AI-SDK generated base64 image; skeleton, `img.complete` guard, `ImageOff` fallback         |
| `packages/ai/src/gallery.tsx` `GalleryImg` (L149–207)                                             | a second copy of the same logic with `object-cover`; its header comment says "don't merge" |
| `packages/ai/src/attachments.tsx` (L82–99, L216–260)                                              | 96 / 20 px thumbnails and a muted `<video>` thumbnail; no error state, no story, no test   |
| `packages/ai/src/asset-preview.tsx` (L243–252), `queue.tsx` (L128–138)                            | bare `<img>`, no error state                                                               |
| `packages/ai/src/model-provider-logo.tsx` (L125–166)                                              | remote SVG `<img>`, dark-mode invert, icon fallback                                        |
| `packages/ai/src/audio-player.tsx` + `_audio-player-media-chrome.tsx`                             | media-chrome web-component player: optional peer, lazy boundary, missing-peer state        |
| `packages/viewer/src/adapters/image/image-adapter.tsx`                                            | real `<img>`, error → `StatePanel`, zoom / rotation transforms                             |
| `packages/viewer/src/adapters/media/media-adapter.tsx`                                            | native `<audio controls>` / `<video controls>`; its header (L3–17) defers a ui player      |
| `docx-adapter.tsx` (L211–222), editor `ImageMd` (L896–906), ui `LinkPreview` `Thumbnail` (L46–62) | bare `<img>`                                                                               |

The repo already decided where such a need goes: ADR 0012 (MetricCard), ADR 0024 §4 (file model)
and §5a (Toolbar), and ADR 0034 rule 2 all move a need shared by two layer-2 packages **down** into
`ui`. Three decisions were taken with the maintainer on 2026-09-23: the players draw their own
controls from existing `ui` primitives and media-chrome leaves `ai`; `ui` takes the name `Image`
and `ai`'s becomes `GeneratedImage` with a one-minor alias; the rollout is a roadmap track with no
GitHub issues and one report at the end.

## Decision

### 1. The primitives live in `ui`

- `packages/ui/src/components/image/` ships `Image`, `ImageProps`, `ImageFit`, `imageVariants`
  (RM-155).
- `packages/ui/src/components/media-player/` ships the headless `useMediaState`, the compound
  `MediaPlayer` + `MediaPlayer*` parts, `useMediaPlayer`, and the presets `Audio` and `Video`;
  `packages/ui/src/lib/format-media-time.ts` ships `formatMediaTime` (RM-156).
- Players draw their controls from `Slider`, `IconButton`, `DropdownMenu`, `Tooltip`, `Skeleton`
  and `StatePanel`. **No new dependency.**
- Design rules: zoom and rotation stay in the viewer (ADR 0026); primitives take `src: string`
  (whoever mints an object URL owns `revoke()`); the native `<img>` / `<audio>` / `<video>` is the
  source of truth and React mirrors it; `cva` only for the visual `fit` axis; the compound context
  is `{ state, actions, meta }` (canonical shape:
  `packages/ui/src/components/mention-input/mention-input.tsx` L43–87).

### 2. Contract the migrations rely on

Each item is load-bearing for a named test in a consumer; a change to any of them is a change to
this ADR.

1. With the skeleton off, the bare `<img>` is the root; `className`, `style` and `ref` land on it
   (viewer `image-adapter.test.tsx` L108–115 reads `img.style.width`; the editor test at L205; ai
   `image.test.tsx` asserts `firstElementChild.tagName === "IMG"`).
2. `fit` emits only `object-*` classes, never sizing; `fit="none"` exists. The viewer's zoom
   classes (`max-h-full max-w-full` / `max-w-none`) stay adapter-owned.
3. `ImageProps` extends `ImgHTMLAttributes`, so Queue's `ComponentProps<"img">` stays assignable;
   because `alt` is required, Queue passes `alt={alt ?? ""}` explicitly.
4. A falsy `src` renders `fallback` immediately with no `<img>` (the `ModelProviderLogo`
   unknown-provider path asserts no `src`); `fallback={null}` renders nothing on error
   (`LinkPreview` thumbnail).
5. Every `ui` part and root emits `data-slot` **before** `{...props}`, so a wrapper can override it
   (the ai presets keep their `audio-player*` selectors, §7).
6. `MediaPlayerElement` is a part: ai's `AudioPlayerElement` is a child carrying `src` / `data`,
   and `src` cannot be hoisted to the root. Presets forward native attributes (`aria-label`,
   `preload`, `crossOrigin`, `onError`, `muted`, `loop`) to the element; the `controls` prop
   renders `MediaPlayerControls` — the native `controls` attribute is never set.
7. The `Video` preset also takes `tracks?: { src; kind; srclang; label; default? }[]`, rendered as
   `<track>`, so an args-only `Default` story carries a captions track and passes axe
   `video-caption` (blocking in the Storybook job). Decorative thumbnails (`aria-hidden`, muted,
   no controls) are excluded from axe as hidden content — verified in RM-156.
8. `MediaPlayerError` accepts `title` / `description` overrides; the native `error` event still
   reaches the consumer's `onError` while the component shows its own error UI.
9. jsdom has no `play` / `pause` / `load` and `duration` is `NaN`: tests stub per file with
   `vi.spyOn(HTMLMediaElement.prototype, …)` and `Object.defineProperty` — **never** in
   `vitest.setup.ts` (repo policy there: components feature-detect, no per-package DOM stubs).

### 3. `Image`

```ts
export type ImageFit = "contain" | "cover" | "fill" | "none" | "scale-down";
export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt">, VariantProps<typeof imageVariants> {
  alt: string; // required; "" = decorative
  fit?: ImageFit; // cva, default "contain"
  showSkeleton?: boolean; // default Boolean(width && height) || aspectRatio !== undefined
  aspectRatio?: number; // reserves a box via AspectRatio; the img gets size-full
  fallback?: ReactNode; // replaces the default ImageOff box after a terminal error
}
```

- The `<img>` always carries `data-slot="image"`, `className`, `ref`, `...props` and
  `data-status="loading|loaded|error"`. A frame `<span data-slot="image-frame">` wraps it only when
  a box must be reserved (`showSkeleton` resolved true, or `aspectRatio` set) — decided from props,
  never from load state, so nothing remounts mid-load.
- Loading: an absolutely positioned `Skeleton` (`data-slot="image-skeleton"`) inside the frame, and
  one `sr-only role="status" aria-live="polite"` only when `alt !== ""`. Cached images resolve on
  mount via `img.complete`. Error (terminal `error` event only): the `<img>` is removed and
  `fallback` or a muted `ImageOff` box (`data-slot="image-fallback"`) renders — `role="img"
aria-label={alt}` when `alt` is non-empty, else `aria-hidden`. A `src` change resets the status.
- The native `loading="lazy|eager"` attribute stays the platform's; there is **no**
  `loading?: boolean`, because an `<img>` has no external not-ready signal.

### 4. Media core: `useMediaState`, `MediaPlayer*`, `Audio`, `Video`

- **Context** (`useMediaPlayer()` throws outside the provider): `state` mirrors the element
  (`paused`, `ended`, `waiting`, `currentTime`, `duration`, `buffered`, `volume`, `muted`,
  `playbackRate`, `readyState`, `error`, `fullscreen`, `pip`, `textTracks`, `activeTextTrack`, …);
  `actions` drive it (`play`, `pause`, `toggle`, `seek`, `seekBy`, `setVolume`, `toggleMute`,
  `setPlaybackRate`, `toggleFullscreen`, `togglePip`, `setTextTrack`); `meta` carries `kind`, refs,
  `attach`, `controlsVisible`, `pinControls`, `id`. No controlled/uncontrolled pairs in v1 and no
  `useEffect`-to-sync: the element is the source of truth.
- **Root** `MediaPlayer`: `role="region"` with a default label (`ui.media.audioPlayer` /
  `videoPlayer`), `data-kind`, `data-paused`, `data-controls`, `data-fullscreen`; video roots are
  focusable and the media area letterboxes on `bg-muted` (tokens only).
- **Look: a docked control bar.** The visual direction is the shadcnblocks video-player family
  (Kibo-style docked control bar), 2026-09-23 — we take its layout, not its media-chrome engine.
  `MediaPlayerControls` has one `cva` visual axis, `placement: "docked" | "overlay"`, default
  `docked`:
  - `docked` — an opaque, theme-coloured bar beneath the media. For video the root is a resting
    surface frame (`rounded-lg border bg-card shadow-xs`) holding the media area and the bar; the
    bar never hides.
  - `overlay` — a translucent bar (`bg-background/80 backdrop-blur`, one wash, no border) floating
    over the bottom of the video, whose root is `overflow-hidden rounded-md bg-muted` with no
    border (the video is the surface).
  - `Audio` stays transparent with a docked row; the surrounding bubble or `Card` is the surface.
- **Keyboard** (`resolveMediaShortcut`): Space / `k` toggle (Space only on the root), ← / → ±5 s,
  `j` / `l` ±10 s, ↑ / ↓ volume, `m` mute, `f` fullscreen (video), `0`–`9` percent seek; ignored
  when modified, prevented, or inside sliders, menus and text inputs.
- **Autohide** applies **only** to `overlay` placement: controls stay visible while paused, ended,
  errored, pinned (an open menu) or under a moving pointer; a focused control never hides; the
  fade is token motion and zeroes under reduced motion.
- **Parts**, each `data-slot="media-player-<part>"`, every icon control an `IconButton`:
  `MediaPlayerElement`, `Controls`, `PlayButton`, `SeekButton`, `TimeSlider`, `Time`,
  `MuteButton`, `VolumeSlider`, `PlaybackRateMenu`, `FullscreenButton`, `PipButton`,
  `CaptionsButton`, `Loading`, `Error` (the full table is in the review doc).
- **Presets** keep the base root slot `media-player` plus `data-kind`. `Audio` renders Seek(−10) ·
  Play · Seek(+10) · time · slider · duration · mute · volume. `Video` adds `poster`, `playsInline`,
  `fit`, `aspectRatio`, `controlsPlacement?: "docked" | "overlay"` (default `docked`) and
  `tracks`; its default bar is Play · Seek(−10) · Seek(+10) · time slider · current time ·
  duration · mute · volume · playback rate · captions · PiP · fullscreen. `controls` is the only
  boolean; `children` is the full-composition escape hatch.
- Copy: `ui.media.*` keys in `locale-provider/messages.ts`; `Image` reuses the generic `loading` key.

### 5. `ai`'s `Image` becomes `GeneratedImage`

`packages/ai/src/generated-image.tsx` adds `GeneratedImage` (ui `Image` + the AI-SDK
`Experimental_GeneratedImage` → data-URL `src`, root `data-slot="generated-image"`) and
`GeneratedImageProps`. `image.tsx` shrinks to a deprecated alias in **specifier form**:

```ts
/** @deprecated Use GeneratedImage */
export { GeneratedImage as Image, type GeneratedImageProps as ImageProps } from "./generated-image";
```

This is the ADR 0024 §5a precedent (`export { NodeToolbar as Toolbar }`). The specifier form is
required: `ui-reuse` ignores re-exports, while `export const Image = GeneratedImage` would count as
a local declaration and fail it. The alias is removed in the next major (`DEPRECATION.md` §2).

### 6. media-chrome leaves `ai`

`AudioPlayer*` become presets over the §4 parts; `_audio-player-media-chrome.tsx` and the
missing-peer state are deleted; `media-chrome` leaves `peerDependencies`, `peerDependenciesMeta`,
`devDependencies`, the lockfile and every check script and doc that names it. This **supersedes
ADR 0019 and ADR 0032 for the media-chrome engine only**; both get a one-line pointer, no rewrite.
Rive and the other lazy engines are unaffected.

Prop map for `AudioPlayerProps` (types kept, `@deprecated` JSDoc naming the replacement):

| media-chrome prop                                                                                                                                                                                                                                                                        | Replacement                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `noHotkeys`, `keyboardControl`                                                                                                                                                                                                                                                           | `keyboardShortcuts` (`!noHotkeys && keyboardControl !== false`) |
| `seekOffset`                                                                                                                                                                                                                                                                             | `offset` on `MediaPlayerSeekButton`                             |
| `autohide*`, `breakpoints*`, `defaultDuration`, `defaultStreamType`, `defaultSubtitles`, `gesturesDisabled`, `keysUsed`, `liveEdgeOffset`, `noAuto*`, `noDefaultStore`, `no*Pref`, `resolvedLang`, `userInteractive`, `mediaController`, `mediaCurrentTime`, `noTooltip`, `preventClick` | accept-and-ignore (destructured and dropped)                    |

Part map: `ControlBar` → `MediaPlayerControls`; `PlayButton` → `MediaPlayerPlayButton`;
`Seek{Backward,Forward}Button` → `MediaPlayerSeekButton offset={∓seekOffset}`; `TimeDisplay` →
`MediaPlayerTime mode="current"`; `DurationDisplay` → `mode="duration"`; `TimeRange` →
`MediaPlayerTimeSlider`; `MuteButton` → `MediaPlayerMuteButton`; `VolumeRange` →
`MediaPlayerVolumeSlider`; `AudioPlayerElement` → `MediaPlayerElement` (`slot="media"` dropped;
the `SpeechResult["audio"]` → data-URL conversion stays in `ai`). The error path renders
`MediaPlayerError title={t("ai.audioPlayer.renderError")}`.

**Why minor, not major.** The peer was optional, so no install breaks; no exported symbol is
removed; every prop type stays assignable; the `data-slot` selectors persist (§7); the custom
element tag names and `--media-*` variables were never documented API — the `AudioPlayer` intent
row already lists `--media-*` as an anti-pattern. A leftover `media-chrome` install is inert. The
alias and the ignored props are removed in the next major per `DEPRECATION.md`.

### 7. `data-slot` compatibility for the ai presets

Conventions say a preset keeps its base root slot. The ai `AudioPlayer*` presets deliberately do
**not** in this minor: each passes its existing `data-slot="audio-player*"`, overriding the `ui`
slot (possible because of §2 item 5). DOM selectors in consumer code and tests stay unchanged and
the `data-slot` ratchet stays at 0. Aligning them to `media-player*` is a **next-major** item.

### 8. Gates

- **`ui-reuse`** (`scripts/check/rules/ui-reuse.mjs`, `scope: "packages"`, `baseline: "keys"`): in
  every layer-2 package, a local declaration named like a `ui` manifest component fails; key
  `<pkg>::<Name>`, escape `// ui-reuse-exempt: <reason>`. The declaration scan is lifted from
  `charts-reuse.mjs` into a shared helper; `charts-reuse` keeps only its `@base-ui` arm. Baseline
  seeded with the one pre-existing collision, `@elabs-ai/components-data::FilterChip`.
- **`media-reuse`** (`scope: "packages"`, `baseline: "none"`): a raw `<img>`, `<video>` or
  `<audio>` in any package except `icons`, `tokens`, `cli`, `create` fails, outside
  `packages/ui/src/components/{image,media-player}/**`, tests, stories and contracts; escape
  `// media-reuse-exempt: <reason>` on the line or the line above. It lands last (RM-160), so it
  ships at zero findings.

### 9. What stays where it is

- `packages/data/src/data-table/cells/markdown-cell.tsx` L44 — exempt (16 px inline glyph in a
  sanitised parser hot path).
- `packages/icons/src/service-logo.tsx` L121 — out of scope (layer 0 cannot import `ui`).
- `Avatar` / `AvatarImage` (Radix state machine), `MapPlanImage` (canvas raster), `LogoStrip` /
  `Hero` (slots), charts canvas and export, `AudioVisualizer` (canvas meter), `Persona` (Rive stays
  under ADR 0019 / 0032), `Transcription` (follow-up: wire `useMediaState` for `currentTime` /
  `onSeek`).

## Options considered

| Option                                                      | Verdict                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move media-chrome down into `ui`                            | rejected — makes a web-component engine a dependency of the foundation package, keeps its `--media-*` styling model beside the token system, and keeps the lazy boundary and missing-peer state that exist only because of it               |
| Native `controls` only (`<audio controls>` everywhere)      | rejected — the browser's chrome ignores tokens and themes, differs per engine, cannot be composed or restyled, and gives no shared loading or error state; it is what the viewer does today and the reason its header defers to a ui player |
| Overlay bar as the only video look (the plan's first draft) | rejected — the maintainer chose the shadcnblocks video-player family (Kibo-style docked control bar, 2026-09-23) as the reference; `docked` is the default and `overlay` stays one `placement` value away                                   |
| Keep the copies, add a shared hook only                     | rejected — the loading, error and accessibility gaps live in the markup each copy draws, not in state                                                                                                                                       |
| Put the primitives in `ai` or `viewer`                      | rejected — a sideways dependency between layer-2 packages; ADR 0012 / 0034 rule 2 move a shared need down                                                                                                                                   |
| Keep `ai`'s `Image` name, call the ui one `Img`             | rejected by the maintainer — the base primitive gets the plain name; the AI-specific one is named for what it renders                                                                                                                       |

## Consequences

- `ui` gains `Image`, `Audio`, `Video`, `MediaPlayer*`, `useMediaPlayer`, `useMediaState`,
  `formatMediaTime` and the `ui.media.*` copy; four new Storybook titles (`Display/Image`,
  `Display/Audio`, `Display/Video`, `Display/MediaPlayer`).
- `ai` gains `GeneratedImage` and deprecates `Image` / `ImageProps`; `AudioPlayer` renders real
  controls with zero optional peers (`pnpm consumer:check` is the proof); `Attachments` gets its
  first story and test.
- `viewer`, `editor` and `ui`'s `LinkPreview` render through the primitives; the viewer keeps its
  own zoom, rotation and error panels.
- Two new check rules; `charts-reuse` narrows to its `@base-ui` arm.
- Changesets: `ui` minor, `ai` minor, `viewer` minor, `editor` patch (fixed group — highest bump
  wins).

## Watch for

- **Barrel collision.** `ui` and `ai` both export `Image`. No file imports both barrels **and**
  `Image` today and none `export *`s both; a future dual-barrel file must pick one (`ai.md` says so
  at closure).
- **The viewer's `measure()`** uses the global `Image` constructor; the `ui` import must be aliased
  (`UiImage`) or it shadows the global silently.
- **The alias form.** `export const Image = GeneratedImage` trips `ui-reuse`. Confirm the
  `@deprecated` JSDoc surfaces on the specifier in TypeScript and Storybook.
- **axe `video-caption`** blocks any `<video>` story without a captions track.
- **A true dark letterbox** would need a new token, never a literal.
- **`ModelProviderLogo`'s fallback** must render as the root without a wrapper (its test asserts
  `tagName === "svg"`).

## Maintainer confirmation

(a), (b) and (d) were decided with the maintainer on 2026-09-23; (c) is the one open judgement.
The maintainer ticks the list at track closure (RM-161).

- [ ] (a) `ui` takes the name `Image`; `ai`'s becomes `GeneratedImage` with `Image` as a
      `@deprecated` alias for one minor — decided 2026-09-23.
- [ ] (b) The media-chrome removal ships as a **minor** (argued in §6) — decided 2026-09-23.
- [ ] (c) The ai `AudioPlayer*` presets keep their `audio-player*` slots this minor; alignment to
      `media-player*` is a next-major item (§7) — **open**.
- [ ] (d) The name `GeneratedImage` — decided 2026-09-23.
