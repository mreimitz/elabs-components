import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeWorkspaceBlock } from "@/components/code-workspace/code-workspace";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CodeWorkspaceBlock,
  title: "Patterns/Blocks/AI and Terminal/Code Workspace",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A multi-file code editor with brand-ui tabs and token theming. Language is inferred from each file's extension; wire the editor's language workers once at the app entry.\n\nCopy-own it: `npx shadcn add code-workspace`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CodeWorkspaceBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three files of different languages, editable in place. */
export const Default: Story = {};
