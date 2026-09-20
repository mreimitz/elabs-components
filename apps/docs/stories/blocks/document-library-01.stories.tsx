import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentLibrary } from "@/components/document-library-01/document-library";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DocumentLibrary,
  title: "Patterns/Blocks/Documents/Document library",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I let people open any file without leaving the product?",
      description: {
        component:
          "A data room with the file open beside the list: folders, a filter and one FileViewer that renders markdown, CSV, JSON, code, logs and images through lazily loaded adapters, with the viewer's own toolbar, find-in-document, pager and zoom.\n\nCopy-own it: `npx shadcn add document-library-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DocumentLibrary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
