# Media primitives in `ui` — `Image`, `Audio`, `Video` (2026-09-23)

Trigger: image, audio and video display is re-implemented in seven-plus places, each with its own
(or no) loading, error and accessibility handling; the maintainer asked for base primitives in
`ui` that every other package reuses.

Outcome of the planning: `ui` gains `Image` and a compound media player (`MediaPlayer*` +
`Audio` / `Video` presets, headless `useMediaState`); `ai`, `viewer`, `editor` and `ui`'s own
`LinkPreview` render through them; media-chrome leaves `ai`; two gates keep it that way. Decision
record: ADR 0041 (`docs/ADR/0041-media-primitives-in-ui.md`). Track:
`roadmap/media-primitives/` (RM-154 … RM-161). No GitHub issues; one report at the end.

Decisions taken with the maintainer on 2026-09-23:

1. Players draw their own controls from existing `ui` primitives (`Slider`, `IconButton`,
   `DropdownMenu`, `Tooltip`, `Skeleton`, `StatePanel`). No media-chrome, no new dependency;
   media-chrome is removed from `ai`.
2. `ui` takes the name `Image`; `ai`'s `Image` becomes `GeneratedImage` built on it, with `Image`
   kept as a `@deprecated` alias for one minor (the ADR 0024 §5a Toolbar → NodeToolbar precedent).
3. Rollout as a roadmap track (this review + ADR 0041 + `roadmap/media-primitives/`), no GitHub
   issues, one report at the end.
4. Visual direction (later the same day): the shadcnblocks video-player family (Kibo-style docked
   control bar). We take its layout, not its media-chrome engine — see §3.2.

## 1. Inventory (evidence)

