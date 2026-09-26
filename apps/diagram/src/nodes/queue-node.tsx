import { FlowNodeCard, resolveFlowTone, type NodeProps } from "@elabs-ai/components-flow";
import type { ArchNode } from "./arch-node-data";
import { archNodeVariants } from "./arch-node-variants";
import { ArchNodeLayout, ArchPorts } from "./service-node";

/** `arch/queue` — a queue, topic or stream: a pill in the `icon` look, a left rail on the `card`. */
export function QueueNode({ data, selected }: NodeProps<ArchNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const variant = data.variant ?? "icon";
  return (
    <FlowNodeCard
      className={archNodeVariants({ variant, kind: "queue" })}
      data-slot="arch-queue"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <ArchPorts />
      <ArchNodeLayout data={data} emphasis={emphasis} kind="queue" tone={tone} variant={variant} />
    </FlowNodeCard>
  );
}
