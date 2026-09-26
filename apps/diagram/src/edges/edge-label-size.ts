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
  column: "flex flex-col items-center gap-0.5",
  head: "flex items-center gap-1",
  step: "min-w-5 justify-center rounded-full px-1.5 tabular-nums",
  pill: "rounded-full bg-flow-node text-flow-node-foreground shadow-sm",
  meta: "flex items-center gap-1 rounded-sm bg-canvas px-1",
  protocol: "rounded-sm bg-muted px-1 font-mono text-code text-foreground",
  schedule: "text-meta text-muted-foreground",
} as const;

/** A 12 px lucide glyph (`size={12}`), as a box. */
const GLYPH: ProbeSpec = { className: "block size-3 shrink-0" };

/** What the cluster shows for `data` — the same rules `EdgeLabelCluster` renders by. */
export function clusterParts(data: DataFlowEdgeData, kind: FlowKind) {
  const kindGlyph = KIND_GLYPH[kind] !== undefined;
  const secureGlyph = data.secure !== undefined && data.secure !== "none";
  const hasHead = data.step !== undefined || Boolean(data.label) || kindGlyph;
  const hasMeta = secureGlyph || Boolean(data.protocol) || Boolean(data.schedule);
  return { kindGlyph, secureGlyph, hasHead, hasMeta };
}

/**
 * The laid-out size of an edge's label cluster (head line + meta line), or `undefined` when
 * the edge shows no cluster or nothing can be measured (no DOM). Wave-2 review M2: ELK gets
 * this as the edge's label size, so it reserves room for the label and places it.
 */
export function measureLabelCluster(data: DataFlowEdgeData): ProbeSize | undefined {
  const kind = data.kind ?? "data";
  const { kindGlyph, secureGlyph, hasHead, hasMeta } = clusterParts(data, kind);
  if (!hasHead && !hasMeta) return undefined;
  const head: ProbeSpec[] = [];
  if (data.step !== undefined) {
    head.push({
      className: cn(badgeVariants(), CLUSTER_CLASS.step),
      children: [String(data.step)],
    });
  }
  if (data.label || kindGlyph) {
    head.push({
      className: cn(badgeVariants({ variant: "outline" }), CLUSTER_CLASS.pill),
      children: [...(kindGlyph ? [GLYPH] : []), ...(data.label ? [data.label] : [])],
    });
  }
  const meta: (ProbeSpec | string)[] = [];
  if (secureGlyph) meta.push(GLYPH);
  if (data.protocol) meta.push({ className: CLUSTER_CLASS.protocol, children: [data.protocol] });
  if (data.schedule) meta.push({ className: CLUSTER_CLASS.schedule, children: [data.schedule] });
  const column: ProbeSpec = {
    className: CLUSTER_CLASS.column,
    children: [
      ...(hasHead ? [{ className: CLUSTER_CLASS.head, children: head }] : []),
      ...(hasMeta ? [{ className: CLUSTER_CLASS.meta, children: meta }] : []),
    ],
  };
  const key = JSON.stringify([
    data.step,
    data.label,
    kindGlyph,
    secureGlyph,
    data.protocol,
    data.schedule,
  ]);
  return measureProbe(`edge-label:${key}`, column);
}
