"use client";

import { Skeleton, isOptionalPeerMissing, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { Experimental_SpeechResult as SpeechResult } from "ai";
import { VolumeOffIcon } from "lucide-react";
import type { ComponentProps, ComponentType, HTMLAttributes } from "react";
import { lazy, Suspense } from "react";

import { LazyEngineBoundary } from "./_lazy-engine-boundary";

/**
 * media-chrome lives behind a dynamic import — it declares no `sideEffects`, so
 * a static import would put the whole custom-element library in every consumer's
 * entry chunk, `AudioPlayer` rendered or not. Every value import lives in
 * `_audio-player-media-chrome.tsx`. See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * All ten parts resolve from the SAME module specifier, so they share one chunk:
 * once `AudioPlayer` has loaded it, the controls inside it resolve from cache.
 *
 * Issue #101: `media-chrome` is an OPTIONAL peer, so no PUBLIC export's type
 * may structurally reference `media-chrome/react`'s own types (previously
 * `ComponentProps<typeof MediaController>` and nine siblings, imported as
 * TYPE-only above) — doing so names `media-chrome/react`'s module specifier in
 * this package's generated root `.d.ts` and hands a `skipLibCheck: false`
 * consumer who has correctly omitted the peer a `TS2307` just for importing
 * the barrel — not just for using `AudioPlayer`. `AudioPlayerPartProps` below
 * is an OWNED base type: `media-chrome/react`'s wrapper
 * (`media-chrome/react`'s `createComponent`, from the `ce-la-react` helper it
 * is built on) types every part as `Omit<HTMLAttributes<I>, …> &
 * Partial<the element's own instance members>` — i.e. ordinary HTML attributes
 * plus a handful of optional custom attributes. `AudioPlayerPartProps` itself
 * stays ordinary HTML attributes only; the PRIMITIVE-typed (`string` /
 * `boolean` / `number`) extra instance members of `<media-controller>` and
 * `<media-seek-forward-button>` — the two elements measured by the round-2
 * validator — are mirrored one-by-one on `AudioPlayerProps` and
 * `AudioPlayerSeekForwardButtonProps` below (each a single declaration line
 * referencing nothing peer-owned, the same technique `seekOffset` already
 * used). What stays narrowed to `AudioPlayerPartProps` alone are the
 * PEER/COMPLEX-typed members (`MediaStore`, `AttributeTokenList`,
 * `MediaTooltip`, `TooltipPlacement`, DOM-element and `HTMLMediaElement`
 * callbacks, methods) and every member of the other eight parts — restoring
 * those would re-import the peer type graph this fix exists to avoid. See the
 * CHANGELOG's "Breaking (types)" entry for the exact narrowed set.
 * `AudioPlayerPartProps` is therefore NOT a full replica of media-chrome's
 * surface, only the base every part actually uses and re-exports (the same
 * scoping `TerminalColorTheme` uses for xterm's `ITheme` in
 * `packages/terminal/src/interactive-terminal.tsx`, also issue #101). The ten
 * conformance assertions at the bottom of `_audio-player-media-chrome.tsx`
 * (which still imports the real peer types — that module is reached only
 * through `lazy()` and never sits in the barrel's declaration graph) prove
 * every owned type here stays assignable to its real media-chrome counterpart;
 * a peer version bump that narrows a prop incompatibly fails
 * `pnpm --filter @elabs-ai/components-ai typecheck` locally instead of
 * reaching a consumer as silent drift.
 *
 * Deliberately no `ref` field: `ComponentProps<typeof MediaController>` (and
 * its nine siblings) included one via `RefAttributes<I>`, but `RefObject<T>`'s
 * mutable `current` makes ref types INVARIANT in `T` — a `Ref<HTMLElement>`
 * can never be assignable to a real element's own `Ref<MediaController>` (the
 * custom element subclass carries private/extra members `HTMLElement` lacks),
 * so keeping it would make every owned type fail its own conformance
 * assertion below. This IS a real-world break for a React 19 consumer: none
 * of the ten parts this package renders is wrapped in `forwardRef`, but
 * `MediaController` (and its siblings) are genuine `forwardRef` components,
 * and React 19's ref-as-prop carries a `ref` straight through an ordinary
 * function component's `{...props}` spread to the real underlying element —
 * see the CHANGELOG's "Breaking (types)" entry for the measured detail. It is
 * inert only under React 18.
 */
export type AudioPlayerPartProps = HTMLAttributes<HTMLElement>;

type MediaChromeModule = typeof import("./_audio-player-media-chrome");

const lazyPart = <P,>(pick: (module: MediaChromeModule) => ComponentType<P>) =>
  lazy(() => import("./_audio-player-media-chrome").then((m) => ({ default: pick(m) })));

/**
 * The primitive-typed (`string`/`boolean`/`number`) extra instance members of
 * `media-chrome/react`'s `MediaController` — restored per issue #101's round-2
 * validation (R2): each is a single declaration line mirroring the real peer
 * type's name and shape, referencing nothing peer-owned, so it costs nothing
 * against the `.d.ts` leak this fix exists to prevent. Deliberately EXCLUDED:
 * `audio` (already narrowed out — `_audio-player-media-chrome.tsx`'s
 * conformance assertion Omits it from the real `ComponentProps`, since this
 * package renders its own `<AudioPlayerElement>` instead of passing one
 * through), and every PEER/COMPLEX-typed member (`mediaStore`, `hotkeys`
 * (`AttributeTokenList`), `media`/`fullscreenElement` (DOM elements),
 * `mediaStateReceivers`, `associatedElementSubscriptions`, every
 * `HTMLMediaElement` callback and every method) — those stay narrowed to
 * `AudioPlayerPartProps` alone; restoring them would re-import the peer type
 * graph. See `_audio-player-media-chrome.tsx`'s
 * `_AudioPlayerPropsConformance` assertion, which fails typecheck if this
 * interface ever drifts wider than the real element's own props.
 *
 * Doc comments below are inferred from each member's name and media-chrome's
 * public attribute-naming convention (`no*` = boolean opt-out of the
 * corresponding default-on behavior) — media-chrome ships no per-property doc
 * comments in its own `.d.ts` or README to copy from. Treat them as a reading
 * aid, not an authoritative spec; verify against media-chrome's source before
 * relying on exact semantics.
 */
export interface AudioPlayerProps extends AudioPlayerPartProps {
  /** Seconds of inactivity before controls hide; a string because it mirrors the HTML attribute value. */
  autohide?: string;
  /** Also autohide while the pointer is over the control elements themselves, not just the media. */
  autohideOverControls?: boolean;
  /** Breakpoint definitions (space-separated `name:width` pairs) driving `breakpointsComputed`. */
  breakpoints?: string;
  /** Whether the controller has computed its current breakpoint(s) at least once. */
  breakpointsComputed?: boolean;
  /** Fallback duration (seconds) to display before the real media duration is known. */
  defaultDuration?: number;
  /** Default stream type ("on-demand" or "live") before the media has resolved its own. */
  defaultStreamType?: string;
  /** Whether subtitles/captions are enabled by default. */
  defaultSubtitles?: boolean;
  /** Disables the controller's built-in tap/gesture handling (e.g. tap-to-play, double-tap-to-seek). */
  gesturesDisabled?: boolean;
  /** Whether hotkey keyboard control is currently active on the controller. */
  keyboardControl?: boolean;
  /** Space-separated list of hotkey names currently in use, for conflict detection with other listeners. */
  keysUsed?: string;
  /** Seconds behind the live edge still considered "at" live, for a live stream's seek range. */
  liveEdgeOffset?: number;
  /** Disables the controller's autohide-controls-on-inactivity behavior entirely. */
  noAutohide?: boolean;
  /** Disables automatically seeking back to the live edge after a manual seek on a live stream. */
  noAutoSeekToLive?: boolean;
  /** Opts out of the controller creating its own default internal media store. */
  noDefaultStore?: boolean;
  /** Disables the controller's built-in keyboard hotkeys entirely. */
  noHotkeys?: boolean;
  /** Opts out of remembering the user's mute preference across sessions. */
  noMutedPref?: boolean;
  /** Opts out of remembering the user's subtitles-language preference across sessions. */
  noSubtitlesLangPref?: boolean;
  /** Opts out of remembering the user's volume preference across sessions. */
  noVolumePref?: boolean;
  /** The language the controller resolved for its UI text, after applying any language preference. */
  resolvedLang?: string;
  /** Whether the user has interacted with the controller yet (affects autoplay-adjacent UI). */
  userInteractive?: boolean;
}

const AudioPlayerImpl = lazyPart<AudioPlayerProps>((m) => m.AudioPlayer);

/**
 * The settled-failure stand-in for the `LazyEngineBoundary` above — rendered
 * once the `media-chrome` load has genuinely failed, never while it is still
 * pending (that stays `Skeleton`, via the `Suspense fallback` below). A
 * loading skeleton left in place after a settled failure reads as "still
 * loading, forever" (loading-states.md) — this is a terminal state, so it
 * gets a real (if compact) notice instead, sized to the same `h-10` slot so
 * nothing shifts when the boundary trips.
 */
const AudioPlayerMissing = ({ className, error }: { className?: string; error: unknown }) => {
  const { t } = useLocale();
  const isPeerMissing = isOptionalPeerMissing(error);
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 text-caption text-muted-foreground",
        className,
      )}
      role={isPeerMissing ? "status" : "alert"}
    >
      <VolumeOffIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">
        {isPeerMissing
          ? t("ai.error.engineMissingBody", {
              feature: t("ai.audioPlayer.feature"),
              packages: "media-chrome",
            })
          : t("ai.audioPlayer.renderError")}
      </span>
    </div>
  );
};

