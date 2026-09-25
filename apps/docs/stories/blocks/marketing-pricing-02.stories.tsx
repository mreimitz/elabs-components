import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingPricingCompare } from "@/components/marketing-pricing-02/marketing-pricing-compare";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingPricingCompare,
  title: "Patterns/Blocks/Marketing/Pricing compare",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Which plan has the thing I need?",
      description: {
        component:
          "The full feature matrix: four plans with price and a button in a header row that stays in view while the feature groups scroll past, cells that say included, not included or the limit in words, and a billing toggle that recomputes every price. The popular plan is named as such and framed. On a phone the same rows stack into one card per plan.\n\nCopy-own it: `npx shadcn add marketing-pricing-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingPricingCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Three plans, euro prices, and a smaller yearly discount. */
export const ThreePlansInEuro: Story = {
  args: {
    currency: "EUR",
    locale: "de-DE",
    yearlyDiscount: 0.1,
    plans: [
      {
        id: "solo",
        name: "Solo",
        audience: "One planner",
        monthly: 90,
        cta: "Start free",
        href: "#register",
      },
      {
        id: "team",
        name: "Team",
        audience: "One depot",
        monthly: 390,
        cta: "Start free",
        href: "#register",
        featured: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        audience: "A network",
        monthly: null,
        cta: "Talk to sales",
        href: "#contact",
      },
    ],
    groups: [
      {
        id: "core",
        label: "Core",
        features: [
          {
            id: "parcels",
            label: "Parcels a month",
            values: ["Up to 1,000", "Up to 20,000", "Unlimited"],
          },
          { id: "routing", label: "Route planning", values: [true, true, true] },
          { id: "replanning", label: "Live re-planning", values: [false, true, true] },
        ],
      },
      {
        id: "support",
        label: "Support",
        features: [
          {
            id: "email",
            label: "Email support",
            values: ["Next business day", "4 hours", "1 hour"],
          },
          { id: "csm", label: "Named success manager", values: [false, false, true] },
        ],
      },
    ],
  },
};
