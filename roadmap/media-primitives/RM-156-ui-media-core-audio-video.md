---
id: RM-156
title: "ui media core: `useMediaState`, `MediaPlayer*`, `Audio`, `Video`, `formatMediaTime`, `ui.media.*` copy"
status: in-progress
priority: P0
effort: L (3–4 days)
wave: 1
depends_on: [RM-154]
blocks: [RM-157, RM-158, RM-159]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/ui/src/components/media-player/media-player.tsx (new — context, MediaPlayer root, MediaPlayerElement, every control part)
  - packages/ui/src/components/media-player/use-media-state.ts (new — headless hook)
  - packages/ui/src/components/media-player/media-shortcuts.ts (new — pure key → action resolver)
  - packages/ui/src/components/media-player/audio.tsx (new — preset)
  - packages/ui/src/components/media-player/video.tsx (new — preset)
  - packages/ui/src/components/media-player/media-player.fixtures.ts (new — synthWavDataUrl, synthPosterSvgDataUrl, synthVttDataUrl; not exported)
  - packages/ui/src/components/media-player/index.ts (new)
  - packages/ui/src/components/media-player/{media-player,audio,video}.stories.tsx (new)
  - packages/ui/src/components/media-player/{use-media-state,media-shortcuts,media-player,audio,video}.test.ts(x) (new)
  - packages/ui/src/lib/format-media-time.ts (new) + format-media-time.test.ts (new)
  - packages/ui/src/index.ts (append `// Audio, Video, MediaPlayer — RM-156` + `export * from "./components/media-player"`; `formatMediaTime` next to `formatElapsed` ~L96)
  - packages/ui/src/components/locale-provider/messages.ts (`ui.media.*` after `ui.colorPicker.customHex` ~L275)
  - packages/cli/lib/intent.mjs (Audio, Video, MediaPlayer rows next to AspectRatio / Avatar ~L3515)
  - scripts/check/contract-known-failures.json (two entries: display-audio--default, display-video--default)
  - apps/docs/public/*.vtt (only if data-URL tracks do not load in Chromium)
  - .changeset/*.md (ui minor)
source: docs/review/2026-09-23-media-primitives-plan.md §3.2; ADR 0041 §2 items 5–9, §4
---

# RM-156 ui media core + `Audio` / `Video`

## Finding

- The only themed player is ai's `AudioPlayer`, built on media-chrome web components: an optional peer behind a lazy boundary with a missing-peer state (`audio-player.tsx`, `_audio-player-media-chrome.tsx`). Its styling runs through undocumented `--media-*` variables, not tokens.
- viewer `media-adapter.tsx` (L91, L104) uses native `<audio controls>` / `<video controls>` — browser chrome that ignores themes — and its header (L3–17) defers to a ui player "tracked separately". ai `attachments.tsx` (L239) draws its own muted `<video>` thumbnail.
- `ui` already has every control primitive needed: `Slider`, `IconButton` (tooltip + `aria-label` for free), `DropdownMenu`, `Tooltip`, `Skeleton`, `StatePanel`, `AspectRatio`. The canonical `{ state, actions, meta }` context shape is `mention-input.tsx` L43–87; the key-guard precedent is `carousel.tsx` L28–33.

## Change

**`useMediaState(element)`** (exported, headless): subscribes per element to `loadedmetadata`, `durationchange`, `timeupdate`, `progress`, `play`, `pause`, `playing`, `canplay`, `waiting`, `seeking`, `seeked`, `ended`, `volumechange`, `ratechange`, `error` (only when `el.error` is non-null), `emptied` + `loadstart` (reset), `enter|leavepictureinpicture`; document `fullscreenchange`; `textTracks` add / remove / change. Actions feature-detect: the `play()` promise rejection is swallowed; `requestFullscreen` / `pictureInPictureEnabled` are guarded. Listeners cleaned up on element change.

**Context** (`useMediaPlayer()` throws outside the provider):

- `state`: `paused, ended, seeking, waiting, currentTime, duration (NaN until loadedmetadata, Infinity = live), buffered: {start,end}[], volume, muted, playbackRate, readyState, error: MediaError | null, fullscreen, pip, textTracks: {id,label,language,kind}[], activeTextTrack`.
- `actions`: `play, pause, toggle, seek, seekBy, setVolume (clamps; > 0 unmutes), toggleMute (restores 1 at 0), setPlaybackRate, toggleFullscreen (root; no-op when unsupported), togglePip (video only), setTextTrack`.
- `meta`: `kind, mediaRef, rootRef, attach (callback ref the element binds), controlsVisible, pinControls(bool), id`.
- No controlled / uncontrolled pairs in v1; `muted` / `loop` / `autoPlay` / `preload` pass through as initial attributes. Not one `useEffect`-to-sync.

**Root `MediaPlayer`:** `<div data-slot="media-player" data-kind data-paused data-controls="visible|hidden" data-fullscreen role="region" aria-label={label ?? t("ui.media.audioPlayer" | "ui.media.videoPlayer")} tabIndex={video ? 0 : undefined}>`, `className` via `cn()` with `group/media relative` (+ `focus-ring` for video). Props: `kind`, `label?`, `keyboardShortcuts?` (default true), div attributes. Every root and part emits `data-slot` **before** `{...props}` (ADR 0041 §2 item 5).

**Look — docked by default** (maintainer direction 2026-09-23: the shadcnblocks video-player family, Kibo-style docked control bar; we take the layout, not its media-chrome engine):

- `MediaPlayerControls` has a `cva` visual axis `placement: "docked" | "overlay"`, default `docked`, exported as `mediaPlayerControlsVariants`.
- `docked`: an opaque, theme-coloured bar beneath the media (`flex w-full items-center gap-1`, padding on the Tailwind scale). For video the root is a resting surface: `rounded-lg border bg-card shadow-xs`, the media area letterboxing on `bg-muted`, the bar below it. Never hides.
- `overlay`: `absolute inset-x-0 bottom-0 bg-background/80 p-2 backdrop-blur` (one wash, no border) over the video; the root is `overflow-hidden rounded-md bg-muted`, no border.
- `Audio` is transparent with a docked row; the surrounding bubble or `Card` is the surface.
- Tokens only; a true dark letterbox later = a new token, never a literal.

**Autohide — overlay only:** `controlsVisible = paused || ended || error || pinned || pointerActive`; `pointermove` restarts a 3 s timer, `pointerleave` while playing hides; `group-focus-within/media:opacity-100` keeps a focused control visible; menus call `pinControls(open)` from `onOpenChange`. Fade `transition-opacity duration-base ease-standard` (the token layer zeroes it under reduced motion via `--motion-factor`; no `useReducedMotion()`). A click on the `<video>` toggles play. With `docked`, `data-controls` is always `visible`.

**Keyboard** (`resolveMediaShortcut(event, { isRootTarget, kind, duration })`): Space / `k` toggle (Space only when the target is the root, so a focused button does not double-toggle); ← / → ±5 s; `j` / `l` ±10 s; ↑ / ↓ volume ±0.1; `m` mute; `f` fullscreen (video); `0`–`9` percent seek (finite duration). Returns null when `defaultPrevented`, ctrl / meta / alt, or the target is inside `[role=slider|menu|menuitem|menuitemradio], input, textarea, select, [contenteditable]`. Tooltips are `label`-only — no `Kbd` in any accessible name.

**Parts** (all `data-slot="media-player-<part>"`, every icon control an `IconButton`):

| Part                                                                                 | Renders                                                                                                                                                                                                                            | Props                                                                       | Accessible name                                                                         |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `MediaPlayerElement`                                                                 | `<video>` / `<audio>` by `meta.kind`; children `<source>` / `<track>`; `fit?: "contain" \| "cover"` cva (video)                                                                                                                    | `ComponentPropsWithoutRef<"video">`                                         | oxlint `media-has-caption` disable with a reason, as ai does today                      |
| `MediaPlayerControls`                                                                | the bar; `placement` `docked` (default) / `overlay`                                                                                                                                                                                | div attrs + `placement`                                                     | —                                                                                       |
| `MediaPlayerPlayButton`                                                              | Play / Pause / RotateCcw (ended)                                                                                                                                                                                                   | `Omit<IconButtonProps, "label" \| "icon">`                                  | `ui.media.play` / `pause` / `replay`                                                    |
| `MediaPlayerSeekButton`                                                              | SkipBack / SkipForward by sign, `data-direction`                                                                                                                                                                                   | `offset: number`                                                            | plural `ui.media.seekBackward` / `seekForward` `{count}`                                |
| `MediaPlayerTimeSlider`                                                              | `Slider` 0..duration step 0.1; local pending value while dragging, `seek` on commit; buffered ranges as an `aria-hidden` overlay (`media-player-buffered`)                                                                         | `Omit<SliderProps, value \| min \| max \| onValueChange \| onValueCommit>`  | `ui.media.seek`, `aria-valuetext` "1:23 of 4:56"; disabled until the duration is finite |
| `MediaPlayerTime`                                                                    | `text-meta tabular-nums text-muted-foreground`; hours forced when duration ≥ 3600                                                                                                                                                  | `mode: "current" \| "duration" \| "remaining"`                              | text                                                                                    |
| `MediaPlayerMuteButton` / `MediaPlayerVolumeSlider`                                  | Volume2 / Volume1 / VolumeX; `Slider` 0..1 step 0.05 `w-20`                                                                                                                                                                        | as above                                                                    | `ui.media.mute` / `unmute`; `ui.media.volume` + valuetext "50%"                         |
| `MediaPlayerPlaybackRateMenu`                                                        | `DropdownMenu` + `DropdownMenuRadioGroup`; ghost `sm` trigger shows "1×"                                                                                                                                                           | `rates?` default `[0.5, 0.75, 1, 1.25, 1.5, 2]`                             | trigger "Playback speed: 1×"; `onOpenChange → pinControls`                              |
| `MediaPlayerFullscreenButton` / `MediaPlayerPipButton` / `MediaPlayerCaptionsButton` | `null` when unsupported / audio / no tracks                                                                                                                                                                                        | —                                                                           | `ui.media.enterFullscreen` … `captionsOff`                                              |
| `MediaPlayerLoading`                                                                 | `readyState < 1 && !poster && !error` → `Skeleton absolute inset-0`; `waiting && !paused` → centred `Loader2 animate-spin` on a `bg-background/80` disc; one `sr-only role="status"` (never `Spinner`, which carries its own role) | —                                                                           | `t("loading")` / `ui.media.buffering`                                                   |
| `MediaPlayerError`                                                                   | `StatePanel kind="error" size="sm"`, null until `state.error`                                                                                                                                                                      | `Pick<StatePanelProps, title \| description \| actions \| size \| titleAs>` | `role="alert"` from `StatePanel`; defaults `ui.media.errorTitle` / `errorDescription`   |

**Presets** (keep the root `data-slot="media-player"` + `data-kind`):

- `Audio`: `Omit<MediaPlayerProps, "kind">` & element props (`src`, `preload`, `crossOrigin`, `loop`, `muted`, `autoPlay`, media events) & `{ controls?: boolean /* true */; children? }`. Default docked row: Seek(−10) · Play · Seek(+10) · Time current · TimeSlider · Time duration · Mute · Volume. On `error` the row is replaced by the compact `StatePanel`.
- `Video`: adds `poster`, `playsInline`, `fit?`, `aspectRatio?` (no default), `controlsPlacement?: "docked" | "overlay"` (default `docked`) and `tracks?: { src; kind; srclang; label; default? }[]` rendered as `<track>`. Structure: root → media area (`[AspectRatio?]` → Element `size-full` + Loading + Error) → `{children ?? (controls && default bar)}`; in `overlay` the bar sits inside the media area. Default bar: Play · Seek(−10) · Seek(+10) · TimeSlider · Time current · Time duration · Mute · Volume · PlaybackRate · Captions · Pip · Fullscreen. `controls={false} muted fit="cover"` is the attachments thumbnail.
- `controls` is the only boolean; `children` is the full-composition escape hatch. Presets forward native attributes (`aria-label`, `preload`, `crossOrigin`, `onError`, `muted`, `loop`) to the element and never set the native `controls` attribute (ADR 0041 §2 item 6). The native `error` event still reaches the consumer's `onError` (item 8).

**`formatMediaTime(seconds, { hours? })`**: floors; `m:ss` (unpadded minutes) below an hour; `h:mm:ss` at ≥ 3600 or `hours: true`; `NaN` / ±`Infinity` / negative → `"0:00"`.

**Copy** (`messages.ts`, after `ui.colorPicker.customHex`): `ui.media.audioPlayer`, `videoPlayer`, `play`, `pause`, `replay`, `seekBackward{one,other}`, `seekForward{one,other}`, `seek`, `timeValue` "{current} of {duration}", `mute`, `unmute`, `volume`, `volumeValue` "{percent}%", `playbackRate`, `playbackRateValue` "{rate}×", `playbackRateLabel` "Playback speed: {rate}×", `enterFullscreen`, `exitFullscreen`, `enterPip`, `exitPip`, `captionsOn`, `captionsOff`, `buffering` "Buffering…", `errorTitle` "Can’t play this media", `errorDescription` "The browser couldn’t decode this file."

**Intent rows** (`intent.mjs`): `Audio`, `Video`, `MediaPlayer` — purpose, category `display`, relationships, stateTokens, antiPatterns: "reaching for media-chrome → compose `MediaPlayer` parts", "`autoPlay` with sound", "a black letterbox literal", "native `controls`".

**Stories** (`Display/…`, `tags: ["autodocs"]`, `component:` set, args-only `Default`):

- `Display/Audio`: Default (synthetic 20 s WAV; play asserts region name, button names, slider valuetext "0:00 of 0:20"), Minimal, CustomComposition (`ButtonGroup` + `outline icon-sm`, the ai look), PlaybackRate (six `menuitemradio`), Keyboard (`m` → "Unmute", `l` → "0:10 of 0:20"), Error (`role="alert"`).
- `Display/Video` mirrors the eight reference recipes — Basic (play + time), FullBar, MutedAutoplayLoop (hero embed), PosterFullscreen, PlaybackRate, Poster, SeekControls, VolumeRange — plus Default (WAV as `<video src>` + SVG poster, `aspectRatio 16/9`, muted, `tracks` in args; play: click Play → `data-paused="false"`), Overlay (`controlsPlacement="overlay"`; `data-controls="hidden"` after 3 s, pointer move restores), Thumbnail (`controls={false} muted fit="cover" aria-hidden`), Keyboard, Error. **Every Video story except Thumbnail carries `tracks`** (axe `video-caption` is blocking). Tracks use a VTT data URL; fall back to a static file under `apps/docs/public` if Chromium does not load data-URL tracks.
- `Display/MediaPlayer`: CustomVideoLayout, HeadlessHook.

## Acceptance

- ADR 0041 §2 items 5–9 hold, each with a test: slot-before-props override; `MediaPlayerElement` as a part with native attrs forwarded and no native `controls` attribute; `tracks` on `Video`; `MediaPlayerError` title / description overrides and `onError` still firing; per-file jsdom stubs only (`vi.spyOn(HTMLMediaElement.prototype, "play" | "pause" | "load")`, `Object.defineProperty` for `duration` / `currentTime` / `buffered` / `error`) — nothing added to `vitest.setup.ts`.
- Tests: `format-media-time.test.ts` (table); `use-media-state.test.tsx` (every event, null error ignored, resets, clamps, listener cleanup); `media-shortcuts.test.ts` (key table, guards); `media-player.test.tsx` (throws outside the provider, every slot, names, slider valuetext / disabled, time modes, rate menu, unsupported → null, loading rungs, error only after a terminal event, `placement` classes); `audio.test.tsx`; `video.test.tsx` (tabIndex, aspect frame, click toggles, autohide with fake timers in `overlay` only, docked never hides, pin, Space on root vs button).
- Decorative thumbnails (`aria-hidden`, muted, no controls) pass axe as hidden content — verified here, not deferred.
- Two known-failure entries for `display-audio--default` / `display-video--default` with the reason "preset keeps base root slot `media-player`".

## Test / gate

`pnpm --filter @elabs-ai/components-ui typecheck lint test`; `pnpm check --rule data-slot,variant-coverage,loading-states,microcopy,contract-known-failures`; `pnpm gen && pnpm gen:check`; Storybook `run-story-tests` on `display-audio--*`, `display-video--*`, `display-mediaplayer--*` in light and dark: real `loadedmetadata`, the `data-paused` flip, live valuetext, overlay autohide timing, `<track>` loading, Fullscreen / PiP presence, axe.

## Orchestrator notes

Runs in parallel with RM-155 — disjoint directories; `index.ts`, `intent.mjs` and `messages.ts` are append-only under `// Audio, Video, MediaPlayer — RM-156`. Opus because the context, the event model, keyboard guards, autohide and two placements interact. Blocks all three wave-2 items; it is on the critical path.
