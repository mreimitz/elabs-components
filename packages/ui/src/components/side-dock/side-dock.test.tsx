import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SideDock } from "./side-dock";

/**
 * Every test that wants the COLUMN branch passes `overlayBreakpoint={800}` —
 * jsdom's `window.innerWidth` is 1024 and its stubbed `matchMedia` always
 * reports `matches: false`, so the default `overlayBreakpoint` (1100) would
 * render the OVERLAY branch in every test (see task-10-brief.md, Mechanism §2).
 * The one test that wants the overlay branch passes `overlayBreakpoint={2000}`.
 */
const COLUMN_BREAKPOINT = 800;

describe("SideDock", () => {
  // 1. Names the region.
  it("names the complementary region from `title`", () => {
    render(
      <SideDock title="Assistant" open overlayBreakpoint={COLUMN_BREAKPOINT}>
        Body
      </SideDock>,
    );
    expect(screen.getByRole("complementary")).toHaveAccessibleName("Assistant");
  });

  // 2. Names the handle and reports its value.
  it("names the resize handle and reports its current value", () => {
    render(
      <SideDock title="Assistant" open overlayBreakpoint={COLUMN_BREAKPOINT}>
        Body
      </SideDock>,
    );
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAccessibleName("Resize Assistant");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "400");
    expect(handle).toHaveAttribute("aria-valuemin", "320");
    expect(handle.getAttribute("aria-valuetext")).toContain("400 pixels");
  });

  // 3. Keyboard widens (right-hand dock: ArrowLeft widens).
  it("widens on ArrowLeft and commits once on keyup", () => {
    const onWidthChange = vi.fn();
    const onWidthCommit = vi.fn();
    render(
      <SideDock
        title="Assistant"
        open
        overlayBreakpoint={COLUMN_BREAKPOINT}
        onWidthChange={onWidthChange}
        onWidthCommit={onWidthCommit}
      >
        Body
      </SideDock>,
    );
    const handle = screen.getByRole("separator");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onWidthChange).toHaveBeenCalledTimes(1);
    const widened = onWidthChange.mock.calls[0]![0] as number;
    expect(widened).toBeGreaterThan(400);
    expect(onWidthCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(handle, { key: "ArrowLeft" });
    expect(onWidthCommit).toHaveBeenCalledTimes(1);
    expect(onWidthCommit).toHaveBeenCalledWith(widened);
  });

  // 4. Keyboard narrows; Home/End jump to the effective bounds.
  // CORRECTED 2026-09-05 (Ruling 29): under these defaults (minContentWidth
  // 480 against jsdom's 1024px viewport) the effective maximum is 544, not
  // maxWidth (640) — see clampWidth's viewport term.
  it("narrows on ArrowRight and End jumps to the effective maximum (544, not maxWidth)", () => {
    render(
      <SideDock title="Assistant" open overlayBreakpoint={COLUMN_BREAKPOINT}>
        Body
      </SideDock>,
    );
    const handle = screen.getByRole("separator");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyUp(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "384");
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyUp(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "544");
  });

  // 5. A no-op is silent.
  it("fires no callback and leaves the value unchanged when the narrowing key is a no-op at minWidth", () => {
    const onWidthChange = vi.fn();
    const onWidthCommit = vi.fn();
    render(
      <SideDock
        title="Assistant"
        open
        overlayBreakpoint={COLUMN_BREAKPOINT}
        width={320}
        minWidth={320}
        onWidthChange={onWidthChange}
        onWidthCommit={onWidthCommit}
      >
        Body
      </SideDock>,
    );
    const handle = screen.getByRole("separator");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyUp(handle, { key: "ArrowRight" });
    expect(onWidthChange).not.toHaveBeenCalled();
    expect(onWidthCommit).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute("aria-valuenow", "320");
  });

  // 6. A controlled out-of-range width converges (maxWidth as the sole
  // upper bound — minContentWidth={0} zeroes the viewport bound, per
  // Ruling 29; assertion 7 below is what covers the viewport bound).
  it("converges a controlled width above maxWidth, emitting each callback once", () => {
    const onWidthChange = vi.fn();
    const onWidthCommit = vi.fn();
    render(
      <SideDock
        title="Assistant"
        open
        overlayBreakpoint={COLUMN_BREAKPOINT}
        width={9999}
        maxWidth={640}
        minContentWidth={0}
        onWidthChange={onWidthChange}
        onWidthCommit={onWidthCommit}
      >
        Body
      </SideDock>,
    );
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "640");
    expect(onWidthChange).toHaveBeenCalledTimes(1);
    expect(onWidthChange).toHaveBeenCalledWith(640);
    expect(onWidthCommit).toHaveBeenCalledTimes(1);
    expect(onWidthCommit).toHaveBeenCalledWith(640);
  });

  // 7. minContentWidth binds against the live viewport.
  it("binds minContentWidth against jsdom's 1024px viewport", () => {
    render(
      <SideDock
        title="Assistant"
        open
        overlayBreakpoint={COLUMN_BREAKPOINT}
        width={640}
        minContentWidth={480}
      >
        Body
      </SideDock>,
    );
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "544");
  });

  // 8. Uncontrolled default is closed.
  // `data-state` lives on the GROUP element per task-10-brief.md Mechanism §1
  // ("attrs ... goes on the group element that wraps both fragments" —
  // mirrors Sidebar, which puts `data-state` on `data-slot="sidebar"`, never
  // on `sidebar-container`); `inert` is the CONTAINER's own attribute (the
  // fixed contract's "the collapsed container is inert").
  it("is closed by default, inert, with its body content still mounted", () => {
    render(
      <SideDock title="Assistant" overlayBreakpoint={COLUMN_BREAKPOINT}>
        Body content
      </SideDock>,
    );
    const root = document.querySelector('[data-slot="side-dock"]');
    const container = document.querySelector('[data-slot="side-dock-container"]');
    expect(root).toHaveAttribute("data-state", "collapsed");
    // jsdom does not implement the `.inert` IDL property (it reads back
    // `undefined` even when the attribute is present) — assert the
    // ATTRIBUTE, which is what React 19 actually renders for `inert={true}`.
    expect(container).toHaveAttribute("inert");
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  // 9. The close control closes it.
  it("closes on clicking the close button", () => {
    const onOpenChange = vi.fn();
    render(
      <SideDock
        title="Assistant"
        defaultOpen
        overlayBreakpoint={COLUMN_BREAKPOINT}
        onOpenChange={onOpenChange}
      >
        Body
      </SideDock>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    const root = document.querySelector('[data-slot="side-dock"]');
    expect(root).toHaveAttribute("data-state", "collapsed");
  });

  // 10. The overlay branch.
  it("renders as an overlay Sheet below overlayBreakpoint, with no resize handle", () => {
    render(
      <SideDock title="Assistant" open overlayBreakpoint={2000} description="A helper panel.">
        Body
      </SideDock>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Assistant");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByText("A helper panel.")).toBeInTheDocument();
  });

  // 11. side="left" inverts the keyboard direction.
  it("inverts ArrowRight to widen on a left-hand dock", () => {
    const onWidthChange = vi.fn();
    render(
      <SideDock
        title="Assistant"
        open
        side="left"
        overlayBreakpoint={COLUMN_BREAKPOINT}
        onWidthChange={onWidthChange}
      >
        Body
      </SideDock>,
    );
    const handle = screen.getByRole("separator");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onWidthChange).toHaveBeenCalledTimes(1);
    expect(onWidthChange.mock.calls[0]![0] as number).toBeGreaterThan(400);
  });
});
