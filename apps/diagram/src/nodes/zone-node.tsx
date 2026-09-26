import { useCallback, type ComponentType } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";
import {
  Box,
  Building,
  ChevronDown,
  ChevronRight,
  Cloud,
  Globe,
  LayoutGrid,
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
 * The header glyph per kind, when the zone names no provider. Named Lucide imports: the
 * glyph is fixed per kind, so it needs no name lookup (`LucideByName` resolves the icon
 * names that come from the YAML).
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

/**
 * A header clip box for an item that gives way to the title (wave-1 review M2): it starts
 * at `basis-0` and only grows into the room the title leaves; it cancels the header gap in
 * front of it (`-ms-2`) and the item inside carries that spacing (`ms-2`), so a box at 0 px
 * costs nothing. The item is all or truncated, never a sliver: with a `basis-12` (3rem, or
 * its content width if shorter) it WRAPS to a second line when the box cannot hold that,
 * and the box clips the line away — the full-height `before:` item holds line one open, so
 * a wrapped item lands below the box. A bordered badge cannot shrink below its own padding
 * (an empty pill), and a text truncated to its first letter read as "T." (review m7).
 */
const headerClipBox =
  "-ms-2 flex min-w-0 basis-0 flex-wrap items-center self-stretch overflow-hidden before:h-full";
/** The item inside a clip box: its spacing, the 3rem basis, growth up to its content. */
const headerClipItem = "ms-2 max-w-max grow basis-12 truncate";

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
  // The collapsed chip is too narrow for a subtitle; it truncated to "T." (wave-1 review m7).
  const showSubtitle = Boolean(data.subtitle) && !collapsed;

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
          // `<vendor>/<vendor>` is each pack's brand mark in DG-04's icon index; a provider
          // without a pack renders ServiceLogo's monogram tile.
          <ServiceLogo
            name={`${data.provider}/${data.provider}`}
            size={16}
            variant="mono"
            decorative
          />
        ) : (
          <Glyph aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
        )}
        {/* Width priority (wave-1 review M2): title, then owner word, then subtitle. The
            title is the only item that starts at its content width and shrinks, so it keeps
            its full text while anything else gives way, and truncates last. The owner word
            and the subtitle sit in clip boxes (`headerClipBox`) that grow into the room the
            title leaves: the owner first (`grow-100`, up to its content width), then the
            subtitle — which, or else the title, also takes whatever is left, pushing the
            toggle to the end. */}
        <span
          className={cn("min-w-0 truncate text-caption font-medium", !showSubtitle && "grow")}
          title={data.title}
        >
          {data.title}
        </span>
        <span className="sr-only">{KIND_LABEL[data.kind]}</span>
        {showSubtitle ? (
          <span className={cn(headerClipBox, "grow")}>
            <span className={cn(headerClipItem, "text-meta text-muted-foreground")}>
              {data.subtitle}
            </span>
          </span>
        ) : null}
        {showOwner ? (
          <span className={cn(headerClipBox, "max-w-max grow-100")}>
            {/* `me-px` keeps the badge's end border off the clip edge. */}
            <Badge
              variant="outline"
              className={cn(headerClipItem, "me-px block text-meta uppercase")}
              title={OWNER_LABEL[data.owner]}
            >
              {OWNER_LABEL[data.owner]}
            </Badge>
          </span>
        ) : (
          <span className="sr-only">{OWNER_LABEL[data.owner]}</span>
        )}
        <span className="sr-only">{count === 1 ? "1 child" : `${count} children`}</span>
        {collapsed ? (
          // The visible count only on the collapsed chip, behind a glyph no zone kind uses:
          // a bare number beside the owner badge read as part of it ("SAAS 1", wave-1
          // review m8). Expanded, the children themselves are on screen.
          <span
            aria-hidden="true"
            data-slot="arch-zone-count"
            className="flex shrink-0 items-center gap-1 text-meta tabular-nums text-muted-foreground"
          >
            <LayoutGrid size={12} />
            {count}
          </span>
        ) : null}
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
      {/* Last, so its corner handles paint above the body: a SaaS body's hatch layer is
          positioned and covered the bottom handles when the resizer came first. */}
      <NodeResizer
        isVisible={Boolean(selected) && !collapsed}
        minWidth={ZONE_MIN_WIDTH}
        minHeight={ZONE_MIN_HEIGHT}
        handleClassName={resizerHandleClassName}
        lineClassName="!border-border"
        onResizeEnd={onResizeEnd}
      />
    </FlowNodeCard>
  );
}
