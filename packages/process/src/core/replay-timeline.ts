/**
 * replayTimeline — the timing model behind `ProcessReplay` (RM-065).
 *
 * Pure, deterministic, framework-free: no DOM, no clock, no randomness. It turns a log into
 * the moves each case makes along the directly-follows edges of its trace, then answers two
 * questions for any playhead `t`:
 *
 * - **Where is every in-flight case?** A token per case on the edge it is travelling, with
 *   `progress` 0..1 from the source activity's completion to the target activity's start
 *   (the idle time the edge measures). {@link replayFrameAt}.
 * - **How congested is each edge?** The number of distinct cases on it at any moment of the
 *   current bucket (`bucketMs` wide). {@link ReplayFrame.congestion}.
 *
 * Edge ids are `/core`'s `source + EDGE_KEY_SEPARATOR + target` — the same string
 * `discoverGraph`'s transitions and the process map's React Flow edges use.
 *
 * Time is RELATIVE to the timeline's `origin`: `t = 0` is the earliest event in wall-clock
 * mode, or each case's own first activity in `synchronizedStart` mode (Disco's
 * "synchronized start"), where `origin` is `0` and absolute timestamps are meaningless.
 */
import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import { asNormalizedLog, type AnyLog } from "./event-log";

/** One case travelling one edge. Times are relative to {@link ReplayTimeline.origin}. */
export interface ReplaySegment {
  caseId: string;
  /** `source + EDGE_KEY_SEPARATOR + target`. */
  edgeId: string;
  source: string;
  target: string;
  /** The source activity's completion. */
  enterAt: number;
  /** The target activity's start — never before {@link enterAt}. */
  exitAt: number;
}

/** One case's token on one edge at a playhead. */
export interface ReplayFrameToken {
  caseId: string;
  edgeId: string;
  /** 0 at the source end, 1 at the target end. */
  progress: number;
}

/** The replay at one playhead. */
export interface ReplayFrame {
  /** Playhead, relative to the timeline origin. */
  t: number;
  /** One token per in-flight case, in segment order. */
  tokens: ReplayFrameToken[];
  /** Edge id → distinct cases on that edge during the bucket starting at `t`. Zero edges are omitted. */
  congestion: Record<string, number>;
}

/** Options for {@link replayTimeline}. */
export interface ReplayTimelineOptions {
  /** Bucket width in ms. Defaults to {@link defaultReplayBucketMs}. Raised when it would exceed {@link REPLAY_MAX_FRAMES}. */
  bucketMs?: number;
  /** Align every case's first activity to `t = 0`. @default false */
  synchronizedStart?: boolean;
}

/** A replay-ready timeline. */
export interface ReplayTimeline {
  /** Epoch ms of `t = 0` in wall-clock mode; `0` in synchronized-start mode. */
  origin: number;
  /** Last relative instant any case reaches. `0` for an empty log. */
  duration: number;
  /** The bucket width actually used. */
  bucketMs: number;
  synchronizedStart: boolean;
  /** Every edge move of every case, ordered by `enterAt` then case order. */
  segments: ReplaySegment[];
  /** One frame per bucket, `frames[i].t === i * bucketMs`, covering `[0, duration]`. */
  frames: ReplayFrame[];
  /** Highest congestion any edge reaches in any bucket. `0` when nothing moves. */
  peakCongestion: number;
}

/** How many frames {@link defaultReplayBucketMs} aims for. */
export const REPLAY_TARGET_FRAMES = 300;
/** Upper bound on frames; a finer `bucketMs` is widened to respect it. */
export const REPLAY_MAX_FRAMES = 5000;

/** The default bucket: the log span over {@link REPLAY_TARGET_FRAMES}, at least 1 ms. */
export function defaultReplayBucketMs(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Math.max(1, duration / REPLAY_TARGET_FRAMES);
}

/** Every case's edge moves, relative to the chosen origin. */
function buildSegments(
  log: AnyLog,
  synchronizedStart: boolean,
): { origin: number; duration: number; segments: ReplaySegment[] } {
  const { cases } = asNormalizedLog(log);
  if (cases.length === 0) return { origin: 0, duration: 0, segments: [] };
  const origin = synchronizedStart ? 0 : Math.min(...cases.map((c) => c.start));
  const segments: ReplaySegment[] = [];
  let duration = 0;
  for (const trace of cases) {
    const base = synchronizedStart ? trace.start : origin;
    duration = Math.max(duration, trace.end - base);
    for (let i = 1; i < trace.events.length; i++) {
      const from = trace.events[i - 1]!;
      const to = trace.events[i]!;
      const enterAt = from.end - base;
      segments.push({
        caseId: trace.caseId,
        edgeId: `${from.activity}${EDGE_KEY_SEPARATOR}${to.activity}`,
        source: from.activity,
        target: to.activity,
        enterAt,
        exitAt: Math.max(enterAt, to.start - base),
      });
    }
  }
  // Stable: equal `enterAt` keeps case order.
  segments.sort((a, b) => a.enterAt - b.enterAt);
  return { origin, duration, segments };
}

/** Tokens at `t`: a segment is in flight over `[enterAt, exitAt)`. */
function tokensAt(segments: readonly ReplaySegment[], t: number): ReplayFrameToken[] {
  const tokens: ReplayFrameToken[] = [];
  for (const segment of segments) {
    if (segment.enterAt > t) break;
    if (t >= segment.exitAt) continue;
    tokens.push({
      caseId: segment.caseId,
      edgeId: segment.edgeId,
      progress: (t - segment.enterAt) / (segment.exitAt - segment.enterAt),
    });
  }
  return tokens;
}

