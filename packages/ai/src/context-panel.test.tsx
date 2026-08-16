import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

beforeAll(() => {
  // jsdom has no matchMedia (useIsMobile drives the mobile Sheet fallback).
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

const ASSETS: ContextAsset[] = [
  { id: "board-note", name: "board-note.md", type: "markdown", content: "# Note" },
  { id: "revenue", name: "revenue.csv", type: "csv", content: "region,total\nEMEA,1" },
];

function RootSections() {
  const { state, actions } = useContextPanel();
  return (
    <ContextPanelSection label="Produced assets">
      <ProducedAssetTree
        assets={ASSETS}
        selectedId={state.selectedAsset?.id}
        onSelect={actions.openDetail}
      />
    </ContextPanelSection>
  );
}

function DetailHost() {
  const { state } = useContextPanel();
  return <div data-testid="detail-content">{state.selectedAsset?.name ?? "No asset"}</div>;
}

function Workspace(providerProps: Omit<ContextPanelProviderProps, "children"> = {}) {
  return (
    <ContextPanelProvider {...providerProps}>
      <header>
        <ContextPanelTrigger />
      </header>
      <ContextPanel data-testid="panel">
        <ContextPanelHeader title="Context" />
        <ContextPanelBody
          root={<RootSections />}
          detail={
            <ContextPanelDetail>
              <DetailHost />
            </ContextPanelDetail>
          }
        />
      </ContextPanel>
    </ContextPanelProvider>
  );
}

describe("ContextPanel collapse (#193, research 09 §B.2)", () => {
  it("is always mounted and collapses via data-state, never a conditional mount", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    const panel = screen.getByTestId("panel");
    const trigger = screen.getByRole("button", { name: "Toggle context panel" });

    expect(panel).toHaveAttribute("data-state", "expanded");
    expect(panel).toHaveAttribute("data-side", "right");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);

    await user.click(trigger);

    // Still in the DOM (the whole point — width tweens need a mounted node)…
    expect(screen.getByTestId("panel")).toBe(panel);
    // …but collapsed and inert (research 09 §B.5).
    expect(panel).toHaveAttribute("data-state", "collapsed");
    expect(panel).toHaveAttribute("inert");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("respects controlled open (mode never flips)", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Workspace open={false} onOpenChange={onOpenChange} />);

    const panel = screen.getByTestId("panel");
    expect(panel).toHaveAttribute("data-state", "collapsed");

    await user.click(screen.getByRole("button", { name: "Toggle context panel" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Controlled: the prop still says closed.
    expect(panel).toHaveAttribute("data-state", "collapsed");
  });

  it("throws when useContextPanel is used outside the provider", () => {
    const Naked = () => {
      useContextPanel();
      return null;
    };
    expect(() => render(<Naked />)).toThrow(/within a ContextPanelProvider/);
  });
});

describe("ContextPanel drill-in a11y (#193, research 09 §B.5 tab-panel swap)", () => {
  it("moves focus to the BACK control, inerts the off-screen pane and announces", async () => {
    const user = userEvent.setup();
    const { container } = render(<Workspace />);

    const rootPane = container.querySelector('[data-vt-pane="root"]') as HTMLElement;
    const detailPane = container.querySelector('[data-vt-pane="detail"]') as HTMLElement;
    expect(rootPane).not.toHaveAttribute("inert");
    expect(detailPane).toHaveAttribute("inert");
    expect(detailPane).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByText("board-note.md"));

    // The detail pane is now the live one; the root pane is off-screen.
    expect(detailPane).not.toHaveAttribute("inert");
    expect(rootPane).toHaveAttribute("inert");
    expect(rootPane).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("detail-content")).toHaveTextContent("board-note.md");

    // Focus lands on the BACK control after the swap (rAF, animation-independent).
    const back = screen.getByRole("button", { name: "Back to context" });
    await waitFor(() => expect(back).toHaveFocus());

    // The polite live region announced the target.
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      "Showing board-note.md",
    );
  });

  it("returns focus to the originating row on back", async () => {
    const user = userEvent.setup();
    const { container } = render(<Workspace />);

    const row = screen.getByText("board-note.md").closest('[role="treeitem"]') as HTMLElement;
    await user.click(screen.getByText("board-note.md"));

    const back = screen.getByRole("button", { name: "Back to context" });
    await waitFor(() => expect(back).toHaveFocus());
    await user.click(back);

    const rootPane = container.querySelector('[data-vt-pane="root"]') as HTMLElement;
    expect(rootPane).not.toHaveAttribute("inert");
    await waitFor(() => expect(row).toHaveFocus());
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent("Back to context");
  });

  it("auto-opens a collapsed panel when drilling in (research 09 §G.1)", async () => {
    const user = userEvent.setup();

    // External drive: a row is unreachable while the panel is inert, so use a
    // consumer control (the lifted-state story — actions work from anywhere).
    function ExternalOpen() {
      const { actions } = useContextPanel();
      return (
        <button type="button" onClick={() => actions.openDetail(ASSETS[1] as ContextAsset)}>
          Open revenue
        </button>
      );
    }
    render(
      <ContextPanelProvider defaultOpen={false}>
        <ExternalOpen />
        <ContextPanel data-testid="panel">
          <ContextPanelHeader />
          <ContextPanelBody root={<RootSections />} detail={<DetailHost />} />
        </ContextPanel>
      </ContextPanelProvider>,
    );
    expect(screen.getByTestId("panel")).toHaveAttribute("data-state", "collapsed");

    await user.click(screen.getByRole("button", { name: "Open revenue" }));
    expect(screen.getByTestId("panel")).toHaveAttribute("data-state", "expanded");
    expect(screen.getByRole("button", { name: "Back to context" })).toBeInTheDocument();
  });
});
