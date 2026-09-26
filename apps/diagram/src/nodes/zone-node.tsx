import { useCallback, type ComponentType } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";
import {
  Box,
  Building,
  ChevronDown,
  ChevronRight,
  Cloud,
  Globe,
  Layers,
  Network,
  Shield,
  type LucideProps,
} from "lucide-react";
import {
  FLOW_HANDLE_ANCHOR_CLASS,
  FlowNodeCard,
  FlowPort,
  NodeResizer,
  Position,
  useFlowGroups,
  useReactFlow,
  type NodeProps,
} from "@elabs-ai/components-flow";
import { ServiceLogo } from "@elabs-ai/components-icons";
import { Badge, IconButton, cn } from "@elabs-ai/components-ui";
import {
  ZONE_MIN_HEIGHT,
  ZONE_MIN_WIDTH,
  ZONE_NODE_TYPE,
  type ZoneData,
  type ZoneKind,
  type ZoneNode as ZoneNodeType,
  type ZoneOwner,
} from "./zone-data";
import { zoneBodyVariants, zoneVariants } from "./zone-variants";

/**
 * The header glyph per kind, when the zone names no provider.
 * DG-04's `LucideByName` is not on this branch yet (parallel item), so the Lucide
 * components are imported by name here; the orchestrator swaps this map to
 * `LucideByName` names (`cloud`, `globe`, `network`, `layers`, `building`, `shield`,
 * `box`) after DG-04 merges.
 */
const KIND_GLYPH: Record<ZoneKind, ComponentType<LucideProps>> = {
  "cloud-account": Cloud,
  region: Globe,
  vnet: Network,
  subnet: Network,
  cluster: Layers,
  "on-prem": Building,
  datacenter: Building,
  "trust-boundary": Shield,
  generic: Box,
};

/** The owner word in the header — the greyscale-proof channel for `owner` (WCAG 1.4.1). */
export const OWNER_LABEL: Record<ZoneOwner, string> = {
  customer: "Customer managed",
  saas: "SaaS",
  hosted: "Hosted",
  partner: "Partner",
};

/** The kind, spelled out for assistive technology (sighted users read glyph + border). */
const KIND_LABEL: Record<ZoneKind, string> = {
  "cloud-account": "Cloud account",
  region: "Region",
  vnet: "Virtual network",
  subnet: "Subnet",
  cluster: "Cluster",
  "on-prem": "On-premises",
  datacenter: "Data center",
  "trust-boundary": "Trust boundary",
  generic: "Zone",
};

/** The zone's handle dot and resizer corners: copied from `FlowGroupNode`. */
const groupPortClassName = "!border-flow-group-border !bg-flow-group";
const resizerHandleClassName = `!size-2 !border-2 !border-flow-group-border !bg-flow-group ${FLOW_HANDLE_ANCHOR_CLASS}`;

/**
 * How many direct children zone `id` has in the store, as a primitive — the selector
 * `FlowGroupNode` uses (packages/flow/src/flow-group-node/flow-group-node.tsx:65).
 * P4: library gap — `useDirectChildCount` is private to flow, so it is copied here
 * (DG-06-zone-primitives.md, "Header slots").
 */
function useDirectChildCount(id: string): number {
  const selector = useCallback(
    (state: ReactFlowState) => state.parentLookup.get(id)?.size ?? 0,
    [id],
  );
  return useStore(selector);
}

/** The enclosing zone's owner, if the parent is a zone — a primitive, like the count. */
function useParentZoneOwner(parentId: string | undefined): ZoneOwner | undefined {
  const selector = useCallback(
    (state: ReactFlowState) => {
      const parent = parentId ? state.nodeLookup.get(parentId) : undefined;
      return parent?.type === ZONE_NODE_TYPE ? (parent.data as ZoneData).owner : undefined;
    },
    [parentId],
  );
  return useStore(selector);
}

/**
 * DG-06 — an architecture zone: `FlowGroupNode`'s shape (header, live child count,
 * collapse toggle, resizer, group ports) with the D3 boundary vocabulary on top —
 * `owner` × `kind` from `zoneVariants`, the provider mark in the header, the owner word
 * as a badge. Children are ordinary nodes with `parentId`; `useZoneAutofit` keeps the
 * zone wrapped around them and `useFlowGroups().toggleCollapse` folds it to a chip.
 *
 * The header band is `h-11` (44 px) — `ZONE_HEADER_HEIGHT`, the band `layoutFlowElk`
 * reserves above a group's children (see zone-data.ts).
 */
