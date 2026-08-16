import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { ContextAsset } from "./context-panel";
import { FileTree, FileTreeFile, FileTreeFolder, ProducedAssetTree } from "./file-tree";

const meta = {
  title: "AI/FileTree",
  component: FileTree,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof FileTree>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default `code` variant — the IDE source tree (mono, boxed). Unchanged look. */
export const Default: Story = {
  render: () => (
    <FileTree className="max-w-sm" defaultExpanded={new Set(["src"])}>
      <FileTreeFolder path="src" name="src">
        <FileTreeFile path="src/index.ts" name="index.ts" />
        <FileTreeFile path="src/app.tsx" name="app.tsx" />
      </FileTreeFolder>
      <FileTreeFile path="package.json" name="package.json" />
    </FileTree>
  ),
};

/** `document` variant — sans, box-free: for trees of documents, not source. */
export const DocumentVariant: Story = {
  render: () => (
    <FileTree variant="document" className="max-w-sm">
      <FileTreeFile path="board-note.md" name="board-note.md" />
      <FileTreeFile path="summary.md" name="summary.md" />
    </FileTree>
  ),
};

const ASSETS: ContextAsset[] = [
  { id: "board-note", name: "board-note.md", type: "markdown", content: "# Note" },
  { id: "variance-query", name: "variance-check.sql", type: "sql", content: "SELECT 1;" },
  { id: "revenue", name: "revenue.csv", type: "csv", content: "a,b\n1,2" },
  { id: "trend", name: "trend.png", type: "image" },
];

/**
 * ProducedAssetTree — the document-variant preset (#193, research 04 §4):
 * asset-type icons first-class; selection feeds the ContextPanel drill-in.
 */
export const ProducedAssets: Story = {
  render: () => (
    <div className="max-w-80">
      <ProducedAssetTree assets={ASSETS} selectedId="board-note" onSelect={fn()} />
    </div>
  ),
};
