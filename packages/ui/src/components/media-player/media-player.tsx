"use client";

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent as ReactFocusEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Captions,
  CaptionsOff,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { formatMediaTime } from "../../lib/format-media-time";
import { mergeRefs } from "../../lib/merge-refs";
import { AspectRatio } from "../aspect-ratio";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { IconButton, type IconButtonProps } from "../icon-button";
import { useLocale } from "../locale-provider";
import { Skeleton } from "../skeleton";
import { Slider, type SliderProps } from "../slider";
import { StatePanel, type StatePanelProps } from "../state-panel";
import { resolveMediaShortcut, type MediaKind } from "./media-shortcuts";
import { useMediaState, type MediaActions, type MediaState } from "./use-media-state";

export type { MediaKind };

/** Controls hide after this long without pointer movement (overlay placement, while playing). */
const AUTOHIDE_MS = 3000;

// ---------------------------------------------------------------------------
// Context — state / actions / meta
// ---------------------------------------------------------------------------

export type MediaPlayerControlsPlacement = "docked" | "overlay";

export interface MediaPlayerMeta {
  kind: MediaKind;
  mediaRef: RefObject<HTMLMediaElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  /** Callback ref `MediaPlayerElement` binds the `<video>`/`<audio>` with. */
  attach: (element: HTMLMediaElement | null) => void;
  /** A `MediaPlayerControls` bar is mounted (clicking a video toggles playback only then). */
  hasControls: boolean;
  /** `false` only while overlay controls are auto-hidden. */
  controlsVisible: boolean;
  /** Keep the controls shown (a portalled menu is open); pass `false` to release. */
  pinControls: (pinned: boolean) => void;
  /**
   * Registers a `MediaPlayerControls` bar; returns the unregister function.
   * The root needs to know whether a bar exists (click-to-play) and whether it
   * floats (autohide).
   */
  registerControls: (placement: MediaPlayerControlsPlacement) => () => void;
  /** Keyboard focus is inside the controls (keeps overlay controls shown). */
  setKeyboardInControls: (inside: boolean) => void;
  /** Stable id for the player (aria wiring). */
  id: string;
}

