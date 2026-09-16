"use client";

/**
 * Words and time formatting shared by the replay parts (RM-065).
 */
import { useCallback } from "react";
import { useLocale } from "@elabs-ai/components-ui";
import type { ReplayTimeline } from "../core/replay-timeline";
import { formatDurationMs } from "../process-map/map-model";

/** Every user-visible string in `ProcessReplay` and its parts. `{…}` are placeholders. */
export interface ProcessReplayLabels {
  /** Accessible name of the replay region. */
  region: string;
  /** Accessible name of the map canvas. */
  map: string;
  play: string;
  pause: string;
  /** The time slider. */
  time: string;
  /** The speed select. */
  speed: string;
  /** `{speed}` — one speed option. */
  speedOption: string;
  /** `{time}`, `{count}` — the readout and the paused announcement. */
  readout: string;
  /** Announced while the replay runs (the time is not announced frame by frame). */
  playing: string;
  /** `{duration}` — a playhead in synchronized-start mode. */
  relativeTime: string;
  congestionTitle: string;
  /** `{source}`, `{target}`. */
  congestionTransition: string;
  /** `{peak}`, `{time}` — one ranked transition. */
  congestionPeak: string;
  /** `{source}`, `{target}`, `{peak}`, `{time}` — the one-line summary of the busiest transition. */
  congestionSummary: string;
  congestionEmpty: string;
  loading: string;
  empty: string;
  emptyBody: string;
}

/** The shipped English labels. */
export const PROCESS_REPLAY_DEFAULT_LABELS: Readonly<ProcessReplayLabels> = Object.freeze({
  region: "Process replay",
  map: "Process map with case tokens",
  play: "Play replay",
  pause: "Pause replay",
  time: "Replay time",
  speed: "Playback speed",
  speedOption: "{speed}×",
  readout: "{time} · {count} in flight",
  playing: "Replay playing",
  relativeTime: "+{duration}",
  congestionTitle: "Most congested transitions",
  congestionTransition: "{source} → {target}",
  congestionPeak: "Peak {peak} cases at {time}",
  congestionSummary: "Busiest: {source} → {target}, {peak} cases at {time}",
  congestionEmpty: "No case moves along a transition.",
  loading: "Preparing the replay…",
  empty: "No cases to replay",
  emptyBody: "Load an event log with at least one case to replay it.",
});

/**
 * Formats a playhead: a medium date and short time in wall-clock mode, `+duration` since each
 * case's start in synchronized-start mode.
 */
export function useReplayTimeFormatter(
  timeline: Pick<ReplayTimeline, "origin" | "synchronizedStart">,
  relativeTemplate: string = PROCESS_REPLAY_DEFAULT_LABELS.relativeTime,
): (t: number) => string {
  const { formatDate } = useLocale();
  const { origin, synchronizedStart } = timeline;
  return useCallback(
    (t: number) =>
      synchronizedStart
        ? relativeTemplate.replace("{duration}", formatDurationMs(t))
        : formatDate(origin + t, { dateStyle: "medium", timeStyle: "short" }),
    [formatDate, origin, synchronizedStart, relativeTemplate],
  );
}
