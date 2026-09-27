import {
  FlowNodeCard,
  FlowPort,
  FlowToneIndicator,
  Position,
  resolveFlowTone,
  type FlowEmphasis,
  type FlowTone,
  type NodeProps,
} from "@elabs-ai/components-flow";
import { Badge, cn } from "@elabs-ai/components-ui";
import { LayoutGrid } from "lucide-react";
import { ArchMark } from "./arch-mark";
import { isCompositeMock, type CompositeMockNodeData } from "../fixtures/composite-mock";
import {
  ARCH_KIND_DEFAULT_ICON,
  ARCH_KIND_LABEL,
  type ArchMarkedKind,
  type ArchNode,
  type ArchNodeData,
  type ArchNodeVariant,
} from "./arch-node-data";
import { archNodeVariants, archTileVariants } from "./arch-node-variants";
import { IDLE_PORT_CLASS, useConnectedPorts } from "./port-visibility";

export interface ArchPortsProps {
  /**
   * view-mode direction (maintainer 2026-09-27): React Flow computes this from the canvas's
   * `nodesConnectable` prop and hands it to the node, but stops there — each port must pass
   * it on itself, or `IDLE_PORT_CLASS`'s `connectionindicator` hook never sees it turn off.
   */
  isConnectable: boolean;
}

/**
 * The four ports of every architecture node but the actor: `in:in` (left) and
 * `out:out` (right) for the main flow direction, `in:top` / `out:bottom` for a
 * top-to-bottom layout. Ids follow `flowPortId` (`FlowPort`'s `port` prop).
 */
export function ArchPorts({ isConnectable }: ArchPortsProps) {
  // Unconnected ports stay hidden until they can be used (port-visibility.ts).
  const connected = useConnectedPorts();
  const idle = (handleId: string) => (connected.has(handleId) ? undefined : IDLE_PORT_CLASS);
  return (
    <>
      <FlowPort
        port="in"
        position={Position.Left}
        type="target"
        isConnectable={isConnectable}
        className={idle("in:in")}
      />
      <FlowPort
        port="out"
        position={Position.Right}
        type="source"
        isConnectable={isConnectable}
        className={idle("out:out")}
      />
      <FlowPort
        port="top"
        position={Position.Top}
        type="target"
        isConnectable={isConnectable}
        className={idle("in:top")}
      />
      <FlowPort
        port="bottom"
        position={Position.Bottom}
        type="source"
        isConnectable={isConnectable}
        className={idle("out:bottom")}
      />
    </>
  );
}

export interface ArchNodeLayoutProps {
  kind: ArchMarkedKind;
  variant: ArchNodeVariant;
  data: ArchNodeData;
  tone: FlowTone;
  emphasis: FlowEmphasis;
}

/** The inside of an architecture node, in its D5 look — shared by every marked kind. */
export function ArchNodeLayout(props: ArchNodeLayoutProps) {
  return props.variant === "icon" ? <IconLayout {...props} /> : <CardLayout {...props} />;
}

/**
 * The node OBJECT's `ariaLabel`: "<title>, <kind>" (e.g. "Order API, Data store"), so the
 * kind is part of the node's accessible name and not only of its content (wave-1 review m1).
 * P4: library gap — `CanvasShell` names every node wrapper from `data.title` alone
 * (`defaultNodeAriaLabel`, packages/flow/src/canvas-shell/node-aria-label.ts:21) and a node
 * component has no channel to its wrapper's name, so whoever builds the node objects sets
 * this (DG-05-node-primitives.md, "Wave-1 review additions").
 */
export function archNodeAriaLabel(kind: ArchMarkedKind, title: string): string {
  return `${title}, ${ARCH_KIND_LABEL[kind]}`;
}

/**
 * The kind as a word for assistive technology, read with the node's content. The `icon`
 * look shows the kind only as a shape cue, and the `card` look's eyebrow names the provider
 * instead of the kind when one is set.
 */
function KindWord({ kind }: { kind: ArchMarkedKind }) {
  return <span className="sr-only">{ARCH_KIND_LABEL[kind]}</span>;
}

function BadgeRow({ badges, className }: { badges?: string[]; className?: string }) {
  if (!badges?.length) return null;
  // P4: library gap — no `FlowNodeBadges` part; a plain row of outline `Badge`s. DG-20:
  // `Badge` has no `size` prop, so the item's `size="sm"` is tighter padding here
  // (findings, "Library gaps").
  return (
    <div className={cn("flex min-w-0 flex-wrap gap-1", className)} data-slot="arch-node-badges">
      {badges.map((badge) => (
        <Badge key={badge} variant="outline" className="px-1.5 py-0 text-meta">
          {badge}
        </Badge>
      ))}
    </div>
  );
}

/** The mark on its tile: the `icon` look's common ground and shape cue (DG-20). */
function MarkTile({
  kind,
  icon,
  className,
}: {
  kind: ArchMarkedKind;
  icon?: string;
  className?: string;
}) {
  return (
    <span className={cn(archTileVariants({ kind }), className)} data-slot="arch-node-tile">
      <ArchMark
        className="text-muted-foreground"
        data-flow-tone-part="mark"
        icon={icon ?? ARCH_KIND_DEFAULT_ICON[kind]}
        size={32}
      />
    </span>
  );
}

