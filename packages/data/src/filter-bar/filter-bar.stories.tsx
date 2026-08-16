import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@qlik-coe-emea/qlabs-components-ui";
import { FilterBar } from "./filter-bar";
import { SearchInput } from "../search-input";
import { FacetFilter } from "../facet-filter";

const statusOptions = [
  { label: "Healthy", value: "healthy" },
  { label: "Degraded", value: "degraded" },
  { label: "Down", value: "down" },
];

const meta = {
  title: "Data/FilterBar",
  component: FilterBar,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The two-cluster table toolbar: filters on the leading edge, actions on the trailing " +
          "edge. It owns no state — compose it from `SearchInput`, `FacetFilter` and " +
          "`ColumnPicker` and pass it to a DataTable's `toolbar` render-prop.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FilterBar>;
export default meta;
type Story = StoryObj<typeof meta>;

function Toolbar({ withActions = true }: { withActions?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  return (
    <FilterBar actions={withActions ? <Button size="sm">Export CSV</Button> : undefined}>
      <SearchInput value={query} onValueChange={setQuery} />
      <FacetFilter
        title="Status"
        options={statusOptions}
        selected={status}
        onSelectedChange={setStatus}
      />
    </FilterBar>
  );
}

export const Default: Story = {
  args: { children: null },
  render: () => <Toolbar />,
};

/** Without `actions` the trailing cluster is omitted entirely, not rendered empty. */
export const FiltersOnly: Story = {
  args: { children: null },
  render: () => <Toolbar withActions={false} />,
};
