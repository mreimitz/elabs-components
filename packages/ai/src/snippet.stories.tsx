import type { Meta, StoryObj } from "@storybook/react-vite";
import { Snippet, SnippetAddon, SnippetCopyButton, SnippetInput } from "./snippet";
const meta = {
  title: "AI/Snippet",
  component: Snippet,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A single-line copyable COMMAND — an `InputGroup` in a mono face wrapping a read-only value and a copy button (`npm i …`, a curl line, an id). Multi-line highlighted source with a language picker is `AI/CodeBlock`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). Nothing here highlights: `Snippet` never loads Shiki.",
      },
    },
  },
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
