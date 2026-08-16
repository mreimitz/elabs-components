import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttributionPanel } from "./attribution-panel";

const meta = {
  title: "Core/AttributionPanel",
  component: AttributionPanel,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The one surface where brand-ui's third-party notices are shown. Its content is " +
          "GENERATED from the repo (`pnpm gen:attributions`, gated by `pnpm attributions:check`), " +
          "so it cannot drift from what actually ships.\n\n" +
          "**Why it matters:** `MapCanvas` disables MapLibre's in-map attribution control by " +
          "default and the flow canvases hide the React Flow badge. The React Flow badge is an " +
          "MIT project's request, but the default Carto basemap's OpenStreetMap data is " +
          "ODbL-licensed and the credit is REQUIRED — mount this panel somewhere reachable " +
          "(About dialog, settings pane, footer link) to keep that obligation met.",
      },
    },
  },
  argTypes: {
    categories: {
      description: "Restrict to these categories, in the panel's own order.",
      table: { category: "Content" },
    },
    packages: {
      description:
        "Restrict to notices reachable through these packages — an app that never renders a map need not credit the basemap providers.",
      table: { category: "Content" },
    },
    requiredOnly: {
      description: "Show only notices a licence obliges the product to display.",
      control: "boolean",
      table: { category: "Content" },
    },
    maxHeight: {
      description: "Cap the body height and scroll inside it.",
      table: { category: "Layout" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof AttributionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full generated dataset, scrolling inside a fixed height. */
export const Default: Story = {
  args: { maxHeight: 420, className: "max-w-2xl" },
};

/**
 * The minimum a product must display: only the notices a licence obliges. This is
 * the variant to mount when screen space is tight — a footer "Attributions" link
 * or an About dialog section.
 */
export const RequiredOnly: Story = {
  args: { requiredOnly: true, className: "max-w-2xl" },
};

/** Scoped to one package — what an app that only renders maps has to credit. */
export const ScopedToMaps: Story = {
  args: {
    packages: ["@qlik-coe-emea/qlabs-components-maps"],
    className: "max-w-2xl",
  },
};

/** Adapted source and fonts only — the provenance half, without the dependency tail. */
export const SourceAndFonts: Story = {
  args: { categories: ["source", "font"], className: "max-w-2xl" },
};

/** A filter that matches nothing still renders a real empty state, never a blank box. */
export const Empty: Story = {
  args: { attributions: [], className: "max-w-2xl" },
};
