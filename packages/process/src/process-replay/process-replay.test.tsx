import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverGraph } from "../core/discover-graph";
import { EDGE_KEY_SEPARATOR } from "../core/discover-graph";
import fixture from "../core/fixtures/order-to-cash-small.json";
import type { EventLog } from "../core/types";
import { CongestionHeat } from "./congestion-heat";
import { ProcessReplay } from "./process-replay";
import { replayTimeline } from "../core/replay-timeline";
import {
  ProcessReplayTokensContext,
  useProcessReplayEdgeTokens,
  type ProcessReplayTokens,
} from "./replay-tokens-context";

// jsdom has no `DOMMatrixReadOnly`, which React Flow's transform math needs to mount the
// canvas at all — the same missing-browser-API fill `process-map.test.tsx` documents.
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyPolyfill {
    m22 = 1;
    constructor(_init?: unknown) {}
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
}

const log = fixture as EventLog;
const graph = discoverGraph(log);
const HOUR = 3_600_000;
const status = () => document.querySelector('[data-slot="process-replay-status"]');

let reduced = false;
let frames: FrameRequestCallback[] = [];

function flushFrame(now: number) {
  const queued = frames;
  frames = [];
  act(() => queued.forEach((callback) => callback(now)));
}

beforeEach(() => {
  reduced = false;
  frames = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProcessReplay", () => {
  it("renders the controls, the paused announcement and the ranked congestion list", () => {
    render(<ProcessReplay graph={graph} log={log} synchronizedStart bucketMs={HOUR} />);
    expect(screen.getByRole("button", { name: "Play replay" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Replay time" })).toHaveAttribute(
      "aria-valuetext",
      "+0 s",
    );
    expect(screen.getByRole("combobox", { name: "Playback speed" })).toBeInTheDocument();
    expect(status()).toHaveTextContent("+0 s · 5 in flight");

    const heat = screen.getByRole("region", { name: "Most congested transitions" });
    const items = within(heat).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Create Order → Check Credit");
    expect(items[0]).toHaveAttribute("data-peak", "5");
    expect(heat).toHaveTextContent("Busiest: Create Order → Check Credit, 5 cases at +0 s");
  });

  it("scrubs with the keyboard, one bucket per arrow press", () => {
    const onTimeChange = vi.fn();
    render(
      <ProcessReplay
        graph={graph}
        log={log}
        synchronizedStart
        bucketMs={HOUR}
        onTimeChange={onTimeChange}
      />,
    );
    fireEvent.keyDown(screen.getByRole("slider", { name: "Replay time" }), { key: "ArrowRight" });
    expect(onTimeChange).toHaveBeenLastCalledWith(HOUR);
    expect(status()).toHaveTextContent("+1.0 h · 5 in flight");
  });

  it("advances the playhead on animation frames and cancels the loop on pause", () => {
    const onTimeChange = vi.fn();
    render(
      <ProcessReplay
        graph={graph}
        log={log}
        synchronizedStart
        bucketMs={HOUR}
        onTimeChange={onTimeChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play replay" }));
    expect(status()).toHaveTextContent("Replay playing");
    flushFrame(0);
    flushFrame(3000); // 10% of the 30 s playback at 1×.
    expect(onTimeChange).toHaveBeenLastCalledWith(HOUR);

    fireEvent.click(screen.getByRole("button", { name: "Pause replay" }));
    expect(frames).toHaveLength(0);
    expect(status()).toHaveTextContent("+1.0 h · 5 in flight");
  });

  it("never autoplays under reduced motion, but plays when the reader presses play", () => {
    reduced = true;
    render(<ProcessReplay graph={graph} log={log} bucketMs={HOUR} defaultPlaying />);
    expect(screen.getByRole("button", { name: "Play replay" })).toBeInTheDocument();
    expect(frames).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Play replay" }));
    expect(frames).toHaveLength(1);
  });

  it("renders the loading and empty panels", () => {
    const { rerender } = render(<ProcessReplay graph={graph} log={log} loading />);
    expect(document.querySelector('[data-slot="process-replay"]')).toHaveAttribute(
      "data-state",
      "loading",
    );
    rerender(<ProcessReplay graph={graph} log={{ events: [] }} />);
    expect(screen.getByText("No cases to replay")).toBeInTheDocument();
  });
});

describe("CongestionHeat", () => {
  it("says so when no case moves", () => {
    render(<CongestionHeat timeline={replayTimeline({ events: [] })} />);
    expect(screen.getByText("No case moves along a transition.")).toBeInTheDocument();
  });
});

describe("replay tokens context", () => {
  function Probe({ edgeId }: { edgeId: string }) {
    const tokens = useProcessReplayEdgeTokens(edgeId);
    return <output>{tokens === undefined ? "none" : tokens.length}</output>;
  }
  const edgeId = `Create Order${EDGE_KEY_SEPARATOR}Check Credit`;

  it("answers undefined without a provider, so the edge data stays unchanged", () => {
    render(<Probe edgeId={edgeId} />);
    expect(screen.getByRole("status")).toHaveTextContent("none");
  });

  it("answers the edge's tokens, or an empty list, inside a replay", () => {
    const tokens: ProcessReplayTokens = new Map([[edgeId, [{ id: "case-1", progress: 0.5 }]]]);
    render(
      <ProcessReplayTokensContext value={tokens}>
        <Probe edgeId={edgeId} />
        <Probe edgeId="elsewhere" />
      </ProcessReplayTokensContext>,
    );
    expect(screen.getAllByRole("status").map((el) => el.textContent)).toEqual(["1", "0"]);
  });
});
