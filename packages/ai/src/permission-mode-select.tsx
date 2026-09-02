"use client";

import { forwardRef, useId, type ComponentProps } from "react";
import { Badge, Kbd, Label, RadioGroup, RadioGroupItem, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * PermissionModeSelect — the standing-permission-policy chooser (#104).
 *
 * Distinct from `Confirmation`/`ApprovalCard` (#103): those render ONE
 * per-call decision ("may I run this command?"). This renders the POLICY
 * that governs how many of those per-call decisions ever occur ("how much
 * may you do without asking?"). The two stay separate components with a
 * documented relationship rather than one growing a boolean "policy mode"
 * prop — see `.claude/rules/component-api.md` ("Avoid boolean-prop
 * proliferation").
 *
 * The mode vocabulary is entirely app-defined: no agent's mode names are
 * hardcoded in this file or in `PermissionMode`/`PermissionModeSelectProps`.
 * `consequence` is a REQUIRED field — a mode whose effect is unstated is
 * exactly the failure this component exists to prevent (three unlabelled
 * radio buttons).
 *
 * Built on `@elabs-ai/components-ui`'s `RadioGroup` (Radix) for roving
 * focus / arrow-key navigation / Space-Enter selection / announcement — this
 * component does not hand-roll any of that. The in-force mode is marked in
 * TEXT: a "Current" badge lives inside the `<Label>` associated with that
 * mode's radio input, so it is part of the control's accessible name and
 * recoverable in greyscale — never colour alone (WCAG 1.4.1).
 */
export interface PermissionMode {
  id: string;
  label: string;
  /** What this mode actually permits — required, not optional. */
  consequence: string;
  keyHint?: string;
}

export interface PermissionModeSelectProps extends ComponentProps<"div"> {
  modes: PermissionMode[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** The mode currently in force, marked distinctly from the highlighted one. */
  currentId?: string;
}

export const PermissionModeSelect = forwardRef<HTMLDivElement, PermissionModeSelectProps>(
  function PermissionModeSelect(
    { modes, value, defaultValue, onValueChange, currentId, className, dir, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const baseId = useId();

    return (
      <RadioGroup
        ref={ref}
        // `dir` on a plain <div> is a free-form HTML string; Radix's RadioGroup
        // narrows it to "ltr" | "rtl". Cast at this single call site rather
        // than widening (and so weakening) the public prop type.
        dir={dir as "ltr" | "rtl" | undefined}
        // The RadioGroup's own highlighted value is independent of `currentId`
        // (the mode already in force) — they answer different questions, so
        // neither prop ever derives the other except as an uncontrolled
        // starting point: with nothing else specified, pre-select the mode
        // that is currently in force.
        defaultValue={defaultValue ?? currentId}
        value={value}
        onValueChange={onValueChange}
        data-slot="permission-mode-select"
        className={cn("grid gap-3", className)}
        {...props}
      >
        {modes.map((mode) => {
          const isCurrent = mode.id === currentId;
          const itemId = `${baseId}-${mode.id}`;
          // The consequence sentence is the whole point of this component (see
          // the `consequence` prop doc above), so it has to reach assistive
          // tech as a DESCRIPTION of the radio — not merely sit next to it in
          // the DOM. Without this link a screen-reader user arrowing through
          // the modes hears "Unrestricted" and never hears what unrestricted
          // costs them. Same wiring as `ApprovalCardOptions` in
          // `confirmation.tsx`, deliberately: one convention, not two.
          const consequenceId = `${itemId}-consequence`;

          return (
            <div
              key={mode.id}
              data-slot="permission-mode-select-option"
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border bg-card p-4",
                "has-[[data-state=checked]]:border-primary",
              )}
            >
              <RadioGroupItem
                aria-describedby={consequenceId}
                className="mt-1"
                data-slot="permission-mode-select-input"
                id={itemId}
                value={mode.id}
              />
              <div className="grid flex-1 gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    className="text-body flex items-center gap-2 font-medium"
                    data-slot="permission-mode-select-label"
                    htmlFor={itemId}
                  >
                    {mode.label}
                    {isCurrent ? (
                      <Badge data-slot="permission-mode-select-current" variant="secondary">
                        {t("ai.permissionModeSelect.current")}
                      </Badge>
                    ) : null}
                  </Label>
                  {mode.keyHint ? (
                    <Kbd data-slot="permission-mode-select-key-hint">{mode.keyHint}</Kbd>
                  ) : null}
                </div>
                <p
                  className="text-meta text-muted-foreground"
                  data-slot="permission-mode-select-consequence"
                  id={consequenceId}
                >
                  {mode.consequence}
                </p>
              </div>
            </div>
          );
        })}
      </RadioGroup>
    );
  },
);

PermissionModeSelect.displayName = "PermissionModeSelect";
