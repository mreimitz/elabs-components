// registry: data-model-viewer-01 — copied 2026-09-20
"use client";

import {
  EdgeLabelRenderer,
  FlowEdgePath,
  getSmoothStepPath,
  Position,
  type Edge,
  type EdgeProps,
} from "@elabs-ai/components-flow";
import type { ModelRelation } from "./model";

export interface RelationEdgeData extends Record<string, unknown> {
  relation: ModelRelation;
  /** The relation in focus, or one touching the table in focus. */
  highlighted?: boolean;
  /** Something else is in focus: step back. */
  dimmed?: boolean;
  /** Written at the middle of the line while highlighted, e.g. `account_id → id`. */
  label?: string;
}

export type RelationFlowEdge = Edge<RelationEdgeData, "relation">;

/** How far the end marks reach from the table border, in flow units. */
const FOOT = 12;
const SPREAD = 5;

/** +1 when the line leaves toward the right, -1 toward the left. */
const outward = (position: Position) => (position === Position.Left ? -1 : 1);

/** Crow’s foot: three toes on the table border meeting at one point on the line. "Many." */
const crowsFoot = (x: number, y: number, dir: number) =>
  `M ${x} ${y - SPREAD} L ${x + FOOT * dir} ${y} L ${x} ${y + SPREAD}`;

/** A bar across the line. "Exactly one." */
const bar = (x: number, y: number, dir: number) =>
  `M ${x + (FOOT - 3) * dir} ${y - SPREAD} L ${x + (FOOT - 3) * dir} ${y + SPREAD}`;

/**
 * A foreign key as a line with entity-relationship end marks: a crow’s foot at the
 * referencing ("many") end, a bar at the referenced ("one") end, a ring beside the bar
 * when the key is nullable. An optional relation is also dashed, so it reads without the ring.
 *
 * Drawn through `FlowEdgePath`, so it keeps the package’s keyboard focus indicator.
 */
export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RelationFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    offset: 24,
  });
  const relation = data?.relation;
  const highlighted = Boolean(data?.highlighted);
  const stroke = highlighted ? "var(--flow-edge-strong)" : "var(--flow-edge)";
  const opacity = data?.dimmed ? 0.35 : 1;
  const sourceDir = outward(sourcePosition);
  const targetDir = outward(targetPosition);
  const marks = [
    relation?.cardinality === "one-to-one"
      ? bar(sourceX, sourceY, sourceDir)
      : crowsFoot(sourceX, sourceY, sourceDir),
    bar(targetX, targetY, targetDir),
  ].join(" ");

  return (
    <>
      <FlowEdgePath
        data-slot="relation-edge"
        id={id}
        path={path}
        stroke={stroke}
        strokeDasharray={relation?.optional ? "5 4" : undefined}
        strokeOpacity={opacity}
        strokeWidth={highlighted ? 2 : 1.5}
      />
      <g
        aria-hidden="true"
        fill="none"
        opacity={opacity}
        stroke={stroke}
        strokeLinecap="round"
        strokeWidth={highlighted ? 2 : 1.5}
      >
        <path d={marks} />
        {relation?.optional ? (
          <circle cx={targetX + (FOOT + 4) * targetDir} cy={targetY} fill="var(--canvas)" r={3.5} />
        ) : null}
      </g>
      {highlighted && data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-md bg-surface-elevated px-1.5 py-0.5 font-mono text-meta text-foreground shadow-ring-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
