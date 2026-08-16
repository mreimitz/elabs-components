import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("accepts typed text", async () => {
    render(<Input aria-label="email" />);
    const el = screen.getByLabelText<HTMLInputElement>("email");
    await userEvent.type(el, "hi");
    expect(el.value).toBe("hi");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input aria-label="email" disabled />);
    const el = screen.getByLabelText<HTMLInputElement>("email");
    expect(el).toBeDisabled();
  });
});
