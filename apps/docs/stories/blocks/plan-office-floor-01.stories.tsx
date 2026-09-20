import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { OfficeFloorPlan } from "@/components/plan-office-floor-01/office-floor-plan";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: OfficeFloorPlan,
  title: "Patterns/Blocks/Maps and Geo/Office Floor Plan",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Which rooms are free on this floor?",
      description: {
        component:
          "A custom, non-geographic map: the building itself is the map. `MapCanvas plan` declares the floor’s extent in centimetres once, and every shape after it is written in those units — no latitudes anywhere. Rooms are `MapGeoJSON` polygons whose state rides the fill tone AND the outline dash, so free and in use stay apart in greyscale; `MapPlanOverlay` puts one real button on each room for the keyboard; `MapPlanTable` repeats the floor as words, because a WebGL canvas prints blank and cannot be read by assistive technology.\n\nCopy-own it: `npx shadcn add plan-office-floor-01`.",
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
} satisfies Meta<typeof OfficeFloorPlan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // The exact accessible name, not a regex: the visible label has to come first
    // (WCAG 2.5.3), and if CI ever fails to hand MapLibre a WebGL context the canvas
    // renders its error panel instead — where this fails rather than passing on nothing.
    await expect(
      await canvas.findByRole("button", { name: "Helsinki, in use, meeting, 10 seats" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Rooms on level 3" })).toBeInTheDocument();
    await expect(canvas.getByRole("table", { name: /Every room on level 3/ })).toBeInTheDocument();
  },
};

/** The floor above, same extent: switch the data, keep the camera. */
export const UpperLevel: Story = { args: { level: 4 } };

/**
 * The surveyor’s drawing underneath, as a custom background picture in plan units.
 * It is held back at low opacity on purpose: the drawing is context, the rooms are
 * the ink, and a picture with baked-in colours fights the theme.
 */
export const WithSurveyDrawing: Story = { args: { showDrawing: true } };

/** Nothing to draw yet — the plan holds its shape instead of collapsing. */
export const Loading: Story = { args: { loading: true } };

/** A floor with no rooms on it says so, rather than showing an empty grid. */
export const EmptyFloor: Story = { args: { empty: true } };
