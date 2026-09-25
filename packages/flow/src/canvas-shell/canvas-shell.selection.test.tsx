import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Node, NodeChange, OnSelectionChangeParams } from "@xyflow/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FlowNode, type BrandFlowNode } from "../flow-node/flow-node";
import { CanvasShell } from "./canvas-shell";

/*
 * Issue 536 lock. Unlike `canvas-shell.test.tsx`, this file renders the REAL React Flow
 * engine: the bug lives in how React Flow's own keyboard/click selection meets a
 * controlled canvas, which a mocked engine cannot show. jsdom lacks the layout APIs React
 * Flow measures with, so they are shimmed the way React Flow's testing guide does.
 */
class ResizeObserverShim {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

class DOMMatrixReadOnlyShim {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}

const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverShim);
  vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyShim);
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 160;
      },
    },
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 60;
      },
    },
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
  if (offsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth);
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
});

afterEach(cleanup);

const nodeTypes = { brand: FlowNode };

/**
 * A static fixture: module-level, never updated — the tour surface's original shape.
 * `initialWidth`/`initialHeight` stand in for the measurement jsdom cannot perform: React
 * Flow keeps an unmeasured node `visibility: hidden`, and a hidden element has no
 * accessible name to assert.
 */
const SIZE = { initialWidth: 160, initialHeight: 60 };
const NODES: BrandFlowNode[] = [
  { id: "ingest", type: "brand", position: { x: 0, y: 0 }, data: { title: "Ingest" }, ...SIZE },
  { id: "dedupe", type: "brand", position: { x: 240, y: 0 }, data: { title: "Dedupe" }, ...SIZE },
  { id: "enrich", type: "brand", position: { x: 480, y: 0 }, data: { title: "Enrich" }, ...SIZE },
];

function nodeEl(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (!el) throw new Error(`node ${id} not rendered`);
  return el;
}

type Trigger = "Enter" | "Space" | "click";

function activate(el: HTMLElement, trigger: Trigger) {
  act(() => el.focus());
  if (trigger === "click") fireEvent.click(el);
  else fireEvent.keyDown(el, { key: trigger === "Space" ? " " : "Enter" });
}

describe("CanvasShell selection on a static canvas (no onNodesChange)", () => {
  it.each<Trigger>(["Enter", "Space", "click"])(
    "%s selects the focused node and moves the selection off the previous one",
    async (trigger) => {
      const onSelectionChange = vi.fn<(params: OnSelectionChangeParams) => void>();
      const { container } = render(
        <div style={{ width: 800, height: 400 }}>
          <CanvasShell
            nodes={NODES}
            edges={[]}
            nodeTypes={nodeTypes}
            onSelectionChange={onSelectionChange}
          />
        </div>,
      );

      activate(nodeEl(container, "ingest"), trigger);
      await waitFor(() => expect(nodeEl(container, "ingest")).toHaveClass("selected"));
      await waitFor(() =>
        expect(onSelectionChange).toHaveBeenLastCalledWith(
          expect.objectContaining({ nodes: [expect.objectContaining({ id: "ingest" })] }),
        ),
      );

      activate(nodeEl(container, "dedupe"), trigger);
      await waitFor(() => expect(nodeEl(container, "dedupe")).toHaveClass("selected"));
      expect(nodeEl(container, "ingest")).not.toHaveClass("selected");
      expect(nodeEl(container, "enrich")).not.toHaveClass("selected");
    },
  );

  it("names every node from its visible title, so a focused node is never an unnamed group", async () => {
    const { container } = render(<CanvasShell nodes={NODES} edges={[]} nodeTypes={nodeTypes} />);
    for (const { id, data } of NODES) {
      expect(nodeEl(container, id)).toHaveAttribute("role", "group");
      expect(nodeEl(container, id)).toHaveAttribute("aria-label", data.title);
      await waitFor(() => expect(nodeEl(container, id)).toHaveAccessibleName(data.title));
    }
  });

  it("keeps a caller-set ariaLabel and never borrows data.label (a placeholder's button name)", async () => {
    const nodes: Node[] = [
      { ...NODES[0]!, ariaLabel: "Ingest step, raw feeds" },
      { id: "plain", position: { x: 0, y: 120 }, data: { label: "Add node" }, ...SIZE },
    ];
    const { container } = render(<CanvasShell nodes={nodes} edges={[]} nodeTypes={nodeTypes} />);
    await waitFor(() =>
      expect(nodeEl(container, "ingest")).toHaveAccessibleName("Ingest step, raw feeds"),
    );
    expect(nodeEl(container, "plain")).not.toHaveAttribute("aria-label");
  });

  it("lets the consumer's own selected field win once it moves", async () => {
    const { container, rerender } = render(
      <CanvasShell nodes={NODES} edges={[]} nodeTypes={nodeTypes} />,
    );
    activate(nodeEl(container, "ingest"), "Enter");
    await waitFor(() => expect(nodeEl(container, "ingest")).toHaveClass("selected"));

    // The consumer now selects `enrich` itself (and says nothing about `ingest`).
    const next = NODES.map((node) => (node.id === "enrich" ? { ...node, selected: true } : node));
    rerender(<CanvasShell nodes={next} edges={[]} nodeTypes={nodeTypes} />);
    await waitFor(() => expect(nodeEl(container, "enrich")).toHaveClass("selected"));
  });
});

describe("CanvasShell selection with a consumer onNodesChange", () => {
  it("leaves selection to the consumer: forwards the select change, applies nothing itself", async () => {
    const onNodesChange = vi.fn<(changes: NodeChange<BrandFlowNode>[]) => void>();
    const { container } = render(
      <CanvasShell nodes={NODES} edges={[]} nodeTypes={nodeTypes} onNodesChange={onNodesChange} />,
    );
    activate(nodeEl(container, "ingest"), "Enter");
    await waitFor(() =>
      expect(onNodesChange).toHaveBeenCalledWith(
        expect.arrayContaining([{ type: "select", id: "ingest", selected: true }]),
      ),
    );
    expect(nodeEl(container, "ingest")).not.toHaveClass("selected");
  });
});
