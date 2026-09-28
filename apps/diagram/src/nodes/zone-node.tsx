import { useCompositeActions, COMPOSITE_UI } from "../interaction/composite-actions";
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
  useReactFlow,
  type NodeProps,
} from "@elabs-ai/components-flow";
import { ServiceLogo } from "@elabs-ai/components-icons";
import { Badge, IconButton, cn } from "@elabs-ai/components-ui";
import { IDLE_PORT_CLASS, useConnectedPorts } from "./port-visibility";
import {
  KIND_LABEL,
  OWNER_LABEL,
  ZONE_MIN_HEIGHT,
  ZONE_MIN_WIDTH,
  ZONE_NODE_TYPE,
  type ZoneData,
  type ZoneKind,
  type ZoneNode as ZoneNodeType,
  type ZoneOwner,
} from "./zone-data";
import { zoneBodyVariants, zoneFill, zoneVariants } from "./zone-variants";
import { MOTION_CLASS } from "../motion";
// Wave-2 review M5: the header's classes live beside the probe that measures its minimum
// width for ELK and auto-fit, so the two cannot drift apart.
import { ZONE_HEADER_CLASS } from "../layout/zone-header-width";
import { toggleZone } from "../layout/zone-folds";

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

// Moved to zone-data.ts (wave-2 review M5: the header probe needs the words without
// importing this component; m3: the compiler names zones with them); re-exported for
// existing importers.
export { KIND_LABEL, OWNER_LABEL } from "./zone-data";

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

/** A zone's place in its nesting chain. */
interface ZoneNesting {
  /** Zone ancestors above this zone (0 = top level). */
  depth: number;
  /** The owner of the top-level zone of the chain (this zone's own owner at depth 0). */
  rootOwner: ZoneOwner;
  /** The enclosing zone's owner, if the parent is a zone. */
  parentOwner: ZoneOwner | undefined;
}

/**
 * DG-20 — the zone's nesting as ONE store selector returning a primitive string
 * ("depth|rootOwner|parentOwner"), so a zone re-renders only when its chain changes. Walks
 * `parentId` through zone parents; a non-zone parent ends the chain.
 */
function useZoneNesting(parentId: string | undefined, owner: ZoneOwner): ZoneNesting {
  const selector = useCallback(
    (state: ReactFlowState) => {
      let depth = 0;
      let rootOwner = owner;
      let parentOwner = "";
      let next = parentId ? state.nodeLookup.get(parentId) : undefined;
      while (next?.type === ZONE_NODE_TYPE) {
        const zoneOwner = (next.data as ZoneData).owner;
        if (depth === 0) parentOwner = zoneOwner;
        depth += 1;
        rootOwner = zoneOwner;
        next = next.parentId ? state.nodeLookup.get(next.parentId) : undefined;
      }
      return `${depth}|${rootOwner}|${parentOwner}`;
    },
    [parentId, owner],
  );
  const [depth, rootOwner, parentOwner] = useStore(selector).split("|");
  return {
    depth: Number(depth),
    rootOwner: rootOwner as ZoneOwner,
    parentOwner: parentOwner ? (parentOwner as ZoneOwner) : undefined,
  };
}

/**
 * DG-06 — an architecture zone: `FlowGroupNode`'s shape (header, live child count,
 * collapse toggle, resizer, group ports) with the D3 boundary vocabulary on top —
 * `owner` × `kind` from `zoneVariants`, the provider mark in the header, the owner word
 * as a badge. Children are ordinary nodes with `parentId`; `useZoneAutofit` keeps the
 * zone wrapped around them and the header chevron folds it to a chip (`toggleZone`).
 *
 * The header band is `h-11` (44 px) — `ZONE_HEADER_HEIGHT`, the band `layoutFlowElk`
 * reserves above a group's children (see zone-data.ts).
 */
