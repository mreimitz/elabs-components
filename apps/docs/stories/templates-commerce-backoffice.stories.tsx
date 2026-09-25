import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import CommerceBackofficePage from "@/components/commerce-backoffice-page/commerce-backoffice-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CommerceBackofficePage,
  title: "Patterns/Templates/Commerce/Back Office",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For e-commerce operations teams",
      description: {
        component:
          "Orders, stock and prices for a web shop behind one set of tabs. Orders is the `grid-orders-detail-01` block (master / detail, floating filters); Replenishment groups stock by warehouse, flags lines that run out before a delivery could land (icon + words) and takes order quantities typed, pasted or filled down — or filled from the suggestion in one undoable batch; Prices is the `grid-price-editor-01` block.\n\nCopy-own it: `npx shadcn add commerce-backoffice-page` (pulls `workspace-shell`, `grid-orders-detail-01` and `grid-price-editor-01`).",
      },
    },
  },
  tags: ["autodocs"],
  // The shell's <ThemeSwitcher /> reads the tokens React context, so the screen
  // needs a real provider (see templates-revenue-ops.stories.tsx).
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof CommerceBackofficePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opens on the replenishment grid. */
export const Replenishment: Story = { args: { defaultTab: "stock" } };

/** Opens on the price list. */
export const Prices: Story = { args: { defaultTab: "prices" } };
