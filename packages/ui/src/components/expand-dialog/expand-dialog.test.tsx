import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog } from "../dialog";
import { ExpandDialog, ExpandDialogPanes } from "./expand-dialog";

/** Radix portals the content, so assertions run against `document.body`. */
function renderOpen(ui: React.ReactNode) {
  return render(<Dialog open>{ui}</Dialog>);
}

describe("ExpandDialogPanes", () => {
  it("renders one full-width track and no region when there is no detail", () => {
    render(
      <ExpandDialogPanes>
        <p>view</p>
      </ExpandDialogPanes>,
    );
    expect(screen.getByText("view")).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.querySelector('[data-slot="expand-dialog-detail"]')).toBeNull();
  });

  it("names the detail region from the shared default", () => {
    render(
      <ExpandDialogPanes detail={<p>context</p>}>
        <p>view</p>
      </ExpandDialogPanes>,
    );
    expect(screen.getByRole("region", { name: "Details" })).toBeInTheDocument();
  });

  it("takes an explicit detailLabel", () => {
    render(
      <ExpandDialogPanes detail={<p>context</p>} detailLabel="Chart summary">
        <p>view</p>
      </ExpandDialogPanes>,
    );
    expect(screen.getByRole("region", { name: "Chart summary" })).toBeInTheDocument();
  });

  /*
   * Both panes are `overflow-auto`. axe's `scrollable-region-focusable` fires
   * on a scroll container with no focusable child, and a detail pane holding
   * only text is exactly that — so each pane takes its own tab stop unless the
   * caller opts out.
   */
  it("gives each pane a tab stop, with an opt-out", () => {
    const { rerender } = render(
      <ExpandDialogPanes detail={<p>context</p>}>
        <p>view</p>
      </ExpandDialogPanes>,
    );
    expect(document.querySelector('[data-slot="expand-dialog-view"]')).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(document.querySelector('[data-slot="expand-dialog-detail"]')).toHaveAttribute(
      "tabindex",
      "0",
    );

    rerender(
      <ExpandDialogPanes detail={<p>context</p>} viewTabIndex={-1} detailTabIndex={-1}>
        <p>view</p>
      </ExpandDialogPanes>,
    );
    expect(document.querySelector('[data-slot="expand-dialog-view"]')).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("writes the track sizes as custom properties so a runtime string can size the grid", () => {
    render(
      <ExpandDialogPanes detail={<p>context</p>} viewSize="3fr" detailSize="20rem">
        <p>view</p>
      </ExpandDialogPanes>,
    );
    const panes = document.querySelector('[data-slot="expand-dialog-panes"]') as HTMLElement;
    expect(panes.style.getPropertyValue("--expand-dialog-view-size")).toBe("3fr");
    expect(panes.style.getPropertyValue("--expand-dialog-detail-size")).toBe("20rem");
  });

  it("switches the grid axis with detailPlacement", () => {
    const { rerender } = render(
      <ExpandDialogPanes detail={<p>context</p>}>
        <p>view</p>
      </ExpandDialogPanes>,
    );
    const side = document.querySelector('[data-slot="expand-dialog-panes"]')!.className;
    expect(side).toContain("grid-cols-[var(--expand-dialog-view-size)");

    rerender(
      <ExpandDialogPanes detail={<p>context</p>} detailPlacement="bottom">
        <p>view</p>
      </ExpandDialogPanes>,
    );
    const bottom = document.querySelector('[data-slot="expand-dialog-panes"]')!.className;
    expect(bottom).not.toContain("grid-cols-[var(--expand-dialog-view-size)");
    expect(bottom).toContain("grid-rows-[var(--expand-dialog-view-size)");
  });

  it("stacks at the breakpoint and restores the side split above it", () => {
    render(
      <ExpandDialogPanes detail={<p>context</p>} stackBelow="md">
        <p>view</p>
      </ExpandDialogPanes>,
    );
    const cls = document.querySelector('[data-slot="expand-dialog-panes"]')!.className;
    expect(cls).toContain("grid-rows-[var(--expand-dialog-view-size)");
    expect(cls).toContain("md:grid-cols-[var(--expand-dialog-view-size)");
  });
});

describe("ExpandDialog", () => {
  it("names the dialog by its title", () => {
    renderOpen(
      <ExpandDialog title="Revenue by region">
        <p>view</p>
      </ExpandDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Revenue by region" })).toBeInTheDocument();
  });

  it("describes the dialog only when a description is supplied", () => {
    const { rerender } = renderOpen(
      <ExpandDialog title="T">
        <p>view</p>
      </ExpandDialog>,
    );
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby");

    rerender(
      <Dialog open>
        <ExpandDialog title="T" description="Trailing twelve months.">
          <p>view</p>
        </ExpandDialog>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby");
    expect(screen.getByText("Trailing twelve months.")).toBeInTheDocument();
  });

  /*
   * Radix positions the close button absolutely in the top inline-end corner.
   * Without the inline-end padding a long title runs underneath it — the single
   * easiest thing to drop when this anatomy moves between files.
   */
  it("keeps the header clear of the close button", () => {
    renderOpen(
      <ExpandDialog title="T">
        <p>view</p>
      </ExpandDialog>,
    );
    expect(document.querySelector('[data-slot="dialog-header"]')!.className).toContain("pe-12");
  });

  it("renders header actions on the title row", () => {
    renderOpen(
      <ExpandDialog title="T" actions={<button type="button">Download</button>}>
        <p>view</p>
      </ExpandDialog>,
    );
    const header = document.querySelector('[data-slot="dialog-header"]')!;
    expect(header.querySelector("button")).toHaveTextContent("Download");
  });

  /*
   * The body must NOT take a tab stop of its own: the two panes inside it are
   * the real scroll owners and each already takes one, so a focusable body
   * would add a third that scrolls nothing.
   */
  it("delegates scrolling to the panes, not the dialog body", () => {
    renderOpen(
      <ExpandDialog title="T" detail={<p>context</p>}>
        <p>view</p>
      </ExpandDialog>,
    );
    expect(document.querySelector('[data-slot="dialog-body"]')).toHaveAttribute("tabindex", "-1");
    expect(document.querySelector('[data-slot="expand-dialog-view"]')).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
