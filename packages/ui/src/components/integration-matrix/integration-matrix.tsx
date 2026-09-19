"use client";

/**
 * IntegrationMatrix — every agent-facing integration unit, as installable rows.
 *
 * Ships no site copy, no URL and no install command of its own (`i18n-strings`,
 * `remote-origins`): every string, host and command text is a prop. A single host
 * selector at the top swaps every row's copy action at once, so a visitor picks
 * their tool once instead of re-reading each row for it.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { Button } from "../button";
import { CommandChip } from "../command-chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

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
   * repeats the same string under every id). `kind: "link"` — a single href string.
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
          {rows.map((row) => (
            <div
              key={row.id}
              data-slot="integration-matrix-row"
              className="grid grid-cols-1 gap-3 border-b py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] md:items-center md:gap-4"
            >
              <span className="text-body font-medium text-foreground">{row.unit}</span>
              <span className="text-body text-muted-foreground">{row.gives}</span>
              <div
                data-slot="integration-matrix-actions"
                className="flex flex-wrap items-center gap-2"
              >
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
                      onCopyCommand={(text, copied) =>
                        onCopyAction?.(row.id, action.label, text, copied)
                      }
                    />
                  ) : (
                    <Button key={action.label} variant="link" size="sm" asChild>
                      <a href={resolveCopyValue(action.value, hostId)}>{action.label}</a>
                    </Button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        {routine && routine.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-caption font-semibold text-muted-foreground">
              {labels.routineHeading}
            </h3>
            <TooltipProvider>
              <div
                data-slot="integration-matrix-routine"
                className="flex flex-wrap items-center gap-2"
              >
                {routine.map((step, index) => (
                  <div key={step.verb} className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          data-slot="integration-matrix-routine-step"
                          tabIndex={0}
                          className="inline-flex items-center rounded-md border border-input bg-card px-2.5 py-1 font-mono text-code text-foreground focus-ring"
                        >
                          {step.verb}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{step.does}</TooltipContent>
                    </Tooltip>
                    {index < routine.length - 1 ? (
                      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    ) : null}
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>
        ) : null}
      </div>
    );
  },
);
