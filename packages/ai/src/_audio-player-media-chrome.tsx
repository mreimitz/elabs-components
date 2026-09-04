"use client";

/**
 * The media-chrome half of `AudioPlayer`, split out so it can be `lazy()`-loaded.
 *
 * `media-chrome` declares no `sideEffects`, so a static import from
 * `audio-player.tsx` put the whole custom-element library (and the
 * `media-chrome/react` wrappers that register it) into the entry chunk of every
 * `@elabs-ai/components-ai` consumer — including the vast majority that
 * never render an `AudioPlayer`. Keeping every media-chrome *value* import in
 * this module, reached only through
 * `lazy(() => import("./_audio-player-media-chrome"))`, confines it to its own
 * chunk. `audio-player.tsx` owns the public prop types, and — since issue #101
 * — owns them as OWNED types (`AudioPlayerPartProps` and its ten aliases) that
 * never reference `media-chrome/react`'s own types; this module still imports
 * the REAL media-chrome values (below) and, at the bottom of the file, proves
 * every owned type stays assignable to its real counterpart.
 *
 * See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * @lazy-boundary This module must only ever be reached via `import()`. The gate
 * fails if anything imports it statically, which would put media-chrome back in
 * the entry chunk and make the `lazy()` pointless.
 */
import { Button, ButtonGroup, ButtonGroupText } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
// A NAMED import (`import { MediaController } from "media-chrome/react"`) is a
// static ESM binding a bundler must resolve at build time. Now that
// `media-chrome` is a genuinely optional peer (issue #33), a consumer who has
// not installed it hits that resolution at the worst possible time: Vite's own
// optional-peer-dependency handling swaps in a build-time stub with no
// exports, and Rollup's static named-export check then fails the WHOLE APP
// BUILD — not a runtime error any `.catch()`/error boundary could ever see
// (confirmed against `fixtures/consumer-smoke`'s real Vite build). A namespace
// import defers every one of these to a plain property lookup, which Rollup
// does not statically validate, so the build always succeeds; a genuinely
// missing peer instead resolves the destructured names below to `undefined`,
// and the guard turns that into a render-phase throw `LazyEngineBoundary`
// already catches (see `persona.tsx`'s identical pattern).
import * as MediaChromeReactModule from "media-chrome/react";
import type { ComponentProps, CSSProperties } from "react";

import type {
  AudioPlayerControlBarProps,
  AudioPlayerDurationDisplayProps,
  AudioPlayerMuteButtonProps,
  AudioPlayerPlayButtonProps,
  AudioPlayerProps,
  AudioPlayerSeekBackwardButtonProps,
  AudioPlayerSeekForwardButtonProps,
  AudioPlayerTimeDisplayProps,
  AudioPlayerTimeRangeProps,
  AudioPlayerVolumeRangeProps,
} from "./audio-player";

const {
  MediaControlBar,
  MediaController,
  MediaDurationDisplay,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} = MediaChromeReactModule;

// The peer is genuinely absent (Vite's build-time stub, or any other bundler
// that resolves an optional peer to an empty module) — surface a message
// `isModuleNotFoundMessage` recognizes, so the caller's `renderMissing` still
// gets the actionable "install media-chrome" copy rather than a raw
// "MediaController is not a valid JSX element" crash.
if (!MediaController) {
  throw new Error("Cannot find module 'media-chrome'");
}

export const AudioPlayer = ({ children, style, ...props }: AudioPlayerProps) => (
  <MediaController
    audio
    style={
      {
        "--media-background-color": "transparent",
        "--media-button-icon-height": "1rem",
        "--media-button-icon-width": "1rem",
        "--media-control-background": "transparent",
        "--media-control-hover-background": "var(--color-accent)",
        "--media-control-padding": "0",
        "--media-font": "var(--font-sans)",
        "--media-font-size": "10px",
        "--media-icon-color": "currentColor",
        "--media-preview-time-background": "var(--color-background)",
        "--media-preview-time-border-radius": "var(--radius-md)",
        "--media-preview-time-text-shadow": "none",
        "--media-primary-color": "var(--color-primary)",
        "--media-range-bar-color": "var(--color-primary)",
        "--media-range-track-background": "var(--color-secondary)",
        "--media-secondary-color": "var(--color-secondary)",
        "--media-text-color": "var(--color-foreground)",
        "--media-tooltip-arrow-display": "none",
        "--media-tooltip-background": "var(--color-background)",
        "--media-tooltip-border-radius": "var(--radius-md)",
        ...style,
      } as CSSProperties
    }
    {...props}
  >
    {children}
  </MediaController>
);

