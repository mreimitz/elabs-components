import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "./combobox";
describe("Combobox", () => {
  it("renders the placeholder on the trigger", () => {
    render(<Combobox options={[{ label: "A", value: "a" }]} placeholder="Pick one" />);
    // The trigger uses role="combobox"; that ARIA role does not take its
    // accessible name from text content, so assert the visible placeholder text.
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  // #343 — disabled prop
  it("disables the trigger and never opens the popover when disabled", async () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Combobox ref={ref} disabled options={[{ label: "A", value: "a" }]} placeholder="Pick one" />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(ref.current).toBe(trigger);

    await userEvent.click(trigger);
    expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("is excluded from tab order when disabled (native disabled semantics)", () => {
    render(<Combobox disabled options={[{ label: "A", value: "a" }]} />);
    const trigger = screen.getByRole("combobox");
    // A native `disabled` button is always excluded from the tab order —
    // no `tabIndex` gymnastics needed.
    expect(trigger).toBeDisabled();
  });

  // #347 — accessible-name passthrough
  it("names the trigger via aria-label, distinct from the selected value", () => {
    render(
      <Combobox
        aria-label="Session switcher"
        options={[{ label: "Alpha", value: "a" }]}
        value="a"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Session switcher" });
    // The value is still visible as the control's current state.
    expect(trigger).toHaveTextContent("Alpha");
  });

  it("spreads triggerProps onto the trigger without clobbering role/aria-expanded", () => {
    render(
      <Combobox
        options={[{ label: "A", value: "a" }]}
        triggerProps={{ "data-testid": "env-combobox" }}
      />,
    );
    const trigger = screen.getByTestId("env-combobox");
    expect(trigger).toHaveAttribute("role", "combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the selected custom value on the trigger even though it isn't in options", async () => {
    render(
      <Combobox allowCustomValue options={[{ label: "Alpha", value: "a" }]} value="Custom Value" />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Custom Value");
  });
});

// #359 — allowCustomValue. A nested describe because these tests TYPE into the
// cmdk-backed search input, which internally calls `Element.scrollIntoView` to
// keep the auto-selected item visible — jsdom doesn't implement it, and the
// project's global vitest setup deliberately provides no stub (see
// packages/ui/vitest.setup.ts), so third-party libraries that don't
// feature-detect need a local, scoped stub (same pattern as tree.test.tsx).
describe("Combobox allowCustomValue", () => {
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

  beforeEach(() => {
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("accepts a typed value not present in options when allowCustomValue is set (Enter)", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        allowCustomValue
        options={[{ label: "Alpha", value: "a" }]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    await userEvent.type(input, "Custom Value{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("Custom Value");
  });

  it("accepts a typed value not present in options when allowCustomValue is set (click)", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        allowCustomValue
        options={[{ label: "Alpha", value: "a" }]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    await userEvent.type(input, "Canary");
    const customItem = await screen.findByRole("option", { name: /use.*canary/i });
    await userEvent.click(customItem);
    expect(onValueChange).toHaveBeenCalledWith("Canary");
  });

  it("does NOT emit an unlisted value when allowCustomValue is unset (regression guard)", async () => {
    const onValueChange = vi.fn();
    render(<Combobox options={[{ label: "Alpha", value: "a" }]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    await userEvent.type(input, "Custom Value{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("option", { name: /use/i })).not.toBeInTheDocument();
  });

  it("still filters real suggestions while allowCustomValue is set", async () => {
    render(
      <Combobox
        allowCustomValue
        options={[
          { label: "Alpha", value: "a" },
          { label: "Beta", value: "b" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    await userEvent.type(input, "Alpha");
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Beta" })).not.toBeInTheDocument();
    // An exact match to an existing option must not also offer a redundant
    // "Use…" custom-value entry.
    expect(screen.queryByRole("option", { name: /use/i })).not.toBeInTheDocument();
  });

  it("keyboard: ArrowDown moves the highlight off the auto-selected top match, and Enter accepts it", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        allowCustomValue
        options={[
          { label: "Alpha", value: "alpha" },
          { label: "Alphabet", value: "alphabet" },
        ]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    // "Alpha" is an EXACT match (case-insensitive) for the typed text, so no
    // custom-value item is offered — only the two real options are ranked.
    await userEvent.type(input, "Alpha");
    await screen.findByRole("option", { name: "Alpha" });
    await screen.findByRole("option", { name: "Alphabet" });
    expect(screen.queryByRole("option", { name: /use/i })).not.toBeInTheDocument();
    // The exact match ("Alpha") auto-ranks first/highlighted; one ArrowDown
    // moves the highlight to "Alphabet", and Enter accepts THAT option — not
    // whatever was auto-selected by default.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("alphabet");
  });

  // Regression lock: cmdk re-sorts items by score and auto-highlights the top
  // one. Giving the synthetic "Use …" row the SEARCH TEXT as its `value` made
  // it score a perfect 1, so it outranked every real PARTIAL match and stole
  // the highlight — typing "Alp" and pressing Enter emitted "Alp" instead of
  // selecting "Alpha". The row now carries a sentinel value scored just above
  // zero, so it always renders but always sorts last.
  it("ranks the custom-value row LAST, so Enter still selects a real partial match", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        allowCustomValue
        options={[
          { label: "Alpha", value: "alpha" },
          { label: "Beta", value: "beta" },
        ]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    // A PARTIAL match — "Alpha" is offered AND the custom row is offered.
    await userEvent.type(input, "Alp");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Alpha", 'Use "Alp"']);
    // The real suggestion — not the custom row — is the auto-highlighted one.
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("alpha");
    expect(onValueChange).not.toHaveBeenCalledWith("Alp");
  });

  it("still accepts the custom value from a partial match via ArrowDown + Enter", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        allowCustomValue
        options={[{ label: "Alpha", value: "alpha" }]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Search…");
    await userEvent.type(input, "Alp");
    // Move off the auto-highlighted "Alpha" onto the trailing custom row.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("Alp");
  });

  it("Escape closes the popover without clearing the already-selected value", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        allowCustomValue
        options={[{ label: "Alpha", value: "a" }]}
        value="a"
        onValueChange={onValueChange}
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    const input = await screen.findByPlaceholderText("Search…");
    await userEvent.type(input, "something");
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent("Alpha");
  });
});
