import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rating } from "./rating";

describe("Rating", () => {
  it("renders `max` interactive stars as a radiogroup", () => {
    render(<Rating defaultValue={0} max={5} aria-label="Quality" />);
    expect(screen.getByRole("radiogroup", { name: "Quality" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("marks the current star as checked", () => {
    render(<Rating value={3} aria-label="Quality" />);
    expect(screen.getByRole("radio", { name: "3 stars" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "2 stars" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onValueChange when a star is clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating defaultValue={0} onValueChange={onValueChange} aria-label="Quality" />);
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onValueChange).toHaveBeenCalledWith(4);
  });

  it("adjusts the value with arrow keys", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Rating defaultValue={2} onValueChange={onValueChange} aria-label="Quality" />);
    await user.tab(); // focus the roving tab stop
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith(3);
  });

  it("renders readOnly as a non-interactive img with an accessible label", () => {
    render(<Rating value={4} max={5} readOnly />);
    expect(screen.getByRole("img", { name: "4 out of 5" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
