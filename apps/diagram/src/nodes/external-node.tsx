import { FlowNodeCard, resolveFlowTone, type NodeProps } from "@elabs-ai/components-flow";
import type { ArchNode } from "./arch-node-data";
import { archNodeVariants } from "./arch-node-variants";
import { ArchNodeLayout, ArchPorts } from "./service-node";

/** `arch/external` — a system outside every zone. Dashed outline, all four ports. */
export function ExternalNode({ data, selected }: NodeProps<ArchNode>) {
  const { tone, emphasis } = resolveFlowTone(data.tone, data.emphasis);
  const variant = data.variant ?? "icon";
  return (
    <FlowNodeCard
      className={archNodeVariants({ variant, kind: "external" })}
      data-slot="arch-external"
      emphasis={emphasis}
      selected={selected}
      tone={tone}
    >
      <ArchPorts />
      <ArchNodeLayout
        data={data}
        emphasis={emphasis}
        kind="external"
        tone={tone}
        variant={variant}
      />
    </FlowNodeCard>
  );
}
