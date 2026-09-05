"use client";

/**
 * AbstractionControls — the two sliders every process-mining explorer opens with (RM-052,
 * issue #227). Activities/paths abstraction is a VIEW filter, never a re-analysis
 * (`abstractGraph`'s own contract — see `core/abstract-graph.ts`): dragging a slider hides
 * nodes/edges, it never recomputes a statistic.
 *
 * Composed entirely from `@elabs-ai/components-ui` primitives — two `Slider`s, a `Switch`,
 * a `Button` — plus the pure, framework-free `computeAutoAbstraction` heuristic. No local
 * slider/switch/select is authored here (`pnpm process:reuse:check`).
 *
 * ## Controlled, not stateful
 *
 * This component owns no abstraction state of its own — `abstraction` is the current value,
 * `onAbstractionChange` is how it asks for a new one. `useProcessExplorer` is the one place
 * that actually holds the `useState` (see the compound-component "lift state into the
 * provider" convention, `.claude/rules/component-api.md`).
 *
 * ## "Auto" reads the graph, not just the sliders
 *
 * The pre-abstraction activity total is derived, not passed as a separate prop:
 * `graph.activities.length + hiddenCounts.activities` — the CURRENT (already-abstracted)
 * graph's kept count plus what it currently hides always sums back to the full graph's
 * activity count, so "Auto" needs no additional field on `useProcessExplorer`.
 */
import { forwardRef, useCallback, useId, type HTMLAttributes } from "react";
import { Sparkles } from "lucide-react";
import { Button, Label, Slider, Switch, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { AbstractionOptions } from "../core/abstract-graph";
import type { ProcessGraph } from "../core/types";
import { computeAutoAbstraction } from "./auto-abstraction";

const TICKS = [25, 50, 75, 100] as const;

function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

function fromPercent(percent: number): number {
  return percent / 100;
}

export interface AbstractionControlsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The current abstraction — both fractions, `invert`, and (read-only here) `keepConnected`. */
  abstraction: AbstractionOptions;
  /** Called with a PARTIAL patch — mirrors `useProcessExplorer`'s own `setAbstraction`. */
  onAbstractionChange(next: Partial<AbstractionOptions>): void;
  /** The CURRENT (already-abstracted) graph — only `activities.length` is read. */
  graph: Pick<ProcessGraph, "activities">;
  /** What the current abstraction hides, straight from `AbstractedGraph.hidden`. */
  hiddenCounts: { activities: number; paths: number };
  /** Node budget the "Auto" button searches for. Default `25`. */
  autoMaxActivities?: number;
  /** Accessible name for the control group. Default from locale. */
  label?: string;
}

/** One clickable percentage tick — sets its slider directly rather than requiring a drag. */
function Tick({
  percent,
  active,
  onSelect,
}: {
  percent: number;
  active: boolean;
  onSelect(percent: number): void;
}) {
  return (
    <button
      type="button"
      data-slot="abstraction-controls-tick"
      aria-pressed={active}
      onClick={() => onSelect(percent)}
      className={cn(
        "focus-ring rounded-sm text-meta text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground",
        active && "font-semibold text-foreground",
      )}
    >
      {percent}%
    </button>
  );
}

export const AbstractionControls = forwardRef<HTMLDivElement, AbstractionControlsProps>(
  function AbstractionControls(
    {
      abstraction,
      onAbstractionChange,
      graph,
      hiddenCounts,
      autoMaxActivities = 25,
      label,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const activitiesId = useId();
    const pathsId = useId();

    const activitiesPercent = toPercent(abstraction.activities);
    const pathsPercent = toPercent(abstraction.paths);

    const setActivitiesPercent = useCallback(
      (percent: number) => onAbstractionChange({ activities: fromPercent(percent) }),
      [onAbstractionChange],
    );
    const setPathsPercent = useCallback(
      (percent: number) => onAbstractionChange({ paths: fromPercent(percent) }),
      [onAbstractionChange],
    );

    const handleAuto = useCallback(() => {
      const totalActivities = graph.activities.length + hiddenCounts.activities;
      const result = computeAutoAbstraction(totalActivities, {
        maxActivities: autoMaxActivities,
      });
      onAbstractionChange({ activities: result.activities });
    }, [graph.activities.length, hiddenCounts.activities, autoMaxActivities, onAbstractionChange]);

    // Two independently-pluralized fragments, joined — `t()` selects its plural category
    // from a single `count` var, so one activities count and one paths count cannot share
    // a single PluralMessage. Composing two already-localized fragments is the standard
    // way around that (see `resolveMessage` in locale-provider.tsx).
    const hiddenSummary = `${t("process.abstractionControls.hiddenActivities", {
      count: hiddenCounts.activities,
    })} · ${t("process.abstractionControls.hiddenPaths", { count: hiddenCounts.paths })}`;

    return (
      <div
        ref={ref}
        data-slot="abstraction-controls"
        role="group"
        aria-label={label ?? t("process.abstractionControls.label")}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        <div data-slot="abstraction-controls-activities" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={activitiesId} className="text-body">
              {t("process.abstractionControls.activities")}
            </Label>
            <span className="text-meta text-muted-foreground tabular-nums">
              {activitiesPercent}%
            </span>
          </div>
          <Slider
            id={activitiesId}
            min={0}
            max={100}
            step={1}
            value={[activitiesPercent]}
            onValueChange={([next]) => setActivitiesPercent(next ?? activitiesPercent)}
            aria-label={t("process.abstractionControls.activities")}
          />
          <div className="flex items-center justify-between px-0.5">
            {TICKS.map((percent) => (
              <Tick
                key={percent}
                percent={percent}
                active={activitiesPercent === percent}
                onSelect={setActivitiesPercent}
              />
            ))}
          </div>
        </div>

        <div data-slot="abstraction-controls-paths" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={pathsId} className="text-body">
              {t("process.abstractionControls.paths")}
            </Label>
            <span className="text-meta text-muted-foreground tabular-nums">{pathsPercent}%</span>
          </div>
          <Slider
            id={pathsId}
            min={0}
            max={100}
            step={1}
            value={[pathsPercent]}
            onValueChange={([next]) => setPathsPercent(next ?? pathsPercent)}
            aria-label={t("process.abstractionControls.paths")}
          />
          <div className="flex items-center justify-between px-0.5">
            {TICKS.map((percent) => (
              <Tick
                key={percent}
                percent={percent}
                active={pathsPercent === percent}
                onSelect={setPathsPercent}
              />
            ))}
          </div>
        </div>

        <div
          data-slot="abstraction-controls-footer"
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <Switch
              id={`${activitiesId}-invert`}
              checked={abstraction.invert ?? false}
              onCheckedChange={(checked) => onAbstractionChange({ invert: checked })}
            />
            <Label htmlFor={`${activitiesId}-invert`} className="text-body">
              {t("process.abstractionControls.invert")}
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAuto}
            data-slot="abstraction-controls-auto"
          >
            <Sparkles aria-hidden="true" />
            {t("process.abstractionControls.auto")}
          </Button>
        </div>

        <p
          data-slot="abstraction-controls-hidden-summary"
          role="status"
          aria-live="polite"
          className="text-meta text-muted-foreground"
        >
          {hiddenSummary}
        </p>
      </div>
    );
  },
);
