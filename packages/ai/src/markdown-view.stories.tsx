import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownView } from "./markdown-view";

const meta = {
  title: "AI/MarkdownView",
  component: MarkdownView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof MarkdownView>;
export default meta;
type Story = StoryObj<typeof meta>;

const DOC = `# Quarterly summary

Revenue grew **12.4% QoQ**. See the [variance check](https://example.com) for details.

## Regional highlights

- EMEA $18.4M (+14%)
- Americas $21.2M (+8%)
- APAC $8.6M — watch churn

> Flagged by the automated variance check.

Inline \`code\` stays inline; fenced blocks go through Shiki:

\`\`\`sql
SELECT region, total FROM finance.revenue;
\`\`\`
`;

/** The full reading scale — markdown mapped onto the Prose* primitives. */
export const Default: Story = {
  args: { children: DOC },
  decorators: [
    (Story) => (
      <div className="max-w-prose">
        <Story />
      </div>
    ),
  ],
};

/**
 * The constrained rung for narrow embeds (research 09 §G.2): `baseHeadingLevel={2}`
 * maps a document `#` to the title rung — never "biggest text on screen" in a rail.
 */
export const ConstrainedHeadings: Story = {
  args: { children: DOC, baseHeadingLevel: 2 },
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
