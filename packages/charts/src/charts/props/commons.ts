/**
 * commons — the existing chart mixins, registered by reference (ADR 0042 §4,
 * RM-174). Each mixin stays where it is declared; nothing here redeclares a
 * member. A commons entry splits its mixin in two, so a definition can list
 * it the way it lists a prop group:
 *
 * - `group`: a prop group over the mixin's serializable members, typed
 *   `Omit<Mixin, code-only keys>`. A definition adds it to `groups`.
 * - `codeOnly`: the mixin's callbacks, by name. A definition spreads them
 *   into its own `codeOnly`.
 *
 * The groups carry no defaults. Each mixin's defaults are applied today by
 * the one shared module that reads it (the navigator, the gesture layer,
 * the datapoint layer, the analytics transforms); a group default would be a
 * second copy of each.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else
 * by `import type`.
 */

import { definePropGroup, field } from "@elabs-ai/components-ui/definition";

import type { ChartAnalyticsProps } from "../analytics/types";
import type { ChartInteractionProps } from "../chart-datapoint";
import type { ChartSelectionProps } from "../chart-selection";
import type { ChartCategoryNavigatorProps, ChartNavigatorProps } from "../navigator/types";
import type { ChartSelectionGestureProps } from "../selection/types";
import { looseFieldFor, partialFieldFor } from "./typed-field";

// ── ChartInteractionProps ────────────────────────────────────────────────────

type InteractionCodeOnly = "onDatapointClick" | "datapointLabel";

/** `ChartInteractionProps`: drill-down on a datapoint, by pointer and keyboard. */
export const interactionCommons = {
  group: /* @__PURE__ */ definePropGroup<Omit<ChartInteractionProps, InteractionCodeOnly>>()({
    id: "interaction",
    fields: {
      copyValueOnActivate: field.boolean({
        tier: "advanced",
        description: "Copy a datapoint’s exact value to the clipboard when it is activated.",
      }),
      maxInteractiveDatapoints: field.number({
        tier: "advanced",
        description: "Number of keyboard targets above which a development warning is logged.",
      }),
    },
  }),
  codeOnly: [
    "onDatapointClick",
    "datapointLabel",
  ] as const satisfies readonly InteractionCodeOnly[],
};

// ── ChartSelectionProps ──────────────────────────────────────────────────────

type SelectionCodeOnly = "selectionStates";

/** `ChartSelectionProps`: selection states painted on the marks. */
export const selectionCommons = {
  group: /* @__PURE__ */ definePropGroup<Omit<ChartSelectionProps, SelectionCodeOnly>>()({
    id: "selection",
    fields: {
      dimExcluded: field.boolean({
        tier: "advanced",
        description: "Dim the marks a selection excludes.",
      }),
    },
  }),
  codeOnly: ["selectionStates"] as const satisfies readonly SelectionCodeOnly[],
};

// ── ChartCategoryNavigatorProps / ChartNavigatorProps ────────────────────────

type NavigatorCodeOnly = "onWindowChange";

/**
 * An index window over rows: `start` inclusive, `end` exclusive. A time window
 * holds `Date` values, which JSON cannot carry, so it stays code-only.
 */
const indexWindowFields = {
  kind: /* @__PURE__ */ field.enum({ values: ["index"], required: true }),
  start: /* @__PURE__ */ field.number({ required: true }),
  end: /* @__PURE__ */ field.number({ required: true }),
};

