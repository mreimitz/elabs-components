import { cn } from "@elabs-ai/components-ui/lib/cn";
import { computeEdgeWeightScale, type WeightedEdgeLike } from "../flow-weighted-edge/weight-scale";

export interface LegendItem {
  label: string;
  /** Any CSS color or token reference, e.g. "var(--chart-1)". */
  color: string;
}

/**
 * Categorical legend props — a swatch-and-label list. This is the shape
 * `Legend` renders when `variant` is omitted, byte-for-byte unchanged from
 * before the `"scale"` variant existed.
 */
export interface LegendCategoricalProps {
  variant?: "categorical";
  items: LegendItem[];
  title?: string;
  className?: string;
}

/**
 * Continuous scale legend — a reading key that explains a WIDTH or COLOR
 * encoding as a *range*, not a set of discrete categories (e.g.
 * `FlowWeightedEdge`'s `data.weight` → stroke width, `data.value` → stroke
 * color). `kind: "width"` reuses `computeEdgeWeightScale` — the exact pure
 * scale `FlowWeightedEdge` calls — so the sample strokes drawn here can never
 * drift from the widths a real flow's edges render for the same weights.
 */
export interface LegendScaleProps {
  variant: "scale";
  /** Which continuous encoding this legend explains. */
  kind: "width" | "color";
  /** `[min, max]` of the underlying value the ramp represents. */
  domain: [number, number];
  /** Formats a domain value for display at a tick. @default `(v) => v.toLocaleString()` */
  format?: (value: number) => string;
  /**
   * Sample count for `kind: "width"`: `"minmax"` draws a min/max pair of
   * sample strokes, `"minmedmax"` adds the domain midpoint as a third
   * sample. `kind: "color"` always renders a fixed 5-stop gradient
   * regardless of this prop — five stops is what makes a 2-endpoint color
   * ramp legible as an ordered scale (see the color-ramp a11y note below),
   * independent of how many width samples are shown.
   * @default "minmax"
   */
  ticks?: "minmax" | "minmedmax";
  title?: string;
  className?: string;
}

export type LegendProps = LegendCategoricalProps | LegendScaleProps;

const defaultFormat = (value: number): string => value.toLocaleString();

/**
 * Small legend mapping colors/types to labels for a canvas or chart
 * (`variant: "categorical"`, the default), or — via `variant="scale"` — a
 * continuous width/color ramp with a domain, tick marks and formatting.
 */
export function Legend(props: LegendProps) {
  if (props.variant === "scale") {
    return <LegendScale {...props} />;
  }
  return <LegendCategorical {...props} />;
}

function LegendCategorical({ items, title, className }: LegendCategoricalProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-elevated/90 p-3 text-xs shadow-ring-sm backdrop-blur",
        className,
      )}
    >
      {title ? <div className="mb-1.5 font-medium text-foreground">{title}</div> : null}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Width-ramp sample: a tick value plus the stroke width `computeEdgeWeightScale`
 * assigns it. The "edges" fed to the scale are exactly the requested tick
 * values, so the group's own min/max always equal the domain — the returned
 * widths are byte-identical to what `computeEdgeWeightScale` would compute for
 * real edges carrying these same weights (no duplicated min-max math).
 */
function computeWidthSamples(
  domain: [number, number],
  ticks: "minmax" | "minmedmax",
): { value: number; width: number }[] {
  const [min, max] = domain;
  const values = ticks === "minmedmax" ? [min, (min + max) / 2, max] : [min, max];
  const likeEdges: WeightedEdgeLike[] = values.map((weight, index) => ({
    id: String(index),
    data: { weight },
  }));
  const widths = computeEdgeWeightScale(likeEdges);
  return values.map((value, index) => ({ value, width: widths.get(String(index)) ?? 0 }));
}

/** Fractions along the domain the color ramp samples — fixed at 5 stops (see `LegendScaleProps.ticks`). */
const COLOR_STOP_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