| Where                                                                                   | What it does today                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/ai/src/image.tsx` `Image`                                                     | AI-SDK generated base64 image; skeleton, `img.complete` guard, `ImageOff` fallback                      |
| `packages/ai/src/gallery.tsx` `GalleryImg` (L149–207)                                   | a second copy of the same logic, `object-cover`; header comment says "don't merge"                      |
| `packages/ai/src/attachments.tsx` (L82–99, L216–260)                                    | 96 / 20 px thumbnails, muted `<video>` thumbnail; no error state, no story, no test                     |
| `packages/ai/src/asset-preview.tsx` (L243–252), `queue.tsx` `QueueItemImage` (L128–138) | bare `<img>`, no error state                                                                            |
| `packages/ai/src/model-provider-logo.tsx` (L125–166)                                    | remote SVG `<img>`, dark invert, icon fallback                                                          |
| `packages/ai/src/audio-player.tsx` + `_audio-player-media-chrome.tsx`                   | media-chrome web-component player, optional peer, lazy boundary, missing-peer state                     |
| `packages/viewer/src/adapters/image/image-adapter.tsx`                                  | real `<img>`, error → `StatePanel`, zoom / rotation transforms                                          |
| `packages/viewer/src/adapters/media/media-adapter.tsx`                                  | native `<audio controls>` / `<video controls>`; header (L3–17) says a ui player is "tracked separately" |
| `packages/viewer/src/adapters/docx/docx-adapter.tsx` (L211–222)                         | bare `<img>`                                                                                            |
| `packages/editor/src/markdown-preview/markdown-preview.tsx` `ImageMd` (L896–906)        | bare `<img>`                                                                                            |
| `packages/ui/src/components/link-preview/link-preview.tsx` `Thumbnail` (L46–62)         | bare `<img>`                                                                                            |

`ui` has no image, audio or video primitive at all.

## 2. Why `ui`

The repo has decided this shape of question three times: a need shared by two layer-2 packages
moves **down** into `ui`, never sideways — ADR 0012 (MetricCard), ADR 0024 §4 (file model) and §5a
(Toolbar), ADR 0034 rule 2. Here the need is shared by `ai`, `viewer` and `editor`, and `ui`'s own
`LinkPreview` has it too. Design principles:

- Zoom and rotation stay in the viewer (ADR 0026: view state belongs to the shell).
- Primitives take `src: string`; whoever mints an object URL owns `revoke()`.
- The native `<img>` / `<audio>` / `<video>` is the source of truth; React mirrors it.
- `cva` only for visual axes (`fit`, `placement`).
- Compound context `{ state, actions, meta }` (canonical shape:
  `packages/ui/src/components/mention-input/mention-input.tsx` L43–87).

## 3. API summary

### 3.1 `Image` (`packages/ui/src/components/image/`, RM-155)

```ts
export type ImageFit = "contain" | "cover" | "fill" | "none" | "scale-down";
export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt">, VariantProps<typeof imageVariants> {
  alt: string; // required; "" = decorative
  fit?: ImageFit; // cva, default "contain"; object-* classes only
  showSkeleton?: boolean; // default Boolean(width && height) || aspectRatio !== undefined
  aspectRatio?: number; // reserves a box via AspectRatio; img gets size-full
  fallback?: ReactNode; // replaces the default ImageOff box after a terminal error
}
```

- The `<img>` carries `data-slot="image"`, `className`, `ref`, `...props`, `data-status`. A
  `data-slot="image-frame"` span wraps it only when a box is reserved (from props, never from load
  state). Frame sizing: `aspectRatio` → `AspectRatio`; else `width && height` → inline-block with
  inline size; else `relative block size-full`.
- Loading: absolute `Skeleton` (`image-skeleton`); one `sr-only role="status"` only when `alt` is
  non-empty, text set one tick later. Cached: `img.complete` on mount.
- Error (terminal event only): `<img>` removed; `fallback` or an `ImageOff` box (`image-fallback`)
  with `role="img" aria-label={alt}` or `aria-hidden`. `src` change resets status (derived in
  render from `{ status, forSrc }`).
- No `loading?: boolean` — the native `loading="lazy|eager"` attribute stays the platform's.

### 3.2 Media core (`packages/ui/src/components/media-player/`, RM-156)

Files: `media-player.tsx` (context, root, element, every part), `use-media-state.ts` (headless
hook), `media-shortcuts.ts` (pure key → action), `audio.tsx`, `video.tsx`,
`media-player.fixtures.ts` (synthetic WAV / SVG poster / VTT data URLs, not exported), stories and
tests. Plus `packages/ui/src/lib/format-media-time.ts`.

- **Context:** `state` (paused, ended, seeking, waiting, currentTime, duration — `NaN` until
  metadata, `Infinity` = live — buffered, volume, muted, playbackRate, readyState, error,
  fullscreen, pip, textTracks, activeTextTrack); `actions` (play, pause, toggle, seek, seekBy,
  setVolume, toggleMute, setPlaybackRate, toggleFullscreen, togglePip, setTextTrack); `meta`
  (kind, mediaRef, rootRef, attach, controlsVisible, pinControls, id). The element is the source of
  truth; no controlled pairs in v1, no `useEffect`-to-sync.
- **Root:** `role="region"`, default label `ui.media.audioPlayer` / `videoPlayer`, `data-kind`,
  `data-paused`, `data-controls`, `data-fullscreen`; video roots `tabIndex=0` + `focus-ring`.
- **Look:** `MediaPlayerControls` has a `cva` visual axis `placement: "docked" | "overlay"`,
  default `docked` — an opaque, theme-coloured bar beneath the media; for video the root is a
  resting frame `rounded-lg border bg-card shadow-xs`. `overlay` is the translucent
  `bg-background/80 backdrop-blur` bar over the video (root `overflow-hidden rounded-md bg-muted`,
  no border). Autohide applies only to `overlay`. `Audio` stays transparent with a docked row.
- **Keyboard:** Space / `k` toggle (Space only when the root is the target), ← / → ±5 s, `j` / `l`
  ±10 s, ↑ / ↓ volume ±0.1, `m` mute, `f` fullscreen (video), `0`–`9` percent seek; null when
  prevented, modified, or inside sliders / menus / inputs / contenteditable.
- **Presets:** `Audio` — Seek(−10) · Play · Seek(+10) · current · slider · duration · mute ·
  volume. `Video` — adds `poster`, `playsInline`, `fit`, `aspectRatio`, `controlsPlacement`
  (default `docked`), `tracks`; default bar Play · Seek(−10) · Seek(+10) · slider · current ·
  duration · mute · volume · rate · captions · PiP · fullscreen. `controls` is the only boolean;
  `children` is the escape hatch. Both keep the root slot `media-player`.

| Part                                                           | Renders                                                                                             | Accessible name                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `MediaPlayerElement`                                           | `<video>` / `<audio>` by kind; children `<source>` / `<track>`; `fit` (video)                       | —                                                                |
| `MediaPlayerControls`                                          | the bar; `placement` `docked` (default) or `overlay`                                                | —                                                                |
| `MediaPlayerPlayButton`                                        | Play / Pause / RotateCcw (ended)                                                                    | `ui.media.play` / `pause` / `replay`                             |
| `MediaPlayerSeekButton`                                        | SkipBack / SkipForward by sign of `offset`                                                          | plural `ui.media.seekBackward` / `seekForward`                   |
| `MediaPlayerTimeSlider`                                        | `Slider` 0..duration; pending value while dragging, seek on commit; buffered overlay                | `ui.media.seek`, valuetext "1:23 of 4:56"; disabled until finite |
| `MediaPlayerTime`                                              | `text-meta tabular-nums`; `mode` current / duration / remaining                                     | text                                                             |
| `MediaPlayerMuteButton` / `MediaPlayerVolumeSlider`            | Volume2 / 1 / X; `Slider` 0..1                                                                      | `ui.media.mute` / `unmute`; `ui.media.volume` + "50%"            |
| `MediaPlayerPlaybackRateMenu`                                  | `DropdownMenu` radio group, rates 0.5–2                                                             | "Playback speed: 1×"; open pins controls                         |
| `MediaPlayerFullscreenButton` / `PipButton` / `CaptionsButton` | `null` when unsupported / audio / no tracks                                                         | `ui.media.enterFullscreen` … `captionsOff`                       |
| `MediaPlayerLoading`                                           | `Skeleton` before metadata (no poster); `Loader2` disc while buffering; one `sr-only role="status"` | `loading` / `ui.media.buffering`                                 |
| `MediaPlayerError`                                             | `StatePanel kind="error" size="sm"` after a terminal error                                          | `role="alert"`; `ui.media.errorTitle` / `errorDescription`       |

Stories: `Display/Image`, `Display/Audio`, `Display/Video`, `Display/MediaPlayer`. `Display/Video`
mirrors the eight reference recipes — Basic, FullBar, MutedAutoplayLoop, PosterFullscreen,
PlaybackRate, Poster, SeekControls, VolumeRange — plus Default, Overlay, Thumbnail, Keyboard,
Error.

The nine contract items the migrations rely on are ADR 0041 §2.

## 4. Migration map

| Site                                                                  | Item   | Becomes                                                                                                               |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `packages/ai/src/image.tsx` L79                                       | RM-158 | `GeneratedImage` in `generated-image.tsx`; `image.tsx` = deprecated specifier alias                                   |
| `packages/ai/src/gallery.tsx` L196 (+ header L10–14)                  | RM-158 | ui `Image fit="cover" alt=""` in tiles; `fit="contain" showSkeleton={false}` in the lightbox                          |
| `packages/ai/src/attachments.tsx` L84, L92, L239                      | RM-158 | ui `Image fit="cover" showSkeleton={false}`; video thumbnail = `Video controls={false} muted fit="cover" aria-hidden` |
| `packages/ai/src/asset-preview.tsx` L245                              | RM-158 | ui `Image fit="contain" loading="lazy"`                                                                               |
| `packages/ai/src/queue.tsx` L131                                      | RM-158 | ui `Image`, 32 px, `data-slot="queue-item-image"`                                                                     |
| `packages/ai/src/model-provider-logo.tsx` L148                        | RM-158 | ui `Image showSkeleton={false} fallback={<BotIcon role="img" aria-label/>}`, `invert` kept                            |
| `packages/ai/src/audio-player.tsx` L203 + media-chrome parts L211–357 | RM-159 | presets over ui `Audio` / `MediaPlayer*` (§5)                                                                         |
| `packages/viewer/src/adapters/image/image-adapter.tsx` L123           | RM-157 | `UiImage fit="none" showSkeleton={false}` (aliased import); adapter keeps its `failed` → `StatePanel`                 |
| `packages/viewer/src/adapters/docx/docx-adapter.tsx` L213             | RM-157 | `UiImage fallback={null} fit="none" loading="lazy"`                                                                   |
| `packages/viewer/src/adapters/media/media-adapter.tsx` L91, L104      | RM-157 | ui `Audio` / `Video` with `controls`; adapter keeps its `failed` → `StatePanel`                                       |
| `packages/ui/src/components/link-preview/link-preview.tsx` L51        | RM-160 | `Image fallback={null} fit="cover" showSkeleton={false} loading="lazy" alt="" aria-hidden`                            |
| `packages/editor/src/markdown-preview/markdown-preview.tsx` L898      | RM-160 | ui `Image fit="none" loading="lazy"`, classes kept                                                                    |
| `packages/data/src/data-table/cells/markdown-cell.tsx` L44            | exempt | 16 px inline glyph in a sanitised parser hot path — `// media-reuse-exempt:` comment                                  |
| `packages/icons/src/service-logo.tsx` L121                            | —      | out of scope: layer 0 cannot import `ui`                                                                              |

