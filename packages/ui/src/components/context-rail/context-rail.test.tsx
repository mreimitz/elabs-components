import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FileText, Quote } from "lucide-react";

import { ContextRail, type ContextRailSection } from "./context-rail";

const sections: ContextRailSection[] = [
  {
    id: "sources",
    label: "Sources",
    icon: <FileText />,
    count: 3,
    content: <p>Sources body</p>,
  },
  {
    id: "quotes",
    label: "Quotes",
    icon: <Quote />,
    content: <p>Quotes body</p>,
  },
];

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe("ContextRail", () => {
  afterEach(() => {
    setViewportWidth(ORIGINAL_INNER_WIDTH);
  });

  it("1. is reachable by exact accessible name when collapsed", () => {
    render(<ContextRail sections={sections} open={false} />);
    expect(screen.getByRole("button", { name: "Sources 3 items" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quotes" })).toBeInTheDocument();
  });

  it("2. mounts only the active section's content", () => {
    render(<ContextRail sections={sections} activeSectionId="sources" />);
    expect(screen.getByText("Sources body")).toBeInTheDocument();
    expect(screen.queryByText("Quotes body")).not.toBeInTheDocument();
  });

  it("3. calls onActiveSectionChange with the clicked section's id", () => {
    const onActiveSectionChange = vi.fn();
    render(
      <ContextRail
        sections={sections}
        activeSectionId="sources"
        onActiveSectionChange={onActiveSectionChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quotes" }));
    expect(onActiveSectionChange).toHaveBeenCalledWith("quotes");
  });

  it("4. defaults to sections[0] uncontrolled, honours defaultActiveSectionId, and updates on click with no controlled prop", () => {
    const { unmount } = render(<ContextRail sections={sections} />);
    expect(screen.getByText("Sources body")).toBeInTheDocument();
    unmount();

    render(<ContextRail sections={sections} defaultActiveSectionId="quotes" />);
    expect(screen.getByText("Quotes body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sources 3 items" }));
    expect(screen.getByText("Sources body")).toBeInTheDocument();
    expect(screen.queryByText("Quotes body")).not.toBeInTheDocument();
  });

  it("5. gives the active entry aria-current=true", () => {
    render(<ContextRail sections={sections} activeSectionId="quotes" />);
    expect(screen.getByRole("button", { name: "Quotes" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Sources 3 items" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("6. clicking the active entry toggles open; clicking an inactive entry opens and reports the new section", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ContextRail
        sections={sections}
        activeSectionId="sources"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sources 3 items" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    const onActiveSectionChange = vi.fn();
    rerender(
      <ContextRail
        sections={sections}
        activeSectionId="sources"
        open={false}
        onOpenChange={onOpenChange}
        onActiveSectionChange={onActiveSectionChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quotes" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onActiveSectionChange).toHaveBeenCalledWith("quotes");
  });

  it("7. disabled sections render a disabled button and do not fire onActiveSectionChange", () => {
    const onActiveSectionChange = vi.fn();
    const disabledSections: ContextRailSection[] = [
      sections[0]!,
      { ...sections[1]!, disabled: true },
    ];
    render(
      <ContextRail
        sections={disabledSections}
        activeSectionId="sources"
        onActiveSectionChange={onActiveSectionChange}
      />,
    );
    const quotesButton = screen.getByRole("button", { name: "Quotes" });
    expect(quotesButton).toBeDisabled();
    fireEvent.click(quotesButton);
    expect(onActiveSectionChange).not.toHaveBeenCalled();
  });

  it("8. renders the empty slot for an empty sections array, localized by default, overridable via `empty`", () => {
    const { container, rerender } = render(<ContextRail sections={[]} />);
    const emptySlot = container.querySelector('[data-slot="context-rail-empty"]');
    expect(emptySlot).not.toBeNull();
    expect(within(emptySlot as HTMLElement).getByText("No sections")).toBeInTheDocument();

    const custom: ReactNode = <p>Nothing to show here</p>;
    rerender(<ContextRail sections={[]} empty={custom} />);
    const customEmptySlot = container.querySelector('[data-slot="context-rail-empty"]');
    expect(customEmptySlot).not.toBeNull();
    expect(screen.getByText("Nothing to show here")).toBeInTheDocument();
    expect(screen.queryByText("No sections")).not.toBeInTheDocument();
  });

  it("9. publishes `width` as --sidebar-width on the provider element, defaulting to 20rem", () => {
    const { container, rerender } = render(<ContextRail sections={sections} />);
    const provider = container.firstElementChild as HTMLElement;
    expect(provider.getAttribute("style") ?? "").toContain("--sidebar-width: 20rem");

    rerender(<ContextRail sections={sections} width="24rem" />);
    const providerAfter = container.firstElementChild as HTMLElement;
    expect(providerAfter.getAttribute("style") ?? "").toContain("--sidebar-width: 24rem");
  });

  it("10. warns exactly once when overlayBreakpoint < 768, and not when >= 768", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { unmount } = render(<ContextRail sections={sections} overlayBreakpoint={500} />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    unmount();
    warnSpy.mockClear();

    render(<ContextRail sections={sections} overlayBreakpoint={768} />);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("11. below overlayBreakpoint renders the narrow strip (no [data-slot=sidebar]) with the same switcher names", () => {
    setViewportWidth(500);
    const { container } = render(<ContextRail sections={sections} />);
    expect(container.querySelector('[data-slot="sidebar"]')).toBeNull();
    expect(container.querySelector('[data-slot="context-rail"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sources 3 items" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quotes" })).toBeInTheDocument();
  });

  it("12. renders all seven data-slot values on an open, non-empty rail", () => {
    const { container } = render(
      <ContextRail sections={sections} open={true} activeSectionId="sources" />,
    );
    for (const slot of [
      "context-rail",
      "context-rail-switcher",
      "context-rail-switcher-item",
      "context-rail-count",
      "context-rail-heading",
      "context-rail-body",
    ]) {
      expect(
        container.querySelector(`[data-slot="${slot}"]`),
        `expected [data-slot="${slot}"] to be present`,
      ).not.toBeNull();
    }
  });
});
