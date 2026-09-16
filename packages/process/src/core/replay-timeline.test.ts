import { describe, expect, it } from "vitest";

import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import fixture from "./fixtures/order-to-cash-small.json";
import {
  REPLAY_MAX_FRAMES,
  REPLAY_TOKEN_RADIUS_RANGE,
  rankReplayCongestion,
  replayFrameAt,
  replayTimeline,
  replayTokenRadius,
} from "./replay-timeline";
import type { EventLog } from "./types";

const log = fixture as EventLog;
const HOUR = 3_600_000;
const edge = (source: string, target: string) => `${source}${EDGE_KEY_SEPARATOR}${target}`;

/**
 * The five traces of `order-to-cash-small.json`, as hours after each case's own start
 * (every event is atomic, so an edge runs from one event to the next):
 *
 *   case-1  CO 0 · CC 1 · AO 2 · SO 3 · SI 4 · RP 5
 *   case-2  CO 0 · CC 1 · AO 2 · SO 3 · SI 4 · RP 5
 *   case-3  CO 0 · CC 1 · RO 2
 *   case-4  CO 0 · CC 1 · AmO 2 · CC 3 · AO 4 · SO 5 · SI 6 · RP 7
 *   case-5  CO 0 · CC 2 · AO 4 · SI 6 · SO 8 · RP 10
 *
 * A case is in flight at hour h when one of its edges spans [enter, exit) and contains h.
 * Counted by hand from the five lines above:
 *
 *   h        0  1  2  3  4  5  6  7  8  9  10
 *   c1       1  1  1  1  1  -  -  -  -  -  -
 *   c2       1  1  1  1  1  -  -  -  -  -  -
 *   c3       1  1  -  -  -  -  -  -  -  -  -
 *   c4       1  1  1  1  1  1  1  -  -  -  -
 *   c5       1  1  1  1  1  1  1  1  1  1  -
 *   tokens   5  5  4  4  4  2  2  1  1  1  0
 */
const SYNCHRONIZED_TOKENS_PER_HOUR = [5, 5, 4, 4, 4, 2, 2, 1, 1, 1, 0];

describe("replayTimeline — synchronized start", () => {
  const timeline = replayTimeline(log, { bucketMs: HOUR, synchronizedStart: true });

  it("aligns all five cases' first activity to t = 0", () => {
    expect(timeline.origin).toBe(0);
    const firstMoves = new Map<string, number>();
    for (const s of timeline.segments) {
      if (!firstMoves.has(s.caseId)) firstMoves.set(s.caseId, s.enterAt);
    }
    expect([...firstMoves.keys()].sort()).toEqual([
      "case-1",
      "case-2",
      "case-3",
      "case-4",
      "case-5",
    ]);
    expect([...firstMoves.values()]).toEqual([0, 0, 0, 0, 0]);
    expect(timeline.frames[0]!.tokens.map((token) => token.edgeId)).toEqual(
      Array(5).fill(edge("Create Order", "Check Credit")),
    );
  });

  it("matches the hand-computed token count per bucket", () => {
    expect(timeline.duration).toBe(10 * HOUR);
    expect(timeline.frames.map((frame) => frame.t)).toEqual(
      SYNCHRONIZED_TOKENS_PER_HOUR.map((_, h) => h * HOUR),
    );
    expect(timeline.frames.map((frame) => frame.tokens.length)).toEqual(
      SYNCHRONIZED_TOKENS_PER_HOUR,
    );
  });

  it("counts distinct cases per edge per bucket as congestion", () => {
    expect(timeline.frames[0]!.congestion).toEqual({ [edge("Create Order", "Check Credit")]: 5 });
    // Hour 1: case-5 is still on its first edge; the rest have moved on.
    expect(timeline.frames[1]!.congestion).toEqual({
      [edge("Create Order", "Check Credit")]: 1,
      [edge("Check Credit", "Approve Order")]: 2,
      [edge("Check Credit", "Reject Order")]: 1,
      [edge("Check Credit", "Amend Order")]: 1,
    });
    expect(timeline.peakCongestion).toBe(5);
  });

  it("ranks the busiest transition first", () => {
    const ranked = rankReplayCongestion(timeline, 3);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]).toMatchObject({
      edgeId: edge("Create Order", "Check Credit"),
      source: "Create Order",
      target: "Check Credit",
      peak: 5,
      peakAt: 0,
    });
  });
});

describe("replayTimeline — wall clock", () => {
  const timeline = replayTimeline(log, { bucketMs: HOUR });

  it("starts at the earliest event and runs to the latest", () => {
    expect(timeline.origin).toBe(Date.parse("2026-01-05T09:00:00.000Z"));
    // 2026-01-05T09:00 to 2026-01-09T19:00.
    expect(timeline.duration).toBe(106 * HOUR);
    expect(timeline.frames).toHaveLength(107);
  });

  it("never has more than one case in flight — each starts on its own day", () => {
    expect(Math.max(...timeline.frames.map((frame) => frame.tokens.length))).toBe(1);
    expect(timeline.frames[24]!.tokens).toEqual([
      { caseId: "case-2", edgeId: edge("Create Order", "Check Credit"), progress: 0 },
    ]);
  });
});

describe("replayFrameAt", () => {
  const timeline = replayTimeline(log, { bucketMs: HOUR, synchronizedStart: true });

  it("interpolates progress between buckets and reads the containing bucket's congestion", () => {
    const frame = replayFrameAt(timeline, 1.5 * HOUR);
    expect(frame.tokens.find((token) => token.caseId === "case-5")).toEqual({
      caseId: "case-5",
      edgeId: edge("Create Order", "Check Credit"),
      progress: 0.75,
    });
    expect(frame.congestion).toEqual(timeline.frames[1]!.congestion);
  });

  it("clamps the playhead", () => {
    expect(replayFrameAt(timeline, -5).t).toBe(0);
    expect(replayFrameAt(timeline, 99 * HOUR).t).toBe(10 * HOUR);
    expect(replayFrameAt(timeline, Number.NaN).t).toBe(0);
  });
});

describe("edge cases", () => {
  it("answers one empty frame for an empty log", () => {
    const timeline = replayTimeline({ events: [] });
    expect(timeline.duration).toBe(0);
    expect(timeline.frames).toEqual([{ t: 0, tokens: [], congestion: {} }]);
    expect(rankReplayCongestion(timeline)).toEqual([]);
  });

  it("widens a bucket that would exceed the frame cap", () => {
    const timeline = replayTimeline(log, { bucketMs: 1 });
    expect(timeline.frames.length).toBeLessThanOrEqual(REPLAY_MAX_FRAMES);
  });

  it("defaults to about 300 frames", () => {
    expect(replayTimeline(log).frames.length).toBe(301);
  });

  it("scales token radius by area within the range", () => {
    const [min, max] = REPLAY_TOKEN_RADIUS_RANGE;
    expect(replayTokenRadius(0, 5)).toBe(min);
    expect(replayTokenRadius(5, 5)).toBe(max);
    expect(replayTokenRadius(1, 4)).toBeCloseTo(min + (max - min) * 0.5);
    expect(replayTokenRadius(3, 0)).toBe(min);
  });
});
