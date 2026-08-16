import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckoutWizard } from "@/components/form-wizard-01/checkout-wizard";

const meta = {
  title: "Patterns/Blocks/Form Wizard",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A multi-step form with a horizontal numbered stepper (the Wizard primitive) — a checkout flow (Customer → Shipping → Payment → Review) with real fields, correct autocomplete/type hints, and a Descriptions review step. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add form-wizard-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <CheckoutWizard /> };
