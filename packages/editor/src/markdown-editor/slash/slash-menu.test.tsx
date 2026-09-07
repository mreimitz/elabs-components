/**
 * Locking test for #157 (site 1): `SlashMenu`'s empty state used to be a bare
 * `<div>` inside `role="listbox"` — not `option`/`group`, so a user who types
 * a query matching nothing got silence (axe `aria-required-children`).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SlashMenu } from "./slash-menu";

describe("SlashMenu — empty state a11y (#157)", () => {
  it("announces the no-match message as a disabled option, not a bare div", () => {
    render(<SlashMenu commands={[]} onSelect={() => {}} emptyLabel="No matching blocks" />);

    const listbox = screen.getByRole("listbox", { name: "Insert block" });
    // Reachable via an assistive-tech query, not only present in the DOM.
    const empty = screen.getByRole("option", { name: "No matching blocks" });
    expect(listbox).toContainElement(empty);
    expect(empty).toHaveAttribute("aria-disabled", "true");

    // Every direct child of the listbox is an `option` or `group` — never a
    // bare, roleless element.
    for (const child of Array.from(listbox.children)) {
      expect(["option", "group"]).toContain(child.getAttribute("role"));
    }
  });
});
