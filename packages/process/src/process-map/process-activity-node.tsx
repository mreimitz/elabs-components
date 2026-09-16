"use client";

/**
 * ProcessActivityNode — one activity on the process map (RM-051).
 *
 * ## It COMPOSES `FlowNode`; it does not fork it
 *
 * The frame, the handles, the tone glyph, the selection ring and — this is the load-bearing
 * part — the keyboard focus indicator repaired in #312 all come from
 * `@elabs-ai/components-flow`'s `FlowNode`, rendered here with process-shaped data. Nothing
 * about React Flow's proxied focus (the `:focus-visible` state lands on React Flow's own
 * wrapper element, one level above anything this package renders) is re-implemented, and
 * the ancestor-variant class string that makes it work is not copied. If `FlowNode`'s focus
 * treatment changes, this node changes with it.
 *
 * The three text slots `FlowNode` already owns carry the whole reading:
 *
 * - `kind` (eyebrow) — what the number MEANS ("Cases", "Median duration");
 * - `title` — the activity name;
 * - `subtitle` — the primary metric, and the secondary metric when one is asked for.
 *
 * ## Encoding: never colour alone (WCAG 1.4.1)
 *
 * The node metric reaches the reader three ways, and the first two survive greyscale:
 * the **printed value** in the subtitle, the **length** of the meter bar under the node,
 * and the meter's **saturation** against the surface→primary ramp. Two nodes with
 * different values differ in text and in bar length before they differ in hue, which is
 * what keeps this surface honest while the two open flow-colour defects (#321, #297) are
 * unfixed.
 *
 * Start and end are a glyph PLUS a word in the accessible name (never a colour); rework is
 * a counted badge; the tri-state selection is driven by the `data-selection` attribute
 * `map-model`'s `domAttributes` sets on React Flow's own node element, so a consumer can
 * select on `[data-selection="excluded"]` without reaching into this component. An
 * excluded node is deliberately NOT `aria-disabled`: it stays fully operable (clicking it
 * is how a reader filters it back in), and `activityAriaLabel` already appends the word
 * "excluded" to its accessible name, so the state reaches assistive technology through
 * real text rather than a lie about disablement.
 *
 * ## Ghosting an excluded node without erasing its boundary (#352)
 *
 * A single `opacity-35` on this whole subtree used to dim the card, its border AND its
 * text together — since the card's fill barely differs from the canvas
 * (white-on-near-white in the light theme), the 1px border was the ONLY structural cue
 * telling a reader "there is still a card here", and dimming it along with everything else
 * measured under WCAG's own 3:1 non-text floor, while the eyebrow/title text measured as
 * low as 1.64:1/1.97:1 against 4.5:1 — a real axe-caught 1.4.3 failure, not a cosmetic one.
 * This component now composes `FlowNode` UNCHANGED (no fork, no new prop on it) and reaches
 * the ghost treatment from outside on two channels that never touch text:
 *
 * - **The card's border-colour token is locally overridden** (`--border` → `--border-strong`
 *   on the wrapping frame div) so `FlowNode`'s own `border-border` utility resolves to the
 *   stronger rung automatically — a plain CSS custom-property cascade trick, not a fork.
 * - **The card's fill token is locally re-tinted** (`--flow-node` → a `card`/`surface-muted`
 *   mix) so `FlowNode`'s `bg-flow-node` utility reads as visibly quieter. This is a
 *   background-COLOUR change, not an opacity change — it cannot wash out the text painted
 *   on top of it the way a translucent scrim would (a scrim was tried and rejected for
 *   exactly this reason: it sits in the same paint layer as the text it was meant to spare).
 *
 * Eyebrow/title/subtitle text is never dimmed and never overlaid — see {@link GHOST_OPACITY}'s
 * own docblock for why (0.35 over that text's already-modest contrast fails 4.5:1 in both
 * themes). The meter's fill (a redundant, `aria-hidden`, non-text channel) still dims at the
 * shared rung.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { CircleDot, Flag, Play, RefreshCw } from "lucide-react";
import { Badge } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FlowNode, type FlowNodeData } from "@elabs-ai/components-flow";
import type { NodeProps } from "@xyflow/react";
import { useProcessMapHover } from "./process-map-context";
import type { ActivityColor } from "../core/activity-color-scale";
import { activityAccentStyle } from "./activity-accent";
import { activityRole, GHOST_OPACITY, type ProcessMapNode } from "./map-model";
import type { ProcessObjectTypeCount } from "./map-model";
import {
  CONFORMANCE_STATE_ENCODING,
  type ConformanceState,
} from "../conformance-overlay/conformance-state";

/**
 * Local override for the ghost frame: retargets `--border` (what `FlowNode`'s own
 * `border-border` utility resolves through) to the stronger rung, and `--flow-node` (what
 * `bg-flow-node` resolves through) to a quieter fill blended from two OTHER tokens
 * (`--card`, `--surface-muted` — never `--flow-node` itself, which would be a
 * self-referencing custom property and silently fail to apply) — WITHOUT touching
 * `FlowNode`'s source or props. Both values cascade to `FlowNode`'s root div through the
 * plain CSS custom-property lookup at the point each `var()` is used, same as any other
 * theme override in this codebase (`.claude/rules/theming.md` §5). `--card` stands in for
 * `--flow-node`'s own usual value here (the two are near-identical in both reference
 * themes) so the blend reads as "quieter", not as a hue shift.
 */
