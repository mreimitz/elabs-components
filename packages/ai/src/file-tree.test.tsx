import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContextAsset } from "./context-panel";
import { FileTree, FileTreeFile, FileTreeFolder, ProducedAssetTree } from "./file-tree";

describe("FileTree folder icons", () => {
  it("color them with a semantic token, not a raw palette color (theme-safe)", () => {
    const { container } = render(
      <FileTree defaultExpanded={new Set(["src"])}>
        <FileTreeFolder path="src" name="src">
          <FileTreeFile path="src/index.ts" name="index.ts" />
        </FileTreeFolder>
      </FileTree>,
    );

    // Regression lock for #4: no raw Tailwind palette color anywhere in the tree.
    expect(container.querySelector('[class*="text-blue-"]')).toBeNull();

    // The folder glyph adapts per theme via the semantic primary token.
    expect(container.querySelector("svg.text-primary")).not.toBeNull();

    // The file glyph stays muted-foreground (the contrast that surfaced the bug).
    expect(container.querySelector("svg.text-muted-foreground")).not.toBeNull();
  });
});

describe("FileTree variant axis (#193, research 04 §4 ASSET-1)", () => {
  it("keeps the IDE look by default (code variant — non-breaking)", () => {
    const { container } = render(
      <FileTree>
        <FileTreeFile path="index.ts" name="index.ts" />
      </FileTree>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("font-mono");
    expect(root).toHaveClass("border");
    expect(root).toHaveClass("bg-background");
  });

  it("document variant drops the mono font and the hard box", () => {
    const { container } = render(
      <FileTree variant="document">
        <FileTreeFile path="note.md" name="note.md" />
      </FileTree>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).not.toHaveClass("font-mono");
    expect(root).not.toHaveClass("border");
    expect(root).toHaveClass("text-body");
  });
});

describe("ProducedAssetTree (#193 — the document-variant preset)", () => {
  const ASSETS: ContextAsset[] = [
    { id: "note", name: "board-note.md", type: "markdown", content: "# Note" },
    { id: "rev", name: "revenue.csv", type: "csv", content: "a,b" },
  ];

  it("renders document-variant rows with asset-type icons and selects the ASSET", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<ProducedAssetTree assets={ASSETS} onSelect={onSelect} />);

    const root = container.firstChild as HTMLElement;
    expect(root).not.toHaveClass("font-mono");
    // One glyph per asset, hidden from AT (decorative — the name labels the row).
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);

    await user.click(screen.getByText("revenue.csv"));
    expect(onSelect).toHaveBeenCalledWith(ASSETS[1]);
  });

  it("renders a real empty state for no assets", () => {
    render(<ProducedAssetTree assets={[]} />);
    expect(screen.getByText("No assets produced yet.")).toBeInTheDocument();
  });

  it("draws a FILE-BACKED asset from its own name, not from the closed type union", () => {
    // A PDF reaches the rail through the `renderPreview` seam typed `code`,
    // because `ContextAssetType` is deliberately closed (ADR 0024 §6). The
    // type-keyed glyph would draw it as source; its name knows better.
    const { container } = render(
      <ProducedAssetTree
        assets={[
          { id: "src", name: "query.ts", type: "code", content: "const a = 1;" },
          {
            id: "pdf",
            name: "audit.pdf",
            type: "code",
            mediaType: "application/pdf",
            source: { kind: "url", url: "/audit.pdf", name: "audit.pdf" },
          },
        ]}
      />,
    );
    const [code, pdf] = [...container.querySelectorAll("svg")];
    expect(code?.getAttribute("class")).toContain("file-code");
    expect(pdf?.getAttribute("class")).toContain("file-text");
  });
});