export interface MediaPlayerContextValue {
  state: MediaState;
  actions: MediaActions;
  meta: MediaPlayerMeta;
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

/** Read the surrounding `MediaPlayer`'s state, actions and meta. */
export function useMediaPlayer(): MediaPlayerContextValue {
  const ctx = use(MediaPlayerContext);
  if (!ctx) {
    throw new Error("useMediaPlayer must be used inside a <MediaPlayer>.");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface MediaPlayerProps extends HTMLAttributes<HTMLDivElement> {
  /** Which element `MediaPlayerElement` renders. */
  kind: MediaKind;
  /** The region's accessible name. Default "Audio player" / "Video player". */
  label?: string;
  /** Handle the player keyboard map (Space/k, ←/→, j/l, ↑/↓, m, f, 0–9). Default `true`. */
  keyboardShortcuts?: boolean;
}

/**
 * The player root: owns the element subscription (`useMediaState`), the
 * keyboard map and the overlay-controls autohide, and shares them with every
 * `MediaPlayer*` part. A video root is a resting surface (bordered, rounded,
 * focusable); an audio root is transparent — the bubble or card around it is
 * the surface.
 */
export const MediaPlayer = forwardRef<HTMLDivElement, MediaPlayerProps>(function MediaPlayer(
  {
    kind,
    label,
    keyboardShortcuts = true,
    className,
    children,
    onKeyDown,
    onPointerMove,
    onPointerLeave,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const id = useId();
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [element, setElement] = useState<HTMLMediaElement | null>(null);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<MediaPlayerControlsPlacement | null>(null);
  const [pinned, setPinned] = useState(false);
  const [keyboardInControls, setKeyboardInControls] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const attach = useCallback((node: HTMLMediaElement | null) => {
    mediaRef.current = node;
    setElement(node);
  }, []);
  const rootRefs = useMemo(() => mergeRefs(ref, rootRef, setRootElement), [ref]);

  const { state, actions } = useMediaState(element, { fullscreenTarget: rootElement });

  // Cleanup only: an idle timer must not fire into an unmounted player.
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  const registerControls = useCallback((next: MediaPlayerControlsPlacement) => {
    setPlacement(next);
    return () => setPlacement(null);
  }, []);

  const controlsVisible =
    placement !== "overlay" ||
    state.paused ||
    state.ended ||
    state.error !== null ||
    pinned ||
    keyboardInControls ||
    pointerActive;

  const meta = useMemo<MediaPlayerMeta>(
    () => ({
      kind,
      mediaRef,
      rootRef,
      attach,
      hasControls: placement !== null,
      controlsVisible,
      pinControls: setPinned,
      registerControls,
      setKeyboardInControls,
      id,
    }),
    [kind, attach, placement, controlsVisible, registerControls, id],
  );
  const value = useMemo(() => ({ state, actions, meta }), [state, actions, meta]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (!keyboardShortcuts) return;
    const shortcut = resolveMediaShortcut(event, {
      isRootTarget: event.target === event.currentTarget,
      kind,
      duration: state.duration,
    });
    if (!shortcut) return;
    event.preventDefault();
    switch (shortcut.type) {
      case "toggle":
        actions.toggle();
        break;
      case "seekBy":
        actions.seekBy(shortcut.seconds);
        break;
      case "volumeBy":
        actions.setVolume((mediaRef.current?.volume ?? 1) + shortcut.delta);
        break;
      case "toggleMute":
        actions.toggleMute();
        break;
      case "toggleFullscreen":
        actions.toggleFullscreen();
        break;
      case "seekToPercent":
        actions.seek((state.duration * shortcut.percent) / 100);
        break;
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    onPointerMove?.(event);
    if (placement !== "overlay") return;
    setPointerActive(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setPointerActive(false), AUTOHIDE_MS);
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    onPointerLeave?.(event);
    clearTimeout(idleTimer.current);
    setPointerActive(false);
  }

  const isVideo = kind === "video";
  const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true";
  // A sound-only file in a <video> is named for what it plays.
  const soundOnly = state.hasPicture === false;

  return (
    <MediaPlayerContext value={value}>
      <div
        data-slot="media-player"
        data-kind={kind}
        data-paused={state.paused ? "true" : "false"}
        data-controls={controlsVisible ? "visible" : "hidden"}
        data-fullscreen={state.fullscreen ? "" : undefined}
        data-picture={state.hasPicture === null ? undefined : String(state.hasPicture)}
        role="region"
        aria-label={
          label ?? t(isVideo && !soundOnly ? "ui.media.videoPlayer" : "ui.media.audioPlayer")
        }
        // A hidden (decorative) video must not be a tab stop.
        tabIndex={isVideo ? (hidden ? -1 : 0) : undefined}
        {...props}
        ref={rootRefs}
        className={cn(
          "group/media relative",
          isVideo &&
            "flex flex-col overflow-hidden rounded-lg border bg-card shadow-xs focus-ring data-[fullscreen]:justify-center data-[fullscreen]:rounded-none data-[fullscreen]:border-0",
          className,
        )}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </div>
    </MediaPlayerContext>
  );
});

// ---------------------------------------------------------------------------
// Viewport + element
// ---------------------------------------------------------------------------

export interface MediaPlayerViewportProps extends HTMLAttributes<HTMLDivElement> {
  /** Width ÷ height. Omit to size by the video's intrinsic dimensions. */
  aspectRatio?: number;
}

/**
 * The video's box: the `bg-muted` letterbox that `MediaPlayerElement`,
 * `MediaPlayerLoading`, `MediaPlayerError` and overlay controls position in.
 */
export const MediaPlayerViewport = forwardRef<HTMLDivElement, MediaPlayerViewportProps>(
  function MediaPlayerViewport({ aspectRatio, className, children, ...props }, ref) {
    return (
      <div
        data-slot="media-player-viewport"
        {...props}
        ref={ref}
        className={cn(
          "relative w-full bg-muted group-data-[fullscreen]/media:min-h-0 group-data-[fullscreen]/media:flex-1",
          className,
        )}
      >
        {aspectRatio ? <AspectRatio ratio={aspectRatio}>{children}</AspectRatio> : children}
      </div>
    );
  },
);

export const mediaPlayerElementVariants = cva("block size-full", {
  variants: {
    fit: {
      contain: "object-contain",
      cover: "object-cover",
    },
  },
  defaultVariants: { fit: "contain" },
});

export interface MediaPlayerElementProps
  extends
    Omit<ComponentPropsWithoutRef<"video">, "controls">,
    VariantProps<typeof mediaPlayerElementVariants> {}

/**
 * The `<video>` or `<audio>` itself (by the root's `kind`). Carries `src` and
 * any `<source>`/`<track>` children. The native `controls` attribute is never
 * set — `MediaPlayerControls` is the UI. Clicking a video that has a controls
 * bar toggles playback.
 */
export const MediaPlayerElement = forwardRef<HTMLMediaElement, MediaPlayerElementProps>(
  function MediaPlayerElement({ fit, className, onClick, children, ...rest }, ref) {
    const { actions, meta } = useMediaPlayer();
    const refs = useMemo(() => mergeRefs<HTMLMediaElement>(ref, meta.attach), [ref, meta.attach]);
    // Untyped callers: the native controls attribute would double the UI.
    const { controls: _controls, ...props } = rest as typeof rest & { controls?: boolean };

    if (meta.kind === "audio") {
      const { poster: _poster, playsInline: _playsInline, ...audioProps } = props;
      return (
        // oxlint-disable-next-line eslint-plugin-jsx-a11y(media-has-caption) -- captions are the consumer's `<track>` children
        <audio
          data-slot="media-player-element"
          {...audioProps}
          ref={refs as (node: HTMLAudioElement | null) => void}
          className={className}
          onClick={onClick}
        >
          {children}
        </audio>
      );
    }

    function handleClick(event: ReactMouseEvent<HTMLVideoElement>) {
      onClick?.(event);
      if (!event.defaultPrevented && meta.hasControls) actions.toggle();
    }

    return (
      // oxlint-disable-next-line eslint-plugin-jsx-a11y(media-has-caption) -- captions are the consumer's `<track>` children (`Video`'s `tracks`)
      <video
        data-slot="media-player-element"
        {...props}
        ref={refs as (node: HTMLVideoElement | null) => void}
        className={cn(mediaPlayerElementVariants({ fit }), className)}
        onClick={handleClick}
      >
        {children}
      </video>
    );
  },
);

// ---------------------------------------------------------------------------
// Controls bar
// ---------------------------------------------------------------------------

/**
 * The bar is a named container (`@container/controls`), so a composition can hide
 * its secondary parts by the bar's own width — `hidden @lg/controls:inline-flex` —
 * instead of the viewport's; the presets do exactly that.
 */
export const mediaPlayerControlsVariants = cva(
  "@container/controls flex w-full min-w-0 items-center gap-1",
  {
    variants: {
      placement: {
        docked: "relative",
        overlay:
          "absolute inset-x-0 bottom-0 z-10 bg-background/80 p-2 backdrop-blur transition-opacity duration-base ease-standard group-data-[controls=hidden]/media:pointer-events-none group-data-[controls=hidden]/media:opacity-0",
      },
    },
    defaultVariants: { placement: "docked" },
  },
);

export interface MediaPlayerControlsProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof mediaPlayerControlsVariants> {}

function focusIsVisible(target: EventTarget): boolean {
  try {
    return target instanceof Element && target.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * The control bar. `docked` (default) is a row in the frame under the video —
 * opaque, never hidden; `overlay` floats over the bottom of the video and
 * auto-hides while playing (pointer idle 3 s, or pointer gone), staying shown
 * while paused, on error, while a menu is open or while a control inside has
 * keyboard focus.
 */
export const MediaPlayerControls = forwardRef<HTMLDivElement, MediaPlayerControlsProps>(
  function MediaPlayerControls({ placement, className, onFocus, onBlur, ...props }, ref) {
    const { meta } = useMediaPlayer();
    const resolved = placement ?? "docked";
    const { registerControls, setKeyboardInControls } = meta;

    // Registration, not state sync: the root learns a bar exists and how it sits.
    useLayoutEffect(() => registerControls(resolved), [registerControls, resolved]);

    function handleFocus(event: ReactFocusEvent<HTMLDivElement>) {
      onFocus?.(event);
      if (focusIsVisible(event.target)) setKeyboardInControls(true);
    }

    function handleBlur(event: ReactFocusEvent<HTMLDivElement>) {
      onBlur?.(event);
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
        setKeyboardInControls(false);
      }
    }

    return (
      <div
        data-slot="media-player-controls"
        data-placement={resolved}
        {...props}
        ref={ref}
        className={cn(
          mediaPlayerControlsVariants({ placement: resolved }),
          meta.kind === "video" && resolved === "docked" && "bg-background px-2 py-1.5",
          className,
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

// ---------------------------------------------------------------------------
// Icon controls
// ---------------------------------------------------------------------------

/** Props for the icon-button parts: an `IconButton` whose label and glyph the part owns. */
export type MediaPlayerButtonProps = Omit<IconButtonProps, "label" | "icon">;

export const MediaPlayerPlayButton = forwardRef<HTMLButtonElement, MediaPlayerButtonProps>(
  function MediaPlayerPlayButton({ onClick, size = "icon-sm", ...props }, ref) {
    const { t } = useLocale();
    const { state, actions } = useMediaPlayer();
    const label = state.ended
      ? t("ui.media.replay")
      : state.paused
        ? t("ui.media.play")
        : t("ui.media.pause");
    const Icon = state.ended ? RotateCcw : state.paused ? Play : Pause;
    return (
      <IconButton
        data-slot="media-player-play-button"
        data-paused={state.paused ? "true" : "false"}
        size={size}
        {...props}
        ref={ref}
        label={label}
        icon={<Icon aria-hidden="true" />}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) actions.toggle();
        }}
      />
    );
  },
);

export interface MediaPlayerSeekButtonProps extends MediaPlayerButtonProps {
  /** Seconds to jump; negative seeks backward. */
  offset: number;
}

export const MediaPlayerSeekButton = forwardRef<HTMLButtonElement, MediaPlayerSeekButtonProps>(
  function MediaPlayerSeekButton({ offset, onClick, size = "icon-sm", ...props }, ref) {
    const { t } = useLocale();
    const { actions } = useMediaPlayer();
    const backward = offset < 0;
    const count = Math.abs(offset);
    const Icon = backward ? SkipBack : SkipForward;
    return (
      <IconButton
        data-slot="media-player-seek-button"
        data-direction={backward ? "backward" : "forward"}
        size={size}
        {...props}
        ref={ref}
        label={t(backward ? "ui.media.seekBackward" : "ui.media.seekForward", { count })}
        icon={<Icon aria-hidden="true" />}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) actions.seekBy(offset);
        }}
      />
    );
  },
);

export const MediaPlayerMuteButton = forwardRef<HTMLButtonElement, MediaPlayerButtonProps>(
  function MediaPlayerMuteButton({ onClick, size = "icon-sm", ...props }, ref) {
    const { t } = useLocale();
    const { state, actions } = useMediaPlayer();
    const silent = state.muted || state.volume === 0;
    const Icon = silent ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;
    return (
      <IconButton
        data-slot="media-player-mute-button"
        data-muted={silent ? "true" : "false"}
        size={size}
        {...props}
        ref={ref}
        label={silent ? t("ui.media.unmute") : t("ui.media.mute")}
        icon={<Icon aria-hidden="true" />}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) actions.toggleMute();
        }}
      />
    );
  },
);

export const MediaPlayerFullscreenButton = forwardRef<HTMLButtonElement, MediaPlayerButtonProps>(
  function MediaPlayerFullscreenButton({ onClick, size = "icon-sm", ...props }, ref) {
    const { t } = useLocale();
    const { state, actions, meta } = useMediaPlayer();
    // Nothing to enlarge when the file is sound only.
    if (meta.kind !== "video" || !state.canFullscreen) return null;
    const Icon = state.fullscreen ? Minimize : Maximize;
    return (
      <IconButton
        data-slot="media-player-fullscreen-button"
        size={size}
        {...props}
        ref={ref}
        label={state.fullscreen ? t("ui.media.exitFullscreen") : t("ui.media.enterFullscreen")}
        icon={<Icon aria-hidden="true" />}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) actions.toggleFullscreen();
        }}
      />
    );
  },
);