/** Distinct cases per edge overlapping `[start, end)`. A zero-length move counts where it happens. */
function congestionIn(
  segments: readonly ReplaySegment[],
  start: number,
  end: number,
): Record<string, number> {
  const casesByEdge = new Map<string, Set<string>>();
  for (const segment of segments) {
    if (segment.enterAt >= end) break;
    const overlaps = segment.exitAt > start || segment.enterAt >= start;
    if (!overlaps) continue;
    let cases = casesByEdge.get(segment.edgeId);
    if (!cases) casesByEdge.set(segment.edgeId, (cases = new Set()));
    cases.add(segment.caseId);
  }
  const congestion: Record<string, number> = {};
  for (const [edgeId, cases] of casesByEdge) congestion[edgeId] = cases.size;
  return congestion;
}

/**
 * Bucket a log into replay frames.
 *
 * @example
 * ```ts
 * const timeline = replayTimeline(log, { synchronizedStart: true });
 * const frame = replayFrameAt(timeline, timeline.duration / 2);
 * ```
 */
export function replayTimeline(log: AnyLog, options: ReplayTimelineOptions = {}): ReplayTimeline {
  const synchronizedStart = options.synchronizedStart ?? false;
  const { origin, duration, segments } = buildSegments(log, synchronizedStart);
  const requested =
    options.bucketMs !== undefined && Number.isFinite(options.bucketMs) && options.bucketMs > 0
      ? options.bucketMs
      : defaultReplayBucketMs(duration);
  const bucketMs = Math.max(requested, duration / (REPLAY_MAX_FRAMES - 1));
  const frameCount = Math.floor(duration / bucketMs) + 1;
  const frames: ReplayFrame[] = [];
  let peakCongestion = 0;
  for (let i = 0; i < frameCount; i++) {
    const t = i * bucketMs;
    const congestion = congestionIn(segments, t, t + bucketMs);
    for (const count of Object.values(congestion)) peakCongestion = Math.max(peakCongestion, count);
    frames.push({ t, tokens: tokensAt(segments, t), congestion });
  }
  return { origin, duration, bucketMs, synchronizedStart, segments, frames, peakCongestion };
}

/**
 * The replay at any playhead — tokens at exactly `t` (not snapped), congestion from the
 * bucket containing `t`. `t` is clamped to `[0, duration]`.
 */
export function replayFrameAt(timeline: ReplayTimeline, t: number): ReplayFrame {
  const clamped = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), timeline.duration);
  const bucket = Math.min(Math.floor(clamped / timeline.bucketMs), timeline.frames.length - 1);
  return {
    t: clamped,
    tokens: tokensAt(timeline.segments, clamped),
    congestion: timeline.frames[Math.max(bucket, 0)]?.congestion ?? {},
  };
}

/** One transition in {@link rankReplayCongestion}'s list. */
export interface ReplayCongestionEntry {
  edgeId: string;
  source: string;
  target: string;
  /** Most distinct cases on the edge in one bucket. */
  peak: number;
  /** Relative start of the first bucket reaching {@link peak}. */
  peakAt: number;
  /** Mean congestion over every bucket of the timeline. */
  mean: number;
}

/** Transitions ranked by peak congestion, then mean, then edge id. Edges that never carry a case are omitted. */
export function rankReplayCongestion(
  timeline: ReplayTimeline,
  limit = Number.POSITIVE_INFINITY,
): ReplayCongestionEntry[] {
  const ends = new Map<string, { source: string; target: string }>();
  for (const s of timeline.segments) ends.set(s.edgeId, { source: s.source, target: s.target });
  const byEdge = new Map<string, ReplayCongestionEntry>();
  for (const frame of timeline.frames) {
    for (const [edgeId, count] of Object.entries(frame.congestion)) {
      let entry = byEdge.get(edgeId);
      if (!entry) {
        const { source, target } = ends.get(edgeId)!;
        byEdge.set(edgeId, (entry = { edgeId, source, target, peak: 0, peakAt: 0, mean: 0 }));
      }
      if (count > entry.peak) {
        entry.peak = count;
        entry.peakAt = frame.t;
      }
      entry.mean += count;
    }
  }
  const frameCount = Math.max(timeline.frames.length, 1);
  return [...byEdge.values()]
    .map((entry) => ({ ...entry, mean: entry.mean / frameCount }))
    .sort(
      (a, b) =>
        b.peak - a.peak ||
        b.mean - a.mean ||
        (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0),
    )
    .slice(0, limit);
}

/** Smallest and largest token radius, in px. */
export const REPLAY_TOKEN_RADIUS_RANGE = Object.freeze([3, 8] as const);

/**
 * Token radius for an edge's congestion: the radius above the minimum grows with
 * √(count / peak), so a busier edge's blob grows by area rather than by diameter.
 */
export function replayTokenRadius(congestion: number, peak: number): number {
  const [min, max] = REPLAY_TOKEN_RADIUS_RANGE;
  if (!(peak > 0) || !(congestion > 0)) return min;
  const share = Math.min(congestion / peak, 1);
  return min + (max - min) * Math.sqrt(share);
}
