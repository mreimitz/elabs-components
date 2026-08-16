"use client";

/**
 * AssetPreview — type-keyed preview of one produced asset (#193, research 04
 * §5 ASSET-4). Reuses the `Artifact` chrome for the header/actions; the body
 * switches on `ContextAsset.type`:
 *
 *   markdown → `MarkdownView` (the branded renderer — a document, never
 *              Shiki source; the ASSET-2 fix)
 *   code/sql → `CodeBlock` (Shiki)
 *   csv      → a small token-styled table + row-count summary
 *   image    → an image preview
 *
 * A Preview / Raw toggle serves users who want the source (Raw = `CodeBlock`,
 * soft-wrapped for narrow embeds). Selection state lives in the
 * `ContextPanelProvider` — the tree and this preview are the two levels of the
 * drill-in.
 *
 * Formats beyond that switch — a PDF, a spreadsheet, a video — arrive through
 * `renderPreview` (prop, or injected once on `ContextPanelProvider`), because
 * `@elabs-ai/components-viewer` is a layer PEER of this package and
 * neither may import the other (ADR 0024 §6). A renderer that returns `null`
 * declines, and everything below runs exactly as before.
 */
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { BundledLanguage } from "shiki";
import {
  Artifact,
  ArtifactActions,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "./artifact";
import { CodeBlock } from "./code-block";
import type { AssetPreviewRenderer, ContextAsset } from "./context-panel";
import { useAssetPreviewRenderer } from "./context-panel";
import { MarkdownView } from "./markdown-view";

export type AssetPreviewMode = "preview" | "raw";

const DEFAULT_CODE_LANGUAGE: BundledLanguage = "typescript";

/** Raw-mode (and code-preview) Shiki language for an asset. */
function assetLanguage(asset: ContextAsset): BundledLanguage {
  switch (asset.type) {
    case "markdown":
      return "markdown";
    case "sql":
      return "sql";
    case "csv":
      return "csv";
    case "code":
      return (asset.language as BundledLanguage) ?? DEFAULT_CODE_LANGUAGE;
    default:
      return DEFAULT_CODE_LANGUAGE;
  }
}

interface ParsedCsv {
  header: string[];
  rows: string[][];
}

/** Minimal preview-grade CSV split (no quoted-comma handling — it's a glance, not a grid). */
function parseCsv(content: string): ParsedCsv {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  const [head = "", ...rest] = lines;
  const split = (line: string) => line.split(",").map((cell) => cell.trim());
  return { header: split(head), rows: rest.map(split) };
}

const CsvPreview = ({ content }: { content: string }) => {
  const { header, rows } = useMemo(() => parseCsv(content), [content]);
  return (
    <div className="flex flex-col gap-2">
      <Table className="text-body tabular-nums">
        <TableHeader>
          <TableRow>
            {header.map((cell) => (
              <TableHead key={cell}>{cell}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            // Rows have no stable identity in raw CSV — index is the key.
            // oxlint-disable-next-line eslint-plugin-react(no-array-index-key)
            <TableRow key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                // oxlint-disable-next-line eslint-plugin-react(no-array-index-key)
                <TableCell key={`cell-${rowIndex}-${cellIndex}`}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-meta text-muted-foreground">
        {rows.length} {rows.length === 1 ? "row" : "rows"}
      </p>
    </div>
  );
};

export interface AssetPreviewProps extends HTMLAttributes<HTMLDivElement> {
  asset: ContextAsset;
  /** Initial mode. Default `"preview"`. */
  defaultMode?: AssetPreviewMode;
  /**
   * Draw this asset's preview body yourself; return `null` to decline and get
   * the built-in rendering. Wins over a renderer injected on
   * `ContextPanelProvider`, so one rail-wide default can still be overridden
   * for a single preview.
   */
  renderPreview?: AssetPreviewRenderer;
}

export const AssetPreview = ({
  asset,
  defaultMode = "preview",
  renderPreview,
  className,
  ...props
}: AssetPreviewProps) => {
  const [mode, setMode] = useState<AssetPreviewMode>(defaultMode);
  const injectedRenderer = useAssetPreviewRenderer();
  const content = asset.content ?? "";
  // Raw source only exists for text assets with content.
  const hasRaw = asset.type !== "image" && content.length > 0;
  const showRaw = mode === "raw" && hasRaw;

  // Raw is "show me the source", so an injection never intercepts it.
  const render = renderPreview ?? injectedRenderer;
  const injected = !showRaw && render ? render(asset) : null;

  let body: ReactNode;
  if (injected !== null) {
    body = injected;
  } else if (asset.type !== "image" && content.length === 0) {
    body = <p className="text-body text-muted-foreground">No preview available…</p>;
  } else if (showRaw) {
    body = <CodeBlock code={content} language={assetLanguage(asset)} wrap />;
  } else {
    switch (asset.type) {
      case "markdown": {
        // Constrained heading rung inside the narrow rail (research 09 §G.2).
        body = <MarkdownView baseHeadingLevel={2}>{content}</MarkdownView>;
        break;
      }
      case "code":
      case "sql": {
        body = <CodeBlock code={content} language={assetLanguage(asset)} showLineNumbers wrap />;
        break;
      }
      case "csv": {
        body = <CsvPreview content={content} />;
        break;
      }
      case "image": {
        body = (
          <img
            src={content || asset.path}
            alt={asset.name}
            loading="lazy"
            className="max-w-full rounded-md"
          />
        );
        break;
      }
    }
  }

  return (
    <Artifact data-slot="asset-preview" className={className} {...props}>
      <ArtifactHeader>
        <ArtifactTitle className="min-w-0 truncate">{asset.name}</ArtifactTitle>
        {hasRaw ? (
          <ArtifactActions>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={!showRaw}
              className={cn(!showRaw && "bg-accent text-accent-foreground")}
              onClick={() => setMode("preview")}
            >
              Preview
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={showRaw}
              className={cn(showRaw && "bg-accent text-accent-foreground")}
              onClick={() => setMode("raw")}
            >
              Raw
            </Button>
          </ArtifactActions>
        ) : null}
      </ArtifactHeader>
      <ArtifactContent>{body}</ArtifactContent>
    </Artifact>
  );
};
