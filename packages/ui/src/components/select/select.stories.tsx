import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
const meta = { title: "Forms/Select", component: Select, tags: ["autodocs"] } satisfies Meta<
  typeof Select
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Select defaultValue="prod">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Environment" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="prod">Production</SelectItem>
        <SelectItem value="staging">Staging</SelectItem>
        <SelectItem value="dev">Dev</SelectItem>
      </SelectContent>
    </Select>
  ),
  // Opens the listbox (Radix portal), picks a different option, and confirms the
  // trigger now reflects the new selection.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).toHaveTextContent("Production");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("option", { name: "Staging" }));
    await expect(trigger).toHaveTextContent("Staging");
    // A value that FITS gains no native `title` (#332): an unconditional one
    // would silently become this combobox's accessible name — a field named
    // after its own value is not a named field.
    await expect(trigger).not.toHaveAttribute("title");
  },
};

const LONG_LABEL = "prod-eu-west-1 · 2026-08-01 · 12 tools";

/**
 * A long, composed value clipped by `line-clamp-1`, recovered on mouse hover
 * by the automatic native `title` — the zero-extra-code path. The trigger
 * measures its own content, so the `title` appears here and NOT on a short
 * value (see `Default`, which has none).
 *
 * `aria-label` is on the trigger because the value is not a name: the `title`
 * is a hover affordance, never the field's label.
 */
export const ClippedValueGetsTitle: Story = {
  render: () => (
    <Select defaultValue={LONG_LABEL}>
      <SelectTrigger className="w-56" aria-label="Environment">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={LONG_LABEL}>{LONG_LABEL}</SelectItem>
        <SelectItem value="dev">Dev</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox");
    await waitFor(() => expect(trigger).toHaveAttribute("title", LONG_LABEL));
  },
};

/**
 * The keyboard-reachable recovery: a `Tooltip` composition, which Radix opens
 * on focus as well as hover. `autoTitle={false}` is REQUIRED here — otherwise
 * the native `title` and the Radix tooltip both appear on hover, one on top of
 * the other.
 */
export const LongComposedLabel: Story = {
  render: () => (
    <TooltipProvider delayDuration={0}>
      <Select defaultValue={LONG_LABEL}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger className="w-56" aria-label="Environment" autoTitle={false}>
              <SelectValue />
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent>{LONG_LABEL}</TooltipContent>
        </Tooltip>
        <SelectContent>
          <SelectItem value={LONG_LABEL}>{LONG_LABEL}</SelectItem>
          <SelectItem value="staging">Staging</SelectItem>
        </SelectContent>
      </Select>
    </TooltipProvider>
  ),
  // Focus the trigger directly (the keyboard path, not a click) and confirm the
  // tooltip content becomes visible — and that no competing native `title` was
  // left behind.
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).not.toHaveAttribute("title");

    trigger.focus();
    await expect(trigger).toHaveFocus();
    const body = within(canvasElement.ownerDocument.body);
    const content = await body.findByText(LONG_LABEL, { selector: "[data-side]" });
    await waitFor(() => expect(content).toBeVisible());
  },
};