export const AudioPlayerControlBar = ({ children, ...props }: AudioPlayerControlBarProps) => (
  <MediaControlBar {...props}>
    <ButtonGroup orientation="horizontal">{children}</ButtonGroup>
  </MediaControlBar>
);

export const AudioPlayerPlayButton = ({ className, ...props }: AudioPlayerPlayButtonProps) => (
  <Button asChild size="icon-sm" variant="outline">
    <MediaPlayButton className={cn("bg-transparent", className)} {...props} />
  </Button>
);

export const AudioPlayerSeekBackwardButton = ({
  seekOffset = 10,
  ...props
}: AudioPlayerSeekBackwardButtonProps) => (
  <Button asChild size="icon-sm" variant="outline">
    <MediaSeekBackwardButton seekOffset={seekOffset} {...props} />
  </Button>
);

export const AudioPlayerSeekForwardButton = ({
  seekOffset = 10,
  ...props
}: AudioPlayerSeekForwardButtonProps) => (
  <Button asChild size="icon-sm" variant="outline">
    <MediaSeekForwardButton seekOffset={seekOffset} {...props} />
  </Button>
);

export const AudioPlayerTimeDisplay = ({ className, ...props }: AudioPlayerTimeDisplayProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaTimeDisplay className={cn("tabular-nums", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerTimeRange = ({ className, ...props }: AudioPlayerTimeRangeProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaTimeRange className={cn("", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerDurationDisplay = ({
  className,
  ...props
}: AudioPlayerDurationDisplayProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaDurationDisplay className={cn("tabular-nums", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerMuteButton = ({ className, ...props }: AudioPlayerMuteButtonProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaMuteButton className={cn("", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerVolumeRange = ({ className, ...props }: AudioPlayerVolumeRangeProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaVolumeRange className={cn("", className)} {...props} />
  </ButtonGroupText>
);

/**
 * Conformance assertions (issue #101): compile-time proof that every OWNED
 * type declared in `audio-player.tsx` stays assignable to its REAL
 * `media-chrome/react` counterpart — this module still has the real values
 * (and therefore the real types) in scope, since it is the one place they are
 * allowed to be (see the module doc comment above). `AssertAssignable`'s type
 * parameter is constrained (`TOwned extends TReal`), so if a future
 * media-chrome release narrows an element's props in a way the owned type no
 * longer satisfies, ONE of these ten lines fails to typecheck — caught by
 * `pnpm --filter @elabs-ai/components-ai typecheck` locally, never shipped as
 * a silent mismatch to a consumer using the real component underneath.
 */
export type AssertAssignable<_TOwned extends TReal, TReal> = true;

export type _AudioPlayerPropsConformance = AssertAssignable<
  AudioPlayerProps,
  Omit<ComponentProps<typeof MediaController>, "audio">
>;
export type _AudioPlayerControlBarPropsConformance = AssertAssignable<
  AudioPlayerControlBarProps,
  ComponentProps<typeof MediaControlBar>
>;
export type _AudioPlayerPlayButtonPropsConformance = AssertAssignable<
  AudioPlayerPlayButtonProps,
  ComponentProps<typeof MediaPlayButton>
>;
export type _AudioPlayerSeekBackwardButtonPropsConformance = AssertAssignable<
  AudioPlayerSeekBackwardButtonProps,
  ComponentProps<typeof MediaSeekBackwardButton>
>;
export type _AudioPlayerSeekForwardButtonPropsConformance = AssertAssignable<
  AudioPlayerSeekForwardButtonProps,
  ComponentProps<typeof MediaSeekForwardButton>
>;
export type _AudioPlayerTimeDisplayPropsConformance = AssertAssignable<
  AudioPlayerTimeDisplayProps,
  ComponentProps<typeof MediaTimeDisplay>
>;
export type _AudioPlayerTimeRangePropsConformance = AssertAssignable<
  AudioPlayerTimeRangeProps,
  ComponentProps<typeof MediaTimeRange>
>;
export type _AudioPlayerDurationDisplayPropsConformance = AssertAssignable<
  AudioPlayerDurationDisplayProps,
  ComponentProps<typeof MediaDurationDisplay>
>;
export type _AudioPlayerMuteButtonPropsConformance = AssertAssignable<
  AudioPlayerMuteButtonProps,
  ComponentProps<typeof MediaMuteButton>
>;
export type _AudioPlayerVolumeRangePropsConformance = AssertAssignable<
  AudioPlayerVolumeRangeProps,
  ComponentProps<typeof MediaVolumeRange>
>;
