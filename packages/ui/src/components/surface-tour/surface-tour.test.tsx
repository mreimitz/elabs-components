import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AffordanceHint,
  SurfaceTour,
  SurfaceTourActions,
  type SurfaceTourTab,
} from "./surface-tour";

function makeTabs(prefetch = vi.fn()): SurfaceTourTab[] {
  return [
    { id: "one", label: "One", useCase: "First surface.", render: () => <p>Surface one</p> },
    { id: "two", label: "Two", render: () => <p>Surface two</p>, prefetch },
    { id: "three", label: "Three", render: () => <p>Surface three</p>, hint: "Try me" },
  ];
}

describe("SurfaceTour", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("renders the default tab with data-slots and only mounts the active surface", () => {
    const { container } = render(<SurfaceTour title="Tour" tabs={makeTabs()} />);
    expect(container.querySelector('[data-slot="surface-tour"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="surface-tour-frame"]')).not.toBeNull();
    expect(screen.getByText("Surface one")).toBeInTheDocument();
    expect(screen.queryByText("Surface two")).toBeNull();
    expect(screen.getByText("First surface.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tour" })).toBeInTheDocument();
  });

  it("switches tabs, unmounts the previous surface and writes the hash without a history entry", async () => {
    const onTabChange = vi.fn();
    render(<SurfaceTour tabs={makeTabs()} hashKey="tour" onTabChange={onTabChange} />);
    const before = window.history.length;
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Two" }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(screen.getByText("Surface two")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("Surface one")).toBeNull());
    expect(onTabChange).toHaveBeenCalledWith("two");
    expect(window.location.hash).toBe("#tour=two");
    expect(window.history.length).toBe(before);
  });

  it("opens the tab named in the hash on mount", async () => {
    window.history.replaceState(null, "", "/#tour=three");
    Element.prototype.scrollIntoView = vi.fn();
    render(<SurfaceTour tabs={makeTabs()} hashKey="tour" />);
    await waitFor(() => expect(screen.getByText("Surface three")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Three" })).toHaveAttribute("aria-selected", "true");
  });

  it("prefetches a tab's code once on hover or focus", () => {
    const prefetch = vi.fn();
    render(<SurfaceTour tabs={makeTabs(prefetch)} />);
    const tab = screen.getByRole("tab", { name: "Two" });
    fireEvent.pointerEnter(tab);
    fireEvent.focus(tab);
    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});

describe("AffordanceHint", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("appears after the delay, leaves on the first keydown and never returns this session", () => {
    vi.useFakeTimers();
    const view = render(
      <div data-testid="host">
        <AffordanceHint storageKey="hint-a">Drag a tile</AffordanceHint>
      </div>,
    );
    const hint = screen.getByText("Drag a tile");
    expect(hint).toHaveAttribute("aria-hidden", "true");
    expect(hint).not.toHaveAttribute("data-visible");
    act(() => vi.advanceTimersByTime(800));
    expect(hint).toHaveAttribute("data-visible");
    fireEvent.keyDown(screen.getByTestId("host"), { key: "a" });
    expect(hint).not.toHaveAttribute("data-visible");
    view.unmount();
    render(
      <div>
        <AffordanceHint storageKey="hint-a">Again</AffordanceHint>
      </div>,
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("Again")).not.toHaveAttribute("data-visible");
    vi.useRealTimers();
  });
});

describe("SurfaceTourActions", () => {
  it("links to Storybook, copies the multi-line prompt and shows the command", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(
      <SurfaceTourActions
        storybookHref="/storybook/?path=/docs/x--docs"
        prompt={"line one\nline two"}
        command="npx create"
      />,
    );
    expect(screen.getByRole("link", { name: "Open in Storybook" })).toHaveAttribute(
      "href",
      "/storybook/?path=/docs/x--docs",
    );
    expect(screen.getByText("npx create")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("line one\nline two"));
    await waitFor(() => expect(screen.getByText("Prompt copied")).toBeInTheDocument());
  });
});
