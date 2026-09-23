"use client";

import {
  forwardRef,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cva, type VariantProps } from "class-variance-authority";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "../../lib/cn";
import { formatMediaTime } from "../../lib/format-media-time";
import { useLocale } from "../locale-provider";
import { useMediaPlayer } from "./media-player";
import "./media-player.css";

const DEFAULT_BARS = 48;
/** The shortest bar, as a share of the height — silence still reads as a bar. */
const MIN_PEAK = 0.08;
/** Bars either side of the playhead that pulse while it plays. */
const PULSE_REACH = 2;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Fit `peaks` (0–1) to `count` bars: shrinking keeps the loudest peak of each
 * bucket (a transient never vanishes), stretching repeats the nearest one.
 */
export function resamplePeaks(peaks: readonly number[], count: number): number[] {
  if (count <= 0 || peaks.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i * peaks.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / count));
    let loudest = Number.NEGATIVE_INFINITY;
    for (let j = start; j < end; j += 1) loudest = Math.max(loudest, peaks[j] ?? 0);
    out.push(clamp01(loudest));
  }
  return out;
}

/** FNV-1a — a stable 32-bit hash of the seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — a small seeded generator, so the same seed draws the same shape. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stand-in shape for a file whose real peaks the app has not supplied: a
 * slow swell with speech-like jitter, drawn from `seed` (the source), so each
 * recording looks different and never shifts between renders. Values 0.15–1.
 */
export function standInPeaks(seed: string, count: number): number[] {
  const random = seeded(hash(seed));
  const phase = random() * Math.PI * 2;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const swell = 0.55 + 0.45 * Math.sin(phase + (i / Math.max(1, count)) * Math.PI * 3);
    const jitter = 0.35 + 0.65 * random();
    out.push(Math.min(1, Math.max(0.15, swell * jitter)));
  }
  return out;
}

export const mediaPlayerWaveformVariants = cva(
  // Radix positions the thumb in a wrapper span with no height: stretch it so
  // the playhead spans the bars.
  "relative flex min-w-0 touch-none select-none items-center [&>span:has(>[role=slider])]:inset-y-0",
  {
    variants: {
      placement: {
        /** A row in a control bar, in place of the time slider. */
        inline: "h-8 flex-1",
        /** Fills a sound-only file's viewport, where the picture would be. */
        stage: "absolute inset-x-4 inset-y-6 sm:inset-x-8",
        /** Runs along the bottom of cover art. */
        strip: "absolute inset-x-0 bottom-0 h-16 bg-background/80 px-4 py-3 backdrop-blur",
      },
    },
    defaultVariants: { placement: "inline" },
  },
);

export interface MediaPlayerWaveformProps
  extends
    Omit<
      ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
      "value" | "defaultValue" | "min" | "max" | "onValueChange" | "onValueCommit" | "children"
    >,
    VariantProps<typeof mediaPlayerWaveformVariants> {
  /**
   * The recording's shape, 0–1, any length — resampled to `bars`. The app
   * supplies it (e.g. from `AudioBuffer.getChannelData`); the player never
   * fetches or decodes. Omit for a stand-in shape drawn from `seed`.
   */
  peaks?: readonly number[];
  /** How many bars to draw. Default 48. */
  bars?: number;
  /** Seeds the stand-in shape — pass the source so each file looks different. Default: the player's id. */
  seed?: string;
  /** Announced instead of "Seek". */
  "aria-label"?: string;
}

/**
 * The scrubber drawn as the recording's waveform: bars fill with the accent
 * as it plays, the thin playhead is the slider thumb (arrows, Home/End,
 * PageUp/PageDown; announced as "0:05 of 0:20"), and the bars at the playhead
 * pulse while it plays — never under reduced motion. Use it in place of
 * `MediaPlayerTimeSlider`, not beside it, so there is one scrubber.
 */
export const MediaPlayerWaveform = forwardRef<
  ElementRef<typeof SliderPrimitive.Root>,
  MediaPlayerWaveformProps
>(function MediaPlayerWaveform(
  {
    peaks,
    bars = DEFAULT_BARS,
    seed,
    placement,
    className,
    step = 0.1,
    disabled,
    "aria-label": ariaLabel,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const { state, actions, meta } = useMediaPlayer();
  const reducedMotion = useReducedMotion();
  const [pending, setPending] = useState<number | null>(null);
  const finite = Number.isFinite(state.duration) && state.duration > 0;
  const duration = finite ? state.duration : 0;
  const current = Math.min(pending ?? state.currentTime, duration);
  const hours = duration >= 3600;
  const fraction = finite ? current / duration : 0;
  const count = Math.max(1, Math.round(bars));
  const head = Math.min(count - 1, Math.floor(fraction * count));
  const pulsing = finite && !state.paused && !state.ended && !reducedMotion;
  const shape = useMemo(
    () => (peaks ? resamplePeaks(peaks, count) : standInPeaks(seed ?? meta.id, count)),
    [peaks, count, seed, meta.id],
  );
  const resolved = placement ?? "inline";

  return (
    <SliderPrimitive.Root
      data-slot="media-player-waveform"
      data-placement={resolved}
      {...props}
      ref={ref}
      className={cn(mediaPlayerWaveformVariants({ placement: resolved }), className)}
      min={0}
      max={finite ? duration : 1}
      step={step}
      value={[current]}
      disabled={disabled || !finite}
      onValueChange={([next]) => setPending(next ?? 0)}
      onValueCommit={([next]) => {
        setPending(null);
        actions.seek(next ?? 0);
      }}
    >
      <SliderPrimitive.Track className="relative flex h-full w-full items-center gap-px sm:gap-0.5">
        {/* Bars are positional — a fixed-length list, the shape fixed per file. */}
        {Array.from({ length: count }).map((_, index) => {
          const peak = shape[index] ?? 0;
          const played = (index + 0.5) / count <= fraction;
          const active = pulsing && Math.abs(index - head) <= PULSE_REACH;
          return (
            <span
              key={index}
              aria-hidden="true"
              data-slot="media-player-waveform-bar"
              data-played={played ? "" : undefined}
              data-active={active ? "" : undefined}
              className="min-w-0 flex-1 rounded-full bg-border-strong data-[played]:bg-primary"
              style={{
                height: `${Number((Math.max(MIN_PEAK, peak) * 100).toFixed(1))}%`,
                // Neighbours pulse out of step, so the playhead reads as sound, not a blink.
                animationDelay: active ? `${(index - head + PULSE_REACH) * 90}ms` : undefined,
              }}
            />
          );
        })}
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ?? t("ui.media.seek")}
        aria-valuetext={t("ui.media.timeValue", {
          current: formatMediaTime(current, { hours }),
          duration: formatMediaTime(duration, { hours }),
        })}
        className="block h-full w-1 rounded-full bg-foreground shadow-xs focus-ring disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
});
