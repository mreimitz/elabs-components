/**
 * motion group — the entry animation of a chart kind that animates (ADR 0042
 * §4, RM-174). Only kinds that declare they animate list it; Ring animates
 * with `enterTransition` and the stagger, not the duration.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import type { Transition } from "motion/react";

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import { DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING } from "../animation";
import { partialFieldFor } from "./typed-field";

/** The motion members, as the animating chart families declare them today. */
export interface MotionGroupProps {
  animationDuration?: number;
  animationEasing?: string;
  enterTransition?: Transition;
  enterStaggerScale?: number;
  revealSignature?: string;
}

export const motionGroup = /* @__PURE__ */ definePropGroup<MotionGroupProps>()({
  id: "motion",
  fields: {
    // Every animating family defaults to this, except Choropleth, which keeps
    // its own kind default: `animationDuration = DEFAULT_CHOROPLETH_ANIMATION_DURATION_MS`
    // (800, `choropleth/choropleth-chart.tsx:1201`).
    animationDuration: field.number({
      default: DEFAULT_ANIMATION_DURATION_MS,
      unit: "ms",
      tier: "advanced",
      description: "Length of the entry animation, in milliseconds.",
    }),
    animationEasing: field.string({
      default: DEFAULT_ANIMATION_EASING,
      tier: "advanced",
      description: "CSS easing function of the entry animation.",
    }),
    // No group default: only Scatter sets one,
    // `enterTransition = DEFAULT_CHART_ENTER_TRANSITION` (`scatter-chart.tsx:368`);
    // every other family leaves it unset and derives its transition from
    // `animationDuration`. Easing curves given as numbers and functions stay code-only.
    enterTransition: partialFieldFor<Transition>()(
      field.object({
        fields: {
          type: field.enum({ values: ["tween", "spring", "keyframes", "decay", "inertia"] }),
          duration: field.number({ unit: "s" }),
          delay: field.number({ unit: "s" }),
          ease: field.enum({
            values: [
              "linear",
              "easeIn",
              "easeOut",
              "easeInOut",
              "circIn",
              "circOut",
              "circInOut",
              "backIn",
              "backOut",
              "backInOut",
              "anticipate",
            ],
          }),
        },
        tier: "advanced",
        description: "Transition of the entry animation, in place of the duration and easing.",
      }),
    ),
    enterStaggerScale: field.number({
      default: 1,
      tier: "advanced",
      description: "Multiplier on the delay between marks as they enter.",
    }),
    revealSignature: field.string({
      default: "",
      tier: "advanced",
      description: "Changing this value replays the entry animation.",
    }),
  },
});
