import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageFeedback } from "./message-feedback";

describe("MessageFeedback", () => {
  it("renders labelled thumbs up/down controls", () => {
    render(<MessageFeedback />);
    expect(screen.getByRole("button", { name: "Good response" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bad response" })).toBeInTheDocument();
  });

  it("emits onSubmit and marks the root submitted (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { container } = render(<MessageFeedback onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Good response" }));
    expect(onSubmit).toHaveBeenCalledWith({ type: "positive" });
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-submitted", "true");
    expect(root).toHaveAttribute("data-feedback", "positive");
  });

  it("auto-disables both buttons after submit", async () => {
    const user = userEvent.setup();
    render(<MessageFeedback />);
    await user.click(screen.getByRole("button", { name: "Bad response" }));
    expect(screen.getByRole("button", { name: "Good response" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bad response" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bad response" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not fire again once submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MessageFeedback onSubmit={onSubmit} />);
    const up = screen.getByRole("button", { name: "Good response" });
    await user.click(up);
    await user.click(up); // disabled now — no-op
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reflects a controlled value", () => {
    render(<MessageFeedback value="negative" />);
    expect(screen.getByRole("button", { name: "Bad response" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Good response" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("respects the disabled prop", () => {
    render(<MessageFeedback disabled />);
    expect(screen.getByRole("button", { name: "Good response" })).toBeDisabled();
  });
});
