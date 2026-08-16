import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffEditor } from "./diff-editor";

const meta = {
  title: "Editor/DiffEditor",
  component: DiffEditor,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DiffEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const ORIGINAL = `export function greet(name) {
  return "Hello " + name;
}
`;

const MODIFIED = `export function greet(name: string): string {
  // Use a template literal.
  return \`Hello \${name}!\`;
}
`;

export const SideBySide: Story = {
  render: () => (
    <div className="h-[360px] w-full border border-border">
      <DiffEditor language="typescript" original={ORIGINAL} modified={MODIFIED} />
    </div>
  ),
};

export const Inline: Story = {
  render: () => (
    <div className="h-[360px] w-full border border-border">
      <DiffEditor
        language="typescript"
        original={ORIGINAL}
        modified={MODIFIED}
        renderSideBySide={false}
      />
    </div>
  ),
};