export const MediaPlayerPipButton = forwardRef<HTMLButtonElement, MediaPlayerButtonProps>(
  function MediaPlayerPipButton({ onClick, size = "icon-sm", ...props }, ref) {
    const { t } = useLocale();
    const { state, actions, meta } = useMediaPlayer();
    if (meta.kind !== "video" || !state.canPip || state.hasPicture === false) return null;
    return (
      <IconButton
        data-slot="media-player-pip-button"
        size={size}
        {...props}
        ref={ref}
        label={state.pip ? t("ui.media.exitPip") : t("ui.media.enterPip")}
        icon={<PictureInPicture2 aria-hidden="true" />}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) actions.togglePip();
        }}
      />
    );
  },
);

export const MediaPlayerCaptionsButton = forwardRef<HTMLButtonElement, MediaPlayerButtonProps>(
  function MediaPlayerCaptionsButton({ onClick, size = "icon-sm", ...props }, ref) {
    const { t } = useLocale();
    const { state, actions } = useMediaPlayer();
    const first = state.textTracks[0];
    if (!first) return null;
    const on = state.activeTextTrack !== null;
    const Icon = on ? Captions : CaptionsOff;
    return (
      <IconButton
        data-slot="media-player-captions-button"
        data-active={on ? "true" : "false"}
        size={size}
        {...props}
        ref={ref}
        label={on ? t("ui.media.captionsOff") : t("ui.media.captionsOn")}
        icon={<Icon aria-hidden="true" />}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) actions.setTextTrack(on ? null : first.id);
        }}
      />
    );
  },
);

