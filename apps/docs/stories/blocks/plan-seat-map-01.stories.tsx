import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { TrainSeatMap } from "@/components/plan-seat-map-01/train-seat-map";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: TrainSeatMap,
  title: "Patterns/Blocks/Maps and Geo/Train Seat Map",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Which seat, in which coach?",
      description: {
        component:
          "A reservation seat map on a plan of the train: three coaches of 64 seats, 192 regions, drawn in centimetres. That is far past what a Tab-and-arrow walk can carry, so the overlay runs in group mode — one button per coach, `Enter` to go in, `Escape` to come back out, `PageUp` and `PageDown` to change coach at either level. Seat states are seeded, so this is one deterministic train rather than a different one every run.\n\nCopy-own it: `npx shadcn add plan-seat-map-01`.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-[760px] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrainSeatMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Coaches first, seats once you are inside one — the way a passenger asks. */
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const coach = await canvas.findByRole("button", { name: "Coach A, 64 seats" });
    await expect(coach).toHaveAccessibleName("Coach A, 64 seats");
    // A coach’s button is a way in, not a toggle.
    await expect(coach).not.toHaveAttribute("aria-pressed");

    coach.focus();
    await userEvent.keyboard("{Enter}");

    const seat = await canvas.findByRole("button", { name: /^1A, / });
    await expect(seat).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /^Coach B/ })).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expect(await canvas.findByRole("button", { name: "Coach B, 64 seats" })).toBeVisible();
  },
};

/**
 * Every seat on the overlay at once — 192 buttons, which the overlay warns about in
 * development, and which is exactly why group mode is the default.
 */
export const EverySeatAtOnce: Story = { args: { mode: "regions" } };

/**
 * Which way the train runs, and the walk from the door of coach A to a seat in coach C:
 * chevrons along the aisle, and a curve sampled in plan units.
 */
export const DirectionOfTravel: Story = { args: { showWalk: true } };

/** No reservations on this service: a panel, not an empty plan. */
export const NoSeatData: Story = {
  args: { seats: { type: "FeatureCollection", features: [] } },
};
