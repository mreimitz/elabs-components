"use client";

/**
 * Plain-text adapter — the fallback for anything readable as UTF-8.
 *
 * Deliberately does NOT do SYNTAX highlighting — that is the separate `code`
 * adapter, registered at a higher priority for code extensions. Keeping them
 * apart means a 40 MB log file never drags a tokenizer into the bundle, and a
 * consumer can drop the tokenizer without losing plain text. (Citation and
 * find-in-document marks are a different thing entirely and DO render here.)
 *
 * Large files are truncated at load, not at render: putting ten million
 * characters into one `<pre>` locks the main thread with no way back. The cut is
 * reported so the UI can say so rather than silently lying about the content.
 */

import { useMemo, useRef } from "react";

import { MatchHighlight, cn, useLocale } from "@qlik-coe-emea/qlabs-components-ui";
import type { ResolvedFileSource } from "@qlik-coe-emea/qlabs-components-ui";

import { toViewerError } from "../../core/errors";
import { toMarkRanges } from "../../core/highlight-marks";
import { useScrollActiveHighlightIntoView } from "../../core/use-highlight-scroll";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { textManifest } from "./text-manifest";

/**
 * Characters kept before truncation. ~2M is comfortably past any file a person
 * reads in a preview pane and still renders in one frame.
 */
export const TEXT_CHARACTER_LIMIT = 2_000_000;

export interface TextDocument extends AdapterDocument {
  kind: "text";
  text: string;
  /** Total characters in the file, when more than what is shown. */
  totalCharacters?: number;
}

class TextAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<TextDocument> {
    let raw: string;
    try {
      raw = await source.text(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    if (raw.length <= TEXT_CHARACTER_LIMIT) return { kind: "text", text: raw };
    return {
      kind: "text",
      text: raw.slice(0, TEXT_CHARACTER_LIMIT),
      totalCharacters: raw.length,
      // So a passage the shell cannot find is reported as "past the part we
      // previewed" rather than "not in this document" — different news.
      textTruncated: true,
    };
  }
}

function TextRenderer({
  document: doc,
  className,
  highlights,
  activeHighlightId,
}: AdapterRendererProps) {
  const text = doc as TextDocument;
  const { t, formatNumber } = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const { ranges, activeIndex } = useMemo(
    () => toMarkRanges(highlights, text.text.length),
    [highlights, text.text.length],
  );
  useScrollActiveHighlightIntoView(container, activeHighlightId);

  return (
    // No `overflow-auto` here: `FileViewerContent` is the scroll boundary, and
    // nesting a second one clips the text above the outer pane's own padding.
    <div ref={container} className={cn("flex flex-col gap-2", className)}>
      {text.totalCharacters !== undefined && (
        // Not an error — the file is fine, we are showing part of it. A status
        // region, so AT hears it once rather than on every scroll.
        <p role="status" className="text-meta text-muted-foreground">
          {t("viewer.text.truncated", {
            shown: formatNumber(text.text.length),
            total: formatNumber(text.totalCharacters),
          })}
        </p>
      )}
      <pre className="text-code font-mono break-words whitespace-pre-wrap">
        {ranges.length === 0 ? (
          text.text
        ) : (
          // `MatchHighlight` renders the WHOLE string with the matches wrapped,
          // so nothing is lost when a highlight is present — a screen reader
          // still reads the file continuously.
          <MatchHighlight text={text.text} ranges={ranges} activeIndex={activeIndex} />
        )}
      </pre>
    </div>
  );
}

const adapterModule: AdapterModule = {
  manifest: textManifest,
  create: () => new TextAdapter(),
  Renderer: TextRenderer,
};

export default adapterModule;
