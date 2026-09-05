import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandTrigger } from "./command-trigger";

describe("CommandTrigger", () => {
  it("announces only its label — the shortcut glyph must not pollute the accessible name", () => {
    render(<CommandTrigger />);
    // #117: a Kbd inside a control concatenates into the computed name. Assert the
    // EXACT name; a regex match would happily pass on the polluted string.
    expect(screen.getByRole("button")).toHaveAccessibleName("Search");
  });

  it("takes a custom label and shortcut", () => {
    render(<CommandTrigger label="Find anything" shortcut="Ctrl K" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Find anything");
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });
});
