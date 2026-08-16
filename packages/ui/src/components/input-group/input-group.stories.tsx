import type { Meta, StoryObj } from "@storybook/react-vite";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "./input-group";
const meta = {
  title: "Forms/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      description:
        "`outline` — bordered form-field look (default). `surface` — soft filled composer look with no hard border. `card` — `bg-card` well for nesting inside an already-tinted outer frame (the double card, #254); its fill is theme-driven, not universally white — raised on light themes, recessed on dark.",
      control: { type: "radio" },
      options: ["outline", "surface", "card"],
      table: { category: "Appearance" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
    children: {
      description: "Compose with InputGroupAddon, InputGroupInput, InputGroupButton, etc.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Search_: Story = {
  name: "Search",
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search…" />
    </InputGroup>
  ),
};
export const WithButton: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="0.00" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="sm">USD</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
// The composer look (#194, research 08 §C.1): soft `bg-surface-muted` fill +
// the focus-within ring — no hard border. Used by `PromptInput` in @elabs/components-ai.
export const Surface: Story = {
  render: () => (
    <InputGroup variant="surface" className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Ask anything…" />
    </InputGroup>
  ),
};
// The "double card" well (#254): nest a `card` InputGroup inside an
// already-tinted outer frame — `PromptInput`'s `tone="card"` prop wires this
// into the AI composer. The well's fill is theme-driven (raised on light
// themes, recessed on dark/blueprint), not universally white.
export const Card: Story = {
  render: () => (
    <div className="max-w-sm rounded-xl bg-surface-muted p-1.5">
      <InputGroup variant="card">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder="Ask anything…" />
      </InputGroup>
    </div>
  ),
};
