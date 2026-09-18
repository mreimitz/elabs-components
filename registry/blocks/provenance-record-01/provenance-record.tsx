"use client";

import { Pin, TriangleAlert } from "lucide-react";
import { Card, CardContent, STATUS_TONE_ICONS, StatusBadge } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  COPILOT_NAME,
  contactRecord,
  type FieldProvenance,
  type RecordField,
} from "@/components/agent-ops-parts/data/atlas-ops";
import { formatDayMonth } from "@/components/agent-ops-parts/format";
import { ConfidenceBar, SourceChip } from "@/components/agent-ops-parts/provenance";

export interface ProvenanceRecordProps {
  /** Record title, e.g. the contact’s name. */
  title?: string;
  /** One-line subtitle under the title, e.g. role · company. */
  subtitle?: string;
  /** A short stage/status label shown as a badge beside the title. */
  stage?: string;
  fields?: RecordField[];
  copilotName?: string;
  locale?: string;
  className?: string;
}

/**
 * A record whose every field says where its value came from. Four
 * provenance states, each with its own glyph + text (never colour alone):
 *
 * - **derived** — a confidence meter and the evidence kind the copilot read;
 * - **pinned** — a person set it; who and when. A pin out-ranks any derivation;
 * - **conflict** — two permitted sources disagree; the copilot has NOT chosen;
 * - **empty** — "No signal yet". The copilot never fills a blank with a guess.
 *
 * The footer counts the four states so the reader knows how much of the
 * record is machine-derived before trusting it.
 */
export function ProvenanceRecord({
  title = contactRecord.name,
  subtitle = `${contactRecord.title} · ${contactRecord.company}`,
  stage = contactRecord.stage,
  fields = contactRecord.fields,
  copilotName = COPILOT_NAME,
  locale = "en-US",
  className,
}: ProvenanceRecordProps) {
  const counts = fields.reduce(
    (acc, f) => {
      acc[f.provenance.state] += 1;
      return acc;
    },
    { derived: 0, pinned: 0, conflict: 0, empty: 0 },
  );

  return (
    <Card className={cn("@container", className)} data-slot="provenance-record">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-title text-foreground">{title}</h3>
          {stage ? (
            <StatusBadge
              status={{ label: stage, tone: "success", icon: STATUS_TONE_ICONS.success }}
            />
          ) : null}
          {subtitle ? (
            <p className="basis-full text-caption text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        <dl className="divide-y divide-border">
          {fields.map((f) => (
            <FieldRow copilotName={copilotName} field={f} key={f.id} locale={locale} />
          ))}
        </dl>

        <p className="mt-4 text-caption text-muted-foreground">
          {fields.length} fields. {counts.derived} derived, {counts.pinned} pinned by a person,{" "}
          {counts.conflict} in conflict and {counts.empty} genuinely unknown. {copilotName} does not
          fill in a blank with a guess.
        </p>
      </CardContent>
    </Card>
  );
}

function FieldRow({
  field,
  copilotName,
  locale,
}: {
  field: RecordField;
  copilotName: string;
  locale: string;
}) {
  const isConflict = field.provenance.state === "conflict";
  return (
    <div
      className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-2.5 @xl:grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_auto]"
      data-slot="provenance-record-field"
    >
      <dt className="text-caption text-muted-foreground">{field.label}</dt>
      <dd
        className={cn(
          "min-w-0 text-body",
          field.value === null ? "text-muted-foreground" : "text-foreground",
          isConflict && "text-warning-text",
        )}
      >
        {field.value ?? "—"}
      </dd>
      <dd className="col-start-2 flex min-w-0 flex-wrap items-center justify-start gap-2 @xl:col-start-3 @xl:justify-end">
        <Provenance copilotName={copilotName} locale={locale} provenance={field.provenance} />
      </dd>
    </div>
  );
}

function Provenance({
  provenance,
  copilotName,
  locale,
}: {
  provenance: FieldProvenance;
  copilotName: string;
  locale: string;
}) {
  switch (provenance.state) {
    case "derived":
      return (
        <>
          <ConfidenceBar
            label={`${copilotName}’s confidence`}
            locale={locale}
            value={provenance.confidence}
          />
          <SourceChip evidence={provenance.evidence} />
        </>
      );
    case "pinned":
      return (
        <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
          <Pin aria-hidden="true" className="size-3.5" />
          Pinned · {provenance.by.name.split(" ")[0]}, {formatDayMonth(provenance.at, locale)}
        </span>
      );
    case "conflict":
      return (
        <span className="inline-flex items-center gap-1.5 text-caption text-warning-text">
          <TriangleAlert aria-hidden="true" className="size-3.5" />
          {provenance.note}
        </span>
      );
    case "empty":
    default:
      return <span className="text-caption text-muted-foreground">No signal yet</span>;
  }
}
