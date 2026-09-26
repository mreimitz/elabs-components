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
import { ArchMark } from "./arch-mark";
import {
  ARCH_KIND_DEFAULT_ICON,
  ARCH_KIND_LABEL,
  type ArchMarkedKind,
  type ArchNode,
  type ArchNodeData,
  type ArchNodeVariant,
} from "./arch-node-data";
import { archNodeVariants } from "./arch-node-variants";

/**
 * The four ports of every architecture node but the actor: `in:in` (left) and
 * `out:out` (right) for the main flow direction, `in:top` / `out:bottom` for a
 * top-to-bottom layout. Ids follow `flowPortId` (`FlowPort`'s `port` prop).
 */
export function ArchPorts() {
  // P4: library gap — `FlowPort` is always drawn; four dots on every node are noise in a
  // static architecture diagram. A `FlowPort` `showOn="hover" | "connect"` mode would hide
  // them until the pointer or a connection drag needs them.
  return (
    <>
      <FlowPort port="in" position={Position.Left} type="target" />
      <FlowPort port="out" position={Position.Right} type="source" />
      <FlowPort port="top" position={Position.Top} type="target" />
      <FlowPort port="bottom" position={Position.Bottom} type="source" />
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
  // P4: library gap — no `FlowNodeBadges` part; a plain row of outline `Badge`s.
  return (
    <div className={cn("flex min-w-0 flex-wrap gap-1", className)} data-slot="arch-node-badges">
      {badges.map((badge) => (
        <Badge key={badge} variant="outline">
          {badge}
        </Badge>
      ))}
    </div>
  );
}

/** AWS/Azure reference-architecture look: mark on top, label under it, no box. */
function IconLayout({ kind, data, tone, emphasis }: ArchNodeLayoutProps) {
  return (
    <>
      <ArchMark
        className="text-muted-foreground"
        data-flow-tone-part="mark"
        icon={data.icon ?? ARCH_KIND_DEFAULT_ICON[kind]}
        size={40}
      />
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
        <div className="min-w-0 flex-1 truncate text-eyebrow text-muted-foreground">
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

/** `arch/service` — the default node type (plan §4). */
export function ServiceNode({ data, selected }: NodeProps<ArchNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const variant = data.variant ?? "icon";
  return (
    <FlowNodeCard
      className={archNodeVariants({ variant, kind: "service" })}
      data-slot="arch-service"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <ArchPorts />
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