export const AudioPlayer = ({ className, ...props }: AudioPlayerProps) => (
  <LazyEngineBoundary
    renderMissing={(error) => <AudioPlayerMissing className={className} error={error} />}
  >
    <Suspense fallback={<Skeleton className={cn("h-10 w-full rounded-md", className)} />}>
      <AudioPlayerImpl className={className} data-slot="audio-player" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerElementProps = Omit<ComponentProps<"audio">, "src"> &
  (
    | {
        data: SpeechResult["audio"];
      }
    | {
        src: string;
      }
  );

export const AudioPlayerElement = ({ ...props }: AudioPlayerElementProps) => (
  // oxlint-disable-next-line eslint-plugin-jsx-a11y(media-has-caption) -- audio player captions are provided by consumer
  <audio
    data-slot="audio-player-element"
    slot="media"
    src={"src" in props ? props.src : `data:${props.data.mediaType};base64,${props.data.base64}`}
    {...props}
  />
);

export type AudioPlayerControlBarProps = AudioPlayerPartProps;

const AudioPlayerControlBarImpl = lazyPart<AudioPlayerControlBarProps>(
  (m) => m.AudioPlayerControlBar,
);

export const AudioPlayerControlBar = (props: AudioPlayerControlBarProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerControlBarImpl data-slot="audio-player-control-bar" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerPlayButtonProps = AudioPlayerPartProps;

const AudioPlayerPlayButtonImpl = lazyPart<AudioPlayerPlayButtonProps>(
  (m) => m.AudioPlayerPlayButton,
);

export const AudioPlayerPlayButton = (props: AudioPlayerPlayButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerPlayButtonImpl data-slot="audio-player-play-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export interface AudioPlayerSeekBackwardButtonProps extends AudioPlayerPartProps {
  /** Skip distance in seconds. Mirrors the element's own default (10). */
  seekOffset?: number;
}

const AudioPlayerSeekBackwardButtonImpl = lazyPart<AudioPlayerSeekBackwardButtonProps>(
  (m) => m.AudioPlayerSeekBackwardButton,
);

export const AudioPlayerSeekBackwardButton = (props: AudioPlayerSeekBackwardButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerSeekBackwardButtonImpl data-slot="audio-player-seek-backward-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

/**
 * Primitive-typed extra members restored per issue #101's round-2 validation
 * (R2) — same technique and same inferred-from-naming caveat as
 * `AudioPlayerProps` above. Deliberately still narrowed out:
 * `keysUsed` (here typed `string[]`, unlike the controller's own `string`
 * member of the same name — an array is not primitive) and the DOM/method
 * members `disable`/`enable`/`handleClick`/`tooltipEl`/`tooltipPlacement`.
 */
export interface AudioPlayerSeekForwardButtonProps extends AudioPlayerPartProps {
  /** Whether the button is disabled. */
  disabled?: boolean;
  /** ID of the `<media-controller>` element this button controls, when it is not an ancestor. */
  mediaController?: string;
  /** The media's current playback time (seconds), as reflected by the controller's media store. */
  mediaCurrentTime?: number;
  /** Skip distance in seconds. Mirrors the element's own default (10). */
  seekOffset?: number;
  /** Suppresses the built-in hover tooltip on this button. */
  noTooltip?: boolean;
  /** Prevents the button's default click handling (for a consumer that wants to fully own the behavior). */
  preventClick?: boolean;
}

const AudioPlayerSeekForwardButtonImpl = lazyPart<AudioPlayerSeekForwardButtonProps>(
  (m) => m.AudioPlayerSeekForwardButton,
);

export const AudioPlayerSeekForwardButton = (props: AudioPlayerSeekForwardButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerSeekForwardButtonImpl data-slot="audio-player-seek-forward-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerTimeDisplayProps = AudioPlayerPartProps;

const AudioPlayerTimeDisplayImpl = lazyPart<AudioPlayerTimeDisplayProps>(
  (m) => m.AudioPlayerTimeDisplay,
);

export const AudioPlayerTimeDisplay = (props: AudioPlayerTimeDisplayProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerTimeDisplayImpl data-slot="audio-player-time-display" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerTimeRangeProps = AudioPlayerPartProps;

const AudioPlayerTimeRangeImpl = lazyPart<AudioPlayerTimeRangeProps>((m) => m.AudioPlayerTimeRange);

export const AudioPlayerTimeRange = (props: AudioPlayerTimeRangeProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerTimeRangeImpl data-slot="audio-player-time-range" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerDurationDisplayProps = AudioPlayerPartProps;

const AudioPlayerDurationDisplayImpl = lazyPart<AudioPlayerDurationDisplayProps>(
  (m) => m.AudioPlayerDurationDisplay,
);

export const AudioPlayerDurationDisplay = (props: AudioPlayerDurationDisplayProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerDurationDisplayImpl data-slot="audio-player-duration-display" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerMuteButtonProps = AudioPlayerPartProps;

const AudioPlayerMuteButtonImpl = lazyPart<AudioPlayerMuteButtonProps>(
  (m) => m.AudioPlayerMuteButton,
);

export const AudioPlayerMuteButton = (props: AudioPlayerMuteButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerMuteButtonImpl data-slot="audio-player-mute-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerVolumeRangeProps = AudioPlayerPartProps;

const AudioPlayerVolumeRangeImpl = lazyPart<AudioPlayerVolumeRangeProps>(
  (m) => m.AudioPlayerVolumeRange,
);

export const AudioPlayerVolumeRange = (props: AudioPlayerVolumeRangeProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerVolumeRangeImpl data-slot="audio-player-volume-range" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);
