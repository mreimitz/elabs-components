import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssetPreview } from "./asset-preview";

const meta = {
  title: "AI/AssetPreview",
  component: AssetPreview,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      // The real host is the 20rem context rail — preview at that width.
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AssetPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

const BOARD_NOTE = `# Board note — Q3

Revenue grew **12.4% QoQ**, led by EMEA.

## Highlights

- EMEA $18.4M (+14%)
- Americas $21.2M (+8%)
`;

/** Markdown renders as a DOCUMENT via MarkdownView (the ASSET-2 fix) — toggle Raw for source. */
export const Markdown: Story = {
  args: {
    asset: { id: "board-note", name: "board-note.md", type: "markdown", content: BOARD_NOTE },
  },
};

/** Code/SQL renders via CodeBlock (Shiki), soft-wrapped for the narrow rail. */
export const Sql: Story = {
  args: {
    asset: {
      id: "variance-query",
      name: "variance-check.sql",
      type: "sql",
      content: "SELECT region, total\nFROM finance.revenue\nWHERE quarter = 'Q3';",
    },
  },
};

/** CSV renders as a small table with a row-count summary. */
export const Csv: Story = {
  args: {
    asset: {
      id: "revenue",
      name: "revenue.csv",
      type: "csv",
      content: "region,q2,q3\nEMEA,16.1,18.4\nAmericas,19.6,21.2\nAPAC,7.2,8.6",
    },
  },
};

/** Raw mode as the initial state. */
export const RawByDefault: Story = {
  args: {
    asset: { id: "board-note", name: "board-note.md", type: "markdown", content: BOARD_NOTE },
    defaultMode: "raw",
  },
};

/**
 * A format this package cannot parse, drawn by an injected renderer.
 *
 * `renderPreview` is how a PDF, a spreadsheet or a video reaches the rail:
 * `@qlik-coe-emea/qlabs-components-viewer` is a layer PEER of this package, so
 * neither may import the other (ADR 0024 §6) and the consuming app owns the
 * edge — `renderPreview={(asset) => asset.source ? <FileViewer source={asset.source} /> : null}`.
 * The stand-in below keeps this story free of that import.
 *
 * A renderer that returns `null` declines, so every built-in format above is
 * untouched by an injection that only knows PDFs.
 */
export const InjectedRenderer: Story = {
  args: {
    asset: {
      id: "audit-report",
      name: "audit-report.pdf",
      // The type union stays closed: a PDF arrives as a `source`, it does not
      // add a case here.
      type: "code",
      mediaType: "application/pdf",
      source: { kind: "url", url: "/audit-report.pdf", name: "audit-report.pdf" },
    },
    renderPreview: (asset) =>
      asset.source ? (
        <div className="bg-surface-muted text-body text-muted-foreground rounded-md p-4">
          Rendered by the injected viewer: {asset.name}
        </div>
      ) : null,
  },
};
