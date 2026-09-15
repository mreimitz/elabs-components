import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type * as ResizablePrimitiveModule from "react-resizable-panels";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";

const capturedProps: Record<string, unknown>[] = [];

vi.mock("react-resizable-panels", async (importOriginal) => {
  const actual = await importOriginal<typeof ResizablePrimitiveModule>();
  return {
    ...actual,
    PanelResizeHandle: (props: Record<string, unknown>) => {
      capturedProps.push(props);
      return actual.PanelResizeHandle(props as never);
    },
  };
});

// Imported AFTER the mock so the module picked up above is the one in use.
const { ResizableHandle, ResizablePanel, ResizablePanelGroup } = await import("./resizable");

describe("Resizable — handle hit area is expanded without changing the visible line", () => {
  it("keeps the visible line at 1px (w-px) while widening the pointer hit area via hitAreaMargins", () => {
    capturedProps.length = 0;
    const { container } = render(
      <ResizablePanelGroup direction="horizontal" className="h-48 max-w-xl">
        <ResizablePanel defaultSize={40}>List</ResizablePanel>
        <ResizableHandle aria-label="Resize" />
        <ResizablePanel defaultSize={60}>Detail</ResizablePanel>
      </ResizablePanelGroup>,
    );
    const handle = container.querySelector('[role="separator"]');
    expect(handle).not.toBeNull();
    // Visual line unchanged — still the 1px hairline, not a wider drawn box.
    expect(handle!.className).toMatch(/\bw-px\b/);

    // The DRAG hit area comes from the primitive's own pointer-distance
    // config, not from CSS: at least 16px combined margin around the line
    // (>= 8px each side), satisfying the ≥16px minimum without widening
    // anything visible.
    const props = capturedProps.at(-1);
    const margins = props?.hitAreaMargins as { coarse: number; fine: number } | undefined;
    expect(margins).toBeDefined();
    expect(margins!.fine).toBeGreaterThanOrEqual(8);
    expect(margins!.coarse).toBeGreaterThanOrEqual(8);
  });

  it("lets a caller override hitAreaMargins explicitly", () => {
    capturedProps.length = 0;
    render(
      <ResizablePanelGroup direction="horizontal" className="h-48 max-w-xl">
        <ResizablePanel defaultSize={40}>List</ResizablePanel>
        <ResizableHandle aria-label="Resize" hitAreaMargins={{ coarse: 20, fine: 20 }} />
        <ResizablePanel defaultSize={60}>Detail</ResizablePanel>
      </ResizablePanelGroup>,
    );
    const props = capturedProps.at(-1);
    expect(props?.hitAreaMargins).toEqual({ coarse: 20, fine: 20 });
  });
});

describe("Resizable — forwardRef", () => {
  it("ResizablePanelGroup forwards its ref to the imperative panel-group handle", () => {
    const ref = createRef<ImperativePanelGroupHandle>();
    render(
      <ResizablePanelGroup ref={ref} direction="horizontal" className="h-48 max-w-xl">
        <ResizablePanel defaultSize={40}>List</ResizablePanel>
        <ResizableHandle aria-label="Resize" />
        <ResizablePanel defaultSize={60}>Detail</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.getLayout).toBe("function");
  });
});
