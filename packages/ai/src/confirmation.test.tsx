import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ApprovalOption } from "@elabs-ai/components-ui";
import * as confirmation from "./confirmation";
import {
  ApprovalCard,
  ApprovalCardActions,
  ApprovalCardApprove,
  ApprovalCardDeny,
  ApprovalCardDescription,
  ApprovalCardOptions,
  ApprovalCardReason,
  ApprovalCardRequest,
  ApprovalCardTarget,
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

/**
 * The `Confirmation*` family is a CLOSED compatibility surface mirroring the
 * AI-Elements shape (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4).
 * New parts are `ApprovalCard*` only. Adding a name here is a decision, not a fix.
 */
const FROZEN_CONFIRMATION_EXPORTS = [
  "Confirmation",
  "ConfirmationTitle",
  "ConfirmationDescription",
  "ConfirmationRequest",
  "ConfirmationAccepted",
  "ConfirmationRejected",
  "ConfirmationActions",
  "ConfirmationAction",
  "ConfirmationApprove",
  "ConfirmationDeny",
].sort();

it("does not grow the Confirmation compatibility family", () => {
  const actual = Object.keys(confirmation)
    .filter((k) => k.startsWith("Confirmation"))
    .sort();
  expect(actual).toEqual(FROZEN_CONFIRMATION_EXPORTS);
});

describe("Confirmation binary preset is unaffected by the N-option API (#103)", () => {
  it("still renders exactly two actions and the same rail class with no `options` prop", () => {
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Proceed?</ConfirmationTitle>
          <ConfirmationActions>
            <ConfirmationDeny>Deny</ConfirmationDeny>
            <ConfirmationApprove>Approve</ConfirmationApprove>
          </ConfirmationActions>
        </ConfirmationRequest>
      </Confirmation>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("group").className).toContain("border-s-border-strong");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("ApprovalCardOptions (#103) — N-option, scoped decision", () => {
  const options: ApprovalOption[] = [
    { id: "once", label: "Yes", scope: "once" },
    { id: "session", label: "Yes, and don't ask again this session", scope: "session" },
    { id: "deny", label: "No", description: "Denies this action.", scope: "deny" },
  ];

  it("renders a real radiogroup via Radix, never a hand-rolled roving group", () => {
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Run the deploy script?</ConfirmationTitle>
          <ApprovalCardOptions options={options} />
        </ConfirmationRequest>
      </Confirmation>,
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("ArrowDown from the last option wraps to the first, and the selected option is reported to onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Run the deploy script?</ConfirmationTitle>
          <ApprovalCardOptions options={options} onConfirm={onConfirm} />
        </ConfirmationRequest>
      </Confirmation>,
    );

    const radios = screen.getAllByRole("radio");
    const [firstRadio, , lastRadio] = radios;
    lastRadio!.focus();
    await userEvent.keyboard("{ArrowDown}");

    // Radix's `RovingFocusGroup` wraps focus from the last item back to the
    // first — this is the roving-tabindex behavior we get for free by using
    // Radix instead of a hand-rolled `parentElement.children[i]` walk.
    expect(firstRadio).toHaveFocus();
    // Committing a focused native radio via Space is standard browser
    // behavior (independent of Radix's own auto-select-on-arrow-move, which
    // relies on a real document-level focus/click ordering that jsdom does
    // not reproduce faithfully). This still proves the acceptance criterion:
    // the option focus wrapped to is the one reported to onConfirm.
    await userEvent.keyboard(" ");

    await waitFor(() => expect(firstRadio).toBeChecked());
    expect(onConfirm).toHaveBeenLastCalledWith(options[0], undefined);
  });

  it("a denial with typed reason text calls onConfirm with both the option and the reason", async () => {
    const onConfirm = vi.fn();
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Delete the release branch?</ConfirmationTitle>
          <ApprovalCardReason />
          <ApprovalCardOptions options={options} onConfirm={onConfirm} />
        </ConfirmationRequest>
      </Confirmation>,
    );

    await userEvent.type(screen.getByRole("textbox"), "Not ready yet");
    await userEvent.click(screen.getByRole("radio", { name: /^no/i }));

    expect(onConfirm).toHaveBeenCalledWith(options[2], "Not ready yet");
  });

  it("falls back to a scope-derived description when the caller supplies none — never colour/data-* alone", () => {
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Install dependencies?</ConfirmationTitle>
          <ApprovalCardOptions
            options={[{ id: "always", label: "Yes, always", scope: "always" }]}
          />
        </ConfirmationRequest>
      </Confirmation>,
    );
    // No LocaleProvider is mounted, so `t()` falls back to the shipped English
    // default — real, visible text tied to the option via `aria-describedby`,
    // not a colour or a bare `data-*` attribute. Asserting the SENTENCE (not
    // the key) is what proves the central catalogue actually carries it.
    const radio = screen.getByRole("radio", { name: "Yes, always" });
    const describedBy = radio.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Applies to actions like this from now on.",
    );
  });

  it("prefers a caller-supplied description over the derived scope text", () => {
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Install dependencies?</ConfirmationTitle>
          <ApprovalCardOptions options={options} />
        </ConfirmationRequest>
      </Confirmation>,
    );
    expect(screen.getByText("Denies this action.")).toBeInTheDocument();
  });

  it("is uncontrolled by default and controlled when `value` is supplied", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Run the deploy script?</ConfirmationTitle>
          <ApprovalCardOptions options={options} value="once" onValueChange={onValueChange} />
        </ConfirmationRequest>
      </Confirmation>,
    );
    const sessionRadio = screen.getByRole("radio", {
      name: "Yes, and don't ask again this session",
    });
    await userEvent.click(sessionRadio);
    expect(onValueChange).toHaveBeenCalledWith("session");
    // Controlled: the caller did not update `value` in response, so the
    // checked state stays pinned to the `value` prop, not the click.
    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
    expect(sessionRadio).not.toBeChecked();

    rerender(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Run the deploy script?</ConfirmationTitle>
          <ApprovalCardOptions options={options} value="session" onValueChange={onValueChange} />
        </ConfirmationRequest>
      </Confirmation>,
    );
    expect(
      screen.getByRole("radio", { name: "Yes, and don't ask again this session" }),
    ).toBeChecked();
  });
});

describe("ApprovalCardTarget (#103)", () => {
  it("accepts arbitrary children — e.g. a command or diff preview", () => {
    render(
      <Confirmation state="approval-requested" approval={{ id: "t" }}>
        <ConfirmationRequest>
          <ConfirmationTitle>Apply this change?</ConfirmationTitle>
          <ApprovalCardTarget>
            <pre>rm -rf build/</pre>
          </ApprovalCardTarget>
        </ConfirmationRequest>
      </Confirmation>,
    );
    expect(screen.getByText("rm -rf build/")).toBeInTheDocument();
  });

  it("stays visible after the decision resolves (not gated by state)", () => {
    render(
      <Confirmation state="approval-responded" approval={{ id: "t", approved: true }}>
        <ApprovalCardTarget>rm -rf build/</ApprovalCardTarget>
      </Confirmation>,
    );
    expect(screen.getByText("rm -rf build/")).toBeInTheDocument();
  });
});