// ---------------------------------------------------------------------------
// Sliders + time
// ---------------------------------------------------------------------------

export type MediaPlayerTimeSliderProps = Omit<
  SliderProps,
  "value" | "defaultValue" | "min" | "max" | "onValueChange" | "onValueCommit"
>;

/**
 * The scrubber. Shows a local value while dragging and seeks on commit;
 * buffered ranges ahead of the playhead draw on the rail beneath. Disabled
 * until the duration is known and finite.
 */
export const MediaPlayerTimeSlider = forwardRef<HTMLSpanElement, MediaPlayerTimeSliderProps>(
  function MediaPlayerTimeSlider({ className, step = 0.1, disabled, ...props }, ref) {
    const { t } = useLocale();
    const { state, actions } = useMediaPlayer();
    const [pending, setPending] = useState<number | null>(null);
    const finite = Number.isFinite(state.duration) && state.duration > 0;
    const duration = finite ? state.duration : 0;
    const current = Math.min(pending ?? state.currentTime, duration);
    const hours = duration >= 3600;
    const percent = (seconds: number) => (finite ? (seconds / duration) * 100 : 0);

    return (
      <div className={cn("relative flex min-w-0 flex-1 items-center", className)}>
        <div
          data-slot="media-player-buffered"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted"
        >
          {state.buffered.map((range) => {
            const start = Math.max(range.start, current);
            if (range.end <= start) return null;
            return (
              <span
                key={`${range.start}-${range.end}`}
                className="absolute inset-y-0 bg-muted-foreground/30"
                style={{ left: `${percent(start)}%`, width: `${percent(range.end - start)}%` }}
              />
            );
          })}
        </div>
        <Slider
          data-slot="media-player-time-slider"
          {...props}
          ref={ref}
          // The rail above paints the track ground (and the buffered ranges);
          // the slider's own track goes clear so both show through.
          className="[&>span:first-child]:bg-transparent"
          min={0}
          max={finite ? duration : 1}
          step={step}
          value={[current]}
          disabled={disabled || !finite}
          aria-label={props["aria-label"] ?? t("ui.media.seek")}
          aria-valuetext={t("ui.media.timeValue", {
            current: formatMediaTime(current, { hours }),
            duration: formatMediaTime(duration, { hours }),
          })}
          onValueChange={([next]) => setPending(next ?? 0)}
          onValueCommit={([next]) => {
            setPending(null);
            actions.seek(next ?? 0);
          }}
        />
      </div>
    );
  },
);

