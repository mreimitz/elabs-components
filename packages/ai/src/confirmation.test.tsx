import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ApprovalCard,
  ApprovalCardActions,
  ApprovalCardApprove,
  ApprovalCardDeny,
  ApprovalCardDescription,
  ApprovalCardRequest,
  ApprovalCardTitle,
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationApprove,
  ConfirmationDeny,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "./confirmation";

describe("Confirmation outcome tone (#7) — quiet rail, no fill", () => {
  it("uses the success RAIL + a status icon when accepted (no colored wash)", () => {
    const { container } = render(
      <Confirmation state="approval-responded" approval={{ id: "t", approved: true }}>
        <ConfirmationAccepted>
          <ConfirmationTitle>Approved</ConfirmationTitle>
        </ConfirmationAccepted>
      </Confirmation>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-s-success");
    expect(alert.className).toContain("border-s-4");
    // Quiet rail: a neutral card ground, NOT a colored wash.
    expect(alert.className).not.toContain("bg-success/10");
    expect(alert.className).not.toContain("bg-destructive/10");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("uses the destructive RAIL when rejected (no colored wash)", () => {
    render(
      <Confirmation state="approval-responded" approval={{ id: "t", approved: false }}>
        <ConfirmationRejected>
          <ConfirmationTitle>Denied</ConfirmationTitle>
        </ConfirmationRejected>
      </Confirmation>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-s-destructive");
    expect(alert.className).not.toContain("bg-destructive/10");
    expect(alert.className).not.toContain("bg-success/10");
  });
});

describe("ApprovalCard pending treatment (#191, research 11 §B.3)", () => {
  const pending = (
    <Confirmation state="approval-requested" approval={{ id: "t" }}>
      <ConfirmationRequest>
        <ConfirmationTitle>Post the final note to #finance?</ConfirmationTitle>
        <ApprovalCardDescription>Visible to 42 people.</ApprovalCardDescription>
        <ConfirmationActions>
          <ConfirmationDeny>Deny</ConfirmationDeny>
          <ConfirmationApprove>Approve</ConfirmationApprove>
        </ConfirmationActions>
      </ConfirmationRequest>
    </Confirmation>
  );

  it("renders a quiet structural rail + lift while pending (no warning wash)", () => {
    render(pending);
    const card = screen.getByRole("group");
    expect(card.className).not.toContain("bg-warning/10");
    expect(card.className).toContain("border-s-4");
    expect(card.className).toContain("border-s-border-strong");
    expect(card.className).toContain("shadow-sm");
  });

  it("is a labelled group (NOT role=alert) while pending", () => {
    render(pending);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const card = screen.getByRole("group");
    const labelledBy = card.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(screen.getByText("Post the final note to #finance?").id).toBe(labelledBy);
  });

  it("renders the three zones: up-scaled title, consequence, separated action band", () => {
    render(pending);
    const title = screen.getByText("Post the final note to #finance?");
    expect(title.className).toContain("text-subtitle");
    expect(screen.getByText("Visible to 42 people.")).toBeInTheDocument();
    const band = screen.getByText("Approve").parentElement;
    expect(band?.className).toContain("border-t");
    expect(band?.className).toContain("border-border-strong");
  });

  it("uses the filled primary Approve + ghost Deny button grammar (never outline)", () => {
    render(pending);
    const approve = screen.getByText("Approve");
    const deny = screen.getByText("Deny");
    expect(approve.className).toContain("bg-primary");
    expect(deny.className).not.toContain("bg-primary");
    expect(deny.className).not.toContain("border-input");
    expect(deny.className).toContain("hover:bg-accent");
  });

  it("hides the actions once resolved", () => {
    render(
      <Confirmation state="approval-responded" approval={{ id: "t", approved: true }}>
        <ConfirmationActions>
          <ConfirmationAction>Approve</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>,
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });
});

describe("ApprovalCard alias", () => {
  it("exports the promoted ApprovalCard* front door over the same compound", () => {
    render(
      <ApprovalCard state="approval-requested" approval={{ id: "t" }}>
        <ApprovalCardRequest>
          <ApprovalCardTitle>Run the migration?</ApprovalCardTitle>
          <ApprovalCardActions>
            <ApprovalCardDeny>Deny</ApprovalCardDeny>
            <ApprovalCardApprove>Approve</ApprovalCardApprove>
          </ApprovalCardActions>
        </ApprovalCardRequest>
      </ApprovalCard>,
    );
    expect(screen.getByRole("group")).toBeInTheDocument();
    expect(screen.getByText("Run the migration?")).toBeInTheDocument();
    expect(screen.getByText("Approve").className).toContain("bg-primary");
  });
});
