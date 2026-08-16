import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Wizard, WizardSteps, WizardStep, WizardNav, type WizardStepMeta } from "./wizard";

const steps: WizardStepMeta[] = [
  { id: "a", title: "Account" },
  { id: "b", title: "Profile" },
  { id: "c", title: "Review" },
];

function renderWizard(extra?: { validate?: () => boolean | Promise<boolean> }) {
  return render(
    <Wizard steps={steps}>
      <WizardSteps />
      <WizardStep step={0} validate={extra?.validate}>
        <p>Account content</p>
      </WizardStep>
      <WizardStep step={1}>
        <p>Profile content</p>
      </WizardStep>
      <WizardStep step={2}>
        <p>Review content</p>
      </WizardStep>
      <WizardNav />
    </Wizard>,
  );
}

describe("Wizard", () => {
  it("shows only the active step's content and marks the indicator", () => {
    renderWizard();
    expect(screen.getByText("Account content")).toBeInTheDocument();
    expect(screen.queryByText("Profile content")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Account");
  });

  it("advances and goes back", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Profile content")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Account content")).toBeInTheDocument();
  });

  it("disables Back on the first step", () => {
    renderWizard();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("blocks advance when validate returns false", async () => {
    const user = userEvent.setup();
    renderWizard({ validate: () => false });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Account content")).toBeInTheDocument();
    expect(screen.queryByText("Profile content")).not.toBeInTheDocument();
  });

  it("shows Finish on the last step", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument());
  });
});
