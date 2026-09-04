"use client";
// a2ui.exposed: no

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";

// ---------------------------------------------------------------------------
// Types & context
// ---------------------------------------------------------------------------

export interface WizardStepMeta {
  /** Stable id for the step. */
  id: string;
  /** Title shown in the step indicator. */
  title: string;
  /** Optional supporting text shown under the title. */
  description?: string;
}

/** A step validator — return false (or a rejected/`false` promise) to block advance. */
export type WizardValidator = () => boolean | Promise<boolean>;

interface WizardContextValue {
  baseId: string;
  step: number;
  steps: WizardStepMeta[];
  count: number;
  isFirst: boolean;
  isLast: boolean;
  validating: boolean;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  setActiveValidator: (validator: WizardValidator | undefined) => void;
  orientation: "horizontal" | "vertical";
}

const WizardContext = createContext<WizardContextValue | null>(null);

function useWizard(): WizardContextValue {
  const ctx = use(WizardContext);
  if (!ctx) throw new Error("Wizard subcomponents must be used inside <Wizard>.");
  return ctx;
}

const wizardVariants = cva("flex gap-6", {
  variants: {
    orientation: {
      horizontal: "flex-col",
      vertical: "flex-row",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});

// ---------------------------------------------------------------------------
// Wizard (Provider / root)
// ---------------------------------------------------------------------------

export interface WizardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">, VariantProps<typeof wizardVariants> {
  /** The ordered step metadata used to render the indicator. */
  steps: WizardStepMeta[];
  /** Controlled active step index. */
  step?: number;
  /** Uncontrolled initial step index. Default 0. */
  defaultStep?: number;
  /** Called whenever the active step changes. */
  onStepChange?: (step: number) => void;
  children?: ReactNode;
}

/**
 * Wizard — a multi-step flow with a step indicator, per-step validation gating,
 * and Back/Next/Finish navigation.
 *
 * Controlled via `step`/`onStepChange`; uncontrolled via `defaultStep`. State is
 * lifted into the provider and exposed to `WizardSteps`/`WizardStep`/`WizardNav`
 * via context. `Next` runs the active step's `validate` (sync or async) before
 * advancing and stays enabled until validation runs.
 */
export const Wizard = forwardRef<HTMLDivElement, WizardProps>(function Wizard(
  {
    steps,
    step: stepProp,
    defaultStep = 0,
    onStepChange,
    orientation = "horizontal",
    className,
    children,
    ...props
  },
  ref,
) {
  const baseId = useId();
  const isControlled = stepProp !== undefined;
  const [internalStep, setInternalStep] = useState(defaultStep);
  const [validating, setValidating] = useState(false);
  const activeValidator = useRef<WizardValidator | undefined>(undefined);

  const count = steps.length;
  const step = Math.min(isControlled ? (stepProp ?? 0) : internalStep, Math.max(0, count - 1));

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), Math.max(0, count - 1));
      if (!isControlled) setInternalStep(clamped);
      onStepChange?.(clamped);
    },
    [isControlled, onStepChange, count],
  );

  const goTo = useCallback(
    (index: number) => {
      // Backward / same navigation never requires validation.
      if (index <= step) {
        commit(index);
      }
    },
    [step, commit],
  );

  const next = useCallback(() => {
    const validator = activeValidator.current;
    const advance = () => commit(step + 1);
    if (!validator) {
      advance();
      return;
    }
    const result = validator();
    if (typeof result === "boolean") {
      if (result) advance();
      return;
    }
    setValidating(true);
    result
      .then((ok) => {
        if (ok) advance();
      })
      .finally(() => setValidating(false));
  }, [step, commit]);

  const prev = useCallback(() => commit(step - 1), [step, commit]);

  const setActiveValidator = useCallback((validator: WizardValidator | undefined) => {
    activeValidator.current = validator;
  }, []);

  const ctx = useMemo<WizardContextValue>(
    () => ({
      baseId,
      step,
      steps,
      count,
      isFirst: step === 0,
      isLast: step === count - 1,
      validating,
      goTo,
      next,
      prev,
      setActiveValidator,
      orientation: orientation ?? "horizontal",
    }),
    [baseId, step, steps, count, validating, goTo, next, prev, setActiveValidator, orientation],
  );

  return (
    <WizardContext value={ctx}>
      <div
        ref={ref}
        data-slot="wizard"
        className={cn(wizardVariants({ orientation }), className)}
        {...props}
      >
        {children}
      </div>
    </WizardContext>
  );
});

