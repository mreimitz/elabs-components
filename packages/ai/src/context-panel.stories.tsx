import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssetPreview } from "./asset-preview";
import {
  ContextPanel,
  ContextPanelBody,
  ContextPanelDetail,
  ContextPanelHeader,
  ContextPanelProvider,
  ContextPanelSection,
  ContextPanelTrigger,
  useContextPanel,
  type ContextAsset,
  type ContextPanelProviderProps,
} from "./context-panel";
import { ProducedAssetTree } from "./file-tree";

const meta = {
  title: "AI/ContextPanel",
  component: ContextPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The chat workspace’s right context RAIL: produced assets, a preview drill-in, and an always-mounted width tween so an external `ContextPanelTrigger` can drive it from anywhere inside `ContextPanelProvider`. Nothing to do with `AI/TokenUsage`, the context-WINDOW usage ring, which carried the name `Context` until it was renamed for exactly this confusion; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). Below the mobile breakpoint the rail degrades to a right-side `Sheet` driven by the same state.",
      },
    },
  },
} satisfies Meta<typeof ContextPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const BOARD_NOTE = `# Board note — Q3

Revenue grew **12.4% QoQ**, led by EMEA.

## Highlights

- EMEA $18.4M (+14%)
- Americas $21.2M (+8%)

> Watch APAC churn — flagged by the variance check.
`;

const ASSETS: ContextAsset[] = [
  { id: "board-note", name: "board-note.md", type: "markdown", content: BOARD_NOTE },
  {
    id: "variance-query",
    name: "variance-check.sql",
    type: "sql",
    content: "SELECT region, total\nFROM finance.revenue\nWHERE quarter = 'Q3';",
  },
  {
    id: "revenue",
    name: "revenue.csv",
    type: "csv",
    content: "region,q2,q3\nEMEA,16.1,18.4\nAmericas,19.6,21.2\nAPAC,7.2,8.6",
  },
];

/** Root view — the three labelled sections (research 09 §C.2). */
function RailRoot() {
  const { state, actions } = useContextPanel();
  return (
    <>
      <ContextPanelSection label="Status">
        <p className="text-body text-muted-foreground">Context 21% · model atlas-fast</p>
      </ContextPanelSection>
      <ContextPanelSection label="Produced assets">
        <ProducedAssetTree
          assets={ASSETS}
          selectedId={state.selectedAsset?.id}
          onSelect={actions.openDetail}
        />
      </ContextPanelSection>
    </>
  );
}

/** Detail view — the focused asset, drill-in target (research 04 §5). */
function RailDetail() {
  const { state } = useContextPanel();
  return (
    <ContextPanelDetail>
      {state.selectedAsset ? (
        <AssetPreview asset={state.selectedAsset} />
      ) : (
        <p className="text-body text-muted-foreground">Select an asset to preview it…</p>
      )}
    </ContextPanelDetail>
  );
}

/**
 * The provider wraps the WORKSPACE; the trigger lives in the app header and the
 * panel is a sibling of the chat (the Sidebar / SidebarInset relationship) —
 * ChatShell stays generic (research 09 §C.2/§C.3).
 */
function WorkspaceDemo(providerProps: Omit<ContextPanelProviderProps, "children">) {
  return (
    <ContextPanelProvider {...providerProps}>
      <div className="flex h-[520px] w-full overflow-hidden rounded-xl border bg-background">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <span className="text-subtitle">Agentic workspace</span>
            <ContextPanelTrigger />
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="max-w-prose text-body text-muted-foreground">
              The conversation renders here. The context panel is an always-mounted sibling: the
              header trigger collapses it (width tween, no conditional mount), and selecting a
              produced asset drills into the detail view inside the same rail.
            </p>
          </div>
        </div>
        <ContextPanel>
          <ContextPanelHeader title="Context" />
          <ContextPanelBody root={<RailRoot />} detail={<RailDetail />} />
        </ContextPanel>
      </div>
    </ContextPanelProvider>
  );
}

/** Root view, expanded — toggle via the header trigger, click a row to drill in. */
export const Default: Story = {
  render: () => <WorkspaceDemo defaultOpen />,
};

/** Detail view — the drill-in target with the BACK control in the header. */
export const DetailView: Story = {
  render: () => <WorkspaceDemo defaultOpen defaultView="detail" defaultSelectedAsset={ASSETS[0]} />,
};

/** Collapsed — still mounted (data-state="collapsed"), inert, ready to tween open. */
export const Collapsed: Story = {
  render: () => <WorkspaceDemo defaultOpen={false} />,
};

/** Below the mobile breakpoint the same state drives a Sheet (research 09 §B.4). */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => <WorkspaceDemo />,
};