export function ZoneNode({ id, data, selected, parentId, isConnectable }: NodeProps<ZoneNodeType>) {
  const { getNodes, getEdges, setNodes, setEdges, updateNodeData } = useReactFlow();
  const compositeActions = useCompositeActions();
  // The same signal `canvas-pane.tsx`'s `READ_ONLY_PROPS` sets `nodesDraggable` false from, so
  // a zone's resize handles never show and a corner drag never resizes it in view mode — the
  // maintainer's three allowed view-mode changes are direction, node style and lens, nothing on
  // the canvas itself. Read straight from the React Flow store rather than threading a prop
  // through `NodeProps`, same pattern `useZoneNesting` above already uses.
  const resizable =
    useStore((state: ReactFlowState) => state.nodesDraggable) && !data.inner && !data.component;
  // What `useFlowGroups().toggleCollapse` did, through the app's fold (zone-folds.ts).
  const toggle = useCallback(() => {
    if (data.component) {
      if (!compositeActions?.disabledReason) compositeActions?.toggle(id);
      return;
    }
    const graph = toggleZone({ nodes: getNodes(), edges: getEdges() }, id);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [getNodes, getEdges, setNodes, setEdges, id, data.component, compositeActions]);
  const count = useDirectChildCount(id);
  const collapsed = data.collapsed ?? false;
  const Glyph = KIND_GLYPH[data.kind];
  // The owner word is shown where ownership CHANGES — on a top-level zone, or a nested one
  // whose owner differs from its enclosing zone's. A nested zone of the same owner repeats
  // it only for assistive technology: three "CUSTOMER MANAGED" badges down one nesting
  // chain crowded the title out of every narrow zone (DG-06 report, first gallery run).
  const nesting = useZoneNesting(parentId, data.owner);
  const showOwner = nesting.parentOwner !== data.owner;
  // DG-20: one elevation rung per nesting level; capped → the line carries the edge alone.
  const { fill, capped } = zoneFill(nesting.depth, nesting.rootOwner);
  // The collapsed chip is too narrow for a subtitle; it truncated to "T." (wave-1 review m7).
  const showSubtitle = Boolean(data.subtitle) && !collapsed;
  // Unconnected ports stay hidden until they can be used (port-visibility.ts).
  const connected = useConnectedPorts();

  // Resizing by hand means "keep this size": the zone leaves auto-fit, so the next
  // drag inside it does not snap it back. A no-op when not `resizable` — defence in
  // depth alongside `NodeResizer`'s own `isVisible` below, which already hides the handles.
  const onResizeEnd = useCallback(() => {
    if (!resizable) return;
    updateNodeData(id, { sizing: "manual" } satisfies Partial<ZoneData>);
  }, [id, updateNodeData, resizable]);

  return (
    <FlowNodeCard
      data-slot="arch-zone"
      data-owner={data.owner}
      data-kind={data.kind}
      selected={selected}
      tone="neutral"
      data-depth={nesting.depth}
      className={cn(
        "group/arch-zone flex h-full w-full min-w-40 flex-col",
        zoneVariants({ owner: data.owner, kind: data.kind, fill, capped }),
      )}
    >
      {nesting.depth === 0 && !collapsed ? (
        // DG-20 — hairline ruler ticks along a top-level zone's top edge, fading toward the
        // middle; decoration only, so invisible below `--decoration` 4 (default 0). The
        // outer span places, masks and fades; the tick utility needs its own box (it sets
        // `position: relative` and owns both pseudo-elements).
        <span
          aria-hidden="true"
          data-slot="arch-zone-ruler"
          className="pointer-events-none absolute inset-x-4 top-0 h-2 opacity-[clamp(0,calc(var(--decoration)_-_3),1)] [mask-image:var(--deco-fade-center)]"
        >
          <span className="hairline-ticks-x block size-full rotate-180" />
        </span>
      ) : null}
      <FlowPort
        position={Position.Left}
        type="target"
        port="in"
        isConnectable={isConnectable}
        className={cn(groupPortClassName, !connected.has("in:in") && IDLE_PORT_CLASS)}
      />
      <FlowPort
        position={Position.Right}
        type="source"
        port="out"
        isConnectable={isConnectable}
        className={cn(groupPortClassName, !connected.has("out:out") && IDLE_PORT_CLASS)}
      />

      <div data-slot="arch-zone-header" className={ZONE_HEADER_CLASS.band}>
        {/* DG-20 — the corner label chip (ZONE_HEADER_CLASS.chip): it straddles the top line
            and carries the provider mark, title, subtitle and owner word together, so the
            owner word sits beside the title it qualifies (defect 2). Width priority lives in
            the classes: the owner word never shrinks, the subtitle gives way first, the title
            truncates last. `zoneHeaderMinWidth` measures this exact structure. */}
        <span data-slot="arch-zone-label" className={ZONE_HEADER_CLASS.chip}>
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
          {data.provider && data.kind === "trust-boundary" ? (
            <Shield aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
          ) : null}
          <span className={ZONE_HEADER_CLASS.title} title={data.title}>
            {data.title}
          </span>
          <span className="sr-only">{KIND_LABEL[data.kind]}</span>
          {showSubtitle ? (
            <span className={ZONE_HEADER_CLASS.subtitle} title={data.subtitle}>
              {data.subtitle}
            </span>
          ) : null}
          {showOwner ? (
            <Badge
              variant="outline"
              className={ZONE_HEADER_CLASS.owner}
              title={OWNER_LABEL[data.owner]}
            >
              {OWNER_LABEL[data.owner]}
            </Badge>
          ) : (
            <span className="sr-only">{OWNER_LABEL[data.owner]}</span>
          )}
        </span>
        <span className="sr-only">{count === 1 ? "1 child" : `${count} children`}</span>
        {collapsed ? (
          // The visible count only on the collapsed chip, behind a glyph no zone kind uses:
          // a bare number beside the owner badge read as part of it ("SAAS 1", wave-1
          // review m8). Expanded, the children themselves are on screen.
          <span aria-hidden="true" data-slot="arch-zone-count" className={ZONE_HEADER_CLASS.count}>
            <LayoutGrid size={12} />
            {count}
          </span>
        ) : null}
        {data.component && compositeActions?.viewerOnly ? (
          <Badge variant="outline">{COMPOSITE_UI.viewer}</Badge>
        ) : null}
        <IconButton
          disabled={Boolean(
            data.component && (!compositeActions || compositeActions.disabledReason),
          )}
          aria-expanded={!collapsed}
          label={collapsed ? `Expand ${data.title}` : `Collapse ${data.title}`}
          icon={
            collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />
          }
          // DG-20 defect 14: the chevron rests out of sight on an expanded zone and shows on
          // hover or keyboard focus (focus-visible keeps it reachable and visible).
          className={cn(
            "nodrag shrink-0 transition-opacity",
            MOTION_CLASS.fast,
            !collapsed &&
              !data.component &&
              "opacity-0 group-focus-within/arch-zone:opacity-100 group-hover/arch-zone:opacity-100 focus-visible:opacity-100",
          )}
          onClick={toggle}
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
        isVisible={Boolean(selected) && !collapsed && resizable}
        minWidth={ZONE_MIN_WIDTH}
        minHeight={ZONE_MIN_HEIGHT}
        handleClassName={resizerHandleClassName}
        lineClassName="!border-border"
        onResizeEnd={onResizeEnd}
      />
    </FlowNodeCard>
  );
}
