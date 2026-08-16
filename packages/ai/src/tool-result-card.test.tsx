import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolResultCard } from "./tool-result-card";

describe("ToolResultCard (#192, research 10 §B.4)", () => {
  it("hosts the artifact as children on the elevation channel (fill + shadow, no border)", () => {
    render(
      <ToolResultCard
        data-testid="card"
        title="Revenue by region — Q3 vs Q2"
        summary="Total $48.2M · +12.4% QoQ"
        status="complete"
      >
        <div data-testid="artifact">chart</div>
      </ToolResultCard>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("bg-surface-elevated");
    expect(card.className).toContain("shadow-sm");
    expect(card.className.split(" ")).not.toContain("border");
    expect(screen.getByTestId("artifact")).toBeInTheDocument();
    expect(screen.getByText("Revenue by region — Q3 vs Q2")).toBeInTheDocument();
    expect(screen.getByText("Total $48.2M · +12.4% QoQ")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument(); // StatusBadge
  });

  it("renders the details slot, merges className and spreads props", () => {
    render(
      <ToolResultCard
        data-testid="card"
        className="custom-card"
        aria-label="result"
        details={<div data-testid="details">technical details</div>}
      >
        body
      </ToolResultCard>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("custom-card");
    expect(card).toHaveAttribute("aria-label", "result");
    expect(screen.getByTestId("details")).toBeInTheDocument();
  });

  /*
   * The artifact's own chrome shares the title row — it never gets a second
   * strip above the heading. A hover-revealed toolbar row costs a whole line of
   * vertical space in a chat transcript and hides the controls until you find
   * them.
   */
  it("puts artifact actions on the title row, between the title and the status", () => {
    render(
      <ToolResultCard
        title="Recent invoices"
        status="complete"
        actions={<button type="button">Expand</button>}
      >
        body
      </ToolResultCard>,
    );
    const row = screen.getByRole("heading", { name: "Recent invoices" }).parentElement!
      .parentElement!;
    const text = row.textContent ?? "";
    expect(text.indexOf("Recent invoices")).toBeLessThan(text.indexOf("Expand"));
    expect(text.indexOf("Expand")).toBeLessThan(text.indexOf("Complete"));
  });

  /* An actions-only card still gets its header — `hasHeader` must see the slot. */
  it("renders the header for an actions-only card", () => {
    render(<ToolResultCard actions={<button type="button">Download</button>}>body</ToolResultCard>);
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });
});
