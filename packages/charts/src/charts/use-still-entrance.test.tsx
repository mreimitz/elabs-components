/**
 * Reduced motion stops mount-only entrances, and the switch back never replays
 * them (RM-189 follow-up review).
 *
 * Nothing about motion is mocked: each chart sits in a real `ThemeProvider`
 * whose motion preference the test flips, the same path a person's setting
 * takes. Two promises per entrance:
 *
 * 1. Under reduced motion the mark is painted at rest in its first frame — no
 *    `opacity: 0`, no `scale(0)`, no sweep from zero.
 * 2. Switching reduced → full keeps the very same DOM nodes (no remount), so
 *    nothing that was already shown animates in again.
 */
import { act, cleanup, render } from "@testing-library/react";
import {
  type MotionPreference,
  ThemeProvider,
  useMotionPreference,
} from "@elabs-ai/components-tokens";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DrawPath } from "../marks/draw-path";
import { FunnelChart } from "./funnel-chart";
import { Gauge } from "./gauge";
import { RadarArea } from "./radar-area";
import { RadarChart } from "./radar-chart";
import type { RadarData, RadarMetric } from "./radar-context";
import { useStillEntrance } from "./use-still-entrance";

vi.mock("./chart-parent-size", () => ({
  ChartParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => ReactNode;
  }) => <>{children({ width: 300, height: 300 })}</>,
}));

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Renders `ui` under a provider whose motion preference the test can flip. */
function renderWithMotion(ui: ReactNode, initial: MotionPreference) {
  const handle: { set?: (next: MotionPreference) => void } = {};
  function CaptureMotion() {
    handle.set = useMotionPreference().setMotionPreference;
    return null;
  }
  const result = render(
    <ThemeProvider defaultMotionPreference={initial} motionStorageKey={null}>
      <CaptureMotion />
      {ui}
    </ThemeProvider>,
  );
  const setMotion = (next: MotionPreference) =>
    act(() => {
      handle.set?.(next);
    });
  return { ...result, setMotion };
}

/** True when an element's inline style shows it at its entrance's start. */
function atEntranceStart(el: Element): boolean {
  const style = (el as HTMLElement | SVGElement).style;
  return style.opacity === "0" || /scale\(0\)/.test(style.transform);
}

describe("useStillEntrance", () => {
  function Probe({ seen }: { seen: boolean[] }) {
    seen.push(useStillEntrance());
    return null;
  }

  it("is on from the first render under reduced motion and stays on after the switch back", () => {
    const seen: boolean[] = [];
    const { setMotion } = renderWithMotion(<Probe seen={seen} />, "reduced");
    expect(seen[0]).toBe(true);
    setMotion("full");
    expect(seen.at(-1)).toBe(true);
    expect(seen).not.toContain(false);
  });

  it("is off under full motion and latches on when reduced motion arrives", () => {
    const seen: boolean[] = [];
    const { setMotion } = renderWithMotion(<Probe seen={seen} />, "full");
    expect(seen[0]).toBe(false);
    setMotion("reduced");
    expect(seen.at(-1)).toBe(true);
    setMotion("full");
    expect(seen.at(-1)).toBe(true);
  });
});

describe("Gauge notches", () => {
  const gauge = <Gauge centerValue={62} height={200} value={62} width={300} />;
  const notches = (container: Element) =>
    Array.from(container.querySelectorAll("path[fill-opacity]"));

  it("stagger in from nothing when motion is allowed", () => {
    const { container } = renderWithMotion(gauge, "full");
    expect(notches(container).length).toBeGreaterThan(0);
    expect(notches(container).every(atEntranceStart)).toBe(true);
  });

  it("land at rest at once under reduced motion", () => {
    const { container } = renderWithMotion(gauge, "reduced");
    expect(notches(container).length).toBeGreaterThan(0);
    expect(notches(container).some(atEntranceStart)).toBe(false);
  });

  it("keep their nodes when reduced motion is switched off again", () => {
    const { container, setMotion } = renderWithMotion(gauge, "reduced");
    const before = notches(container);
    setMotion("full");
    const after = notches(container);
    expect(after).toHaveLength(before.length);
    after.forEach((node, i) => expect(node).toBe(before[i]));
    expect(after.some(atEntranceStart)).toBe(false);
  });
});

