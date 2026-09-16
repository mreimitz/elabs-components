"use client";

/**
 * ProcessReplay — cases replayed as tokens moving over the process map (RM-065).
 *
 * A composition, not a new map: `ProcessMap` (read-only — no `onSelect`), with the tokens
 * handed to its own transition edges through {@link ProcessReplayTokensContext}. The edges
 * draw them with `@elabs-ai/components-flow`'s `FlowEdgeTokens`, which owns every SVG mark;
 * this component owns only the clock.
 *
 * - **Time.** `replayTimeline` buckets the log; the playhead is a controllable `time`, driven
 *   by a `requestAnimationFrame` loop while `playing`. At 1× the whole timeline plays in
 *   {@link REPLAY_PLAYBACK_MS}. Reaching the end pauses.
 * - **Congestion without colour.** One token per in-flight case, so a busy edge carries more
 *   tokens; each token's radius grows with its edge's congestion in the current bucket
 *   (`replayTokenRadius`). {@link CongestionHeat} states the ranking in words beside the map.
 *   The weighted-edge value ramp is deliberately not used.
 * - **Motion.** Never starts on its own under reduced motion: `defaultPlaying` and a
 *   parent's `playing` are both held until the reader presses play. The tokens then jump
 *   rather than glide (the flow primitive drops its transition).
 * - **Text alternative.** The tokens are `aria-hidden`. One polite live region announces the
 *   playhead and the in-flight case count whenever the replay is paused or scrubbed — not
 *   frame by frame while it plays.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { StatePanel } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import type { FlowEdgeToken, FlowLayoutDirection } from "@elabs-ai/components-flow";
import { replayFrameAt, replayTimeline, replayTokenRadius } from "../core/replay-timeline";
import type { EventLog, ProcessGraph } from "../core/types";
import type { ProcessMetricSpec } from "../process-map/map-model";
import { ProcessMap } from "../process-map/process-map";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import { CongestionHeat } from "./congestion-heat";
import { ReplayControls } from "./replay-controls";
import {
  PROCESS_REPLAY_DEFAULT_LABELS,
  useReplayTimeFormatter,
  type ProcessReplayLabels,
} from "./replay-format";
import { ProcessReplayTokensContext, type ProcessReplayTokens } from "./replay-tokens-context";
import { useControllableValue } from "./use-controllable-value";

/** Wall-clock length of a full replay at 1×, in ms. */
export const REPLAY_PLAYBACK_MS = 30_000;

/** The metric the map paints when none is given: case frequency on both marks. */
export const PROCESS_REPLAY_DEFAULT_METRIC: ProcessMetricSpec = Object.freeze({
  node: "absolute_case",
  edge: "absolute",
}) as ProcessMetricSpec;

/** Props for {@link ProcessReplay}. `onSelect` is not offered: the map is read-only. */
export interface ProcessReplayProps extends HTMLAttributes<HTMLDivElement> {
  /** The discovered graph to replay over. */
  graph: ProcessGraph;
  /** The log the graph came from — tokens need per-case timing, not just the aggregate. */
  log: EventLog;
  /** Align every case's start to `t = 0` instead of the wall clock. @default false */
  synchronizedStart?: boolean;
  /** Bucket width in ms for congestion. @default the log span / 300 */
  bucketMs?: number;
  /** Which readings the nodes and edges print. @default case frequency */
  metric?: ProcessMetricSpec;
  /** @default "TB" */
  direction?: FlowLayoutDirection;
  /** Controlled playing state. Held while reduced motion is on until the reader presses play. */
  playing?: boolean;
  /** Initial playing state when uncontrolled. Ignored under reduced motion. @default false */
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Controlled playhead, ms relative to the timeline origin. */
  time?: number;
  /** @default 0 */
  defaultTime?: number;
  onTimeChange?: (time: number) => void;
  /** Controlled playback multiplier. */
  speed?: number;
  /** @default 1 */
  defaultSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  /** How many transitions the congestion list ranks. @default 5 */
  congestionLimit?: number;
  /** No log yet. Renders the loading panel. */
  loading?: boolean;
  /** Override any user-visible string. */
  labels?: Partial<ProcessReplayLabels>;
}

/**
 * The process replay.
 *
 * @example
 * ```tsx
 * const graph = useMemo(() => discoverGraph(log), [log]);
 * <ProcessReplay graph={graph} log={log} synchronizedStart />
 * ```
 */