export function ZoneNode({ id, data, selected, parentId }: NodeProps<ZoneNodeType>) {
  const { toggleCollapse } = useFlowGroups();
  const { updateNodeData } = useReactFlow();
  const count = useDirectChildCount(id);
  const collapsed = data.collapsed ?? false;
  const Glyph = KIND_GLYPH[data.kind];
  // The owner word is shown where ownership CHANGES — on a top-level zone, or a nested one
  // whose owner differs from its enclosing zone's. A nested zone of the same owner repeats
  // it only for assistive technology: three "CUSTOMER MANAGED" badges down one nesting
  // chain crowded the title out of every narrow zone (DG-06 report, first gallery run).
  const showOwner = useParentZoneOwner(parentId) !== data.owner;

  // Resizing by hand means "keep this size": the zone leaves auto-fit, so the next
  // drag inside it does not snap it back.
  const onResizeEnd = useCallback(
    () => updateNodeData(id, { sizing: "manual" } satisfies Partial<ZoneData>),
    [id, updateNodeData],
  );

  return (
    <FlowNodeCard
      data-slot="arch-zone"
      data-owner={data.owner}
      data-kind={data.kind}
      selected={selected}
      tone="neutral"
      className={cn(
        "flex h-full w-full min-w-40 flex-col",
        zoneVariants({ owner: data.owner, kind: data.kind }),
      )}
    >
      <NodeResizer
        isVisible={Boolean(selected) && !collapsed}
        minWidth={ZONE_MIN_WIDTH}
        minHeight={ZONE_MIN_HEIGHT}
        handleClassName={resizerHandleClassName}
        lineClassName="!border-border"
        onResizeEnd={onResizeEnd}
      />
      <FlowPort position={Position.Left} type="target" port="in" className={groupPortClassName} />
      <FlowPort position={Position.Right} type="source" port="out" className={groupPortClassName} />

      <div
        data-slot="arch-zone-header"
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 px-3",
          // P4: library gap — no per-provider accent token; the rail is the neutral strong
          // rung and the provider mark carries the identity (DG-06-zone-primitives.md).
          data.provider && "border-s-2 border-s-border-strong",
        )}
      >
        {data.provider ? (
          // DG-04's icon index is not on this branch: an unregistered `<vendor>/<vendor>`
          // renders ServiceLogo's monogram tile.
          <ServiceLogo
            name={`${data.provider}/${data.provider}`}
            size={16}
            variant="mono"
            decorative
          />
        ) : (
          <Glyph aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 truncate text-caption font-medium" title={data.title}>
          {data.title}
        </span>
        <span className="sr-only">{KIND_LABEL[data.kind]}</span>
        {data.subtitle ? (
          // Gives way first: a narrow zone keeps its title and loses its subtitle.
          <span className="min-w-0 shrink-3 truncate text-meta text-muted-foreground">
            {data.subtitle}
          </span>
        ) : null}
        {showOwner ? (
          <Badge variant="outline" className="ms-auto shrink-0 text-meta uppercase">
            {OWNER_LABEL[data.owner]}
          </Badge>
        ) : (
          <span className="sr-only">{OWNER_LABEL[data.owner]}</span>
        )}
        <span
          data-slot="arch-zone-count"
          className={cn(
            "shrink-0 text-meta tabular-nums text-muted-foreground",
            !showOwner && "ms-auto",
          )}
        >
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">{count === 1 ? "1 child" : `${count} children`}</span>
        </span>
        <IconButton
          aria-expanded={!collapsed}
          label={collapsed ? `Expand ${data.title}` : `Collapse ${data.title}`}
          icon={
            collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />
          }
          className="nodrag shrink-0"
          onClick={() => toggleCollapse(id)}
          size="icon-sm"
          variant="ghost"
        />
      </div>
      <div
        data-slot="arch-zone-body"
        className={cn("min-h-0 flex-1", zoneBodyVariants({ owner: data.owner }))}
      />
    </FlowNodeCard>
  );
}
