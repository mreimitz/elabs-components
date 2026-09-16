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
import { ChevronRight, Link2, Link2Off } from "lucide-react";
import { Button, Label, Slider, Switch, useLocale } from "@elabs-ai/components-ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { AbstractionOptions } from "../core/abstract-graph";
import type { ProcessGraph } from "../core/types";
import { computeAutoAbstraction } from "./auto-abstraction";

const TICKS = [25, 50, 75, 100] as const;

/**
 * The range every tick's percent value is drawn from — the SAME `min`/`max` handed to both
 * `Slider`s below (`min={SLIDER_MIN} max={SLIDER_MAX}`), so a tick's rail offset is always
 * derived from the slider's own range rather than a second, independently hardcoded `0..100`
 * (#355). Today they coincide numerically (percent === offset), but a future non-percent range
 * stays correct because both read this one pair of constants.
 */
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;

/** A tick's position along the rail, as a `0..100` offset — see {@link SLIDER_MIN}. */
function tickOffsetPercent(percent: number): number {
  return ((percent - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
}

/**
 * How far above the "Auto" activities fraction the paths fraction is set — the roadmap's
 * "paths % = 0.2 above the activities %" (RM-052 round 2, #227, F2 third piece). `abstractGraph`
 * only considers an edge a candidate to keep once BOTH its endpoints survive the activities
 * cut (`core/abstract-graph.ts`'s `candidateEdges` filter), so that candidate pool is already
 * thinner than the full edge set once activities are cut — applying the SAME fraction to it
 * would keep noticeably fewer edges than activities were kept. The offset compensates for
 * that, without a second search over the real graph.
 */
const AUTO_PATHS_OFFSET = 0.2;

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
  /**
   * Object-centric — RM-066. One slider pair per object type, keyed by type, rendered as
   * collapsible rows under the global pair. A `linked` type (the default) follows the
   * global sliders proportionally; toggle its link to abstract it on its own. Feed the
   * result to `abstractObjectCentricGraph`.
   */
  perType?: Readonly<Record<string, ObjectTypeAbstraction>>;
  /** Object-centric — RM-066. Called with the whole next per-type record. */
  onPerTypeChange?(next: Record<string, ObjectTypeAbstraction>): void;
  /** Object-centric — RM-066. Strings for the per-type rows. */
  perTypeLabels?: ObjectTypeAbstractionLabels;
}

/** Object-centric — RM-066. One object type's abstraction fractions. */
export interface ObjectTypeAbstraction {
  /** Fraction of this type's activities to keep, `0..1`. */
  activities: number;
  /** Fraction of this type's paths to keep, `0..1`. */
  paths: number;
  /** Follow the global sliders proportionally. @default true */
  linked?: boolean;
}

/** Object-centric — RM-066. Strings for the per-type rows. */
export interface ObjectTypeAbstractionLabels {
  section: string;
  link: (type: string) => string;
  activities: (type: string) => string;
  paths: (type: string) => string;
}

/** English defaults for {@link ObjectTypeAbstractionLabels}. */
export const OBJECT_TYPE_ABSTRACTION_DEFAULT_LABELS: Readonly<ObjectTypeAbstractionLabels> =
  Object.freeze({
    section: "Per object type",
    link: (type: string) => `Link ${type} to the global sliders`,
    activities: (type: string) => `${type} activities`,
    paths: (type: string) => `${type} paths`,
  });

/**
 * Scale every linked type by the global pair's own change: a type at 60% whose global
 * slider moves from 100% to 50% lands at 30%. From a global of 0 there is no ratio, so
 * linked types take the new global value as-is.
 */
function scalePerType(
  perType: Readonly<Record<string, ObjectTypeAbstraction>>,
  current: Pick<AbstractionOptions, "activities" | "paths">,
  patch: Partial<Pick<AbstractionOptions, "activities" | "paths">>,
): Record<string, ObjectTypeAbstraction> {
  const next: Record<string, ObjectTypeAbstraction> = {};
  for (const [type, entry] of Object.entries(perType)) {
    if (entry.linked === false) {
      next[type] = entry;
      continue;
    }
    const scaled = { ...entry };
    for (const axis of ["activities", "paths"] as const) {
      const target = patch[axis];
      if (target === undefined) continue;
      const from = current[axis];
      scaled[axis] = Math.min(1, Math.max(0, from > 0 ? (entry[axis] * target) / from : target));
    }
    next[type] = scaled;
  }
  return next;
}

/** Object-centric — RM-066. One type's collapsible row: a link toggle and two sliders. */
function ObjectTypeSliders({
  type,
  entry,
  labels,
  onChange,
}: {
  type: string;
  entry: ObjectTypeAbstraction;
  labels: ObjectTypeAbstractionLabels;
  onChange(next: ObjectTypeAbstraction): void;
}) {
  const baseId = useId();
  const linked = entry.linked !== false;
  const activitiesPercent = toPercent(entry.activities);
  const pathsPercent = toPercent(entry.paths);
  return (
    <Collapsible
      data-slot="abstraction-controls-object-type"
      data-object-type={type}
      data-linked={linked ? "true" : "false"}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="group min-w-0 justify-start">
            <ChevronRight
              aria-hidden="true"
              className="transition-transform duration-fast ease-standard group-data-[state=open]:rotate-90 motion-reduce:transition-none"
            />
            <span className="truncate">{type}</span>
            <span className="text-meta text-muted-foreground tabular-nums">
              {activitiesPercent}% · {pathsPercent}%
            </span>
          </Button>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-pressed={linked}
          aria-label={labels.link(type)}
          data-slot="abstraction-controls-object-type-link"
          onClick={() => onChange({ ...entry, linked: !linked })}
        >
          {linked ? <Link2 aria-hidden="true" /> : <Link2Off aria-hidden="true" />}
        </Button>
      </div>
      <CollapsibleContent className="flex flex-col gap-3 ps-6">
        <Slider
          id={`${baseId}-activities`}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          value={[activitiesPercent]}
          onValueChange={([next]) =>
            onChange({ ...entry, activities: fromPercent(next ?? activitiesPercent) })
          }
          aria-label={labels.activities(type)}
        />
        <Slider
          id={`${baseId}-paths`}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          value={[pathsPercent]}
          onValueChange={([next]) =>
            onChange({ ...entry, paths: fromPercent(next ?? pathsPercent) })
          }
          aria-label={labels.paths(type)}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * One clickable percentage tick — sets its slider directly rather than requiring a drag.
 * Positioned on a `relative` rail (never spread by flexbox, #355): its centre sits at its own
 * value's fraction of the rail, matching the `Slider` track's coordinate system directly below
 * it. The interior ticks centre on their value (`-translate-x-1/2`); the `100%` tick right-aligns
 * to the rail's own edge instead (`-translate-x-full`) so it is never clipped.
 */
function Tick({
  percent,
  active,
  onSelect,
}: {
  percent: number;
  active: boolean;
  onSelect(percent: number): void;
}) {
  const offsetPercent = tickOffsetPercent(percent);
  return (
    <button
      type="button"
      data-slot="abstraction-controls-tick"
      aria-pressed={active}
      onClick={() => onSelect(percent)}
      style={{ left: `${offsetPercent}%` }}
      className={cn(
        "focus-ring absolute top-0 rounded-sm text-meta text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground",
        offsetPercent <= 0
          ? "translate-x-0"
          : offsetPercent >= 100
            ? "-translate-x-full"
            : "-translate-x-1/2",
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
      perType,
      onPerTypeChange,
      perTypeLabels = OBJECT_TYPE_ABSTRACTION_DEFAULT_LABELS,
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

    // Object-centric — RM-066: a global change carries every linked type along with it.
    const syncPerType = useCallback(
      (patch: Partial<Pick<AbstractionOptions, "activities" | "paths">>) => {
        if (perType && onPerTypeChange) {
          onPerTypeChange(scalePerType(perType, abstraction, patch));
        }
      },
      [perType, onPerTypeChange, abstraction],
    );

    const setActivitiesPercent = useCallback(
      (percent: number) => {
        onAbstractionChange({ activities: fromPercent(percent) });
        syncPerType({ activities: fromPercent(percent) });
      },
      [onAbstractionChange, syncPerType],
    );
    const setPathsPercent = useCallback(
      (percent: number) => {
        onAbstractionChange({ paths: fromPercent(percent) });
        syncPerType({ paths: fromPercent(percent) });
      },
      [onAbstractionChange, syncPerType],
    );

    const handleAuto = useCallback(() => {
      const totalActivities = graph.activities.length + hiddenCounts.activities;
      const result = computeAutoAbstraction(totalActivities, {
        maxActivities: autoMaxActivities,
      });
      onAbstractionChange({
        activities: result.activities,
        paths: Math.min(1, result.activities + AUTO_PATHS_OFFSET),
      });
      syncPerType({
        activities: result.activities,
        paths: Math.min(1, result.activities + AUTO_PATHS_OFFSET),
      });
    }, [
      graph.activities.length,
      hiddenCounts.activities,
      autoMaxActivities,
      onAbstractionChange,
      syncPerType,
    ]);

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
        <div
          data-slot="abstraction-controls-activities"
          role="group"
          aria-labelledby={`${activitiesId}-label`}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Label id={`${activitiesId}-label`} htmlFor={activitiesId} className="text-body">
              {t("process.abstractionControls.activities")}
            </Label>
            <span className="text-meta text-muted-foreground tabular-nums">
              {activitiesPercent}%
            </span>
          </div>
          <Slider
            id={activitiesId}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={[activitiesPercent]}
            onValueChange={([next]) => setActivitiesPercent(next ?? activitiesPercent)}
            aria-label={t("process.abstractionControls.activities")}
          />
          <div className="relative h-4">
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

        <div
          data-slot="abstraction-controls-paths"
          role="group"
          aria-labelledby={`${pathsId}-label`}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Label id={`${pathsId}-label`} htmlFor={pathsId} className="text-body">
              {t("process.abstractionControls.paths")}
            </Label>
            <span className="text-meta text-muted-foreground tabular-nums">{pathsPercent}%</span>
          </div>
          <Slider
            id={pathsId}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={[pathsPercent]}
            onValueChange={([next]) => setPathsPercent(next ?? pathsPercent)}
            aria-label={t("process.abstractionControls.paths")}
          />
          <div className="relative h-4">
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

        {/* Object-centric — RM-066 */}
        {perType ? (
          <div
            data-slot="abstraction-controls-per-type"
            role="group"
            aria-label={perTypeLabels.section}
            className="flex flex-col gap-1"
          >
            {Object.entries(perType).map(([type, entry]) => (
              <ObjectTypeSliders
                key={type}
                type={type}
                entry={entry}
                labels={perTypeLabels}
                onChange={(next) => onPerTypeChange?.({ ...perType, [type]: next })}
              />
            ))}
          </div>
        ) : null}

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
