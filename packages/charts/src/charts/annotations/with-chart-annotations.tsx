"use client";

import {
  type ComponentType,
  createContext,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  useContext,
  useMemo,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { useChartFramePlotHeight } from "../chart-breakpoint";
import { AnnotationKey } from "./annotation-key";
import { AnnotationLayoutProvider } from "./annotation-layout-context";
import { type ChartAnnotation, withAnnotationDescription } from "./annotation-types";
import { AnnotationScalesContext, ChartAnnotations } from "./chart-annotations";
import type { AnnotationScales } from "./resolve-annotation-position";

/** The props a container needs to host annotations. */
export interface ChartAnnotationsHostProps {
  children?: ReactNode;
  accessibleDescription?: string;
  /**
   * Declarative annotations in data units (RM-111): text notes, ranges,
   * reference lines and row notes. Ranges paint under the series, the rest
   * over them; at the `narrow` tier each text note becomes a numbered marker
   * listed in a key under the plot, and every annotation is restated once in
   * the figure description.
   */
  annotations?: readonly ChartAnnotation[];
}

/**
 * Render a cartesian container with its `annotations` prop applied (RM-111).
 * Called from the container's public `forwardRef` (so docgen and the
 * `charts-responsive` rule still see a `forwardRef` export); the container
 * body itself is untouched: this appends a `ChartAnnotations` child (which the
 * shell paints in its back and front passes), merges the restatement into
 * `accessibleDescription`, and stacks an `AnnotationKey` under the plot box,
 * so the key adds to the total height and never eats the drawing.
 *
 * With no annotations it renders the container alone: the DOM is identical to
 * the container without this prop.
 */
export function useAnnotatedChart<P extends ChartAnnotationsHostProps>(
  Plot: ComponentType<P & RefAttributes<HTMLDivElement>>,
  props: P,
  ref: ForwardedRef<HTMLDivElement>,
  /**
   * `children` (default): append a `ChartAnnotations` child for the shell to
   * paint. `context`: publish the annotations for a container that draws its
   * own plot and mounts the layers with `useChartAnnotationLayers`.
   */
  mount: "children" | "context" = "children",
): ReactElement {
  const fill = useChartFramePlotHeight() === "fill";
  const { annotations, ...rest } = props;
  const plotProps = rest as unknown as P;
  if (!annotations?.length) return <Plot {...plotProps} ref={ref} />;
  const accessibleDescription = withAnnotationDescription(props.accessibleDescription, annotations);
  const plot =
    mount === "context" ? (
      <ChartAnnotationsSlotContext.Provider value={annotations}>
        <Plot {...plotProps} accessibleDescription={accessibleDescription} ref={ref} />
      </ChartAnnotationsSlotContext.Provider>
    ) : (
      <Plot {...plotProps} accessibleDescription={accessibleDescription} ref={ref}>
        {props.children}
        <ChartAnnotations annotations={annotations} />
      </Plot>
    );
  // One layout scope for the plot and its key: the key lists the notes the
  // layer had to demote to a numbered marker.
  return (
    <AnnotationLayoutProvider>
      <div
        className={cn("flex w-full flex-col", fill && "h-full min-h-0")}
        data-slot="chart-annotations-host"
      >
        {fill ? <div className="min-h-0 flex-1">{plot}</div> : plot}
        <AnnotationKey annotations={annotations} />
      </div>
    </AnnotationLayoutProvider>
  );
}

/** The annotations a `context`-mounted container paints (see `useAnnotatedChart`). */
const ChartAnnotationsSlotContext = createContext<readonly ChartAnnotation[] | null>(null);

/**
 * The two annotation passes for a container that draws its own plot without a
 * `ChartProvider` (RM-111): render `back` before the marks and `front` after
 * them, inside the plot's translated group. `scales` maps data units onto the
 * plot; pass `null` when the current layout cannot place annotations. Both
 * passes are `null` when the container was given no annotations.
 */
export function useChartAnnotationLayers(scales: AnnotationScales | null): {
  back: ReactElement | null;
  front: ReactElement | null;
} {
  const annotations = useContext(ChartAnnotationsSlotContext);
  return useMemo(() => {
    if (!annotations?.length || !scales) return { back: null, front: null };
    const pass = (layer: "back" | "front") => (
      <AnnotationScalesContext.Provider value={scales}>
        <ChartAnnotations annotations={annotations} layer={layer} />
      </AnnotationScalesContext.Provider>
    );
    return { back: pass("back"), front: pass("front") };
  }, [annotations, scales]);
}
