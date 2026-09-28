import { useEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import {
  FlowNodeCard,
  FlowPort,
  Position,
  resolveFlowTone,
  type Node,
  type NodeProps,
} from "@elabs-ai/components-flow";
import { Badge, IconButton, cn } from "@elabs-ai/components-ui";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { ArchMark } from "./arch-mark";
import { ArchPorts } from "./service-node";
import { archNodeVariants, archTileVariants } from "./arch-node-variants";
import { COMPOSITE_UI, useCompositeActions } from "../interaction/composite-actions";
import { IDLE_PORT_CLASS, useConnectedPorts } from "./port-visibility";
import {
  ARCH_KIND_DEFAULT_ICON,
  type ArchMarkedKind,
  type ArchNodeKind,
  type ArchNodeData,
} from "./arch-node-data";

export interface CompositeNodeData extends ArchNodeData {
  component: string;
  overrideType?: ArchNodeKind;
  ports?: string[];
  count?: number;
  broken?: true;
  pending?: true;
  inner?: true;
}

/** Real workspace references share the mock's stacked tile, with actual named endpoints. */
export function CompositeNode({
  id,
  data,
  selected,
  isConnectable,
}: NodeProps<Node<CompositeNodeData>>) {
  const actions = useCompositeActions();
  const updateInternals = useUpdateNodeInternals();
  const portKey = data.ports?.join("|") ?? "";
  useEffect(() => {
    updateInternals(id);
  }, [id, portKey, updateInternals]);
  const kind: ArchMarkedKind =
    data.overrideType && data.overrideType !== "note" ? data.overrideType : "service";
  const fallback = data.overrideType === "note" ? "lucide/file" : ARCH_KIND_DEFAULT_ICON[kind];
  const connected = useConnectedPorts();
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const reason = data.broken || data.pending ? COMPOSITE_UI.unavailable : actions?.disabledReason;
  return (
    <FlowNodeCard
      data-slot="arch-composite"
      data-component={data.component}
      selected={selected}
      tone={tone}
      emphasis={emphasis}
      className={cn(archNodeVariants({ variant: "icon", kind: "service" }), "w-56 gap-2")}
    >
      <ArchPorts isConnectable={isConnectable} />
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-meta text-muted-foreground">{COMPOSITE_UI.component}</span>
        {actions ? (
          <IconButton
            label={COMPOSITE_UI.expand(data.title)}
            icon={<ChevronRight aria-hidden="true" />}
            size="icon-sm"
            variant="ghost"
            className="nodrag nopan shrink-0"
            aria-expanded={false}
            disabled={Boolean(reason)}
            onClick={(event) => {
              event.stopPropagation();
              actions.toggle(id);
            }}
          />
        ) : null}
      </div>
      <span
        className={cn(
          archTileVariants({ kind }),
          "mt-3 hairline-stack [--hairline-stack-inset:7px] [--hairline-stack-rise:6px]",
        )}
      >
        <ArchMark icon={data.icon ?? fallback} size={32} />
      </span>
      <div className="w-full break-words text-caption font-medium">{data.title}</div>
      {data.subtitle ? (
        <div className="w-full break-words text-meta text-muted-foreground">{data.subtitle}</div>
      ) : null}
      {data.count !== undefined ? (
        <div className="flex items-center gap-1 text-meta text-muted-foreground">
          <LayoutGrid size={12} aria-hidden="true" />
          {COMPOSITE_UI.count(data.count)}
        </div>
      ) : null}
      {actions?.viewerOnly && !reason ? (
        <Badge variant="outline">{COMPOSITE_UI.viewer}</Badge>
      ) : null}
      {reason && actions ? (
        <div className="w-full break-words text-meta text-muted-foreground">{reason}</div>
      ) : null}
      {data.ports?.length ? (
        <div className="w-full border-t border-border pt-1">
          {data.ports.map((port) => (
            <div
              key={port}
              className="relative -mx-3 px-4 py-1 text-meta text-muted-foreground"
              data-slot="composite-port"
            >
              <FlowPort
                port={`inner:${port}`}
                type="target"
                position={Position.Left}
                isConnectable={false}
                className={!connected.has(`in:inner:${port}`) ? IDLE_PORT_CLASS : undefined}
              />
              <span className="block truncate" title={port}>
                {port}
              </span>
              <FlowPort
                port={`inner:${port}`}
                type="source"
                position={Position.Right}
                isConnectable={false}
                className={!connected.has(`out:inner:${port}`) ? IDLE_PORT_CLASS : undefined}
              />
            </div>
          ))}
        </div>
      ) : null}
    </FlowNodeCard>
  );
}
