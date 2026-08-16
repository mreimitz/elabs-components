import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useCollapsiblePanel } from "./use-collapsible-panel";

describe("useCollapsiblePanel (#190)", () => {
  it("is uncontrolled by default (defaultOpen=true) and toggles", () => {
    const { result } = renderHook(() => useCollapsiblePanel());
    expect(result.current.open).toBe(true);
    expect(result.current.state).toBe("expanded");
    expect(result.current.attrs).toEqual({ "data-state": "expanded", "data-side": "left" });

    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
    expect(result.current.state).toBe("collapsed");
    expect(result.current.attrs["data-state"]).toBe("collapsed");
  });

  it("respects defaultOpen=false and setOpen with an updater fn", () => {
    const { result } = renderHook(() => useCollapsiblePanel({ defaultOpen: false }));
    expect(result.current.state).toBe("collapsed");
    act(() => result.current.setOpen((o) => !o));
    expect(result.current.state).toBe("expanded");
  });

  it("controlled mode: the `open` prop wins and never flips to uncontrolled", () => {
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useCollapsiblePanel({ open, onOpenChange }),
      { initialProps: { open: false } },
    );
    expect(result.current.state).toBe("collapsed");

    // setOpen does NOT mutate internal state in controlled mode — it only
    // notifies; the prop stays the source of truth.
    act(() => result.current.setOpen(true));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(result.current.open).toBe(false);

    rerender({ open: true });
    expect(result.current.state).toBe("expanded");
  });

  it("uncontrolled mode still notifies onOpenChange", () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => useCollapsiblePanel({ onOpenChange }));
    act(() => result.current.toggle());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.open).toBe(false);
  });

  it("data-side follows the side option", () => {
    const { result } = renderHook(() => useCollapsiblePanel({ side: "right" }));
    expect(result.current.attrs["data-side"]).toBe("right");
  });

  it("default fragments use the gated motion utilities (duration-base ease-linear)", () => {
    const { result } = renderHook(() => useCollapsiblePanel());
    expect(result.current.spacerClassName).toBe(
      "relative w-(--collapsible-panel-width) bg-transparent transition-[width] duration-base ease-linear group-data-[state=collapsed]:w-0",
    );
    expect(result.current.containerClassName).toBe(
      "fixed inset-y-0 z-10 hidden h-svh w-(--collapsible-panel-width) transition-[left,right,width] duration-base ease-linear md:flex left-0 group-data-[state=collapsed]:left-[calc(var(--collapsible-panel-width)*-1)]",
    );
  });

  // The byte-identity lock (#190 acceptance): configured with Sidebar's
  // literals, the hook must emit EXACTLY the class fragments sidebar.tsx
  // shipped before the extraction (the pre-#190 strings, copied verbatim).
  it("emits Sidebar's original fragments byte-identically when given its literals", () => {
    const sidebarOptions = {
      widthClassName: "w-(--sidebar-width)",
      spacerCollapsedClassName: "group-data-[collapsible=offcanvas]:w-0",
      containerSlideClassNames: {
        left: "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
        right: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
      },
    } as const;

    const left = renderHook(() => useCollapsiblePanel({ side: "left", ...sidebarOptions }));
    expect(left.result.current.spacerClassName).toBe(
      "relative w-(--sidebar-width) bg-transparent transition-[width] duration-base ease-linear group-data-[collapsible=offcanvas]:w-0",
    );
    expect(left.result.current.containerClassName).toBe(
      "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-base ease-linear md:flex left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
    );

    const right = renderHook(() => useCollapsiblePanel({ side: "right", ...sidebarOptions }));
    expect(right.result.current.containerClassName).toBe(
      "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-base ease-linear md:flex right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
    );
  });
});
