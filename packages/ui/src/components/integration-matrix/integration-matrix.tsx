"use client";

/**
 * IntegrationMatrix — every agent-facing integration unit, as installable rows.
 *
 * Ships no site copy, no URL and no install command of its own (`i18n-strings`,
 * `remote-origins`): every string, host and command text is a prop. A single host
 * selector at the top swaps every row's copy action at once, so a visitor picks
 * their tool once instead of re-reading each row for it.
 */
import { forwardRef, useId, type HTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Button } from "../button";
import { CommandChip, DEFAULT_COMMAND_CHIP_LABELS } from "../command-chip";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

/** One host the visitor can pick — the selection swaps every row's copy action. */
export interface IntegrationMatrixHost {
  /** Stable id, matched against each action's `value` map. */
  id: string;
  /** Shown in the selector. */
  label: string;
}

/** One action a row offers: copy a command, or follow a link. */
export interface IntegrationMatrixAction {
  /** Shown on the link button, or as the copy button's accessible name suffix. */
  label: string;
  kind: "copy" | "link";
  /**
   * `kind: "copy"` — the exact text per host id (a row that never changes by host
   * repeats the same string under every id). `kind: "link"` — a single href string; an http(s)
   * href opens in a new tab.
   */
  value: string | Record<string, string>;
}

/** One installable unit — hosted MCP, local MCP + CLI, the plugin, `llms.txt`, … */
export interface IntegrationMatrixRow {
  id: string;
  unit: string;
  gives: string;
  actions: IntegrationMatrixAction[];
}

/** One step of the routine line below the matrix (`info → search → docs → …`). */
export interface IntegrationMatrixRoutineStep {
  verb: string;
  /** Tooltip body — what the verb does. */
  does: string;
}

export interface IntegrationMatrixLabels {
  /** Visible label beside the host selector. */
  hostSelectLabel: string;
  /** `aria-label` of the host `Select` trigger. */
  hostSelectAriaLabel: string;
  unitHeading: string;
  givesHeading: string;
  actionsHeading: string;
  /** Heading above the routine chips. */
  routineHeading: string;
}

export const DEFAULT_INTEGRATION_MATRIX_LABELS: IntegrationMatrixLabels = {
  hostSelectLabel: "Show commands for",
  hostSelectAriaLabel: "Host to show commands for",
  unitHeading: "Unit",
  givesHeading: "Gives you",
  actionsHeading: "Actions",
  routineHeading: "The daily routine",
};

export interface IntegrationMatrixProps extends HTMLAttributes<HTMLDivElement> {
  hosts: IntegrationMatrixHost[];
  rows: IntegrationMatrixRow[];
  /** The routine strip below the matrix; omitted entirely when empty. */
  routine?: IntegrationMatrixRoutineStep[];
  /** Selected host id (controlled). */
  value?: string;
  /** Initially selected host id (uncontrolled). Default: the first host. */
  defaultValue?: string;
  /** Fires when the visitor picks another host. */
  onValueChange?: (id: string) => void;
  /** Fires after a copy attempt with the row id, the action label and the text. */
  onCopyAction?: (rowId: string, actionLabel: string, text: string, copied: boolean) => void;
  labels?: Partial<IntegrationMatrixLabels>;
}

function resolveCopyValue(value: string | Record<string, string>, hostId: string): string {
  if (typeof value === "string") return value;
  return value[hostId] ?? Object.values(value)[0] ?? "";
}

