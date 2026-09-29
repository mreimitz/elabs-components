import { badgeVariants, cn } from "@elabs-ai/components-ui";
import { measureProbe, type ProbeSize, type ProbeSpec } from "../layout/measure-probe";
import type { DataFlowEdgeData, FlowKind } from "./data-flow-edge-data";
import { KIND_GLYPH } from "./edge-style";

/**
 * The label cluster's classes, shared by `EdgeLabelCluster` (which renders them) and
 * `measureLabelCluster` (which measures a probe of the same markup for ELK), so the box ELK
 * reserves is the box that is drawn.
 */
export const CLUSTER_CLASS = {
  count: "text-meta tabular-nums text-muted-foreground",
  column: "flex flex-col items-center gap-0.5",
  head: "flex items-center gap-1",
  /**
   * DG-20 — the step marker: a numbered outline circle on the card surface, quiet at rest
   * (defect 10: primary-filled steps out-ranked every node title) and filled with the
   * primary only while its step is lit (`data-lit` on the cluster, DG-18's walk-through).
   */
  step: "size-5 justify-center rounded-full border-border bg-card p-0 text-meta tabular-nums text-foreground [[data-lit]_&]:border-transparent [[data-lit]_&]:bg-primary [[data-lit]_&]:text-primary-foreground",
  /**
   * DG-20 — ONE compact editorial pill per flow: kind glyph + label, then the secure glyph
   * and the protocol behind a hairline divider (`protocol`). Raised card surface on
   * `shadow-xs`; the `--ring` border when the edge is selected.
   */
  pill: "gap-1.5 rounded-full bg-card text-caption text-foreground shadow-xs",
  /** The protocol part of the pill: a quiet code run, no chip of its own (defect 9). */
  protocol: "flex items-center gap-1 font-mono text-code text-muted-foreground",
  /** A divider in front of the protocol part when the label sits before it. */
  divider: "border-s border-border ps-1.5",
  /** The schedule below the pill, on a canvas patch so a passing line never cuts it. */
  meta: "flex items-center rounded-sm bg-canvas px-1",
  schedule: "text-meta text-muted-foreground",
} as const;

/** A 12 px lucide glyph (`size={12}`), as a box. */
const GLYPH: ProbeSpec = { className: "block size-3 shrink-0" };

/** What the cluster shows for `data` — the same rules `EdgeLabelCluster` renders by. */
export function clusterParts(data: DataFlowEdgeData, kind: FlowKind) {
  const kindGlyph = KIND_GLYPH[kind] !== undefined;
  const secureGlyph = data.secure !== undefined && data.secure !== "none";
  const hasLabel = Boolean(data.label) || kindGlyph;
  const hasProtocol = secureGlyph || Boolean(data.protocol);
  const hasPill = hasLabel || hasProtocol;
  const hasHead = data.step !== undefined || hasPill;
  const hasMeta = Boolean(data.schedule);
  return { kindGlyph, secureGlyph, hasLabel, hasProtocol, hasPill, hasHead, hasMeta };
}

/**
 * The laid-out size of an edge's label cluster (head line + schedule line), or `undefined`
 * when the edge shows no cluster or nothing can be measured (no DOM). Wave-2 review M2: ELK
 * gets this as the edge's label size, so it reserves room for the label and places it.
 */
export function measureLabelCluster(data: DataFlowEdgeData, groupSize = 1): ProbeSize | undefined {
  const kind = data.kind ?? "data";
  const { kindGlyph, secureGlyph, hasLabel, hasProtocol, hasPill, hasHead, hasMeta } = clusterParts(
    data,
    kind,
  );
  if (!hasHead && !hasMeta) return undefined;
  const head: ProbeSpec[] = [];
  if (data.step !== undefined) {
    head.push({
      className: cn(badgeVariants({ variant: "outline" }), CLUSTER_CLASS.step),
      children: [String(data.step)],
    });
  }
  if (hasPill) {
    const pill: (ProbeSpec | string)[] = [];
    if (kindGlyph) pill.push(GLYPH);
    if (data.label) pill.push({ className: "", children: [data.label] });
    if (groupSize > 1) pill.push({ className: CLUSTER_CLASS.count, children: [`×${groupSize}`] });
    if (hasProtocol) {
      pill.push({
        className: cn(CLUSTER_CLASS.protocol, hasLabel && CLUSTER_CLASS.divider),
        children: [
          ...(secureGlyph ? [GLYPH] : []),
          ...(data.protocol ? [{ className: "", children: [data.protocol] }] : []),
        ],
      });
    }
    head.push({
      className: cn(badgeVariants({ variant: "outline" }), CLUSTER_CLASS.pill),
      children: pill,
    });
  }
  const meta: (ProbeSpec | string)[] = [];
  if (data.schedule) meta.push({ className: CLUSTER_CLASS.schedule, children: [data.schedule] });
  const column: ProbeSpec = {
    className: CLUSTER_CLASS.column,
    children: [
      ...(hasHead ? [{ className: CLUSTER_CLASS.head, children: head }] : []),
      ...(hasMeta ? [{ className: CLUSTER_CLASS.meta, children: meta }] : []),
    ],
  };
  const key = JSON.stringify([
    groupSize,
    data.step,
    data.label,
    kindGlyph,
    secureGlyph,
    data.protocol,
    data.schedule,
  ]);
  return measureProbe(`edge-label:${key}`, column);
}
