import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type OperatingMode } from "@elabs-ai/components-ui";
import { PromptInputMode } from "./prompt-input-mode";

const modes: OperatingMode[] = [
  { id: "auto", label: "Auto", description: "Acts without asking" },
  {
    id: "plan",
    label: "Plan first",
    description: "Proposes a plan before acting",
    keyHint: "⇧ Tab",
  },
];

describe("PromptInputMode", () => {
  it("defaults to the first mode and shows it on the trigger", () => {
    render(<PromptInputMode modes={modes} />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAccessibleName("Auto");
  });

  it("is uncontrolled: opens the menu, lists every mode, and selects one on click", async () => {
    const onValueChange = vi.fn();
    render(<PromptInputMode modes={modes} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Auto" }));
    const planOption = await screen.findByRole("menuitemradio", { name: "Plan first" });
    expect(planOption).toHaveAccessibleName("Plan first");
    expect(planOption).toHaveAttribute("aria-checked", "false");

    await userEvent.click(planOption);
    expect(onValueChange).toHaveBeenCalledWith("plan");
    // The trigger's visible label updates to reflect the new selection.
    const trigger = await screen.findByRole("button");
    expect(trigger).toHaveAccessibleName("Plan first");
  });

  it("is controlled via `value`: the app owns the selection, not the component", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <PromptInputMode modes={modes} value="plan" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName("Plan first");

    await userEvent.click(screen.getByRole("button", { name: "Plan first" }));
    const autoOption = await screen.findByRole("menuitemradio", { name: "Auto" });
    expect(autoOption).toHaveAccessibleName("Auto");
    await userEvent.click(autoOption);

    expect(onValueChange).toHaveBeenCalledWith("auto");
    // A controlled component does not move on its own — the trigger only
    // updates once the app feeds the new value back in.
    expect(screen.getByRole("button")).toHaveAccessibleName("Plan first");

    rerender(<PromptInputMode modes={modes} value="auto" onValueChange={onValueChange} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Auto");
  });

  it("renders a mode's description and key hint inside the menu", async () => {
    render(<PromptInputMode modes={modes} />);
    await userEvent.click(screen.getByRole("button", { name: "Auto" }));

    expect(await screen.findByText("Proposes a plan before acting")).toBeInTheDocument();
    expect(screen.getByText("⇧ Tab")).toBeInTheDocument();
  });

  it("gives a menu item an accessible name that is exactly its label — the description and key hint never join it (#153)", async () => {
    render(<PromptInputMode modes={modes} />);
    await userEvent.click(screen.getByRole("button", { name: "Auto" }));

    const planOption = await screen.findByRole("menuitemradio", { name: "Plan first" });
    expect(planOption).toHaveAccessibleName("Plan first");

    // The description is still associated for assistive tech — as a
    // description, not folded into the name.
    expect(planOption).toHaveAccessibleDescription("Proposes a plan before acting");
  });

  it("resolves the accessible description even when a consumer-supplied mode id contains whitespace (#153)", async () => {
    const modesWithSpaceId: OperatingMode[] = [
      { id: "auto", label: "Auto", description: "Acts without asking" },
      {
        id: "plan first",
        label: "Plan first",
        description: "Proposes a plan before acting",
      },
    ];
    render(<PromptInputMode modes={modesWithSpaceId} />);
    await userEvent.click(screen.getByRole("button", { name: "Auto" }));

    const planOption = await screen.findByRole("menuitemradio", { name: "Plan first" });
    // `aria-describedby` is a space-separated token list of IDs — an id
    // built from a raw mode value containing whitespace (e.g. "plan first")
    // splits into two references, breaking the association.
    expect(planOption).toHaveAccessibleDescription("Proposes a plan before acting");
  });
});
