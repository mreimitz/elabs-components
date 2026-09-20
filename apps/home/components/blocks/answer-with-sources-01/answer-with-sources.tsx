// registry: answer-with-sources-01 — copied 2026-09-19
"use client";

/**
 * Answer with sources — every claim opens the document at the sentence that backs it.
 *
 * The answer's citations are data: a file id and a QUOTE. Clicking one swaps the viewer's source
 * when needed and points it at the passage — the viewer locates the quote in the rendered
 * document (markdown, CSV, JSON, a log), scrolls to it and marks it. A quote that is not in the
 * file is reported as such, never silently ignored, so a hallucinated citation is visible.
 *
 * Copy-own it: `npx shadcn add answer-with-sources-01`.
 */
import { Badge, Button } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  FileViewerContent,
  FileViewerFind,
  FileViewerFrame,
  FileViewerHighlightStatus,
  FileViewerProvider,
  FileViewerToolbar,
  FileViewerZoom,
  type DocumentHighlight,
} from "@elabs-ai/components-viewer";
import { FileSearch, Sparkles } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { fileById } from "../document-parts/files";

interface Citation {
  /** The number shown in the answer. */
  n: number;
  fileId: string;
  quote: string;
  /** What the passage establishes, for the source list. */
  establishes: string;
}

const CITATIONS: Citation[] = [
  {
    n: 1,
    fileId: "quality-report",
    quote: "171 units had come back with a failed shoulder-strap seam, which is 3.6 % of the batch",
    establishes: "The return rate for the defect",
  },
  {
    n: 2,
    fileId: "agreement",
    quote:
      "If more than 3 % of a batch is returned by end customers for the same defect within 12 months, the Supplier bears the cost of recalling the rest of that batch.",
    establishes: "The recall clause and its threshold",
  },
  {
    n: 3,
    fileId: "agreement",
    quote:
      "The Buyer must notify the Supplier of a defect in writing within 30 days of discovering it",
    establishes: "The notice period",
  },
  {
    n: 4,
    fileId: "quality-report",
    quote: "The supplier changed the thread on 2 July without telling us.",
    establishes: "The likely cause",
  },
  {
    n: 5,
    fileId: "inspection-log",
    quote: "thread looks thinner than on NB-0929, flagged to quality",
    establishes: "We noticed on arrival",
  },
  {
    n: 6,
    fileId: "agreement",
    quote: "The Supplier pays a penalty of 10 % of the batch value for every late notice.",
    establishes: "A citation the model made up",
  },
];

/** The answer as the model wrote it: prose with citation markers between the sentences. */
const ANSWER: Array<string | number> = [
  "Yes. Batch NB-0931 has crossed the recall threshold: ",
  1,
  ", and the agreement puts the recall cost on the supplier above 3 % ",
  2,
  ". The clock is already running — written notice is due within 30 days of discovery ",
  3,
  ", and the quality report is dated 6 October. The cause looks like an unannounced thread change ",
  4,
  ", which our own inspector noted on the day the batch arrived ",
  5,
  ". I also found a late-notice penalty ",
  6,
  ".",
];

export function AnswerWithSources({ className }: { className?: string }) {
  const [activeN, setActiveN] = useState(1);
  const active = CITATIONS.find((citation) => citation.n === activeN) ?? CITATIONS[0]!;
  const file = fileById(active.fileId);

  // Every citation INTO the open file is handed to the viewer, so the reader sees all the
  // passages this answer leans on; the active one is the one it scrolls to.
  const highlights = useMemo<DocumentHighlight[]>(
    () =>
      CITATIONS.filter((citation) => citation.fileId === active.fileId).map((citation) => ({
        id: `c${citation.n}`,
        label: citation.establishes,
        address: { kind: "quote", text: citation.quote },
      })),
    [active.fileId],
  );

  return (
    <div className={cn("@container w-full", className)} data-slot="answer-with-sources">
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section
          aria-label="Answer"
          className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground"
        >
          <p className="self-end rounded-lg bg-primary px-3 py-2 text-body text-primary-foreground">
            Can we make NB Packs pay for recalling the Trail 40 batch?
          </p>
          <div className="flex items-start gap-2">
            <Sparkles aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
            <p className="text-body leading-relaxed text-foreground">
              {ANSWER.map((part) =>
                typeof part === "string" ? (
                  <Fragment key={part}>{part}</Fragment>
                ) : (
                  <button
                    aria-label={`Source ${part}: ${CITATIONS[part - 1]?.establishes ?? ""}`}
                    aria-pressed={part === activeN}
                    className={cn(
                      "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 align-text-top text-meta font-semibold tabular-nums transition-colors duration-fast focus-ring",
                      part === activeN
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-foreground hover:border-primary",
                    )}
                    key={`cite-${part}`}
                    onClick={() => setActiveN(part)}
                    type="button"
                  >
                    {part}
                  </button>
                ),
              )}
            </p>
          </div>

          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <h3 className="text-meta font-semibold text-muted-foreground uppercase">Sources</h3>
            <ol className="flex flex-col">
              {CITATIONS.map((citation) => (
                <li key={citation.n}>
                  <Button
                    aria-pressed={citation.n === activeN}
                    className="h-auto w-full justify-start gap-2 py-1.5 text-start whitespace-normal"
                    onClick={() => setActiveN(citation.n)}
                    size="sm"
                    variant={citation.n === activeN ? "secondary" : "ghost"}
                  >
                    <span className="w-4 shrink-0 text-meta tabular-nums text-muted-foreground">
                      {citation.n}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body-sm font-semibold">{citation.establishes}</span>
                      <span className="truncate text-meta text-muted-foreground">
                        {fileById(citation.fileId)?.source.name}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-label="Source document" className="flex min-w-0 flex-col gap-2">
          {file ? (
            <FileViewerProvider
              activeHighlightId={`c${active.n}`}
              highlights={highlights}
              key={file.id}
              source={file.source}
            >
              <div className="flex flex-wrap items-center gap-2">
                <FileSearch aria-hidden="true" className="size-4 text-muted-foreground" />
                <span className="min-w-0 truncate text-body-sm font-semibold text-foreground">
                  {file.source.name}
                </span>
                <Badge variant="outline">
                  {highlights.length} cited {highlights.length === 1 ? "passage" : "passages"}
                </Badge>
              </div>
              <FileViewerFrame className="h-[30rem]">
                <FileViewerToolbar>
                  <FileViewerZoom />
                </FileViewerToolbar>
                <FileViewerFind />
                <FileViewerHighlightStatus />
                <FileViewerContent />
              </FileViewerFrame>
            </FileViewerProvider>
          ) : null}
        </section>
      </div>
    </div>
  );
}
