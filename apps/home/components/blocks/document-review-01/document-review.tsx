// registry: document-review-01 — copied 2026-09-19
"use client";

/**
 * Document review — findings on the left, the clause they point at on the right.
 *
 * A reviewer (a person, or an agent's first pass) leaves findings against a contract. Each one
 * carries a quote; selecting it scrolls the document to the clause and marks it, and the verdict
 * buttons record what the reviewer decided. The progress line and the filter are derived from
 * those verdicts — nothing here is decoration.
 *
 * Copy-own it: `npx shadcn add document-review-01`.
 */
import { Badge, Button, Progress, ToggleGroup, ToggleGroupItem } from "@elabs-ai/components-ui";
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
import { Check, Flag } from "lucide-react";
import { useMemo, useState } from "react";
import { fileById } from "../document-parts/files";

type Severity = "high" | "medium" | "low";
type Verdict = "open" | "accepted" | "flagged";

interface Finding {
  id: string;
  clause: string;
  severity: Severity;
  title: string;
  why: string;
  quote: string;
}

const FINDINGS: Finding[] = [
  {
    id: "f1",
    clause: "7.2",
    severity: "high",
    title: "The notice period is short for a defect that shows up in returns",
    why: "Seam failures surface weeks after sale. 30 days from discovery is workable only if “discovery” means our quality report, not the first return.",
    quote:
      "The Buyer must notify the Supplier of a defect in writing within 30 days of discovering it",
  },
  {
    id: "f2",
    clause: "7.3",
    severity: "medium",
    title: "Handling cost is capped at 15 % of the unit price",
    why: "A Trail 40 return costs about € 31 to handle — 16 % of the unit price. We lose money on every confirmed defect.",
    quote: "up to 15 % of the unit price",
  },
  {
    id: "f3",
    clause: "7.4",
    severity: "high",
    title: "The recall clause applies to batch NB-0931 today",
    why: "3.6 % of the batch has come back for the same seam defect, above the 3 % threshold.",
    quote:
      "If more than 3 % of a batch is returned by end customers for the same defect within 12 months",
  },
  {
    id: "f4",
    clause: "9.2",
    severity: "medium",
    title: "The liability cap may not cover a full recall",
    why: "Goods delivered this contract year total € 1.9 million; recalling 4,800 units is estimated at € 0.4 million. Covered, but two such batches would not be.",
    quote: "capped at the value of goods delivered in that year",
  },
  {
    id: "f5",
    clause: "4.2",
    severity: "low",
    title: "The pull-test threshold matches our specification",
    why: "220 newtons is the figure in TS-40 rev. C. No change needed.",
    quote: "A seam that fails below 220 newtons in the pull test counts as a major defect.",
  },
  {
    id: "f6",
    clause: "11.2",
    severity: "low",
    title: "Termination needs three rejected batches — returns do not count",
    why: "NB-0931 passed inbound inspection, so it does not count towards termination even though it is being recalled.",
    quote: "if three batches are rejected under clause 4.3 within six months",
  },
];

const SEVERITY_BADGE: Record<Severity, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export function DocumentReview({ className }: { className?: string }) {
  const file = fileById("agreement");
  const [activeId, setActiveId] = useState(FINDINGS[0]!.id);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [show, setShow] = useState<"all" | "open">("all");

  const highlights = useMemo<DocumentHighlight[]>(
    () =>
      FINDINGS.map((finding) => ({
        id: finding.id,
        label: `Clause ${finding.clause}: ${finding.title}`,
        address: { kind: "quote", text: finding.quote },
      })),
    [],
  );

  const decided = FINDINGS.filter((finding) => (verdicts[finding.id] ?? "open") !== "open").length;
  const shown = FINDINGS.filter(
    (finding) => show === "all" || (verdicts[finding.id] ?? "open") === "open",
  );

  const decide = (id: string, verdict: Verdict) => {
    setVerdicts((current) => ({ ...current, [id]: current[id] === verdict ? "open" : verdict }));
    // Move on to the next undecided finding, the way a review queue does.
    const next = FINDINGS.find(
      (finding) => finding.id !== id && (verdicts[finding.id] ?? "open") === "open",
    );
    if (next && verdicts[id] !== verdict) setActiveId(next.id);
  };

  if (!file) return null;

  return (
    <div className={cn("@container w-full", className)} data-slot="document-review">
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Findings" className="flex min-w-0 flex-col gap-3">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-subtitle font-semibold text-foreground">
                Review: supply agreement
              </h2>
              <ToggleGroup
                aria-label="Which findings to show"
                onValueChange={(value) => value && setShow(value as "all" | "open")}
                size="sm"
                type="single"
                value={show}
              >
                <ToggleGroupItem value="all">All</ToggleGroupItem>
                <ToggleGroupItem value="open">Open</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Progress
              aria-label={`${decided} of ${FINDINGS.length} findings decided`}
              value={(decided / FINDINGS.length) * 100}
            />
            <p className="text-meta text-muted-foreground">
              {decided} of {FINDINGS.length} decided ·{" "}
              {Object.values(verdicts).filter((verdict) => verdict === "flagged").length} flagged
              for legal
            </p>
          </header>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-body-sm text-muted-foreground">
              Every finding has a verdict. Switch to “All” to change one.
            </p>
          ) : null}
          <ol className="flex flex-col gap-2">
            {shown.map((finding) => {
              const verdict = verdicts[finding.id] ?? "open";
              const current = finding.id === activeId;
              return (
                <li
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground transition-colors duration-fast",
                    current ? "border-primary" : "border-border",
                  )}
                  key={finding.id}
                >
                  <button
                    aria-current={current ? "true" : undefined}
                    className="flex flex-col gap-1 rounded-control text-start focus-ring"
                    onClick={() => setActiveId(finding.id)}
                    type="button"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">Clause {finding.clause}</Badge>
                      <Badge variant={SEVERITY_BADGE[finding.severity]}>{finding.severity}</Badge>
                      {verdict !== "open" ? (
                        <Badge variant={verdict === "flagged" ? "warning" : "success"}>
                          {verdict === "flagged" ? "Flagged for legal" : "Accepted as is"}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-body-sm font-semibold text-foreground">
                      {finding.title}
                    </span>
                    {current ? (
                      <span className="text-body-sm text-muted-foreground">{finding.why}</span>
                    ) : null}
                  </button>
                  {current ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-pressed={verdict === "accepted"}
                        onClick={() => decide(finding.id, "accepted")}
                        size="sm"
                        variant={verdict === "accepted" ? "secondary" : "outline"}
                      >
                        <Check aria-hidden="true" />
                        Accept as is
                      </Button>
                      <Button
                        aria-pressed={verdict === "flagged"}
                        onClick={() => decide(finding.id, "flagged")}
                        size="sm"
                        variant={verdict === "flagged" ? "secondary" : "outline"}
                      >
                        <Flag aria-hidden="true" />
                        Flag for legal
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-label="Document" className="min-w-0">
          <FileViewerProvider
            activeHighlightId={activeId}
            highlights={highlights}
            onActiveHighlightChange={(id) => id && setActiveId(id)}
            source={file.source}
          >
            <FileViewerFrame className="h-[38rem]">
              <FileViewerToolbar>
                <FileViewerZoom />
              </FileViewerToolbar>
              <FileViewerFind />
              <FileViewerHighlightStatus />
              <FileViewerContent />
            </FileViewerFrame>
          </FileViewerProvider>
        </section>
      </div>
    </div>
  );
}
