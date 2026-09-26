import { FlowNodeCard, resolveFlowTone, type NodeProps } from "@elabs-ai/components-flow";
import type { ArchNode } from "./arch-node-data";
import { archNodeVariants } from "./arch-node-variants";
import { ArchNodeLayout, ArchPorts } from "./service-node";

/** `arch/datastore` — a database, warehouse or bucket. The rounded bottom is its cylinder cue. */
export function DatastoreNode({ data, selected }: NodeProps<ArchNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const variant = data.variant ?? "icon";
  return (
    <FlowNodeCard
      className={archNodeVariants({ variant, kind: "datastore" })}
      data-slot="arch-datastore"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <ArchPorts />
      <ArchNodeLayout
        data={data}
        emphasis={emphasis}
        kind="datastore"
        tone={tone}
        variant={variant}
      />
    </FlowNodeCard>
  );
}