export const ProcessReplay = forwardRef<HTMLDivElement, ProcessReplayProps>(function ProcessReplay(
  {
    graph,
    log,
    synchronizedStart = false,
    bucketMs,
    metric = PROCESS_REPLAY_DEFAULT_METRIC,
    direction,
    playing: playingProp,
    defaultPlaying = false,
    onPlayingChange,
    time: timeProp,
    defaultTime = 0,
    onTimeChange,
    speed: speedProp,
    defaultSpeed = 1,
    onSpeedChange,
    congestionLimit = 5,
    loading = false,
    labels: labelOverrides,
    className,
    ...props
  },
  ref,
) {
  const labels = useMemo<ProcessReplayLabels>(
    () => ({ ...PROCESS_REPLAY_DEFAULT_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const reducedMotion = useReducedMotion();
  const timeline = useMemo(
    () => replayTimeline(log, { bucketMs, synchronizedStart }),
    [log, bucketMs, synchronizedStart],
  );
  const { duration } = timeline;

  const [playingRequested, setPlaying] = useControllableValue(
    playingProp,
    defaultPlaying,
    onPlayingChange,
  );
  const [rawTime, setTime] = useControllableValue(timeProp, defaultTime, onTimeChange);
  const [speed, setSpeed] = useControllableValue(speedProp, defaultSpeed, onSpeedChange);
  const time = Math.min(Math.max(rawTime, 0), duration);

  // Reduced motion: nothing moves until the reader asks for it with the play button.
  const [readerStarted, setReaderStarted] = useState(false);
  const playing = playingRequested && duration > 0 && (!reducedMotion || readerStarted);

  const timeRef = useRef(time);
  useLayoutEffect(() => {
    timeRef.current = time;
  });

  useEffect(() => {
    if (!playing) return;
    let handle = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last !== null) {
        const advance = ((now - last) * duration * speed) / REPLAY_PLAYBACK_MS;
        const next = Math.min(timeRef.current + advance, duration);
        timeRef.current = next;
        setTime(next);
        if (next >= duration) {
          setPlaying(false);
          return;
        }
      }
      last = now;
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, duration, speed, setTime, setPlaying]);

  const handlePlayingChange = useCallback(
    (next: boolean) => {
      if (next) {
        setReaderStarted(true);
        if (timeRef.current >= duration) setTime(0);
      }
      setPlaying(next);
    },
    [duration, setPlaying, setTime],
  );

  const frame = useMemo(() => replayFrameAt(timeline, time), [timeline, time]);
  const tokensByEdge = useMemo<ProcessReplayTokens>(() => {
    const map = new Map<string, FlowEdgeToken[]>();
    for (const token of frame.tokens) {
      let list = map.get(token.edgeId);
      if (!list) map.set(token.edgeId, (list = []));
      list.push({
        id: token.caseId,
        progress: token.progress,
        radius: replayTokenRadius(frame.congestion[token.edgeId] ?? 0, timeline.peakCongestion),
      });
    }
    return map;
  }, [frame, timeline.peakCongestion]);

  const formatTime = useReplayTimeFormatter(timeline, labels.relativeTime);
  const inFlight = frame.tokens.length;

  // The map element is memoized on its own inputs, so a playhead tick re-renders only the
  // edges that read the tokens context — never the layout or the model.
  const map = useMemo(
    () => <ProcessMap graph={graph} metric={metric} direction={direction} label={labels.map} />,
    [graph, metric, direction, labels.map],
  );

  if (loading) {
    return (
      <div
        ref={ref}
        data-slot="process-replay"
        data-state="loading"
        className={className}
        {...props}
      >
        <StatePanel kind="loading" title={labels.loading} />
      </div>
    );
  }

  if (timeline.segments.length === 0 && duration === 0) {
    return (
      <div ref={ref} data-slot="process-replay" data-state="empty" className={className} {...props}>
        <StatePanel kind="empty" title={labels.empty} description={labels.emptyBody} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={labels.region}
      data-slot="process-replay"
      data-state={playing ? "playing" : "paused"}
      data-synchronized-start={synchronizedStart ? "true" : undefined}
      className={cn("flex size-full min-h-0 flex-col gap-3", className)}
      {...props}
    >
      <ReplayControls
        playing={playing}
        onPlayingChange={handlePlayingChange}
        time={time}
        onTimeChange={setTime}
        duration={duration}
        step={timeline.bucketMs}
        speed={speed}
        onSpeedChange={setSpeed}
        inFlight={inFlight}
        formatTime={formatTime}
        labels={labels}
      />
      <p role="status" aria-live="polite" data-slot="process-replay-status" className="sr-only">
        {playing
          ? labels.playing
          : fillLabel(labels.readout, { time: formatTime(time), count: inFlight })}
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div data-slot="process-replay-map" data-in-flight={inFlight} className="min-h-64 flex-1">
          <ProcessReplayTokensContext value={tokensByEdge}>{map}</ProcessReplayTokensContext>
        </div>
        <CongestionHeat
          timeline={timeline}
          limit={congestionLimit}
          labels={labels}
          className="shrink-0 lg:w-72"
        />
      </div>
    </div>
  );
});
