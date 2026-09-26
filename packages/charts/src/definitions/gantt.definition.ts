/**
 * Gantt definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring of
 * `Gantt` (`gantt/gantt.tsx`). `rowHeight` has no kind default: renamed to `rowHeightProp`
 * and resolved with `??` against a density-derived table inside the component, never a
 * literal destructuring default.
 *
 * Only the plainly scalar props are modeled as fields. `columns`, `scales`, `markers`,
 * `timeRanges`, `taskTypes`, `sort`, `zoomBounds`, `progressLine`, `renderBar`,
 * `formatDate`, `highlightTime` and every `on*` callback are each a rich, nested config
 * or a function with no simple, honest field-vocabulary shape — left to code, per ADR
 * 0042's codeOnly escape hatch. No `accessibleLabel`/`accessibleDescription` exist on this
 * family, so no `a11yGroup`.
 *
 * `GanttProps` extends `Omit<HTMLAttributes<HTMLDivElement>, "onSelect">`, spread onto the
 * root `<div>` via `...props` — the raw DOM attribute grab-bag is real but not a
 * documented, schema-worthy surface, so the definition's props type omits it (keeping
 * `className`, `children` and Gantt's own `onSelect`) rather than declaring a codeOnly
 * entry for each key. No behaviour change.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import type { HTMLAttributes } from "react";

import { field } from "@elabs-ai/components-ui/definition";

import type { GanttProps } from "../gantt/gantt";
import { looseFieldFor } from "../charts/props/typed-field";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

type GanttDefinitionProps = Omit<
  GanttProps,
  Exclude<keyof HTMLAttributes<HTMLDivElement>, "onSelect">
> &
  Pick<GanttProps, "className" | "children">;

export const GANTT = /* @__PURE__ */ defineChart<GanttDefinitionProps>()({
  id: "Gantt",
  version: 1,
  label: "Gantt chart",
  description: "Scheduled tasks against a timeline, with dependencies and progress.",
  specTypes: [],
  groups: [],
  fields: {
    tasks: looseFieldFor<GanttProps["tasks"]>()(
      field.array({
        of: field.object({
          fields: {
            id: field.string({ required: true }),
            progress: field.number(),
            parentId: field.string(),
            isMilestone: field.boolean(),
            dependencies: field.array({ of: field.string() }),
            type: field.string(),
          },
          open: true,
        }),
        required: true,
        tier: "essential",
        description: "One row per task.",
      }),
    ),
    density: field.enum({
      values: ["comfortable", "compact"],
      nullable: true,
      tier: "essential",
      description: "Row density.",
    }),
    rowHeight: field.number({ unit: "px", tier: "advanced", description: "Row height override." }),
    defaultViewMode: field.union({
      of: [
        field.enum({
          values: ["millisecond", "second", "minute", "hour", "day", "week", "month", "quarter"],
        }),
        field.enum({ values: ["auto"] }),
      ],
      tier: "essential",
      description: "Initial tick granularity. auto derives the finest readable unit.",
    }),
    viewModes: field.array({
      of: field.enum({
        values: ["millisecond", "second", "minute", "hour", "day", "week", "month", "quarter"],
      }),
      tier: "advanced",
      description: "Units offered by the toolbar's segmented control.",
    }),
    pointerDrag: field.boolean({
      tier: "advanced",
      description: "Enable pointer drag for move/resize/link-create.",
    }),
    labelPosition: field.enum({
      values: ["inside", "start", "end", "hidden"],
      tier: "advanced",
      description: "Bar-label placement.",
    }),
    showCriticalPath: field.boolean({
      tier: "advanced",
      description: "Mark the critical path.",
    }),
    rollups: field.boolean({
      tier: "advanced",
      description: "Roll child milestones and bars up onto a collapsed summary row.",
    }),
    locale: field.string({ tier: "advanced", description: "BCP-47 locale for date formatting." }),
    defaultPixelsPerDay: field.number({
      tier: "advanced",
      description: "Initial pixels-per-day for uncontrolled zoom.",
    }),
    labelColumnWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Left pane width. Ignored when columns is set.",
    }),
    loading: field.boolean({
      tier: "essential",
      description: "A shimmer loading state instead of the task tree and canvas.",
    }),
    className: classNameField,
  },
  codeOnly: [
    "viewMode",
    "onViewModeChange",
    "selectedId",
    "defaultSelectedId",
    "onSelect",
    "expandedIds",
    "defaultExpandedIds",
    "onExpandedChange",
    "onTaskMove",
    "onTaskResize",
    "onDependencyCreate",
    "columns",
    "scales",
    "highlightTime",
    "markers",
    "timeRanges",
    "progressLine",
    "renderBar",
    "taskTypes",
    "formatDate",
    "pixelsPerDay",
    "onPixelsPerDayChange",
    "zoomBounds",
    "sort",
    "onSortChange",
    "onColumnResize",
    "children",
  ],
  defaults: {
    density: "comfortable",
    labelColumnWidth: 240,
    loading: false,
  },
  targets: [],
  contract: {
    dataProp: "tasks",
    dataKind: "array",
    requiredProps: ["tasks"],
    itemRequiredKeys: ["id", "name", "start", "end"],
    dateItemKeys: ["start", "end"],
  },
});