export const IntegrationMatrix = forwardRef<HTMLDivElement, IntegrationMatrixProps>(
  function IntegrationMatrix(
    {
      hosts,
      rows,
      routine,
      value,
      defaultValue,
      onValueChange,
      onCopyAction,
      labels: labelsProp,
      className,
      ...props
    },
    ref,
  ) {
    const labels = { ...DEFAULT_INTEGRATION_MATRIX_LABELS, ...labelsProp };
    const routineStepIdPrefix = useId();
    const [hostId, setHostId] = useControllableState(
      value,
      defaultValue ?? hosts[0]?.id ?? "",
      onValueChange,
    );

    return (
      <div
        ref={ref}
        data-slot="integration-matrix"
        className={cn("flex flex-col gap-6", className)}
        {...props}
      >
        {hosts.length > 1 ? (
          <div className="flex items-center gap-3">
            <span className="text-body text-muted-foreground">{labels.hostSelectLabel}</span>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger
                data-slot="integration-matrix-host"
                aria-label={labels.hostSelectAriaLabel}
                className="min-w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hosts.map((host) => (
                  <SelectItem key={host.id} value={host.id}>
                    {host.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* md+: a 3-column grid with a header row. Below md: stacked cards, one per row. */}
        <div className="flex flex-col gap-4 md:gap-0">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] gap-4 border-b border-border-strong pb-2 md:grid">
            <span className="text-caption font-semibold text-muted-foreground">
              {labels.unitHeading}
            </span>
            <span className="text-caption font-semibold text-muted-foreground">
              {labels.givesHeading}
            </span>
            <span className="text-caption font-semibold text-muted-foreground">
              {labels.actionsHeading}
            </span>
          </div>
          {/* role="list"/"listitem" plus each cell's own sr-only column label give
              assistive tech a row/column association the header row's grid alone
              doesn't carry (the header is hidden below md, where rows become cards). */}
          <div
            role="list"
            data-slot="integration-matrix-rows"
            className="flex flex-col gap-4 md:gap-0"
          >
            {rows.map((row) => (
              <div
                key={row.id}
                role="listitem"
                data-slot="integration-matrix-row"
                className="grid grid-cols-1 gap-3 border-b border-border-strong py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] md:items-center md:gap-4"
              >
                <span className="text-body font-medium text-foreground">
                  <span className="sr-only">{labels.unitHeading}: </span>
                  {row.unit}
                </span>
                <span className="text-body text-muted-foreground">
                  <span className="sr-only">{labels.givesHeading}: </span>
                  {row.gives}
                </span>
                <div
                  data-slot="integration-matrix-actions"
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="sr-only">{labels.actionsHeading}: </span>
                  {row.actions.map((action) =>
                    action.kind === "copy" ? (
                      <CommandChip
                        key={action.label}
                        className="max-w-full"
                        hosts={[
                          {
                            id: "value",
                            label: action.label,
                            command: resolveCopyValue(action.value, hostId),
                          },
                        ]}
                        labels={{ copy: `${DEFAULT_COMMAND_CHIP_LABELS.copy}: ${action.label}` }}
                        onCopyCommand={(text, copied) =>
                          onCopyAction?.(row.id, action.label, text, copied)
                        }
                      />
                    ) : (
                      <Button key={action.label} variant="link" size="sm" asChild>
                        <a
                          href={resolveCopyValue(action.value, hostId)}
                          {...(/^https?:\/\//.test(resolveCopyValue(action.value, hostId))
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          {action.label}
                        </a>
                      </Button>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {routine && routine.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-caption font-semibold text-muted-foreground">
              {labels.routineHeading}
            </h3>
            <div
              data-slot="integration-matrix-routine"
              className="flex flex-wrap items-center gap-2"
            >
              {routine.map((step, index) => {
                // Each step's own verb labels its popover (aria-labelledby, not a
                // duplicated aria-label) — distinct per step, one id per instance.
                const stepId = `${routineStepIdPrefix}-routine-${index}`;
                return (
                  <div key={step.verb} className="flex items-center gap-2">
                    {/* A real button + Popover (not a Tooltip on a bare span) so the
                        explanation opens on tap too, not only on hover/focus. */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          id={stepId}
                          type="button"
                          data-slot="integration-matrix-routine-step"
                          translate="no"
                          className="inline-flex items-center rounded-md border border-input bg-card px-2.5 py-1 font-mono text-code text-foreground focus-ring"
                        >
                          {step.verb}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        aria-labelledby={stepId}
                        className="w-auto max-w-xs text-body"
                      >
                        {step.does}
                      </PopoverContent>
                    </Popover>
                    {index < routine.length - 1 ? (
                      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);
