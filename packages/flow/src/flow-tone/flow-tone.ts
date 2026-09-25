import { cva, type VariantProps } from "class-variance-authority";
import { STATUS_TONES, type StatusTone } from "@elabs-ai/components-ui";
import { warnFlowOnce } from "../lib/warn-once";

/**
 * A flow surface's status tone — `@elabs-ai/components-ui`'s closed `StatusTone`, the
 * same five values `StatusBadge` and `StatusIcon` speak, so a node and a badge beside it
 * never disagree about what "warning" looks like.
 */
export type FlowTone = StatusTone;

/** Every `FlowTone`, in `StatusTone` order. */
export const FLOW_TONES: readonly FlowTone[] = STATUS_TONES;

/**
 * Flow-only emphasis, a separate axis from the status tone. `"featured"` is the "look
 * here" card — the entry point of a pipeline, the step a story is about. It says
 * nothing about status, so it composes with any tone, and it always carries a star
 * glyph as its non-colour channel (WCAG 1.4.1).
 */
export type FlowEmphasis = "default" | "featured";

/** Every `FlowEmphasis`. */
export const FLOW_EMPHASES: readonly FlowEmphasis[] = ["default", "featured"];

/**
 * Tone values flow used before it adopted `StatusTone`. Still accepted, with a one-time
 * warning, until 6.0.0: `"default"` means `tone: "neutral"`, and `"accent"` means
 * `emphasis: "featured"`.
 *
 * @deprecated Use a `FlowTone`, plus `emphasis: "featured"` for the old `"accent"`.
 * Removed in 6.0.0.
 */
export type FlowLegacyTone = "default" | "accent";

/** What a `tone` field accepts: a `FlowTone`, or (until 6.0.0) a legacy value. */
export type FlowToneInput = FlowTone | FlowLegacyTone;

/** A tone and an emphasis after legacy values have been mapped. */
export interface ResolvedFlowTone {
  tone: FlowTone;
  emphasis: FlowEmphasis;
}

const isFlowTone = (value: unknown): value is FlowTone =>
  (FLOW_TONES as readonly unknown[]).includes(value);

/**
 * Map a node's `tone`/`emphasis` fields onto the two axes `flowToneVariants` takes.
 *
 * - `"default"` becomes `"neutral"`, and `"accent"` becomes `emphasis: "featured"`
 *   on a neutral tone. Each legacy value warns once (dev only) and keeps working
 *   until 6.0.0.
 * - An unknown value (untyped data from a file or a server) falls back to
 *   `"neutral"` rather than painting nothing.
 */
export function resolveFlowTone(tone?: FlowToneInput, emphasis?: FlowEmphasis): ResolvedFlowTone {
  if (tone === "accent") {
    warnFlowOnce(
      "tone:accent",
      '`tone: "accent"` is deprecated and is removed in 6.0.0. Use `emphasis: "featured"`: ' +
        "it keeps the star glyph, and the status tone stays neutral.",
    );
    return { tone: "neutral", emphasis: "featured" };
  }
  if (tone === "default") {
    warnFlowOnce(
      "tone:default",
      '`tone: "default"` is deprecated and is removed in 6.0.0. Use `tone: "neutral"`, ' +
        "or leave `tone` unset.",
    );
  }
  return {
    tone: isFlowTone(tone) ? tone : "neutral",
    emphasis: emphasis === "featured" ? "featured" : "default",
  };
}

/**
 * The one tone system for every flow surface — `FlowNode`, `FlowGroupNode` and any
 * custom node. Two independent axes: `tone` (the status, `StatusTone`) and `emphasis`
 * (flow's own "featured" look).
 *
 * Apply it to a node's frame (`FlowNodeCard` does). It paints the frame's border, which
 * is a MARK and so takes the fill rung, and it reaches the tone PARTS inside the frame
 * through `data-flow-tone-part`, so every part picks the right contrast rung without
 * a tone map of its own:
 *
 * - `data-flow-tone-part="mark"` — a glyph or an icon slot: the fill rung (`text-<tone>`,
 *   ≥3:1).
 * - `data-flow-tone-part="ink"` — running text, or a glyph drawn as ink: the text rung
 *   (`text-<tone>-text`, ≥4.5:1).
 * - `data-flow-tone-part="emphasis"` — the featured star: `text-primary`.
 *
 * A neutral tone adds nothing, so each part keeps its own resting colour. A featured
 * card on a neutral tone takes the primary border and primary ink; on any other tone the
 * status keeps the border and the star alone says "featured".
 *
 * Colour is never the only channel: pair a non-neutral tone or a featured emphasis with
 * `FlowToneIndicator`, which draws the glyph and says its name to assistive technology.
 */
export const flowToneVariants = cva("", {
  variants: {
    tone: {
      neutral: "",
      info: "border-info **:data-[flow-tone-part=mark]:text-info **:data-[flow-tone-part=ink]:text-info-text",
      success:
        "border-success **:data-[flow-tone-part=mark]:text-success **:data-[flow-tone-part=ink]:text-success-text",
      warning:
        "border-warning **:data-[flow-tone-part=mark]:text-warning **:data-[flow-tone-part=ink]:text-warning-text",
      destructive:
        "border-destructive **:data-[flow-tone-part=mark]:text-destructive **:data-[flow-tone-part=ink]:text-destructive-text",
    },
    emphasis: {
      default: "",
      featured: "**:data-[flow-tone-part=emphasis]:text-primary",
    },
  },
  compoundVariants: [
    {
      tone: "neutral",
      emphasis: "featured",
      class:
        "border-primary **:data-[flow-tone-part=mark]:text-primary-text **:data-[flow-tone-part=ink]:text-primary-text",
    },
  ],
  defaultVariants: { tone: "neutral", emphasis: "default" },
});

export type FlowToneVariantProps = VariantProps<typeof flowToneVariants>;
