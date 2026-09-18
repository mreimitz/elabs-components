"use client";

import {
  type ComponentType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { useChartFramePlotHeight } from "../chart-breakpoint";
import { AnnotationKey } from "./annotation-key";
import { type ChartAnnotation, withAnnotationDescription } from "./annotation-types";
import { ChartAnnotations } from "./chart-annotations";

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
): ReactElement {
  const fill = useChartFramePlotHeight() === "fill";
  const { annotations, ...rest } = props;
  const plotProps = rest as unknown as P;
  if (!annotations?.length) return <Plot {...plotProps} ref={ref} />;
  const plot = (
    <Plot
      {...plotProps}
      accessibleDescription={withAnnotationDescription(props.accessibleDescription, annotations)}
      ref={ref}
    >
      {props.children}
      <ChartAnnotations annotations={annotations} />
    </Plot>
  );
  return (
    <div
      className={cn("flex w-full flex-col", fill && "h-full min-h-0")}
      data-slot="chart-annotations-host"
    >
      {fill ? <div className="min-h-0 flex-1">{plot}</div> : plot}
      <AnnotationKey annotations={annotations} />
    </div>
  );
}