// ---------------------------------------------------------------------------
// WizardSteps (the indicator)
// ---------------------------------------------------------------------------

export type WizardStepsProps = HTMLAttributes<HTMLOListElement>;

/** WizardSteps — the ordered step indicator. Reads steps from context. */
export const WizardSteps = forwardRef<HTMLOListElement, WizardStepsProps>(function WizardSteps(
  { className, ...props },
  ref,
) {
  const { baseId, step, steps, orientation, goTo } = useWizard();
  return (
    <ol
      ref={ref}
      className={cn(
        "flex gap-2",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap items-center",
        className,
      )}
      {...props}
    >
      {steps.map((meta, index) => {
        const isActive = index === step;
        const isComplete = index < step;
        const isClickable = index <= step;
        return (
          <li
            key={meta.id}
            id={`${baseId}-step-${index}`}
            aria-current={isActive ? "step" : undefined}
            className={cn("flex items-center gap-2", orientation === "horizontal" && "min-w-0")}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => goTo(index)}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                "focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive && "border-primary bg-primary text-primary-foreground",
                // #399 — the step NUMBER is text on a `/10` wash, not plate ink
                // and not a mark: `-text` rung. The border keeps the fill rung.
                isComplete && "border-primary bg-primary/10 text-primary-text",
                !isActive && !isComplete && "border-border-strong text-muted-foreground",
                isClickable ? "cursor-pointer" : "cursor-default",
              )}
            >
              {isComplete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
            </button>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "truncate text-sm font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {meta.title}
              </span>
              {meta.description && (
                <span className="truncate text-xs text-muted-foreground">{meta.description}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
});

// ---------------------------------------------------------------------------
// WizardStep (per-step content + validator)
// ---------------------------------------------------------------------------

export interface WizardStepProps extends HTMLAttributes<HTMLDivElement> {
  /** This step's index (0-based) — must match its position in `steps`. */
  step: number;
  /** Run before advancing past this step. Return false to block. */
  validate?: WizardValidator;
}

/**
 * WizardStep — renders its children only when it is the active step, and
 * registers its `validate` with the wizard while active. Receives focus on
 * activation for keyboard users.
 */
export const WizardStep = forwardRef<HTMLDivElement, WizardStepProps>(function WizardStep(
  { step, validate, className, children, ...props },
  ref,
) {
  const { step: activeStep, baseId, setActiveValidator } = useWizard();
  const isActive = step === activeStep;
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    setActiveValidator(validate);
    // Move focus to the newly-revealed step for keyboard users.
    regionRef.current?.focus();
    return () => setActiveValidator(undefined);
  }, [isActive, validate, setActiveValidator]);

  if (!isActive) return null;

  return (
    <div
      ref={(node) => {
        regionRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      role="group"
      aria-labelledby={`${baseId}-step-${step}`}
      tabIndex={-1}
      className={cn("min-w-0 flex-1 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
});

// ---------------------------------------------------------------------------
// WizardNav (Back / Next / Finish)
// ---------------------------------------------------------------------------

export interface WizardNavProps extends HTMLAttributes<HTMLDivElement> {
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Called when Finish is pressed on the last step. */
  onFinish?: () => void;
}

/** WizardNav — Back / Next (or Finish on the last step) controls. */
export const WizardNav = forwardRef<HTMLDivElement, WizardNavProps>(function WizardNav(
  { backLabel = "Back", nextLabel = "Next", finishLabel = "Finish", onFinish, className, ...props },
  ref,
) {
  const { isFirst, isLast, validating, next, prev } = useWizard();
  return (
    <div ref={ref} className={cn("flex items-center justify-between gap-2", className)} {...props}>
      <Button type="button" variant="outline" onClick={prev} disabled={isFirst}>
        {backLabel}
      </Button>
      {isLast ? (
        <Button type="button" onClick={onFinish}>
          {finishLabel}
        </Button>
      ) : (
        <Button type="button" onClick={next} disabled={validating}>
          {validating ? "Checking…" : nextLabel}
        </Button>
      )}
    </div>
  );
});
