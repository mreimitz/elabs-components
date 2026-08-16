import { type CSSProperties, type ReactNode } from "react";
import { Reveal, useCollapsiblePanel } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";

const INSPECTOR_PANEL_WIDTH = "18rem";

export interface InspectorPanelProps {
  title?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  /** Empty-state shown when nothing is selected. */
  emptyMessage?: ReactNode;
  /** When false, render the empty state instead of children. */
  hasSelection?: boolean;
  /**
   * Stable identity of the current selection (e.g. the selected node's id).
   * When it changes, the body replays a quick fade so it reads as "details for
   * THIS node". Pass the selected entity's id (or any stable key derived from
   * the selected data).
   */
  selectionKey?: string | number;
  /**
   * Collapse (research 09 step 3 — converged on the shared `@qlik-coe-emea/qlabs-components-ui`
   * `useCollapsiblePanel` base; the panel stays single-view, drill-in is
   * ContextPanel-only). Controlled `open` / uncontrolled `defaultOpen`.
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which edge the panel sits on (collapse slide direction). Default `"right"`. */
  side?: "left" | "right";
  /** Expanded width (any CSS length). Default `"18rem"` (the original `w-72`). */
  width?: string;
  className?: string;
}

/**
 * Properties panel for the selected node/edge. Reusable beside a canvas (e.g.
 * inside a <SplitPanel>) or as a React Flow <Panel>. Always mounted; collapses
 * via the canonical `useCollapsiblePanel` width tween (CSS-gated, reduced-
 * motion safe) when `open`/`defaultOpen` drive it.
 */
export function InspectorPanel({
  title = "Inspector",
  children,
  onClose,
  emptyMessage = "Select a node to see its details.",
  hasSelection = true,
  selectionKey,
  open,
  defaultOpen = true,
  onOpenChange,
  side = "right",
  width = INSPECTOR_PANEL_WIDTH,
  className,
}: InspectorPanelProps) {
  const panel = useCollapsiblePanel({
    side,
    open,
    defaultOpen,
    onOpenChange,
    widthClassName: "w-(--inspector-panel-width)",
    spacerCollapsedClassName: "group-data-[state=collapsed]:w-0",
    containerSlideClassNames: {
      left: "left-0 group-data-[state=collapsed]:left-[calc(var(--inspector-panel-width)*-1)]",
      right: "right-0 group-data-[state=collapsed]:right-[calc(var(--inspector-panel-width)*-1)]",
    },
  });

  return (
    <div
      className={cn("group relative h-full overflow-hidden", className)}
      style={{ "--inspector-panel-width": width } as CSSProperties}
      inert={panel.open ? undefined : true}
      {...panel.attrs}
    >
      <div data-slot="inspector-panel-gap" className={panel.spacerClassName} />
      <div
        data-slot="inspector-panel-container"
        // Bounded to the host (a SplitPanel / canvas edge), not the viewport:
        // absolute within the relative group, full height (research 09 §B.2).
        className={cn(panel.containerClassName, "absolute inset-y-0 flex h-full border-s")}
      >
        {/* Detail-tier surface: raised `card` — robust across themes (#193). */}
        <div className="flex h-full w-full flex-col bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-body font-semibold text-foreground">{title}</h3>
            {onClose ? (
              <button
                type="button"
                aria-label="Close inspector"
                onClick={onClose}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
          {hasSelection ? (
            <Reveal
              key={selectionKey}
              appear="fade"
              speed="fast"
              className="flex-1 overflow-y-auto p-4 text-body"
            >
              {children}
            </Reveal>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 text-body">
              <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
