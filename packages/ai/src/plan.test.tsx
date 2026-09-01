import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Plan,
  PlanApprove,
  PlanComment,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanRequestChanges,
  PlanStatusLine,
  PlanTitle,
} from "./plan";

describe("Plan decision contract (#108)", () => {
  it("exposes a labelled GROUP (not role=alert) containing the three actions while awaiting", () => {
    render(
      <Plan status="awaiting">
        <PlanHeader>
          <PlanTitle>Post the final note to #finance?</PlanTitle>
        </PlanHeader>
        <PlanFooter>
          <PlanComment>Comment</PlanComment>
          <PlanRequestChanges>Request changes</PlanRequestChanges>
          <PlanApprove>Approve</PlanApprove>
        </PlanFooter>
      </Plan>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const group = screen.getByRole("group");
    const labelledBy = group.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(screen.getByText("Post the final note to #finance?").id).toBe(labelledBy);

    expect(screen.getByText("Comment")).toBeInTheDocument();
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("Approve")).toBeInTheDocument();
  });

  it("presets the filled primary variant on PlanApprove, never outline/ghost", () => {
    render(
      <Plan status="awaiting">
        <PlanFooter>
          <PlanComment>Comment</PlanComment>
          <PlanRequestChanges>Request changes</PlanRequestChanges>
          <PlanApprove>Approve</PlanApprove>
        </PlanFooter>
      </Plan>,
    );

    expect(screen.getByText("Approve").className).toContain("bg-primary");
    expect(screen.getByText("Request changes").className).not.toContain("bg-primary");
    expect(screen.getByText("Comment").className).not.toContain("bg-primary");
  });

  it.each([
    ["approved", "Approved"],
    ["changes-requested", "Changes requested"],
  ] as const)("exposes role=alert with no actions once settled (%s)", (status, label) => {
    render(
      <Plan status={status}>
        <PlanFooter>
          <PlanComment>Comment</PlanComment>
          <PlanRequestChanges>Request changes</PlanRequestChanges>
          <PlanApprove>Approve</PlanApprove>
          <PlanStatusLine />
        </PlanFooter>
      </Plan>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByText("Comment")).not.toBeInTheDocument();
    expect(screen.queryByText("Request changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();

    // Recoverable in greyscale: the outcome is in TEXT, not only rail colour.
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders the outcome with a non-text glyph alongside the label (WCAG 1.4.1)", () => {
    render(
      <Plan status="approved">
        <PlanFooter>
          <PlanStatusLine />
        </PlanFooter>
      </Plan>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("renders no decision UI while streaming", () => {
    render(
      <Plan status="streaming">
        <PlanHeader>
          <PlanTitle>Drafting…</PlanTitle>
        </PlanHeader>
        <PlanFooter>
          <PlanComment>Comment</PlanComment>
          <PlanRequestChanges>Request changes</PlanRequestChanges>
          <PlanApprove>Approve</PlanApprove>
          <PlanStatusLine />
        </PlanFooter>
      </Plan>,
    );

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });
});

describe("Plan legacy (no `status`) API stays byte-compatible (#108)", () => {
  const legacy = (
    <Plan>
      <PlanHeader>
        <PlanTitle>Draft the Q3 board note</PlanTitle>
        <PlanDescription>Retrieve filings, reconcile, then summarize.</PlanDescription>
      </PlanHeader>
      <PlanContent>Body</PlanContent>
    </Plan>
  );

  it("renders no ARIA decision role at all", () => {
    render(legacy);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("produces the exact pre-change markup for the root Card (no role, no aria-labelledby, no rail)", () => {
    const { container } = render(legacy);
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute("role")).toBeNull();
    expect(card.getAttribute("aria-labelledby")).toBeNull();
    expect(card.className).not.toContain("border-s-");
    expect(card.className).toContain("shadow-none");
  });

  it("PlanTitle renders no `id` attribute when no status is set", () => {
    render(legacy);
    expect(screen.getByText("Draft the Q3 board note").hasAttribute("id")).toBe(false);
  });

  it("PlanApprove/PlanRequestChanges/PlanComment render nothing without an awaiting status", () => {
    render(
      <Plan>
        <PlanApprove>Approve</PlanApprove>
        <PlanRequestChanges>Request changes</PlanRequestChanges>
        <PlanComment>Comment</PlanComment>
      </Plan>,
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Request changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Comment")).not.toBeInTheDocument();
  });

  it("PlanStatusLine renders nothing without a status", () => {
    render(
      <Plan>
        <PlanStatusLine />
      </Plan>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("isStreaming keeps shimmering the title exactly as before", () => {
    render(
      <Plan isStreaming>
        <PlanHeader>
          <PlanTitle>Draft the Q3 board note</PlanTitle>
        </PlanHeader>
      </Plan>,
    );
    // Shimmer renders the text via its own motion span, not a plain text node.
    expect(screen.getByText("Draft the Q3 board note")).toBeInTheDocument();
  });
});

describe("Plan `status` supersedes `isStreaming` when both are given (#108)", () => {
  it("a settled status stops the shimmer even when isStreaming is still true", () => {
    render(
      <Plan status="approved" isStreaming>
        <PlanHeader>
          <PlanTitle>Draft the Q3 board note</PlanTitle>
        </PlanHeader>
        <PlanFooter>
          <PlanStatusLine />
        </PlanFooter>
      </Plan>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("status='streaming' plus isStreaming=false still shimmers", () => {
    render(
      <Plan status="streaming" isStreaming={false}>
        <PlanHeader>
          <PlanTitle>Draft the Q3 board note</PlanTitle>
        </PlanHeader>
      </Plan>,
    );
    // No decision role while streaming, and the title still renders.
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Draft the Q3 board note")).toBeInTheDocument();
  });
});
