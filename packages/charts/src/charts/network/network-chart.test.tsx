/**
 * NetworkChart — rendered behaviour under jsdom (RM-036).
 *
 * Unlike most chart containers in this package, `NetworkChart` IS testable here:
 * it draws from numbers the layout already computed, so stubbing
 * `getBoundingClientRect` + `ResizeObserver` is enough to make the whole picture
 * appear. The layout maths itself is covered, jsdom-free, in
 * `network-layout.test.ts`; this file covers the three things only a rendered
 * tree can prove:
 *
 * 1. the keyboard path lives OUTSIDE the `aria-hidden` SVG (the axe
 *    `aria-hidden-focus` rule, which is a red build here),
 * 2. adjacency emphasis reaches the DOM as a CSS class, on the right marks,
 * 3. nothing moves after the first paint — the force layout is settled, not
 *    animated.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NetworkChart } from "./network-chart";
import type { NetworkLinkDatum, NetworkNodeDatum } from "./network-types";

const WIDTH = 800;
const HEIGHT = 600;

beforeEach(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom lays nothing out, so every box is 0×0 and the chart's `w > 0 && h > 0`
  // guard would hold the whole drawing back. One stub, and the real component
  // renders its real geometry.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        width: WIDTH,
        height: HEIGHT,
        top: 0,
        left: 0,
        right: WIDTH,
        bottom: HEIGHT,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
});

/** `a—b—c—d` plus `a—c`: `d` is exactly two hops from `a`. */
const NODES: NetworkNodeDatum[] = [
  { id: "a", label: "Alpha", value: 9, group: "one" },
  { id: "b", label: "Beta", value: 4, group: "one" },
  { id: "c", label: "Gamma", value: 1, group: "two" },
  { id: "d", label: "Delta", value: 6, group: "two" },
];
const LINKS: NetworkLinkDatum[] = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
  { source: "c", target: "d" },
  { source: "a", target: "c" },
];

