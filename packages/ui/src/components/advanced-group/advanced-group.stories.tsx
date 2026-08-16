import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs/components-tokens";
import { Button } from "../button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import { AdvancedGroup } from "./advanced-group";

const meta = {
  title: "Forms/AdvancedGroup",
  component: AdvancedGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof AdvancedGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

function Field({ id, label, defaultValue }: { id: string; label: string; defaultValue?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} autoComplete="off" defaultValue={defaultValue} />
    </div>
  );
}

/**
 * Collapsed by default — and it says what is hidden. "3 changed" is the whole
 * point: a reader can tell the group holds edits without opening it.
 */
export const Default: Story = {
  args: { changedCount: 3 },
  render: (args) => (
    <div className="w-96">
      <AdvancedGroup {...args}>
        <Field id="adv-retries" label="Max retries" defaultValue="5" />
        <Field id="adv-timeout" label="Timeout (seconds)" defaultValue="120" />
        <Field id="adv-endpoint" label="Custom endpoint" defaultValue="eu-west-1.internal" />
      </AdvancedGroup>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /advanced/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(canvas.getByText("3 changed")).toBeVisible();

    await userEvent.click(trigger);

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(canvas.getByLabelText("Max retries")).toBeVisible());
    // Once the values are on screen the summary is noise.
    expect(canvas.queryByText("3 changed")).toBeNull();
  },
};

/** A free-form summary when "N changed" is not the useful thing to say. */
export const CustomSummary: Story = {
  args: { summary: "Using a custom endpoint", title: "Connection details" },
  render: Default.render,
};

/** Opened, for anyone auditing the expanded layout. */
export const Expanded: Story = {
  args: { defaultOpen: true, changedCount: 3 },
  render: Default.render,
};

/** Nothing has been touched, so there is nothing to summarise. */
export const Untouched: Story = {
  args: { changedCount: 0 },
  render: Default.render,
};

/** Its real home: the quiet tail of a settings dialog, under a `DialogSection`. */
export const InsideDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit schedule</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule settings</DialogTitle>
          <DialogDescription>
            When the pipeline runs, and what happens if it fails.
          </DialogDescription>
        </DialogHeader>
        <DialogSection title="Cadence" description="Times are in the workspace time zone.">
          <Field id="dlg-cron" label="Run at" defaultValue="02:00" />
        </DialogSection>
        <AdvancedGroup changedCount={2}>
          <Field id="dlg-retries" label="Max retries" defaultValue="5" />
          <Field id="dlg-timeout" label="Timeout (seconds)" defaultValue="120" />
        </AdvancedGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit schedule/i }));
    const doc = within(canvasElement.ownerDocument.body);
    const dialog = await doc.findByRole("dialog");
    const trigger = within(dialog).getByRole("button", { name: /advanced/i });
    await waitFor(() => expect(within(dialog).getByText("2 changed")).toBeVisible());
    await userEvent.click(trigger);
    await waitFor(() => expect(within(dialog).getByLabelText("Max retries")).toBeVisible());
  },
};

export const DefaultDark: Story = {
  name: "Default — dark",
  args: { changedCount: 3 },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: Default.render,
};

export const DefaultHighDecoration: Story = {
  name: "Default — high decoration",
  args: { changedCount: 3 },
  globals: { decoration: "10" },
  render: Default.render,
};