Left alone: `Avatar` / `AvatarImage` (Radix state machine), `MapPlanImage` (canvas raster),
`LogoStrip` / `Hero` (slots), charts canvas / export, `AudioVisualizer` (canvas meter), `Persona`
(Rive, ADR 0019 / 0032), `Transcription` (follow-up: wire `useMediaState` for `currentTime` /
`onSeek`).

## 5. media-chrome removal and the prop map (RM-159)

- `AudioPlayer` → `<Audio data-slot="audio-player" keyboardShortcuts={!noHotkeys && keyboardControl !== false}>`;
  `AudioPlayerElement` → `MediaPlayerElement data-slot="audio-player-element"` with
  `src={data ? dataUrl : src}` (`slot="media"` dropped; the `SpeechResult["audio"]` conversion
  stays in `ai`). `ControlBar` → `MediaPlayerControls`, `PlayButton` → `MediaPlayerPlayButton`,
  `Seek{Backward,Forward}Button` → `MediaPlayerSeekButton offset={∓seekOffset}`, `TimeDisplay` →
  `MediaPlayerTime mode="current"`, `DurationDisplay` → `mode="duration"`, `TimeRange` →
  `MediaPlayerTimeSlider`, `MuteButton` → `MediaPlayerMuteButton`, `VolumeRange` →
  `MediaPlayerVolumeSlider`. Every preset keeps its `audio-player*` slot (ADR 0041 §7).
