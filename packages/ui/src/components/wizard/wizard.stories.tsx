import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import { useState } from "react";
import { Wizard, WizardSteps, WizardStep, WizardNav, type WizardStepMeta } from "./wizard";

const meta = {
  title: "Navigation/Wizard",
  component: Wizard,
  tags: ["autodocs"],
  argTypes: {
    steps: {
      description: "Ordered step metadata (id, title, description) shown in the step indicator.",
      control: false,
      table: { category: "Data" },
    },
    step: {
      description: "Controlled active step index (0-based).",
      control: "number",
      table: { category: "State" },
    },
    defaultStep: {
      description: "Uncontrolled initial step index. Default 0.",
      control: "number",
      table: { category: "State" },
    },
    onStepChange: {
      description: "Callback fired when the active step changes.",
      control: false,
      table: { category: "Events" },
    },
    orientation: {
      description: "Layout direction for the step indicator and content.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Layout" },
    },
    className: {
      description: "Additional CSS classes applied to the wizard root.",
      control: "text",
      table: { category: "Styling" },
    },
    children: {
      description: "WizardSteps, WizardStep panels, and WizardNav composed inside.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof Wizard>;

export default meta;
type Story = StoryObj<typeof meta>;

const steps: WizardStepMeta[] = [
  { id: "account", title: "Account", description: "Login details" },
  { id: "profile", title: "Profile", description: "About you" },
  { id: "review", title: "Review", description: "Confirm" },
];

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-border bg-card p-4 text-card-foreground">{children}</div>
);

export const Default: Story = {
  render: () => (
    <Wizard steps={steps} className="max-w-xl">
      <WizardSteps />
      <WizardStep step={0}>
        <Panel>Step 1 — account details.</Panel>
      </WizardStep>
      <WizardStep step={1}>
        <Panel>Step 2 — profile details.</Panel>
      </WizardStep>
      <WizardStep step={2}>
        <Panel>Step 3 — review and confirm.</Panel>
      </WizardStep>
      <WizardNav onFinish={() => alert("Finished!")} />
    </Wizard>
  ),
  // Advances through all three steps via Next, then asserts the Finish button
  // appears on the last step and Back brings us back one step.
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    // Step 1 is visible
    await waitFor(() => expect(canvas.getByText("Step 1 — account details.")).toBeVisible());
    // Advance to step 2
    await userEvent.click(canvas.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(canvas.getByText("Step 2 — profile details.")).toBeVisible());
    // Advance to step 3
    await userEvent.click(canvas.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(canvas.getByText("Step 3 — review and confirm.")).toBeVisible());
    // On the last step, "Finish" replaces "Next"
    await waitFor(() => expect(canvas.getByRole("button", { name: /finish/i })).toBeVisible());
    // Back returns to step 2
    await userEvent.click(canvas.getByRole("button", { name: /back/i }));
    await waitFor(() => expect(canvas.getByText("Step 2 — profile details.")).toBeVisible());
  },
};

export const Vertical: Story = {
  render: () => (
    <Wizard steps={steps} orientation="vertical" className="max-w-2xl">
      <WizardSteps />
      <div className="flex flex-1 flex-col gap-4">
        <WizardStep step={0}>
          <Panel>Account details.</Panel>
        </WizardStep>
        <WizardStep step={1}>
          <Panel>Profile details.</Panel>
        </WizardStep>
        <WizardStep step={2}>
          <Panel>Review.</Panel>
        </WizardStep>
        <WizardNav />
      </div>
    </Wizard>
  ),
};

export const WithValidationGating: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [agreed, setAgreed] = useState(false);
    return (
      <Wizard steps={steps} className="max-w-xl">
        <WizardSteps />
        <WizardStep step={0} validate={() => agreed}>
          <Panel>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              I agree to continue (Next is blocked until checked).
            </label>
          </Panel>
        </WizardStep>
        <WizardStep step={1}>
          <Panel>Profile details.</Panel>
        </WizardStep>
        <WizardStep step={2}>
          <Panel>Review.</Panel>
        </WizardStep>
        <WizardNav />
      </Wizard>
    );
  },
};