const nodeMark = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-network-node-id="${id}"]`) as SVGGElement;

/**
 * Hover is DELEGATED at the SVG root — the marks take no callbacks, which is
 * what keeps them `React.memo`-comparable at 180 nodes. So the event has to be
 * dispatched on the mark and allowed to bubble; handing `fireEvent` a `target`
 * option would only set a property on the element it was given.
 */
const hoverNode = (container: HTMLElement, id: string) => {
  fireEvent.pointerMove(nodeMark(container, id).querySelector("circle") as Element);
};

describe("NetworkChart — structure and a11y", () => {
  it("announces the graph's shape, which the aria-hidden SVG withholds", () => {
    render(<NetworkChart layout="circular" links={LINKS} nodes={NODES} />);
    expect(screen.getByRole("figure")).toHaveAccessibleName("Network, 4 nodes, 4 links, 2 groups");
  });

  it("lets the caller override the summary", () => {
    render(
      <NetworkChart
        accessibleLabel="Who owns what"
        layout="circular"
        links={LINKS}
        nodes={NODES}
      />,
    );
    expect(screen.getByRole("figure")).toHaveAccessibleName("Who owns what");
  });

  it("draws one mark per node and one path per link", () => {
    const { container } = render(<NetworkChart layout="circular" links={LINKS} nodes={NODES} />);
    expect(container.querySelectorAll('[data-slot="network-node"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-slot="network-link"]')).toHaveLength(4);
  });

  it("keeps the SVG body aria-hidden and free of anything focusable", () => {
    const { container } = render(
      <NetworkChart layout="force" links={LINKS} nodes={NODES} onDatapointClick={() => {}} />,
    );
    const svg = container.querySelector('[data-slot="network-chart-body"]') as SVGSVGElement;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // The axe `aria-hidden-focus` rule, asserted directly: no tab stop, no
    // button and no role inside the hidden subtree.
    expect(svg.querySelectorAll("[tabindex], button, [role='button']")).toHaveLength(0);
  });

  it("renders no interaction layer at all when the chart is not interactive", () => {
    const { container } = render(<NetworkChart layout="circular" links={LINKS} nodes={NODES} />);
    expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeNull();
  });
});

describe("NetworkChart — keyboard targets", () => {
  it("puts every node in a sibling layer with ONE tab stop and 24x24 hit boxes", () => {
    const { container } = render(
      <NetworkChart layout="circular" links={LINKS} nodes={NODES} onDatapointClick={() => {}} />,
    );
    const layer = container.querySelector('[data-slot="chart-datapoint-layer"]') as HTMLElement;
    expect(layer).not.toBeNull();
    // A positioned SIBLING of the SVG, not a descendant of it.
    expect(layer.closest("svg")).toBeNull();
    expect(layer.className).toContain("pointer-events-none");

    const buttons = within(layer).getAllByRole("button");
    expect(buttons).toHaveLength(NODES.length);
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "0")).toHaveLength(1);
    for (const button of buttons) {
      expect(Number.parseFloat(button.style.width)).toBeGreaterThanOrEqual(24);
      expect(Number.parseFloat(button.style.height)).toBeGreaterThanOrEqual(24);
    }
  });

  it("names each target with its group, value and DEGREE", () => {
    render(
      <NetworkChart layout="circular" links={LINKS} nodes={NODES} onDatapointClick={() => {}} />,
    );
    // `a` has two links (a-b, a-c); `c` has three (b-c, c-d, a-c).
    expect(screen.getByRole("button", { name: "Alpha, one, value 9, 2 links" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gamma, two, value 1, 3 links" })).toBeTruthy();
  });

  it("keeps keyboard order equal to layout order", () => {
    render(
      <NetworkChart layout="circular" links={LINKS} nodes={NODES} onDatapointClick={() => {}} />,
    );
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names.map((n) => n?.split(",")[0])).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });

  it("hands the node's degree to the drill-down handler", () => {
    const onDatapointClick = vi.fn();
    render(
      <NetworkChart
        layout="circular"
        links={LINKS}
        nodes={NODES}
        onDatapointClick={onDatapointClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Gamma/ }));
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    expect(onDatapointClick.mock.calls[0]?.[0]).toMatchObject({
      category: "Gamma",
      datum: { degree: 3, group: "two", id: "c", value: 1 },
      index: 2,
      value: 1,
    });
  });
});

describe("NetworkChart — adjacency emphasis", () => {
  it("blurs everything more than one hop from the hovered node", () => {
    const { container } = render(<NetworkChart layout="circular" links={LINKS} nodes={NODES} />);
    // At rest nothing is dimmed.
    for (const id of ["a", "b", "c", "d"]) {
      expect(nodeMark(container, id).getAttribute("class")).not.toContain("opacity-[0.12]");
    }

    hoverNode(container, "a");

    expect(nodeMark(container, "a").getAttribute("class")).not.toContain("opacity-[0.12]");
    expect(nodeMark(container, "b").getAttribute("class")).not.toContain("opacity-[0.12]");
    expect(nodeMark(container, "c").getAttribute("class")).not.toContain("opacity-[0.12]");
    // `d` is two hops away.
    expect(nodeMark(container, "d").getAttribute("class")).toContain("opacity-[0.12]");
  });

  it("keeps only the links incident to the hovered node lit", () => {
    const { container } = render(<NetworkChart layout="circular" links={LINKS} nodes={NODES} />);
    hoverNode(container, "a");
    const dimmed = [...container.querySelectorAll('[data-slot="network-link"]')].map((path) =>
      (path.getAttribute("class") ?? "").includes("opacity-[0.03]"),
    );
    // a-b, b-c, c-d, a-c → only b-c and c-d are not incident to `a`.
    expect(dimmed).toEqual([false, true, true, false]);
  });

  it("does not blur anything when `emphasis` is off", () => {
    const { container } = render(
      <NetworkChart emphasis="none" layout="circular" links={LINKS} nodes={NODES} />,
    );
    hoverNode(container, "a");
    expect(nodeMark(container, "d").getAttribute("class")).not.toContain("opacity-[0.12]");
  });

  it("raises the same tooltip — degree included — from a KEYBOARD focus", () => {
    render(
      <NetworkChart layout="circular" links={LINKS} nodes={NODES} onDatapointClick={() => {}} />,
    );
    fireEvent.focus(screen.getByRole("button", { name: /^Gamma/ }));
    // "Gamma" is painted TWICE — once as the node's own halo label inside the
    // SVG, once as the tooltip title outside it — so the assertion has to name
    // which one it means, or it passes on the label alone and proves nothing.
    const outsideSvg = screen.getAllByText("Gamma").filter((el) => el.closest("svg") === null);
    expect(outsideSvg).toHaveLength(1);
    // The acceptance bullet: a keyboard user reads the node's degree.
    expect(screen.getByText("Degree")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("NetworkChart — labels", () => {
  it("labels every node when no threshold is given", () => {
    const { container } = render(<NetworkChart layout="circular" links={LINKS} nodes={NODES} />);
    expect(container.querySelectorAll('[data-slot="network-node-label"]')).toHaveLength(4);
  });

  it("labels only the nodes at or above the threshold (B1's rule)", () => {
    const { container } = render(
      <NetworkChart labelThreshold={6} layout="circular" links={LINKS} nodes={NODES} />,
    );
    const labels = [...container.querySelectorAll('[data-slot="network-node-label"]')].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(["Alpha", "Delta"]);
  });
});

describe("NetworkChart — the force layout is settled, not animated", () => {
  it("draws the same positions it drew on first paint, 60 ms later", async () => {
    const { container } = render(<NetworkChart layout="force" links={LINKS} nodes={NODES} />);
    const read = () =>
      [...container.querySelectorAll('[data-slot="network-node"]')].map((node) =>
        node.getAttribute("transform"),
      );
    const first = read();
    expect(first.every(Boolean)).toBe(true);
    // A running `d3-timer` would have advanced the simulation several dozen
    // ticks in this window; a settled layout has nothing left to advance.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(read()).toEqual(first);
  });

  it("re-renders the same picture for the same data", () => {
    const first = render(<NetworkChart layout="force" links={LINKS} nodes={NODES} />);
    const firstTransforms = [...first.container.querySelectorAll('[data-slot="network-node"]')].map(
      (node) => node.getAttribute("transform"),
    );
    first.unmount();
    const second = render(<NetworkChart layout="force" links={LINKS} nodes={NODES} />);
    expect(
      [...second.container.querySelectorAll('[data-slot="network-node"]')].map((node) =>
        node.getAttribute("transform"),
      ),
    ).toEqual(firstTransforms);
  });
});
