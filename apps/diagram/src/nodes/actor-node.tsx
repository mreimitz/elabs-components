import {
  FlowNodeCard,
  FlowPort,
  Position,
  resolveFlowTone,
  type NodeProps,
} from "@elabs-ai/components-flow";
import type { ArchNode } from "./arch-node-data";
import { archNodeVariants } from "./arch-node-variants";
import { ArchNodeLayout } from "./service-node";

/** `arch/actor` — a person or team. Draws `lucide/user` when the data names no icon, and offers only the side ports (`in:in` / `out:out`): an actor starts or ends a flow, it is not a hub. */
export function ActorNode({ data, selected }: NodeProps<ArchNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const variant = data.variant ?? "icon";
  return (
    <FlowNodeCard
      className={archNodeVariants({ variant, kind: "actor" })}
      data-slot="arch-actor"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <FlowPort port="in" position={Position.Left} type="target" />
      <FlowPort port="out" position={Position.Right} type="source" />
      <ArchNodeLayout data={data} emphasis={emphasis} kind="actor" tone={tone} variant={variant} />
    </FlowNodeCard>
  );
}
