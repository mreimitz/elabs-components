import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AssetPreview } from "./asset-preview";
import { ContextPanelProvider, type ContextAsset } from "./context-panel";

afterEach(cleanup);

const MARKDOWN_ASSET: ContextAsset = {
  id: "board-note",
  name: "board-note.md",
  type: "markdown",
  content: "# Quarterly summary\n\nRevenue grew.",
};

const CSV_ASSET: ContextAsset = {
  id: "revenue",
  name: "revenue.csv",
  type: "csv",
  content: "region,total\nEMEA,16.1\nAmericas,19.6",
};

describe("AssetPreview (#193, research 04 §5 ASSET-4)", () => {
  it("renders markdown as a document (the ASSET-2 fix), with a Preview/Raw toggle", async () => {
    const user = userEvent.setup();
    render(<AssetPreview asset={MARKDOWN_ASSET} />);

    // Artifact chrome: the asset name headline.
    expect(screen.getByText("board-note.md")).toBeInTheDocument();
    // Preview = a real heading, not Shiki source.
    expect(screen.getByRole("heading", { name: "Quarterly summary" })).toBeInTheDocument();
    // Constrained rung: never an h1 inside the rail (research 09 §G.2).
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

    // Raw shows the markdown source instead.
    await user.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.queryByRole("heading", { name: "Quarterly summary" })).not.toBeInTheDocument();
    expect(screen.getByText(/# Quarterly summary/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raw" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders csv as a small table with a row-count summary", () => {
    render(<AssetPreview asset={CSV_ASSET} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("EMEA")).toBeInTheDocument();
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });

  it("renders an empty state for missing content, never broken UI", () => {
    render(<AssetPreview asset={{ id: "x", name: "empty.md", type: "markdown" }} />);
    expect(screen.getByText("No preview available…")).toBeInTheDocument();
    // No Raw toggle without raw source.
    expect(screen.queryByRole("button", { name: "Raw" })).not.toBeInTheDocument();
  });
});

/**
 * The seam that lets a format this package cannot parse (a PDF, a spreadsheet,
 * a video) show up in the rail without `@elabs/components-ai`
 * importing `@elabs/components-viewer` — they are layer peers
 * (ADR 0024 §6). The injection stands in for `FileViewer` here.
 */
describe("AssetPreview — renderPreview injection", () => {
  const PDF_ASSET: ContextAsset = {
    id: "report",
    name: "report.pdf",
    // The union stays closed: a PDF arrives as `code` + a `source`, it does not
    // grow a `ContextAssetType` case.
    type: "code",
    mediaType: "application/pdf",
    source: { kind: "url", url: "https://example.com/report.pdf", name: "report.pdf" },
  };

  it("draws a format the built-in switch cannot, instead of 'No preview available…'", () => {
    render(
      <AssetPreview
        asset={PDF_ASSET}
        renderPreview={(asset) => (asset.source ? <p>viewer: {asset.name}</p> : null)}
      />,
    );
    expect(screen.getByText("viewer: report.pdf")).toBeInTheDocument();
    expect(screen.queryByText("No preview available…")).not.toBeInTheDocument();
  });

  it("is additive — a renderer that declines leaves every built-in format alone", () => {
    // The whole point of the `null` return: an injection that only knows PDFs
    // must not take markdown away from `MarkdownView`.
    render(
      <AssetPreview
        asset={MARKDOWN_ASSET}
        renderPreview={(asset) => (asset.mediaType === "application/pdf" ? <p>viewer</p> : null)}
      />,
    );
    expect(screen.getByRole("heading", { name: "Quarterly summary" })).toBeInTheDocument();
    expect(screen.queryByText("viewer")).not.toBeInTheDocument();
  });

  it("takes an injection from the surrounding provider, so a rail is taught once", () => {
    render(
      <ContextPanelProvider renderPreview={(asset) => <p>rail: {asset.name}</p>}>
        <AssetPreview asset={PDF_ASSET} />
      </ContextPanelProvider>,
    );
    expect(screen.getByText("rail: report.pdf")).toBeInTheDocument();
  });

  it("lets an explicit prop win over the provider's renderer", () => {
    render(
      <ContextPanelProvider renderPreview={() => <p>rail</p>}>
        <AssetPreview asset={PDF_ASSET} renderPreview={() => <p>this one</p>} />
      </ContextPanelProvider>,
    );
    expect(screen.getByText("this one")).toBeInTheDocument();
    expect(screen.queryByText("rail")).not.toBeInTheDocument();
  });

  it("never intercepts Raw — Raw means 'show me the source'", async () => {
    const user = userEvent.setup();
    render(<AssetPreview asset={MARKDOWN_ASSET} renderPreview={() => <p>injected preview</p>} />);
    expect(screen.getByText("injected preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.queryByText("injected preview")).not.toBeInTheDocument();
    expect(screen.getByText(/# Quarterly summary/)).toBeInTheDocument();
  });
});
