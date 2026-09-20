"use client";

/**
 * ReplayControls — the transport bar of `ProcessReplay` (RM-065).
 *
 * Presentational and fully controlled: a play/pause button, a time slider and a speed select,
 * all native-keyboard components from `@elabs-ai/components-ui` (Space/Enter on the button,
 * arrows/Home/End/PageUp/PageDown on the slider, arrows and typeahead in the select), plus a
 * visible readout of the playhead and the in-flight case count. The readout is NOT a live
 * region — `ProcessReplay` owns the one announcement per region.
 */
import { forwardRef, useMemo, type HTMLAttributes } from "react";
import { Pause, Play } from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import { PROCESS_REPLAY_DEFAULT_LABELS, type ProcessReplayLabels } from "./replay-format";

/** The speed multipliers the select offers. */
export const REPLAY_SPEEDS = Object.freeze([0.5, 1, 2, 4] as const);

/** Props for {@link ReplayControls}. */
export interface ReplayControlsProps extends HTMLAttributes<HTMLDivElement> {
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  /** Playhead, ms relative to the timeline origin. */
  time: number;
  onTimeChange: (time: number) => void;
  /** Timeline length in ms — the slider's maximum. */
  duration: number;
  /** Slider step in ms (one bucket). */
  step: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  /** Cases in flight at {@link time}. */
  inFlight: number;
  /** Formats a playhead for the readout and the slider's value text. */
  formatTime: (time: number) => string;
  /** Disable every control (an empty timeline). */
  disabled?: boolean;
  labels?: Partial<ProcessReplayLabels>;
}

/** Play/pause, time slider, speed select and a readout. */
export const ReplayControls = forwardRef<HTMLDivElement, ReplayControlsProps>(
  function ReplayControls(
    {
      playing,
      onPlayingChange,
      time,
      onTimeChange,
      duration,
      step,
      speed,
      onSpeedChange,
      inFlight,
      formatTime,
      disabled = false,
      labels: labelOverrides,
      className,
      ...props
    },
    ref,
  ) {
    const { formatNumber } = useLocale();
    const labels = useMemo<ProcessReplayLabels>(
      () => ({ ...PROCESS_REPLAY_DEFAULT_LABELS, ...labelOverrides }),
      [labelOverrides],
    );
    const timeText = formatTime(time);
    const PlayIcon = playing ? Pause : Play;

    return (
      <div
        ref={ref}
        data-slot="replay-controls"
        data-playing={playing ? "true" : "false"}
        className={cn("flex flex-wrap items-center gap-3", className)}
        {...props}
      >
        <Button
          data-slot="replay-controls-play"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={playing ? labels.pause : labels.play}
          onClick={() => onPlayingChange(!playing)}
        >
          <PlayIcon aria-hidden="true" />
        </Button>
        <Slider
          data-slot="replay-controls-time"
          className="min-w-40 flex-1"
          min={0}
          max={Math.max(duration, step)}
          step={step}
          value={[time]}
          disabled={disabled}
          aria-label={labels.time}
          aria-valuetext={timeText}
          onValueChange={([next]) => {
            if (next !== undefined) onTimeChange(Math.min(next, duration));
          }}
        />
        {/* A `SelectTrigger` is full-width by default, which in this wrapping row claimed a
            line of its own — a speed picker as wide as the map. Its box is the speed, no more. */}
        <div className="w-24 shrink-0">
          <Select
            value={String(speed)}
            disabled={disabled}
            onValueChange={(value) => onSpeedChange(Number(value))}
          >
            <SelectTrigger
              data-slot="replay-controls-speed"
              className="min-w-20"
              aria-label={labels.speed}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPLAY_SPEEDS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {fillLabel(labels.speedOption, { speed: formatNumber(option) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p
          data-slot="replay-controls-readout"
          className="text-meta text-muted-foreground tabular-nums"
        >
          {fillLabel(labels.readout, { time: timeText, count: formatNumber(inFlight) })}
        </p>
      </div>
    );
  },
);
