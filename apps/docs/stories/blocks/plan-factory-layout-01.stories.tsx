import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FactoryLayout } from "@/components/plan-factory-layout-01/factory-layout";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: FactoryLayout,
  title: "Patterns/Blocks/Maps and Geo/Factory Layout",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Which cell stopped, and what is it costing the line?",
      description: {
        component:
          "The plant floor as the map, drawn in metres through `MapCanvas plan`. Each cell’s state is carried four times over: the tone wash, a hatch texture generated on a canvas and registered with the map, the outline dash, and the word in the legend and the table. That split is deliberate — MapLibre accepts a pattern and a dash from feature PROPERTIES but not from feature-state, which leaves hover and selection the opacity and width channels, with no collision. In greyscale the four states are still four states.\n\nCopy-own it: `npx shadcn add plan-factory-layout-01`.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-[720px] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FactoryLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static by default: one deterministic moment of the plant, so a screenshot means something. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: /^Cell A1, / })).toBeInTheDocument();
    // The legend and the table repeat every state as a word — the greyscale channel and
    // the assistive-technology channel at once.
    await expect(
      canvas.getByRole("list", { name: "What each cell’s appearance means" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("table", { name: /Every machine cell/ })).toBeInTheDocument();
  },
};

/**
 * The same plant, ticking. Each tick walks the same seeded sequence forward, so “live”
 * never means “different every run”.
 */
export const LiveStatus: Story = { args: { live: true } };
