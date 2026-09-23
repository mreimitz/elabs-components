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
  Image,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
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

/**
 * A small RFC 4180-ish CSV tokenizer: handles quoted fields (commas and
 * newlines inside quotes don't end the field/row) and the `""` escaped-quote
 * convention. Single pass over the raw string — no line pre-split, so a
 * quoted field spanning multiple lines survives intact. Still preview-grade
 * (unquoted cells are trimmed for the glance table), not a full CSV grammar.
 */
function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let wasQuoted = false;
  let inQuotes = false;

  const endField = () => {
    row.push(wasQuoted ? field : field.trim());
    field = "";
    wasQuoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      wasQuoted = true;
      continue;
    }

    if (ch === ",") {
      endField();
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    if (ch === "\n") {
      endRow();
      continue;
    }

    field += ch;
  }

  // A trailing field/row with no terminating newline.
  if (field !== "" || row.length > 0) {
    endRow();
  }

  return rows;
}

function parseCsv(content: string): ParsedCsv {
  const rows = parseCsvRows(content.trim()).filter((r) => !(r.length === 1 && r[0] === ""));
  const [header = [], ...rest] = rows;
  return { header, rows: rest };
}

const CsvPreview = ({ content }: { content: string }) => {
  const { t } = useLocale();
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
        {t("ai.assetPreview.rowCount", { count: rows.length })}
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
  const { t } = useLocale();
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
    body = <p className="text-body text-muted-foreground">{t("ai.assetPreview.noPreview")}</p>;
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
          <Image
            src={content || asset.path}
            alt={asset.name}
            fit="contain"
            loading="lazy"
            className="rounded-md"
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
              {t("ai.assetPreview.preview")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={showRaw}
              className={cn(showRaw && "bg-accent text-accent-foreground")}
              onClick={() => setMode("raw")}
            >
              {t("ai.assetPreview.raw")}
            </Button>
          </ArtifactActions>
        ) : null}
      </ArtifactHeader>
      <ArtifactContent>{body}</ArtifactContent>
    </Artifact>
  );
};