export type MediaPlayerVolumeSliderProps = MediaPlayerTimeSliderProps;

export const MediaPlayerVolumeSlider = forwardRef<HTMLSpanElement, MediaPlayerVolumeSliderProps>(
  function MediaPlayerVolumeSlider({ className, step = 0.05, ...props }, ref) {
    const { t } = useLocale();
    const { state, actions } = useMediaPlayer();
    const volume = state.muted ? 0 : state.volume;
    return (
      <Slider
        data-slot="media-player-volume-slider"
        {...props}
        ref={ref}
        className={cn("w-20 shrink-0", className)}
        min={0}
        max={1}
        step={step}
        value={[volume]}
        aria-label={props["aria-label"] ?? t("ui.media.volume")}
        aria-valuetext={t("ui.media.volumeValue", { percent: Math.round(volume * 100) })}
        onValueChange={([next]) => actions.setVolume(next ?? 0)}
      />
    );
  },
);

export interface MediaPlayerTimeProps extends HTMLAttributes<HTMLSpanElement> {
  /** `current` playhead · `duration` total · `remaining` time left (prefixed "-"). Default `current`. */
  mode?: "current" | "duration" | "remaining";
}

export const MediaPlayerTime = forwardRef<HTMLSpanElement, MediaPlayerTimeProps>(
  function MediaPlayerTime({ mode = "current", className, ...props }, ref) {
    const { state } = useMediaPlayer();
    const duration = Number.isFinite(state.duration) ? state.duration : 0;
    const hours = duration >= 3600;
    const text =
      mode === "duration"
        ? formatMediaTime(duration, { hours })
        : mode === "remaining"
          ? `-${formatMediaTime(Math.max(0, duration - state.currentTime), { hours })}`
          : formatMediaTime(state.currentTime, { hours });
    return (
      <span
        data-slot="media-player-time"
        data-mode={mode}
        {...props}
        ref={ref}
        className={cn(
          "shrink-0 whitespace-nowrap px-1 text-meta tabular-nums text-muted-foreground",
          className,
        )}
      >
        {text}
      </span>
    );
  },
);

