/**
 * messages group — per-chart overrides of the words a chart shows or
 * announces (ADR 0042 §4, RM-174). Applies to every chart kind. The keys are
 * the existing `charts.*` keys of the ui `LocaleProvider` catalogue; this
 * group adds no second English table.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import type { MessageValue } from "@elabs-ai/components-ui";
import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import { looseFieldFor } from "./typed-field";

/** A key of the ui catalogue's chart messages, such as `charts.legend.label`. */
export type ChartMessageKey = `charts.${string}`;

/** Overrides of the catalogue's chart messages, by key. */
export type ChartMessages = { readonly [K in ChartMessageKey]?: MessageValue };

/** The messages members. */
export interface MessagesGroupProps {
  messages?: ChartMessages;
}

export const messagesGroup = /* @__PURE__ */ definePropGroup<MessagesGroupProps>()({
  id: "messages",
  fields: {
    // No group default: an unset key reads the catalogue. The field
    // vocabulary has no record kind, so the description accepts any object;
    // the key and value types are checked in code only.
    messages: looseFieldFor<ChartMessages>()(
      field.object({
        fields: {},
        open: true,
        tier: "advanced",
        description: "Replacement words for this chart, keyed by their charts.* message keys.",
      }),
    ),
  },
});
