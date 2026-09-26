import { StickyNote } from "lucide-react";
import { FlowNodeCard, type NodeProps } from "@elabs-ai/components-flow";
import type { ArchNode } from "./arch-node-data";

/**
 * `arch/note` — an annotation (plan §4 `notes:`). No ports: a note explains the graph, it
 * is not wired into it. Still a `FlowNodeCard`, so it keeps the selection ring and the
 * proxied focus indicator. It carries no tone: a note has no status. Shape copied from
 * flow's `Custom Nodes / Annotation` story — a dashed strong border, because a broken line
 * reads a rung lighter than a solid one and is the note's only edge on the canvas.
 */
export function NoteNode({ data, selected }: NodeProps<ArchNode>) {
  return (
    <FlowNodeCard
      className="flex w-56 gap-2 rounded-md border-dashed border-border-strong bg-surface-muted px-3 py-2 shadow-none"
      data-slot="arch-note"
      selected={selected}
    >
      <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      {/* `nodrag` + `select-text`: dragging across the text selects it instead of moving
          the node (React Flow's node wrapper is `user-select: none`). A click still
          selects the node. */}
      <p className="nodrag min-w-0 select-text break-words text-caption text-muted-foreground">
        {data.text ?? data.title}
      </p>
    </FlowNodeCard>
  );
}