// ---------------------------------------------------------------------------
// Playback rate
// ---------------------------------------------------------------------------

const DEFAULT_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export interface MediaPlayerPlaybackRateMenuProps extends Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "children" | "asChild"
> {
  /** Offered speeds. Default `[0.5, 0.75, 1, 1.25, 1.5, 2]`. */
  rates?: readonly number[];
}

export const MediaPlayerPlaybackRateMenu = forwardRef<
  HTMLButtonElement,
  MediaPlayerPlaybackRateMenuProps
>(function MediaPlayerPlaybackRateMenu(
  { rates = DEFAULT_RATES, className, variant = "ghost", size = "sm", ...props },
  ref,
) {
  const { t } = useLocale();
  const { state, actions, meta } = useMediaPlayer();
  const rate = state.playbackRate;
  return (
    <DropdownMenu onOpenChange={meta.pinControls}>
      <DropdownMenuTrigger asChild>
        <Button
          data-slot="media-player-playback-rate"
          variant={variant}
          size={size}
          {...props}
          ref={ref}
          className={cn("shrink-0 px-2 tabular-nums", className)}
          aria-label={t("ui.media.playbackRateLabel", { rate })}
        >
          {t("ui.media.playbackRateValue", { rate })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={t("ui.media.playbackRate")}>
        <DropdownMenuRadioGroup
          value={String(rate)}
          onValueChange={(next) => actions.setPlaybackRate(Number(next))}
        >
          {rates.map((option) => (
            <DropdownMenuRadioItem key={option} value={String(option)} className="tabular-nums">
              {t("ui.media.playbackRateValue", { rate: option })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ---------------------------------------------------------------------------
// Loading + error rungs
// ---------------------------------------------------------------------------

export type MediaPlayerLoadingProps = HTMLAttributes<HTMLDivElement>;

/**
 * Not-ready UI. Video before metadata (no poster, not `preload="none"`) → a
 * layout-shaped `Skeleton` over the viewport; playing but starved → a centred
 * spinner disc. One `sr-only` status region announces either.
 */
export const MediaPlayerLoading = forwardRef<HTMLDivElement, MediaPlayerLoadingProps>(
  function MediaPlayerLoading({ className, ...props }, ref) {
    const { t } = useLocale();
    const { state, meta } = useMediaPlayer();
    const noSource = state.networkState === 3;
    const preMetadata =
      meta.kind === "video" &&
      state.readyState < 1 &&
      !state.poster &&
      !state.error &&
      !noSource &&
      state.preload !== "none";
    const buffering = state.waiting && !state.paused && !state.error;
    const message = preMetadata ? t("loading") : buffering ? t("ui.media.buffering") : "";
    return (
      <div
        data-slot="media-player-loading"
        data-state={preMetadata ? "loading" : buffering ? "buffering" : "idle"}
        {...props}
        ref={ref}
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center",
          className,
        )}
      >
        {preMetadata ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
        {buffering ? (
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-background/80"
          >
            <Loader2 className="size-5 animate-spin text-foreground motion-reduce:animate-none" />
          </span>
        ) : null}
        <span role="status" aria-live="polite" className="sr-only">
          {message}
        </span>
      </div>
    );
  },
);

export type MediaPlayerErrorProps = Pick<
  StatePanelProps,
  "title" | "description" | "actions" | "size" | "titleAs"
> &
  HTMLAttributes<HTMLDivElement>;

/**
 * The error rung: a compact error `StatePanel` (`role="alert"`), rendered only
 * once the element reports a terminal `MediaError`. Over a video it covers the
 * viewport; in an audio player it sits in flow.
 */
export const MediaPlayerError = forwardRef<HTMLDivElement, MediaPlayerErrorProps>(
  function MediaPlayerError(
    { title, description, actions, size = "sm", titleAs, className, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const { state, meta } = useMediaPlayer();
    if (!state.error) return null;
    return (
      <div
        data-slot="media-player-error"
        {...props}
        ref={ref}
        className={cn(
          meta.kind === "video" && "absolute inset-0 z-10 flex items-center justify-center p-4",
          className,
        )}
      >
        <StatePanel
          kind="error"
          size={size}
          titleAs={titleAs}
          title={title ?? t("ui.media.errorTitle")}
          description={description ?? t("ui.media.errorDescription")}
          actions={actions}
        />
      </div>
    );
  },
);
