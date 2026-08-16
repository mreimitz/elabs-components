import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./toggle";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";

describe("Toggle", () => {
  it("toggles pressed state", async () => {
    render(<Toggle aria-label="t">B</Toggle>);
    const t = screen.getByRole("button", { name: "t" });
    await userEvent.click(t);
    expect(t).toHaveAttribute("data-state", "on");
  });

  // Regression guard for #214: when a TooltipTrigger asChild wrapper merges
  // onto the toggle element it overwrites data-state="on" → "closed". The
  // active styles must survive via aria-pressed / aria-checked keying.
  it("carries aria-pressed=true and aria-keyed active classes when pressed, regardless of data-state", () => {
    render(
      <Toggle aria-label="bold" pressed>
        B
      </Toggle>,
    );
    const btn = screen.getByRole("button", { name: "bold" });

    // aria-pressed must be "true" — set by the Radix Toggle primitive alone,
    // not clobbered by a TooltipTrigger wrapper.
    expect(btn).toHaveAttribute("aria-pressed", "true");

    // The className must contain the aria-pressed-keyed active utilities so
    // the style applies even when data-state is overwritten to "closed".
    expect(btn.className).toContain("aria-pressed:bg-accent");
    expect(btn.className).toContain("aria-pressed:text-accent-foreground");
    expect(btn.className).toContain("aria-pressed:font-semibold");
    expect(btn.className).toContain("aria-pressed:border-primary");
  });

  it("carries aria-pressed=true and aria-keyed active classes on outline variant when pressed", () => {
    render(
      <Toggle aria-label="bold" variant="outline" pressed>
        B
      </Toggle>,
    );
    const btn = screen.getByRole("button", { name: "bold" });

    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toContain("aria-pressed:bg-accent");
    expect(btn.className).toContain("aria-pressed:text-accent-foreground");
    expect(btn.className).toContain("aria-pressed:font-semibold");
    expect(btn.className).toContain("aria-pressed:border-primary");
  });

  // Simulate the exact TooltipTrigger collision: data-state is clobbered to
  // "closed" after mount; the aria-pressed attribute (set by the toggle
  // primitive) must remain "true" and the class tokens must still be present.
  it("active style survives data-state being overwritten to closed (TooltipTrigger collision)", () => {
    render(
      <Toggle aria-label="bold" pressed>
        B
      </Toggle>,
    );
    const btn = screen.getByRole("button", { name: "bold" });

    // Simulate what TooltipTrigger asChild does: clobber data-state.
    btn.setAttribute("data-state", "closed");

    // aria-pressed is NOT affected by the data-state clobber.
    expect(btn).toHaveAttribute("aria-pressed", "true");

    // The aria-keyed class tokens must still be present in className — they
    // will activate in the browser via CSS [aria-pressed="true"] selectors.
    expect(btn.className).toContain("aria-pressed:bg-accent");
    expect(btn.className).toContain("aria-pressed:border-primary");

    // data-state is now "closed" (confirming the collision scenario).
    expect(btn).toHaveAttribute("data-state", "closed");
  });
});

describe("ToggleGroup / ToggleGroupItem (#214 regression)", () => {
  it("selected ToggleGroupItem carries aria-checked=true and aria-keyed active classes", () => {
    render(
      <ToggleGroup type="single" value="a">
        <ToggleGroupItem value="a" aria-label="item-a">
          A
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    const item = screen.getByRole("radio", { name: "item-a" });

    // ToggleGroupItem sets aria-checked, not aria-pressed.
    expect(item).toHaveAttribute("aria-checked", "true");

    // aria-checked-keyed active class tokens must be present.
    expect(item.className).toContain("aria-checked:bg-accent");
    expect(item.className).toContain("aria-checked:text-accent-foreground");
    expect(item.className).toContain("aria-checked:font-semibold");
    expect(item.className).toContain("aria-checked:border-primary");
  });

  it("active style on ToggleGroupItem survives data-state being overwritten to closed", () => {
    render(
      <ToggleGroup type="single" value="a">
        <ToggleGroupItem value="a" aria-label="item-a">
          A
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    const item = screen.getByRole("radio", { name: "item-a" });

    // Simulate TooltipTrigger asChild clobbering data-state.
    item.setAttribute("data-state", "closed");

    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item.className).toContain("aria-checked:bg-accent");
    expect(item.className).toContain("aria-checked:border-primary");
    expect(item).toHaveAttribute("data-state", "closed");
  });
});