- Prop map, types kept with `@deprecated` JSDoc: `noHotkeys` / `keyboardControl` →
  `keyboardShortcuts`; `seekOffset` → `offset`; accept-and-ignore: `autohide*`, `breakpoints*`,
  `defaultDuration`, `defaultStreamType`, `defaultSubtitles`, `gesturesDisabled`, `keysUsed`,
  `liveEdgeOffset`, `noAuto*`, `noDefaultStore`, `no*Pref`, `resolvedLang`, `userInteractive`,
  `mediaController`, `mediaCurrentTime`, `noTooltip`, `preventClick`.
- Deleted: `_audio-player-media-chrome.tsx`, `AudioPlayerMissing`. Edited: `_lazy-boundary-conformance.ts`,
  `_lazy-mermaid-absent.test.ts`, `_lazy-engine-boundary.tsx`, `packages/ai/package.json` (peer,
  peer meta, dev dep), `pnpm-lock.yaml`, `scripts/check/rules/eager-heavy-deps.mjs`,
  `scripts/check-optional-peer-types.mjs`, `scripts/gen-package-readmes.mjs`,
  `packages/ai/README.md`, `docs/CONSUMING.md`, `docs/CSP-AND-NETWORK.md`,
  `fixtures/consumer-smoke/src/main.tsx` (comment only), the `AudioPlayer` intent row. ADR 0019 and
  0032 get one-line "superseded for media-chrome by ADR 0041" notes.