const GHOST_FRAME_STYLE = {
  "--border": "var(--border-strong)",
  "--flow-node": "color-mix(in oklab, var(--card) 60%, var(--surface-muted) 40%)",
} as CSSProperties;

/**
 * The meter's fill as a mix of the recessed surface and the brand plate.
 *
 * `color-mix` in an inline `style` rather than a Tailwind opacity utility because the
 * fraction is continuous, per node, and only known at render — but both endpoints stay
 * semantic tokens, so a re-brand still reaches it and no raw colour is authored.
 */
function meterFill(saturation: number): string {
  const percent = Math.round(Math.min(1, Math.max(0, saturation)) * 100);
  return `color-mix(in oklab, var(--primary) ${percent}%, var(--surface-muted))`;
}

/**
 * The footer row: the meter alone (today's rendering, byte-identical) or, when the map has
 * a shared `colorScale` (RM-054), the activity's identity swatch in front of the meter.
 *
 * The swatch is a small mark, never the card fill, so identity colour and the metric's
 * saturation ramp never compete for the same pixels. It is `aria-hidden`: the activity's
 * identity already reaches the reader as its printed title and accessible name, so the
 * colour is a redundant cross-view cue (WCAG 1.4.1), not a channel of its own.
 */
function accentFooter(accent: ActivityColor | undefined, isDimmed: boolean, meter: ReactNode) {
  if (!accent) return meter;
  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        data-slot="process-activity-node-accent"
        data-color-token={accent.token}
        data-pattern={accent.pattern}
        className="size-2.5 shrink-0 rounded-sm"
        style={{ ...activityAccentStyle(accent), ...(isDimmed ? { opacity: GHOST_OPACITY } : {}) }}
      />
      <div className="min-w-0 flex-1">{meter}</div>
    </div>
  );
}

/**
 * Object-centric — RM-066. One chip per object type above the footer row: a chart-token
 * square, the type's two-character code and its object count. Never colour alone — the
 * code and count are printed, and each chip is a named image (`role="img"` plus the
 * type's own "order: 2 objects, 3 occurrences" name, also shown as a `title` tooltip).
 */
function objectTypeFooter(
  objectTypes: ProcessObjectTypeCount[] | undefined,
  isDimmed: boolean,
  footer: ReactNode,
) {
  if (!objectTypes || objectTypes.length === 0) return footer;
  return (
    <div className="flex flex-col gap-1.5">
      <div data-slot="process-activity-node-object-types" className="flex flex-wrap gap-1">
        {objectTypes.map((entry) => (
          <span
            key={entry.type}
            role="img"
            data-object-type={entry.type}
            data-color-token={entry.color.token}
            aria-label={entry.ariaLabel}
            title={entry.ariaLabel}
            className="inline-flex items-center gap-1 rounded-sm text-meta tabular-nums text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{
                ...activityAccentStyle(entry.color),
                ...(isDimmed ? { opacity: GHOST_OPACITY } : {}),
              }}
            />
            <span aria-hidden="true" className="font-medium text-foreground">
              {entry.code}
            </span>
            <span aria-hidden="true">{entry.cases}</span>
          </span>
        ))}
      </div>
      {footer}
    </div>
  );
}

/**
 * The card frame under a conformance state (RM-062): the border token is retargeted to the
 * state's tone and the line style is set on `FlowNode`'s own card through a descendant
 * variant — composition from outside, same as {@link GHOST_FRAME_STYLE}, never a fork.
 * Merged AFTER the ghost style, so an excluded node keeps its quieter fill (selection) and
 * still shows the conformance border and dash (conformance): the two layers compose.
 */
const CONFORMANCE_FRAME_CLASS: Record<ConformanceState, string> = {
  both: "[&_[data-slot=flow-node]]:border-solid",
  logOnly: "[&_[data-slot=flow-node]]:border-dotted",
  modelOnly: "[&_[data-slot=flow-node]]:border-dashed",
};

function frameStyle(
  isDimmed: boolean,
  conformance: ConformanceState | undefined,
): CSSProperties | undefined {
  if (!conformance) return isDimmed ? GHOST_FRAME_STYLE : undefined;
  return {
    ...(isDimmed ? GHOST_FRAME_STYLE : {}),
    "--border": CONFORMANCE_STATE_ENCODING[conformance].colorVar,
  } as CSSProperties;
}

/**
 * The conformance glyph pinned to the card's top-start corner. `aria-hidden`: the state's
 * word is already folded into the node's accessible name by `ProcessMap`, so the glyph is
 * the visible, non-colour channel, not a second announcement.
 */