function scaleKindLabel(kind: "width" | "color"): string {
  return kind === "width" ? "width" : "color";
}

function LegendScale({
  kind,
  domain,
  format = defaultFormat,
  ticks = "minmax",
  title,
  className,
}: LegendScaleProps) {
  const [min, max] = domain;
  // e.g. "Edge width scale, 2 to 48, minimum to maximum" — a single accessible
  // name for the whole reading key, since it is one keyboard tab stop, not one
  // per tick.
  const ariaLabel = `Edge ${scaleKindLabel(kind)} scale, ${format(min)} to ${format(max)}, minimum to maximum`;

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col gap-2 rounded-lg bg-surface-elevated/90 p-3 shadow-ring-sm backdrop-blur",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      role="group"
      tabIndex={0}
    >
      {title ? <div className="text-body font-medium text-foreground">{title}</div> : null}
      {kind === "width" ? (
        <LegendScaleWidth domain={domain} format={format} ticks={ticks} />
      ) : (
        <LegendScaleColor domain={domain} format={format} />
      )}
    </div>
  );
}

function LegendScaleWidth({
  domain,
  format,
  ticks,
}: {
  domain: [number, number];
  format: (value: number) => string;
  ticks: "minmax" | "minmedmax";
}) {
  const samples = computeWidthSamples(domain, ticks);
  return (
    <div className="flex flex-col gap-2">
      {samples.map((sample, index) => (
        // Index disambiguates a zero-width domain, where every sample shares
        // the same value (and therefore the same width).
        <div key={`${index}-${sample.value}`} className="flex items-center gap-3">
          {/* The thin end of the ramp (default floor 1.5px) is the weakest mark
              in the system — `--flow-edge` is the same token a real, unweighted
              edge draws, and `strokeLinecap="round"` keeps that floor width from
              disappearing into a hairline. */}
          <svg aria-hidden="true" className="shrink-0" height={16} overflow="visible" width={40}>
            <line
              stroke="var(--flow-edge)"
              strokeLinecap="round"
              strokeWidth={sample.width}
              x1={2}
              x2={38}
              y1={8}
              y2={8}
            />
          </svg>
          <span className="min-w-0 truncate text-meta tabular-nums text-muted-foreground">
            {format(sample.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LegendScaleColor({
  domain,
  format,
}: {
  domain: [number, number];
  format: (value: number) => string;
}) {
  const [min, max] = domain;
  const span = max - min;
  const stops = COLOR_STOP_FRACTIONS.map((fraction) => ({
    fraction,
    value: min + fraction * span,
  }));
  // Explicit 5-stop `color-mix` gradient (interpolated `in oklch`, matching how
  // the `--flow-edge-weak`/`--flow-edge-strong` tokens themselves are authored)
  // rather than a bare 2-color `linear-gradient`, so the ramp's perceptual
  // steps match the token authoring space instead of the browser's default
  // sRGB gradient interpolation.
  const gradient = `linear-gradient(to right, ${stops
    .map(({ fraction }) => {
      const percent = Math.round(fraction * 100);
      return `color-mix(in oklch, var(--flow-edge-strong) ${percent}%, var(--flow-edge-weak)) ${percent}%`;
    })
    .join(", ")})`;

  return (
    <div className="flex flex-col gap-1.5">
      {/*
        WCAG 1.4.1 — this gradient alone cannot carry the ordering, so the
        numbered ticks below are the required second channel, not decoration.
      */}
      <div
        aria-hidden="true"
        className="h-3 w-full rounded-full"
        style={{ backgroundImage: gradient }}
      />
      <div className="flex justify-between gap-1">
        {stops.map((stop, index) => (
          <span
            // Index disambiguates a zero-width domain, where every stop shares
            // the same formatted value.
            key={`${index}-${stop.value}`}
            className={cn(
              "min-w-0 truncate text-meta tabular-nums text-muted-foreground",
              index === 0 && "text-start",
              index === stops.length - 1 && "text-end",
            )}
          >
            {format(stop.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