/** `ChartCategoryNavigatorProps`: the navigator strip and zoom of a category family. */
export const categoryNavigatorCommons = {
  group: /* @__PURE__ */ definePropGroup<Omit<ChartCategoryNavigatorProps, NavigatorCodeOnly>>()({
    id: "category-navigator",
    fields: {
      scrollbar: field.enum({
        values: ["miniChart", "bar", "auto", "none"],
        tier: "essential",
        description:
          "Navigator strip under the plot: an overview, a plain scrollbar, auto or none.",
      }),
      window: partialFieldFor<ChartNavigatorProps["window"]>()(
        field.object({
          fields: indexWindowFields,
          nullable: true,
          tier: "advanced",
          description: "Controlled window: the rows the plot shows.",
        }),
      ),
      defaultWindow: partialFieldFor<ChartNavigatorProps["defaultWindow"]>()(
        field.object({
          fields: indexWindowFields,
          tier: "advanced",
          description: "Initial window when the window is not controlled.",
        }),
      ),
      minSpan: field.number({
        tier: "advanced",
        description:
          "Smallest window a user can make: a row count, or milliseconds on a time axis.",
      }),
      align: field.enum({
        values: ["start", "end"],
        tier: "advanced",
        description: "Where an automatic first window sits: at the first rows or the latest.",
      }),
      maxVisibleItems: field.responsive({
        of: field.union({ of: [field.number(), field.enum({ values: ["auto"] })] }),
        breakpoints: ["medium", "narrow"],
        tier: "advanced",
        description: "How many categories the plot shows at once, or auto to keep them readable.",
      }),
      windowDomain: field.enum({
        values: ["all", "visible"],
        tier: "advanced",
        description: "Value axis over all the data, or refitted to the visible window.",
      }),
      zoom: field.boolean({
        tier: "advanced",
        description: "Zoom and pan along x with pinch, Ctrl + wheel and the zoom keys.",
      }),
    },
  }),
  codeOnly: ["onWindowChange"] as const satisfies readonly NavigatorCodeOnly[],
};

/** `ChartNavigatorProps`: the navigator strip and zoom of a time-series family. */
export const navigatorCommons = {
  group: /* @__PURE__ */ definePropGroup<Omit<ChartNavigatorProps, NavigatorCodeOnly>>()({
    id: "navigator",
    fields: {
      ...categoryNavigatorCommons.group.fields,
      maxVisiblePoints: field.number({
        tier: "advanced",
        description: "With scrollbar auto: the row count above which the strip appears.",
      }),
    },
  }),
  codeOnly: categoryNavigatorCommons.codeOnly,
};

// ── ChartSelectionGestureProps ───────────────────────────────────────────────

type SelectionGestureCodeOnly = "onSelectionIntent";

/** `ChartSelectionGestureProps`: range, rectangle, lasso and radial selection. */
export const selectionGestureCommons = {
  group: /* @__PURE__ */ definePropGroup<
    Omit<ChartSelectionGestureProps, SelectionGestureCodeOnly>
  >()({
    id: "selection-gesture",
    fields: {
      selectionGestures: field.array({
        of: field.enum({ values: ["range", "rect", "lasso", "radial"] }),
        tier: "advanced",
        description: "Selection gestures to enable.",
      }),
      selectionConfirm: field.enum({
        values: ["immediate", "explicit"],
        tier: "advanced",
        description: "Emit each gesture at once, or collect them until the user confirms.",
      }),
      selectionField: field.string({
        tier: "advanced",
        description: "Field name carried in each selection intent.",
      }),
      selectionHitRule: field.enum({
        values: ["overlap", "contain"],
        tier: "advanced",
        description: "Whether a mark must overlap or lie inside a rectangle or lasso to be hit.",
      }),
      selectionToolbar: field.enum({
        values: ["auto", "none"],
        tier: "advanced",
        description: "Show the selection toolbar while gestures are enabled.",
      }),
    },
  }),
  codeOnly: ["onSelectionIntent"] as const satisfies readonly SelectionGestureCodeOnly[],
};

// ── ChartAnalyticsProps ──────────────────────────────────────────────────────

/**
 * `ChartAnalyticsProps`: statistical overlays computed from the data. It has
 * no callback of its own. An analytic may hold functions (a reducer `value`,
 * a `when` condition), and each kind has its own members, so the description
 * checks each entry's `kind` and `id` and leaves the rest to code.
 */
export const analyticsCommons = {
  group: /* @__PURE__ */ definePropGroup<ChartAnalyticsProps>()({
    id: "analytics",
    fields: {
      analytics: looseFieldFor<ChartAnalyticsProps["analytics"]>()(
        field.array({
          of: field.object({
            fields: {
              kind: field.enum({
                values: ["line", "band", "trend", "window", "forecast", "errorBars"],
                required: true,
              }),
              id: field.string(),
            },
            open: true,
          }),
          tier: "advanced",
          description:
            "Statistical overlays computed from the data: lines, bands, trends and more.",
        }),
      ),
    },
  }),
  codeOnly: [] as const satisfies readonly never[],
};