/** AWS/Azure reference-architecture look: mark on its tile, label under it, no box. */
function IconLayout({ kind, data, tone, emphasis }: ArchNodeLayoutProps) {
  return (
    <>
      <MarkTile kind={kind} icon={data.icon} />
      {/* P4: library gap — the `icon` look has no border for `flowToneVariants` to paint,
          and a vendored mark is an image `text-<tone>` cannot tint, so the title is the
          tone's colour carrier (`ink` = the ≥4.5:1 text rung). A `FlowNodeCard`
          `variant="bare"` with its own tone cue would replace this. */}
      <div
        className="w-full min-w-0 break-words text-caption font-medium"
        data-flow-tone-part="ink"
      >
        {data.title}
      </div>
      <KindWord kind={kind} />
      {data.subtitle ? (
        <div className="w-full min-w-0 break-words text-meta text-muted-foreground">
          {data.subtitle}
        </div>
      ) : null}
      <BadgeRow badges={data.badges} className="justify-center" />
      <FlowToneIndicator className="absolute end-1 top-1" emphasis={emphasis} tone={tone} />
    </>
  );
}

/** C4 look: eyebrow (provider or kind), title, subtitle, badge row. */
function CardLayout({ kind, data, tone, emphasis }: ArchNodeLayoutProps) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2" data-slot="arch-node-header">
        <ArchMark
          className="text-muted-foreground"
          data-flow-tone-part="mark"
          icon={data.icon ?? ARCH_KIND_DEFAULT_ICON[kind]}
          size={20}
          variant="mono"
        />
        <div className="min-w-0 flex-1 truncate text-eyebrow uppercase text-muted-foreground">
          {data.provider ?? ARCH_KIND_LABEL[kind]}
        </div>
        <FlowToneIndicator emphasis={emphasis} tone={tone} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-body font-medium">{data.title}</div>
        {data.provider ? <KindWord kind={kind} /> : null}
        {data.subtitle ? (
          <div className="truncate text-caption text-muted-foreground">{data.subtitle}</div>
        ) : null}
      </div>
      <BadgeRow badges={data.badges} />
    </>
  );
}

/**
 * DG-20 step 8 — the MOCKED collapsed composite (fixtures/composite-mock.ts): the tile with
 * a stacked-cards edge behind it (`hairline-stack`, which rises above the tile, so the tile
 * leaves `mt-3` of room), the title, the node count, and two labelled ports in place of the
 * four plain ones. A review aid for DG-22, not the composite feature.
 */
function CompositeMockLayout({
  data,
  tone,
  emphasis,
  isConnectable,
}: {
  data: CompositeMockNodeData;
  tone: FlowTone;
  emphasis: FlowEmphasis;
  isConnectable: boolean;
}) {
  const { count, input, output } = data.composite;
  return (
    <>
      {/* The standard four ports: the layout's port picker (`followZoneDirection`) only knows
          the arch definition's port names, so the labels name the main in/out pair. */}
      <ArchPorts isConnectable={isConnectable} />
      {/* Port labels INSIDE the box, centred on the port line beside the port dot: the edge
          ends at the dot on the border, so a label inside never sits on its line. The box is
          `w-40` so a label clears the tile (56 px each side of it). */}
      <span
        aria-hidden="true"
        className="absolute start-3 top-1/2 -translate-y-1/2 text-meta text-muted-foreground"
      >
        {input.label}
      </span>
      <span
        aria-hidden="true"
        className="absolute end-3 top-1/2 -translate-y-1/2 text-meta text-muted-foreground"
      >
        {output.label}
      </span>
      {/* The stack's sheets step in 7 px a side (the token's 4 % is ~2 px on a 48 px tile,
          which read as a thicker top line, not as cards) and rise 6 px each; `mt-3` is the
          room for both. */}
      <MarkTile
        kind="service"
        icon={data.icon}
        className="mt-3 hairline-stack [--hairline-stack-inset:7px] [--hairline-stack-rise:6px]"
      />
      <div
        className="w-full min-w-0 break-words text-caption font-medium"
        data-flow-tone-part="ink"
      >
        {data.title}
      </div>
      <div className="flex items-center gap-1 text-meta tabular-nums text-muted-foreground">
        <LayoutGrid aria-hidden="true" size={12} />
        {count === 1 ? "1 node" : `${count} nodes`}
      </div>
      <FlowToneIndicator className="absolute end-1 top-1" emphasis={emphasis} tone={tone} />
    </>
  );
}

/** `arch/service` — the default node type (plan §4). */
export function ServiceNode({ data, selected, isConnectable }: NodeProps<ArchNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const variant = data.variant ?? "icon";
  if (isCompositeMock(data)) {
    return (
      <FlowNodeCard
        className={cn(archNodeVariants({ variant: "icon", kind: "service" }), "w-40")}
        data-slot="arch-service"
        data-composite=""
        emphasis={emphasis}
        selected={selected}
        tone={tone}
      >
        <CompositeMockLayout
          data={data}
          emphasis={emphasis}
          tone={tone}
          isConnectable={isConnectable}
        />
      </FlowNodeCard>
    );
  }
  return (
    <FlowNodeCard
      className={archNodeVariants({ variant, kind: "service" })}
      data-slot="arch-service"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <ArchPorts isConnectable={isConnectable} />
      <ArchNodeLayout
        data={data}
        emphasis={emphasis}
        kind="service"
        tone={tone}
        variant={variant}
      />
    </FlowNodeCard>
  );
}
