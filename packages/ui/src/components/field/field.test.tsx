import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from "./field";

describe("Field compound anatomy", () => {
  // (1) FieldLabel's htmlFor matches the rendered control's id.
  it("associates FieldLabel with FieldControl via htmlFor/id", async () => {
    render(
      <FieldRoot>
        <FieldLabel>Name</FieldLabel>
        <FieldControl>
          <Input />
        </FieldControl>
      </FieldRoot>,
    );
    const input = screen.getByRole("textbox");
    const label = screen.getByText("Name");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", input.id);
    await userEvent.click(label);
    expect(input).toHaveFocus();
  });

  // (2) aria-describedby lists both description and error ids when both are
  // present, and drops the error id when there is no error.
  it("composes aria-describedby from mounted FieldDescription + FieldError, dropping the error id when absent", () => {
    const { rerender } = render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <FieldControl>
          <Input />
        </FieldControl>
        <FieldDescription>We only use this for receipts.</FieldDescription>
        <FieldError>{undefined}</FieldError>
      </FieldRoot>,
    );
    const input = screen.getByRole("textbox");
    let describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    let ids = describedBy!.split(" ");
    expect(ids).toHaveLength(1);
    expect(screen.getByText("We only use this for receipts.").id).toBe(ids[0]);
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <FieldControl>
          <Input />
        </FieldControl>
        <FieldDescription>We only use this for receipts.</FieldDescription>
        <FieldError>Enter a valid email address.</FieldError>
      </FieldRoot>,
    );
    describedBy = input.getAttribute("aria-describedby");
    ids = describedBy!.split(" ");
    expect(ids).toHaveLength(2);
    expect(screen.getByText("We only use this for receipts.").id).toBe(ids[0]);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a valid email address.");
    expect(alert.id).toBe(ids[1]);
  });

  // (3) aria-invalid / aria-required reflect FieldRoot's invalid/required state.
  it("reflects FieldRoot's invalid and required state on the control", () => {
    const { rerender } = render(
      <FieldRoot>
        <FieldLabel>Name</FieldLabel>
        <FieldControl>
          <Input />
        </FieldControl>
      </FieldRoot>,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-required");

    rerender(
      <FieldRoot invalid required>
        <FieldLabel>Name</FieldLabel>
        <FieldControl>
          <Input />
        </FieldControl>
      </FieldRoot>,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("supports two independent FieldControls sharing one FieldRoot's aria-describedby wiring", () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Name</FieldLabel>
        <div className="flex gap-2">
          <FieldControl>
            <Input id="first-name" placeholder="First" />
          </FieldControl>
          <FieldControl>
            <Input id="last-name" placeholder="Last" />
          </FieldControl>
        </div>
        <FieldError>Both names are required.</FieldError>
      </FieldRoot>,
    );
    const first = screen.getByPlaceholderText("First");
    const last = screen.getByPlaceholderText("Last");
    expect(first.id).toBe("first-name");
    expect(last.id).toBe("last-name");
    expect(first.id).not.toBe(last.id);

    const alert = screen.getByRole("alert");
    expect(first.getAttribute("aria-describedby")).toBe(alert.id);
    expect(last.getAttribute("aria-describedby")).toBe(alert.id);
    expect(first).toHaveAttribute("aria-invalid", "true");
    expect(last).toHaveAttribute("aria-invalid", "true");
  });

  it("wires aria-describedby correctly regardless of whether FieldDescription is placed before or after FieldControl", () => {
    render(
      <FieldRoot>
        <FieldLabel>Bio</FieldLabel>
        <FieldDescription>Shown on your public profile.</FieldDescription>
        <FieldControl>
          <Input />
        </FieldControl>
      </FieldRoot>,
    );
    const input = screen.getByRole("textbox");
    const description = screen.getByText("Shown on your public profile.");
    expect(input.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("keeps the label associated when the control supplies its own id (merge-child-wins semantics)", async () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <FieldControl>
          <Input id="consumer-owned-id" />
        </FieldControl>
      </FieldRoot>,
    );
    const input = screen.getByRole("textbox");
    expect(input.id).toBe("consumer-owned-id");
    expect(screen.getByText("Email")).toHaveAttribute("for", "consumer-owned-id");
    await userEvent.click(screen.getByText("Email"));
    expect(input).toHaveFocus();
  });

  // Fix round 1 (validator FAIL on cadac6e): `{condition && "message"}` is the
  // ordinary React idiom for optional content — when `condition` is false,
  // `children` is the boolean `false`, not `undefined`/`null`/`""`. FieldError
  // must render nothing (and register nothing) in that case, exactly like
  // FieldRow's `error ? … : null`, or a screen reader gets an alert with
  // nothing in it and `aria-describedby` points at a dangling target.
  it("renders no alert element (and no aria-describedby reference) when FieldError's children is false", () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <FieldControl>
          <Input />
        </FieldControl>
        <FieldError>{false}</FieldError>
      </FieldRoot>,
    );
    const input = screen.getByRole("textbox");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  // Fix round 1: two `FieldDescription`s under one `FieldRoot` (e.g. a hint
  // above the control and a hint below it) must not collide on one shared id —
  // each needs its own DOM id, and both must be referenced.
  it("gives two FieldDescriptions under one FieldRoot distinct ids, both referenced by aria-describedby", () => {
    render(
      <FieldRoot>
        <FieldLabel>Password</FieldLabel>
        <FieldDescription>Use at least 12 characters.</FieldDescription>
        <FieldControl>
          <Input type="password" />
        </FieldControl>
        <FieldDescription>You can change this later in settings.</FieldDescription>
      </FieldRoot>,
    );
    const input = screen.getByLabelText("Password");
    const first = screen.getByText("Use at least 12 characters.");
    const second = screen.getByText("You can change this later in settings.");
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
    const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(describedBy).toHaveLength(2);
  });

  // Fix round 1: unmounting one of two same-type parts must not strip the
  // still-mounted sibling's own reference — the registration has to be
  // tracked per INSTANCE, not per part type.
  it("keeps the remaining FieldDescription's reference intact after unmounting a sibling FieldDescription", async () => {
    function Harness() {
      const [showSecond, setShowSecond] = useState(true);
      return (
        <FieldRoot>
          <FieldLabel>Password</FieldLabel>
          <FieldDescription>Use at least 12 characters.</FieldDescription>
          <FieldControl>
            <Input type="password" />
          </FieldControl>
          {showSecond ? (
            <FieldDescription>You can change this later in settings.</FieldDescription>
          ) : null}
          <button type="button" onClick={() => setShowSecond(false)}>
            Hide second hint
          </button>
        </FieldRoot>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText("Password");
    const first = screen.getByText("Use at least 12 characters.");
    const firstId = first.id;
    expect(input.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Hide second hint" }));

    expect(screen.getByText("Use at least 12 characters.")).toBe(first);
    expect(input.getAttribute("aria-describedby")).toBe(firstId);
  });
});
