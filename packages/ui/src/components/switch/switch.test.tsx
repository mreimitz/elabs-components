import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";
describe("Switch", () => {
  it("toggles on click", async () => {
    render(<Switch aria-label="s" />);
    const sw = screen.getByRole("switch", { name: "s" });
    await userEvent.click(sw);
    expect(sw).toBeChecked();
  });
});
