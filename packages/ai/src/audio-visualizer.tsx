"use client";

import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

/**
 * brand-ui is a presentation layer (D5, docs/DECISIONS.md §D5): this component
 * never calls `getUserMedia`, never owns an `AudioContext`, and starts nothing
 * on mount. It draws whatever `levels` a parent — who already has a
 * `MediaStream`/`AnalyserNode` — passes it, frame by frame. The analyser
 * plumbing, when a consumer genuinely wants it, is the separate, opt-in
 * `useAudioLevel` export in `./use-audio-level` — never something this
 * component reaches for itself. See issue #21.
 */

export type AudioVisualizerVariant = "bars" | "wave";
export type AudioVisualizerLevelState = "idle" | "silent" | "active";

/**
 * Localized status announced when the discretized level state changes, one
 * key per `AudioVisualizerLevelState`. Typed as a `Record` (not a bare
 * template string) so a state value added later without a matching key here
 * fails to typecheck — same convention as `Persona`'s `PERSONA_STATE_KEYS`.
 */
const AUDIO_VISUALIZER_STATE_KEYS: Record<AudioVisualizerLevelState, string> = {
  active: "ai.audioVisualizer.active",
  idle: "ai.audioVisualizer.idle",
  silent: "ai.audioVisualizer.silent",
};

// Fixed internal render resolution — the canvas is stretched to its CSS box
// (see the className below), so this is a rendering-quality knob, not a
// layout one. Picking a fixed size up front means the draw loop never has to
// measure the DOM (no `getBoundingClientRect`/`offsetHeight` in the hot path).
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 64;
const DEFAULT_BAR_COUNT = 32;
const DEFAULT_SENSITIVITY = 1;
const DEFAULT_SILENCE_THRESHOLD = 0.04;
/**
 * Fraction of the remaining distance to the target level closed per animation
 * frame — a fixed-cost lerp, never a growing history buffer, so the per-frame
 * cost stays O(barCount) no matter how long the session has run.
 */
const SMOOTHING_FACTOR = 0.35;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Nearest-neighbor resample of an arbitrary-length sample array to `count`
 * entries, applying `sensitivity` and clamping to [0, 1]. Never allocates
 * more than `count` numbers, independent of `levels.length`. */
function resampleLevels(levels: number[], count: number, sensitivity: number): number[] {
  if (levels.length === 0) {
    return new Array(count).fill(0);
  }
  const out = new Array<number>(count);
  for (let i = 0; i < count; i += 1) {
    const sourceIndex = Math.min(levels.length - 1, Math.floor((i / count) * levels.length));
    out[i] = clamp01((levels[sourceIndex] ?? 0) * sensitivity);
  }
  return out;
}

function drawBars(ctx: CanvasRenderingContext2D, levels: number[], color: string) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const n = levels.length;
  if (n === 0) return;
  const gap = 2;
  const barWidth = Math.max(1, (width - gap * (n - 1)) / n);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i += 1) {
    const level = levels[i] ?? 0;
    const barHeight = Math.max(2, level * height);
    const x = i * (barWidth + gap);
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
  }
}

/** Draws the CURRENT sample snapshot as a filled envelope (no history/scroll —
 * see the reduced-motion note on `AudioVisualizer` for why this shape never
 * accumulates state over time). */
function drawWave(ctx: CanvasRenderingContext2D, levels: number[], color: string) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const n = levels.length;
  if (n < 2) return;
  const midY = height / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * width;
    const y = midY - clamp01(levels[i] ?? 0) * midY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = (i / (n - 1)) * width;
    const y = midY + clamp01(levels[i] ?? 0) * midY;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Resolves the bar/wave fill colour from tokens at draw time. `getComputedStyle`
 * resolves a CSS custom property's VALUE — unlike `getBoundingClientRect`/
 * `offsetHeight`, it never forces layout, so this is not a "layout read". */
function resolveFillColor(canvas: HTMLCanvasElement): string {
  const styles = getComputedStyle(canvas);
  const token =
    styles.getPropertyValue("--color-primary").trim() ||
    styles.getPropertyValue("--primary").trim();
  return token || styles.color || "currentColor";
}

export interface AudioVisualizerProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * Normalized 0–1 amplitude samples for the CURRENT frame — one per bar (or
   * per sample point for `variant="wave"`). Update this from your own
   * analyser polling loop (or the opt-in `useAudioLevel` hook) on every frame
   * you want reflected; the component never touches the microphone itself.
   * Any length works — samples are resampled to `barCount`.
   */
  levels?: number[];
  /** No stream connected yet — renders the idle baseline instead of `levels`. */
  loading?: boolean;
  /** `"bars"` (default) — a bar chart. `"wave"` — a filled envelope through the
   * current samples. Both encode level as HEIGHT, never as hue alone. */
  variant?: AudioVisualizerVariant;
  /** Multiplies each level before clamping to [0, 1] — turn up for a quiet input. */
  sensitivity?: number;
  /** Number of bars/points drawn. */
  barCount?: number;
  /** Average level, 0–1, at/above which the status text reads "active". */
  silenceThreshold?: number;
  /**
   * Visually-hidden text announced when the discretized level state changes.
   * Defaults to a localized label ("No input detected" / "Microphone
   * active" / …). Pass `null` when the consuming surface already renders its
   * own live region, so assistive tech is not told twice.
   */
  statusLabel?: ReactNode | null;
}

