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
    expect(screen.getByRole("button", { name: /Auto/ })).toBeInTheDocument();
  });

  it("is uncontrolled: opens the menu, lists every mode, and selects one on click", async () => {
    const onValueChange = vi.fn();
    render(<PromptInputMode modes={modes} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole("button", { name: /Auto/ }));
    const planOption = await screen.findByRole("menuitemradio", { name: /Plan first/ });
    expect(planOption).toHaveAttribute("aria-checked", "false");

    await userEvent.click(planOption);
    expect(onValueChange).toHaveBeenCalledWith("plan");
    // The trigger's visible label updates to reflect the new selection.
    expect(await screen.findByRole("button", { name: /Plan first/ })).toBeInTheDocument();
  });

  it("is controlled via `value`: the app owns the selection, not the component", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <PromptInputMode modes={modes} value="plan" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("button", { name: /Plan first/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Plan first/ }));
    const autoOption = await screen.findByRole("menuitemradio", { name: /Auto/ });
    await userEvent.click(autoOption);

    expect(onValueChange).toHaveBeenCalledWith("auto");
    // A controlled component does not move on its own — the trigger only
    // updates once the app feeds the new value back in.
    expect(screen.getByRole("button", { name: /Plan first/ })).toBeInTheDocument();

    rerender(<PromptInputMode modes={modes} value="auto" onValueChange={onValueChange} />);
    expect(screen.getByRole("button", { name: /Auto/ })).toBeInTheDocument();
  });

  it("renders a mode's description and key hint inside the menu", async () => {
    render(<PromptInputMode modes={modes} />);
    await userEvent.click(screen.getByRole("button", { name: /Auto/ }));

    expect(await screen.findByText("Proposes a plan before acting")).toBeInTheDocument();
    expect(screen.getByText("⇧ Tab")).toBeInTheDocument();
  });
});
