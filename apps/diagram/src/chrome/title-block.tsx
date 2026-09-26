import { Heading, Text, cn } from "@elabs-ai/components-ui";
import { Panel } from "@elabs-ai/components-flow";

export interface TitleBlockProps {
  /** The diagram's `title:`. Nothing renders without one. */
  title?: string;
  description?: string;
  /** A short meta line — an example, environment or "generated from …" note. */
  meta?: string;
}

/**
 * DG-08 — the diagram's title, as a floating `Panel` over the canvas (D9: it must be in
 * the exported picture). `Heading level={2}`: the app shell's top bar already owns the
 * page `<h1>` (plan §6), so the title block starts at `<h2>`, visually sized down to the
 * `subtitle` rung so it does not compete with it.
 *
 * The same floating-surface look as `DiagramLegend`/flow's `Legend`
 * (`rounded-lg bg-surface-elevated/90 p-3 text-meta shadow-ring-sm backdrop-blur`) — a
 * floating surface takes `shadow-ring-*` and no border (conventions, "Elevation").
 */
export function TitleBlock({ title, description, meta }: TitleBlockProps) {
  if (!title) return null;
  return (
    <Panel
      data-slot="diagram-title"
      position="top-left"
      className={cn(
        "flex min-w-0 max-w-sm flex-col gap-0.5 rounded-lg bg-surface-elevated/90 p-3 text-meta shadow-ring-sm backdrop-blur",
      )}
    >
      <Heading level={2} size="subtitle" className="min-w-0 truncate">
        {title}
      </Heading>
      {description ? (
        <Text variant="caption" tone="muted" className="min-w-0 truncate">
          {description}
        </Text>
      ) : null}
      {meta ? (
        <Text variant="meta" tone="muted" className="min-w-0 truncate">
          {meta}
        </Text>
      ) : null}
    </Panel>
  );
}