/**
 * Live mic-level / waveform meter. Canvas-drawn (one element, no per-bar DOM,
 * so a `levels` prop updating every frame never costs React a 32-element
 * reconciliation) and driven entirely by the `levels` prop — see the module
 * doc comment for the presentation-layer boundary this enforces.
 *
 * The canvas is decorative (`aria-hidden`); the level itself is announced
 * through a throttled `role="status"` text alternative — see `statusLabel`.
 *
 * Reduced motion: under `prefers-reduced-motion` (or while `loading`) the
 * component skips its internal smoothing animation entirely and paints the
 * raw `levels` directly on every prop change — a static bar chart of the
 * current levels, never a freeze mid-interpolation.
 */
export const AudioVisualizer = forwardRef<HTMLDivElement, AudioVisualizerProps>(
  function AudioVisualizer(
    {
      className,
      levels = [],
      loading = false,
      variant = "bars",
      sensitivity = DEFAULT_SENSITIVITY,
      barCount = DEFAULT_BAR_COUNT,
      silenceThreshold = DEFAULT_SILENCE_THRESHOLD,
      statusLabel,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const prefersReducedMotion = useReducedMotion();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const displayLevelsRef = useRef<number[]>([]);
    const rafRef = useRef<number | null>(null);
    const bucketRef = useRef<AudioVisualizerLevelState>("idle");
    const [levelState, setLevelState] = useState<AudioVisualizerLevelState>("idle");
    // Bumped whenever `data-theme` actually changes on the document — see the
    // MutationObserver effect below. `resolveFillColor` cannot read a token
    // value that isn't there yet: a theme-setting provider (e.g.
    // `ThemeProvider`) applies `data-theme` in its OWN mount effect, and React
    // fires a CHILD's effects before its parent's, so this component's paint
    // effect otherwise runs first and reads whatever the un-themed `:root`
    // fallback resolves to. Re-running the paint once the attribute lands
    // (rather than only on the next animation frame, which the `loading`/
    // reduced-motion path never schedules) is what fixes both the first paint
    // AND a theme change after mount.
    const [themeRevision, setThemeRevision] = useState(0);

    const sampleCount = Math.max(2, barCount);

    const targetLevels = useMemo(
      () => resampleLevels(loading ? [] : levels, sampleCount, sensitivity),
      [levels, loading, sampleCount, sensitivity],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      const ctx = canvas.getContext("2d");

      // The announced status always reflects the CURRENT target level,
      // synchronously and independent of the smoothing animation below — a
      // screen-reader user is never a lerp-frame behind the real signal, even
      // though the visual bars/wave may still be easing toward it.
      const average =
        targetLevels.reduce((sum, value) => sum + value, 0) / (targetLevels.length || 1);
      const bucket: AudioVisualizerLevelState = loading
        ? "idle"
        : average >= silenceThreshold
          ? "active"
          : "silent";
      if (bucket !== bucketRef.current) {
        bucketRef.current = bucket;
        setLevelState(bucket);
      }

      const paint = (paintLevels: number[]) => {
        if (!ctx) return;
        const color = resolveFillColor(canvas);
        if (variant === "wave") drawWave(ctx, paintLevels, color);
        else drawBars(ctx, paintLevels, color);
      };

      if (prefersReducedMotion || loading) {
        displayLevelsRef.current = targetLevels;
        paint(targetLevels);
        return undefined;
      }

      // Seed (or reset, on a `barCount` change) the smoothing buffer and paint
      // this frame SYNCHRONOUSLY — the canvas and status text reflect the
      // current `levels` immediately on mount/update, rather than waiting for
      // the first `requestAnimationFrame` callback. The rAF loop below only
      // has to run to carry the smoothing motion forward from here.
      if (displayLevelsRef.current.length !== targetLevels.length) {
        displayLevelsRef.current = targetLevels.slice();
      }
      paint(displayLevelsRef.current);

      const tick = () => {
        const display = displayLevelsRef.current;
        const next = display.map(
          (value, i) => value + ((targetLevels[i] ?? 0) - value) * SMOOTHING_FACTOR,
        );
        displayLevelsRef.current = next;
        paint(next);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
      // `themeRevision` is the trigger; `resolveFillColor` re-reads the token
      // live, so the value itself never needs to be a dependency.
    }, [targetLevels, variant, loading, prefersReducedMotion, silenceThreshold, themeRevision]);

    // Track `data-theme` (whatever sets it — `ThemeProvider`'s own mount
    // effect, a later `setTheme` call, or Storybook's theme decorator) and
    // re-run the paint effect above once it actually changes. Same fix as
    // `InteractiveTerminal`'s identical `data-theme` race.
    useEffect(() => {
      if (typeof document === "undefined") return undefined;
      const observer = new MutationObserver(() => setThemeRevision((r) => r + 1));
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => observer.disconnect();
    }, []);

    const label =
      statusLabel === null ? null : (statusLabel ?? t(AUDIO_VISUALIZER_STATE_KEYS[levelState]));

    return (
      <div
        className={cn("flex flex-col gap-1", className)}
        data-slot="audio-visualizer"
        ref={ref}
        {...props}
      >
        <canvas
          aria-hidden="true"
          className="h-16 w-full rounded-md bg-muted"
          data-slot="audio-visualizer-canvas"
          height={CANVAS_HEIGHT}
          ref={canvasRef}
          width={CANVAS_WIDTH}
        />
        {label !== null && (
          <span
            className="sr-only"
            data-slot="audio-visualizer-status"
            role="status"
            aria-live="polite"
          >
            {label}
          </span>
        )}
      </div>
    );
  },
);
