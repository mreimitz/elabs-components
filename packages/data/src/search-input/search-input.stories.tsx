import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchInput } from "./search-input";

const meta = {
  title: "Data/SearchInput",
  component: SearchInput,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The SEARCH field, with a leading icon and a clear button; a plain text field is " +
          "`Core/Input` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Controlled search field with a leading icon and a clear button. Pair it with " +
          "`FilterBar` and drive a DataTable's global filter from the `toolbar` render-prop. " +
          "The label is visually hidden but real — the placeholder is never the accessible name.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Uncontrolled-looking wrapper so the stories are actually typeable. */
function Controlled({ initial = "", label }: { initial?: string; label?: string }) {
  const [value, setValue] = useState(initial);
  return <SearchInput value={value} onValueChange={setValue} label={label} />;
}

export const Default: Story = {
  args: { value: "", onValueChange: () => {} },
  render: () => <Controlled />,
};

/** With a value the clear button appears, named "Clear search" for AT. */
export const WithValue: Story = {
  args: { value: "billing", onValueChange: () => {} },
  render: () => <Controlled initial="billing" />,
};

/** The visually-hidden label is overridable when "Search" is too vague. */
export const CustomLabel: Story = {
  args: { value: "", onValueChange: () => {} },
  render: () => <Controlled label="Filter deployments" />,
};
