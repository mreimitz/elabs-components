"use client";

/**
 * chart-selection-toolbar.tsx — the selection chrome (RM-145, ADR 0040 §4).
 *
 * `ChartSelectionToolbar`: a segmented ui `ToggleGroup` of the tools the
 * container lists (Pointer, Range, Rectangle, Lasso — plus Circle when
 * `radial` is listed), the live count ("3 selected") and, in `explicit`
 * confirm, ✓ / ✕ buttons. Every control is a real `<button>` with a localised
 * accessible name and the shared focus ring; the tool group is arrow-key
 * navigable (Radix roving focus).
 *
 * Where it mounts: in `ChartFrame`'s action slot when the chart is framed
 * (`ChartFrameSelectionSlot`), otherwise above the plot inside the
 * container's measured box (`useContainerSelection`, like the container
 * legend). `selectionToolbar: "none"` hides it — the gestures, Enter / Esc and
 * click-outside keep working.
 */

import {
  forwardRef,
  type HTMLAttributes,
  type ComponentType,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  CircleDashed,
  Lasso,
  MousePointer2,
  MoveHorizontal,
  SquareDashed,
  X,
} from "lucide-react";
import {
  Button,
  cn,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useLocale,
} from "@elabs-ai/components-ui";
import { useChartSelectionSession } from "./selection-session-context";
import type { ChartSelectionToolMode, SelectionSession } from "./use-selection-session";

const TOOL_ICONS: Record<ChartSelectionToolMode, ComponentType<{ "aria-hidden"?: boolean }>> = {
  pointer: MousePointer2,
  range: MoveHorizontal,
  rect: SquareDashed,
  lasso: Lasso,
  radial: CircleDashed,
};

export interface ChartSelectionToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** The session to drive. Default: the nearest gesture-enabled container's. */
  session?: SelectionSession | null;
}

/**
 * Tool toggles, live count and ✓ / ✕ for one chart's selection session.
 * Renders `null` without an enabled session.
 */
export const ChartSelectionToolbar = forwardRef<HTMLDivElement, ChartSelectionToolbarProps>(
  function ChartSelectionToolbar({ session: sessionProp, className, ...props }, ref) {
    const fromContext = useChartSelectionSession();
    const session = sessionProp === undefined ? fromContext : sessionProp;
    const { t } = useLocale();
    const [node, setNode] = useState<HTMLDivElement | null>(null);
    const registerInside = session?.registerInside;
    // A toolbar outside the chart root (a frame's action slot) is still
    // "inside" the session: pressing ✕ must not commit by click-outside.
    useEffect(() => {
      if (!node || !registerInside) return;
      const frame = node.closest<HTMLElement>('[data-slot="chart-frame"], [data-slot="card"]');
      const offs = [registerInside(node), frame ? registerInside(frame) : undefined];
      return () => {
        for (const off of offs) off?.();
      };
    }, [node, registerInside]);
    const refs = useRef({ ref });
    refs.current.ref = ref;

    if (!session?.enabled) return null;
    const explicit = session.confirm === "explicit";
    const toolLabel = (mode: ChartSelectionToolMode) => {
      switch (mode) {
        case "range":
          return t("charts.selection.tool.range");
        case "rect":
          return t("charts.selection.tool.rect");
        case "lasso":
          return t("charts.selection.tool.lasso");
        case "radial":
          return t("charts.selection.tool.radial");
        default:
          return t("charts.selection.tool.pointer");
      }
    };

    return (
      <TooltipProvider>
        <div
          aria-label={t("charts.selection.toolbar")}
          className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
          data-chart-export="exclude"
          data-confirm={session.confirm}
          data-slot="chart-selection-toolbar"
          ref={(element) => {
            setNode(element);
            const forwarded = refs.current.ref;
            if (typeof forwarded === "function") forwarded(element);
            else if (forwarded) forwarded.current = element;
          }}
          role="group"
          {...props}
        >
          {session.modes.length > 1 ? (
            <ToggleGroup
              aria-label={t("charts.selection.toolbar.modes")}
              data-slot="chart-selection-toolbar-mode"
              onValueChange={(value) => {
                if (value) session.setMode(value as ChartSelectionToolMode);
              }}
              size="sm"
              type="single"
              value={session.mode}
              variant="segmented"
            >
              {session.modes.map((mode) => {
                const Icon = TOOL_ICONS[mode];
                const label = toolLabel(mode);
                return (
                  <Tooltip key={mode}>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem aria-label={label} data-mode={mode} value={mode}>
                        <Icon aria-hidden />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </ToggleGroup>
          ) : null}
          <span
            className="text-meta text-muted-foreground tabular-nums"
            data-slot="chart-selection-toolbar-count"
          >
            {session.count > 0 ? t("charts.selection.toolbar.count", { count: session.count }) : ""}
          </span>
          {explicit ? (
            <span className="flex items-center gap-1">
              <Button
                aria-label={t("charts.selection.toolbar.confirm")}
                data-slot="chart-selection-toolbar-confirm"
                disabled={!session.isOpen}
                onClick={() => session.commit()}
                size="icon-sm"
                variant="ghost"
              >
                <Check aria-hidden />
              </Button>
              <Button
                aria-label={t("charts.selection.toolbar.cancel")}
                data-slot="chart-selection-toolbar-cancel"
                disabled={!session.isOpen}
                onClick={() => session.cancel()}
                size="icon-sm"
                variant="ghost"
              >
                <X aria-hidden />
              </Button>
            </span>
          ) : null}
        </div>
      </TooltipProvider>
    );
  },
);
