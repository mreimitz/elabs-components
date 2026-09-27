import type { ReactNode } from "react";
import { Heading, Text, cn } from "@elabs-ai/components-ui";
import { Panel } from "@elabs-ai/components-flow";

export interface TitleBlockProps {
  /** The diagram's `title:`. Without one only `children` render. */
  title?: string;
  description?: string;
  /** A short meta line — an example, environment or "generated from …" note. */
  meta?: string;
  /**
   * Semantic heading level for the title (m10). Default `2`: the app shell's top bar
   * already owns the page `<h1>` (plan §6). A standalone route with no shell (e.g.
   * `#legend`) passes `1` so the page still has exactly one `<h1>`. The visual rung stays
   * pinned to `size="subtitle"` either way, so this never changes how the title looks.
   */
  headingLevel?: 1 | 2;
  /**
   * Stacked under the title card, in the same panel — the canvas's status line (wave-2 review
   * m4). Its box is part of the panel, so the chrome-aware fit keeps nodes out from under it.
   */
  children?: ReactNode;
}

/**
 * DG-08 — the diagram's title, as a floating `Panel` over the canvas (D9: it must be in
 * the exported picture). `Heading level={2}` by default: the app shell's top bar already
 * owns the page `<h1>` (plan §6), so the title block starts at `<h2>`, visually sized down
 * to the `subtitle` rung so it does not compete with it; `headingLevel={1}` opts a
 * standalone route in instead (m10).
 *
 * The card has the same floating-surface look as `DiagramLegend`/flow's `Legend`
 * (`rounded-lg bg-surface-elevated/90 p-3 text-meta shadow-ring-sm backdrop-blur`) — a
 * floating surface takes `shadow-ring-*` and no border (conventions, "Elevation"). The panel
 * itself is a bare column: the card, then `children`.
 */
export function TitleBlock({
  title,
  description,
  meta,
  headingLevel = 2,
  children,
}: TitleBlockProps) {
  if (!title && !children) return null;
  return (
    <Panel
      data-slot="diagram-title"
      position="top-left"
      className={cn(
        // m2: `max-w-sm` (384px, a FIXED rem cap) let the panel's shrink-to-fit width win
        // over the pane at 390px — the `truncate` (nowrap) children made their min-content
        // width the full text, so the box never actually shrunk to the cap. `Panel` is
        // `position: absolute` inside `.react-flow` (which fills the pane, `width: 100%`,
        // `position: relative`), so a `%`-based max-width caps it to the PANE, not a fixed
        // rem — 2rem leaves room for the `top-left` panel's own 15px outer margin on both
        // sides. Wave-2 review m1: from `@3xl` the canvas shows the minimap top-right, so the
        // cap also leaves its 200px plus its 15px margin and a gap (16rem in all). P4: library
        // gap — the floating-surface shell (`DiagramLegend`'s `FLOATING_SURFACE`, this block)
        // should cap itself to its pane so no consumer writes this calc(); see
        // docs/findings/DG-08-legend.md.
        // The column's empty corner (beside a short status line) must not catch the canvas's
        // pointer, so only the card takes it.
        "pointer-events-none flex min-w-0 max-w-[calc(100%-2rem)] flex-col items-start gap-2 @3xl:max-w-[calc(100%-16rem)]",
      )}
    >
      {title ? (
        <div
          data-slot="diagram-title-card"
          className="pointer-events-auto flex min-w-0 max-w-full flex-col gap-0.5 rounded-lg bg-surface-elevated/90 p-3 text-meta shadow-ring-sm backdrop-blur"
        >
          {/* Wave-2 review m1: wraps to two lines before it clips — `truncate` kept one line
              at the full title's width, which ran under the minimap at 1440. */}
          <Heading
            level={headingLevel}
            size="subtitle"
            className="line-clamp-2 min-w-0 break-words"
          >
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
        </div>
      ) : null}
      {children}
    </Panel>
  );
}
