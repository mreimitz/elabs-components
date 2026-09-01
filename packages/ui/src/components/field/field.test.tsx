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
});
