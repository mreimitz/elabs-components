import type { Meta, StoryObj } from "@storybook/react-vite";
import { Snippet, SnippetAddon, SnippetCopyButton, SnippetInput } from "./snippet";
const meta = {
  title: "AI/Snippet",
  component: Snippet,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Snippet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Snippet code="npm i @elabs-ai/components-ui" className="max-w-sm">
      <SnippetInput />
      <SnippetAddon align="inline-end">
        <SnippetCopyButton />
      </SnippetAddon>
    </Snippet>
  ),
};