- **Why a minor:** the peer was optional; no exported symbol removed; prop types stay assignable;
  `data-slot` selectors persist; tag names and `--media-*` were never documented API. The alias and
  ignored props go in the next major (`docs/DEPRECATION.md` §2).

## 6. Gates (RM-160)

- **`ui-reuse`** (`scripts/check/rules/ui-reuse.mjs`, `scope: "packages"`, `baseline: "keys"`):
  for every layer-2 package (`ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `editor`,
  `viewer`, `terminal`), a local declaration named like a `ui` manifest component fails; key
  `<pkg>::<Name>`; escape `// ui-reuse-exempt: <reason>`. The scan (`manifestComponentNames`,
  `localDeclarations`) is lifted from `charts-reuse.mjs` L14–52 into a shared helper;
  `charts-reuse` keeps only its `@base-ui` arm. Baseline seeded with
  `@elabs-ai/components-data::FilterChip`.
- **`media-reuse`** (`baseline: "none"`): regex `<(img|video|audio)(?=[\s/>])` on comment-stripped
  source in every package except `icons` / `tokens` / `cli` / `create`, excluding
  `packages/ui/src/components/{image,media-player}/**`, tests, stories and contracts; escape
  `// media-reuse-exempt: <reason>` on the line or the line above. Lands last so it ships at zero.

## 7. Risks

1. Both `ui` and `ai` export `Image`; no file today imports both barrels and `Image`, none
   `export *`s both (30 dual-barrel importers checked). `ai.md` will say so.
2. The alias must stay `export { GeneratedImage as Image }`; `export const` trips `ui-reuse`.
   Verify `@deprecated` surfaces on the specifier in TS and Storybook.
3. The viewer's `measure()` uses the global `Image` constructor — alias the import (`UiImage`).
4. `image-adapter.test.tsx` class / style assertions depend on ADR 0041 §2 items 1–3.
5. axe `video-caption` blocks any `<video>` story without a captions track — `tracks` on every
   Video story; decorative thumbnails `aria-hidden`.
6. The contract generator needs an args-only `Default` per preset; the `Audio` / `Video` probes
   need two known-failure entries (the preset keeps the base root slot `media-player`).
7. RM-158 and RM-159 both rewrite `scripts/check/baseline.json` — merge 159 first, run
   `pnpm check:update` deliberately, never blind.
8. `ModelProviderLogo`'s test asserts fallback `tagName === "svg"` — holds only if `fallback`
   renders as the root, unwrapped.
9. `pnpm gen` churn is wide (manifest, contract tests, catalog JSON, llms, README regions,
   `CLAUDE.md` / `AGENTS.md`, `docs/GATES.md`); `gen:check` is the gate.

## 8. Items

| ID     | Title                                                                                                  | Wave | Effort | Depends       | Agent / model              |
| ------ | ------------------------------------------------------------------------------------------------------ | ---- | ------ | ------------- | -------------------------- |
| RM-154 | ADR 0041 + review doc + track skeleton (decision gate)                                                 | 0    | S      | —             | component-builder / opus   |
| RM-155 | ui `Image`                                                                                             | 1    | M      | 154           | component-builder / sonnet |
| RM-156 | ui media core: `useMediaState`, `MediaPlayer*`, `Audio`, `Video`, `formatMediaTime`, `ui.media.*` copy | 1    | L      | 154           | component-builder / opus   |
| RM-157 | viewer image / docx / media adapters on ui primitives                                                  | 2    | S–M    | 155, 156      | component-builder / sonnet |
| RM-158 | ai `GeneratedImage` + Gallery / Attachments / AssetPreview / Queue / ModelProviderLogo                 | 2    | M      | 155, 156      | component-builder / sonnet |
| RM-159 | ai `AudioPlayer*` presets + media-chrome removal                                                       | 2    | M      | 156           | component-builder / sonnet |
| RM-160 | ui LinkPreview thumbnail, editor ImageMd, `ui-reuse` + `media-reuse` gates                             | 3    | M      | 157, 158, 159 | component-builder / sonnet |
| RM-161 | Closure: D3, skills / docs, rules, ADR pointers, `pnpm gen`, browser sweep, review Outcome             | 3    | S–M    | 160           | docs-writer / sonnet       |

