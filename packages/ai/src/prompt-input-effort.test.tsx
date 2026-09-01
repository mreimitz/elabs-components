import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type EffortLevel } from "@elabs-ai/components-ui";
import { PromptInputEffort } from "./prompt-input-effort";

const levels: EffortLevel[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
];

describe("PromptInputEffort", () => {
  it("defaults to the first (lowest) level", () => {
    render(<PromptInputEffort levels={levels} aria-label="Reasoning effort" />);
    expect(screen.getByRole("radio", { name: "Low", checked: true })).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("is uncontrolled: clicking a level fires onValueChange and moves the checked radio", async () => {
    const onValueChange = vi.fn();
    render(
      <PromptInputEffort
        levels={levels}
        aria-label="Reasoning effort"
        onValueChange={onValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "High" }));
    expect(onValueChange).toHaveBeenCalledWith("high");
    expect(screen.getByRole("radio", { name: "High", checked: true })).toBeInTheDocument();
  });

  it("is controlled via `value`", () => {
    render(<PromptInputEffort levels={levels} aria-label="Reasoning effort" value="max" />);
    expect(screen.getByRole("radio", { name: "Max", checked: true })).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
  });

  /**
   * The test the issue asks for: two ADJACENT levels must differ in their
   * ACCESSIBLE TEXT (not merely a class string, which would pass on
   * colour-only code) and in their RENDERED INDICATOR — a structural count of
   * how many rungs are marked filled, not a comparison of two class strings.
   */
  it("two adjacent levels differ in accessible text AND in the rendered fill indicator", () => {
    const { unmount } = render(
      <PromptInputEffort levels={levels} aria-label="Reasoning effort" value="medium" />,
    );

    // Accessible text: the checked radio's accessible name, and the visible
    // level-name text, both reflect "Medium".
    const mediumChecked = screen.getByRole("radio", { checked: true });
    expect(mediumChecked).toHaveAccessibleName("Medium");
    expect(screen.getByText("Medium")).toBeInTheDocument();

    // Rendered indicator: a structural count of filled rungs (`data-filled`),
    // not a class-string diff — "Medium" is the 2nd of 4 rungs, so exactly 2
    // are filled.
    const mediumFilledCount = document.querySelectorAll('[data-filled="true"]').length;
    expect(mediumFilledCount).toBe(2);

    unmount();

    render(<PromptInputEffort levels={levels} aria-label="Reasoning effort" value="high" />);

    const highChecked = screen.getByRole("radio", { checked: true });
    expect(highChecked).toHaveAccessibleName("High");
    expect(screen.getByText("High")).toBeInTheDocument();

    // "High" is the 3rd of 4 (adjacent) rungs, so exactly 3 are filled — one
    // more than "Medium", proving the indicator actually moved.
    const highFilledCount = document.querySelectorAll('[data-filled="true"]').length;
    expect(highFilledCount).toBe(3);

    // The two accessible names differ, and the two filled counts differ —
    // the assertion this test exists to make.
    expect(mediumChecked).not.toBe(highChecked);
    expect(mediumFilledCount).not.toBe(highFilledCount);
  });
});
