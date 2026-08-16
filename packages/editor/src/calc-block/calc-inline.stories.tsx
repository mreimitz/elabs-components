import type { Meta, StoryObj } from "@storybook/react-vite";

import { CalcInline } from "./calc-inline";
import type { CalcSheet, EvaluateCalc } from "./types";

const meta = {
  title: "Editor/CalcInline",
  component: CalcInline,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof CalcInline>;

export default meta;
type Story = StoryObj<typeof meta>;

// Stand-in evaluator (the math engine is app/domain logic, outside the system).
const sheet = (display: string): CalcSheet => ({
  results: [{ line: 1, tokens: [], value: { kind: "currency", raw: 0, display } }],
});
const evaluate: EvaluateCalc = (src) => {
  if (src.includes("*")) return sheet("2,720 USD");
  if (src.includes("/")) return sheet("31.3%");
  return { results: [{ line: 1, tokens: [], error: { message: `Cannot evaluate "${src}"` } }] };
};

export const Default: Story = {
  args: { source: "85 USD * 32", evaluate },
};

/** In prose: the chip sits inline, the result reads in `text-calc-result`. */
export const InProse: Story = {
  render: () => (
    <p className="max-w-prose text-body text-foreground">
      The campaign spent <CalcInline source="85 USD * 32" evaluate={evaluate} /> last month, a{" "}
      <CalcInline source="980 / 3130" evaluate={evaluate} /> conversion rate — both computed by the
      consumer&rsquo;s engine.
    </p>
  ),
};

/** A bad expression renders a calm inline warning (icon + dotted underline), never throwing. */
export const ErrorState: Story = {
  args: { source: "foo + bar", evaluate },
};