```
wave 0  └ RM-154 ADR 0041 + review + track          ← maintainer confirms the ADR checklist first
              ▼ merge
wave 1  ┬ RM-155 ui Image (sonnet)                   ┐ disjoint dirs: components/image · components/media-player;
        └ RM-156 ui media core + Audio/Video (opus)  ┘ index.ts / intent.mjs / messages.ts append-only under `// <Name> — RM-NNN`
              ▼ merge, full gates once, review lane (Display/Image, Display/Audio, Display/Video; axe video-caption)
wave 2  ┬ RM-157 viewer adapters (sonnet)                            ┐ disjoint write sets: viewer/src/adapters ·
        ├ RM-158 ai image consumers + GeneratedImage (sonnet)        │ ai image files · ai audio files + docs.
        └ RM-159 ai AudioPlayer presets + media-chrome out (sonnet)  ┘ Merge 159 before 158 (both regenerate baseline.json)
              ▼ merge, full gates, pnpm consumer:check (zero optional peers), review lane 380/600/900 + keyboard
wave 3  ┬ RM-160 LinkPreview + editor ImageMd + gates  ← last, so media-reuse ships at zero findings
        └ RM-161 closure (docs-writer)
```

Critical path RM-154 → 156 → 159 → 160 → 161 (≈ 9–11 agent-days). Demo first: RM-157 — FileViewer
audio and video with real controls is the visible win.

## Outcome

Closed 2026-09-23 on `feat/media-primitives` (waves 0–3, RM-154 … RM-161 all done). What landed
differs from the plan only where ADR 0041 §10 records it (viewport part, `placement` axis,
derived `waiting`, viewer `fit="contain"`, alias counted by the `data-slot` ratchet, narrow-bar
container tiers).

**Verification (all run on the closing tree):**

| Gate                                         | Result                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                 | 92/92 (87 rules + 5 commands) — `ui-reuse` seeded with the two pre-existing collisions (`ai::Toolbar`, `data::FilterChip`), `media-reuse` 0, `contract-known-failures` 76 (−2 ai, +2 preset root-slot entries), `data-slot` 7                                                                         |
| `pnpm check:test`                            | 454 tests in 31 files, 0 fail                                                                                                                                                                                                                                                                         |
| `pnpm gen` + `pnpm gen:check`                | fresh; intent projection 196 581 bytes of the 196 608-byte ceiling                                                                                                                                                                                                                                    |
| `pnpm typecheck` / `pnpm lint`               | 16/16 tasks, 0 lint errors                                                                                                                                                                                                                                                                            |
| `pnpm test`                                  | 16/16 packages green (ai 83 files)                                                                                                                                                                                                                                                                    |
| `pnpm build` · `pnpm consumer:check`         | 16/16 built; consumer install smoke exit 0 — `AudioPlayer` renders with zero optional peers                                                                                                                                                                                                           |
| Storybook (Chromium, axe blocking)           | 535 story files, 2 540 tests, 0 failures                                                                                                                                                                                                                                                              |
| `grep -rn media-chrome`                      | only `CHANGELOG.md`, the ADR 0019/0032/0024 notes, the ai changeset and this track's roadmap files                                                                                                                                                                                                    |
| Browser sweep (Storybook dev, agent-browser) | `Display/Video` default: light + dark at 900 px, dark + light at 380 px; `Display/Audio` default: light at 600 px, dark at 380 px. The 380 px pass found the video bar's scrubber collapsing and the view buttons clipping — fixed in the same change (container-width tiers, ADR §10); re-shot clean |

**Not verified:** real fullscreen / picture-in-picture entry and caption-cue rendering (need a
human in a browser with a real video file); the 600 px tier by eye for `Video`; the ai
`AudioPlayer` story below 448 px (its bar is the consumer's composition, no hide classes).

**Open maintainer call** (ADR 0041 checklist): the ai presets keep their `audio-player*`
slots this minor; the intent projection ceiling has 27 bytes of headroom, so the next
component with an intent row must trim or raise it.
