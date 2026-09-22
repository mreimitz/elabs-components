"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "@elabs-ai/components-ui";

import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import { useVariable } from "../dashboard-sheet/use-variable";

/** Content of a `variable` tile: one author-defined variable, bound to `useVariable`. */
export interface VariableTileContent {
  name: string;
  control: "select" | "slider" | "date";
  options?: Array<string | number>;
  min?: number;
  max?: number;
  step?: number;
}

function VariableTile({ tile, interactions }: DashboardTileProps<VariableTileContent>) {
  const { name, control, options, min = 0, max = 100, step = 1 } = tile.content;
  const [value, setValue] = useVariable(name);
  const disabled = !interactions.select;
  const controlId = useId();
  const controlLabel = tile.title ?? name;

  return (
    <div data-slot="variable-tile" className="flex size-full min-h-0 flex-col justify-center gap-1">
      <label htmlFor={controlId} className="text-caption text-muted-foreground">
        {controlLabel}
      </label>
      {control === "select" ? (
        <Select
          value={value !== undefined ? String(value) : undefined}
          onValueChange={(next) => setValue(next)}
          disabled={disabled}
        >
          <SelectTrigger id={controlId} className="w-full" aria-label={controlLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(options ?? []).map((option) => (
              <SelectItem key={String(option)} value={String(option)}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : control === "slider" ? (
        <Slider
          id={controlId}
          aria-label={controlLabel}
          value={[typeof value === "number" ? value : min]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(next) => setValue(next[0] ?? min)}
        />
      ) : (
        <DatePicker
          value={typeof value === "string" && value.length > 0 ? new Date(value) : undefined}
          onValueChange={(date) => setValue(date ? date.toISOString().slice(0, 10) : "")}
        />
      )}
    </div>
  );
}

/** `variable` — one author-defined variable control (`ui/Select`, `ui/Slider`, `ui/DatePicker`). */
export function createVariableTileKind(kind = "variable"): DashboardTileKind<VariableTileContent> {
  return {
    kind,
    label: "Variable", // i18n-exempt: asset-panel label
    icon: SlidersHorizontal,
    description: "An input readers can change.", // i18n-exempt: asset-panel description
    component: VariableTile,
    defaultSize: { w: 4, h: 1 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: false },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "name", label: "Variable name", required: true },
        {
          type: "enum",
          name: "control",
          label: "Control",
          options: ["select", "slider", "date"],
          default: "select",
        },
        {
          type: "list",
          name: "options",
          label: "Options",
          visibleWhen: { field: "control", equals: "select" },
        },
        {
          type: "number",
          name: "min",
          label: "Min",
          visibleWhen: { field: "control", equals: "slider" },
        },
        {
          type: "number",
          name: "max",
          label: "Max",
          visibleWhen: { field: "control", equals: "slider" },
        },
      ],
    },
    defaultContent: { name: "region", control: "select", options: [] },
  };
}

/** `createVariableTileKind()` — the `variable` kind. */
export const variableTileKind = createVariableTileKind();