function ConformanceMarker({ state }: { state: ConformanceState }) {
  const encoding = CONFORMANCE_STATE_ENCODING[state];
  const Glyph = encoding.icon;
  return (
    <span
      aria-hidden="true"
      data-slot="process-activity-node-conformance"
      data-conformance={state}
      data-glyph={encoding.glyph}
      data-dash={encoding.dash}
      className="absolute -start-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-flow-node shadow-xs"
    >
      <Glyph className={cn("size-3", encoding.markClass)} />
    </span>
  );
}

/** Start/end glyph pairing, in `FlowNode`'s own tone-glyph idiom. */
function roleIcon(isStart: boolean, isEnd: boolean) {
  if (isStart && isEnd) return CircleDot;
  if (isStart) return Play;
  if (isEnd) return Flag;
  return undefined;
}

/**
 * Branded process-map activity node. Register it in
 * `nodeTypes={{ "process-activity": ProcessActivityNode }}` and build nodes with
 * `buildProcessMapModel` rather than by hand — the model is what keeps the canvas and the
 * `TableView` twin printing the same numbers.
 */
export function ProcessActivityNode(props: NodeProps<ProcessMapNode>) {
  const { data } = props;
  const hover = useProcessMapHover();
  const RoleIcon = roleIcon(data.isStart, data.isEnd);
  const isHovered = hover.activityId === props.id;
  const isDimmed = data.selectionState === "excluded";

  const percent = Math.round(Math.min(1, Math.max(0, data.saturation)) * 100);

  const flowData = useMemo<FlowNodeData>(
    () => ({
      title: data.title,
      kind: data.metricLabel,
      subtitle: data.secondaryLabel
        ? `${data.primaryLabel} · ${data.secondaryLabel}`
        : data.primaryLabel,
      icon: RoleIcon ? <RoleIcon aria-hidden="true" /> : undefined,
      // `tone` is a COLOUR axis in FlowNode. The process map never uses it to carry a
      // metric — the fill would then be the only channel — so it stays default and the
      // role/rework signals are carried by the glyph, the badge and the accessible name.
      tone: "default",
      // The metric's second, colour-free channel: bar LENGTH. `aria-hidden` because the
      // same number is already printed in the subtitle above and repeated in the node's
      // accessible name — a third announcement would be noise, not access. The fill (not
      // the text) is the one thing here that still dims at the shared ghost rung.
      footer: objectTypeFooter(
        data.objectTypes,
        isDimmed,
        accentFooter(
          data.accent,
          isDimmed,
          <div
            aria-hidden="true"
            data-slot="process-activity-node-meter"
            data-percent={percent}
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted transition-opacity duration-fast ease-standard motion-reduce:transition-none"
            style={isDimmed ? { opacity: GHOST_OPACITY } : undefined}
          >
            <div
              className="h-full rounded-full transition-[width] duration-base ease-standard motion-reduce:transition-none"
              style={{ width: `${percent}%`, background: meterFill(data.saturation) }}
            />
          </div>,
        ),
      ),
    }),
    [
      data.title,
      data.metricLabel,
      data.primaryLabel,
      data.secondaryLabel,
      data.saturation,
      data.accent,
      data.objectTypes,
      RoleIcon,
      percent,
      isDimmed,
    ],
  );

  return (
    <div
      data-slot="process-activity-node"
      data-selection={data.selectionState}
      data-role={activityRole(data).toLowerCase()}
      data-hover={isHovered ? "true" : undefined}
      data-conformance={data.conformance}
      // `relative` positions the rework badge — and, because the meter now lives INSIDE
      // the card (`FlowNode`'s `footer` slot), this wrapper is exactly as tall as the
      // card. That equality is load-bearing, not cosmetic: React Flow lays every
      // `<Handle>` out against the nearest positioned ancestor, so any row rendered here
      // as a sibling of the card pushes every connector dot off the card's border by its
      // own height. The meter used to sit here and did exactly that.
      className={cn("relative", isHovered && "z-10")}
    >
      {data.reworkCount ? (
        <Badge
          variant="warning"
          data-slot="process-activity-node-rework"
          className="absolute -end-2 -top-2 z-10 gap-1 px-1.5 py-0 text-meta tabular-nums"
        >
          <RefreshCw aria-hidden="true" className="size-3" />
          <span aria-hidden="true">{data.reworkCount}</span>
          <span className="sr-only">{data.reworkCount} repeated executions</span>
        </Badge>
      ) : null}
      {data.conformance ? <ConformanceMarker state={data.conformance} /> : null}

      <div
        data-slot="process-activity-node-frame"
        className={data.conformance ? CONFORMANCE_FRAME_CLASS[data.conformance] : undefined}
        style={frameStyle(isDimmed, data.conformance)}
      >
        <FlowNode {...props} type="brand" data={flowData} />
      </div>
    </div>
  );
}
