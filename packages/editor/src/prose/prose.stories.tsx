import type { Meta, StoryObj } from "@storybook/react-vite";
import { Blockquote, Heading, InlineCode, Link, List, ListItem, Text } from "./prose";

const meta = {
  title: "Editor/Prose",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The typographic primitives every markdown renderer maps onto, not a renderer " +
          "itself — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Token-driven typography primitives the markdown preview maps onto: Heading, " +
          "Text, Link, List, Blockquote, InlineCode. Generic and theme-safe.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const All: Story = {
  render: () => (
    <div className="max-w-2xl space-y-3">
      <Heading level={1}>Heading level 1</Heading>
      <Heading level={2}>Heading level 2</Heading>
      <Heading level={3}>Heading level 3</Heading>
      <Text>
        Body text with an <Link href="https://example.com">external link</Link> and some{" "}
        <InlineCode>inline code</InlineCode>.
      </Text>
      <Text variant="muted">Muted helper text.</Text>
      <Blockquote>A blockquote rendered through the branded primitive.</Blockquote>
      <List>
        <ListItem>First bullet</ListItem>
        <ListItem>Second bullet</ListItem>
      </List>
      <List ordered>
        <ListItem>First step</ListItem>
        <ListItem>Second step</ListItem>
      </List>
    </div>
  ),
};