describe("FunnelChart segments and labels", () => {
  const data = [
    { label: "Visitors", value: 12000 },
    { label: "Signups", value: 4800 },
    { label: "Activated", value: 2100 },
  ];

  function renderFunnel(initial: MotionPreference) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 600,
      toJSON: () => ({}),
      top: 0,
      width: 600,
      x: 0,
      y: 0,
    } as DOMRect);
    return renderWithMotion(<FunnelChart data={data} />, initial);
  }
  const labels = (container: Element) =>
    Array.from(container.querySelectorAll('[data-slot="funnel-chart-label"]'));
  /** A segment still growing in: its wrapper is scaled down from zero. */
  const growingSegments = (container: Element) =>
    Array.from(container.querySelectorAll<HTMLElement>("div")).filter((el) =>
      /scale[XY]?\(0\)/.test(el.style.transform),
    );
  const segmentSvgs = (container: Element) =>
    Array.from(container.querySelectorAll('svg[role="presentation"]'));

  it("grow in from nothing when motion is allowed", () => {
    const { container } = renderFunnel("full");
    expect(growingSegments(container).length).toBeGreaterThan(0);
    expect(labels(container).every(atEntranceStart)).toBe(true);
  });

  it("land at rest at once under reduced motion: whole segments, labels at full opacity", () => {
    const { container } = renderFunnel("reduced");
    expect(growingSegments(container)).toHaveLength(0);
    expect(segmentSvgs(container)).toHaveLength(data.length);
    expect(labels(container)).toHaveLength(data.length);
    expect(labels(container).some(atEntranceStart)).toBe(false);
  });

  it("keep their nodes when reduced motion is switched off again", () => {
    const { container, setMotion } = renderFunnel("reduced");
    const labelsBefore = labels(container);
    const segmentsBefore = segmentSvgs(container);
    setMotion("full");
    labels(container).forEach((node, i) => expect(node).toBe(labelsBefore[i]));
    segmentSvgs(container).forEach((node, i) => expect(node).toBe(segmentsBefore[i]));
    expect(growingSegments(container)).toHaveLength(0);
    expect(labels(container).some(atEntranceStart)).toBe(false);
  });
});

describe("RadarArea", () => {
  const metrics: RadarMetric[] = [
    { key: "speed", label: "Speed" },
    { key: "power", label: "Power" },
    { key: "range", label: "Range" },
  ];
  const data: RadarData[] = [{ label: "A", values: { speed: 80, power: 60, range: 40 } }];
  const radar = (
    <RadarChart data={data} metrics={metrics} size={300}>
      <RadarArea index={0} />
    </RadarChart>
  );
  const areaGroup = (container: Element) => container.querySelector("circle")?.closest("g");

  it("keeps its group and its points when reduced motion is switched off again", () => {
    const { container, setMotion } = renderWithMotion(radar, "reduced");
    const group = areaGroup(container);
    const points = Array.from(container.querySelectorAll("circle"));
    expect(group).toBeTruthy();
    expect(atEntranceStart(group as Element)).toBe(false);
    setMotion("full");
    expect(areaGroup(container)).toBe(group);
    Array.from(container.querySelectorAll("circle")).forEach((node, i) =>
      expect(node).toBe(points[i]),
    );
    expect(atEntranceStart(group as Element)).toBe(false);
  });
});

describe("DrawPath", () => {
  it("never replays its draw-in when reduced motion is switched off again", () => {
    const { container, setMotion } = renderWithMotion(
      <svg>
        <DrawPath d="M 0 0 L 50 50" stroke="currentColor" />
      </svg>,
      "reduced",
    );
    const path = container.querySelector('[data-slot="draw-path"]');
    expect(path?.getAttribute("stroke-dasharray")).toBeNull();
    setMotion("full");
    expect(container.querySelector('[data-slot="draw-path"]')).toBe(path);
    expect(path?.getAttribute("stroke-dasharray")).toBeNull();
  });
});
