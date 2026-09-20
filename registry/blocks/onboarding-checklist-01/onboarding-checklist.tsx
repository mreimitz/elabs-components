"use client";

import { useState } from "react";
import { Check, ChevronRight, PartyPopper } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Meter,
} from "@elabs-ai/components-ui";

export interface OnboardingStep {
  id: string;
  title: string;
  detail: string;
  /** Roughly how long it takes — sets expectations before the click. */
  minutes: number;
  action: string;
  done?: boolean;
}

export interface OnboardingChecklistProps {
  steps?: OnboardingStep[];
  onAction?: (step: OnboardingStep) => void;
  onDismiss?: () => void;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "workspace",
    title: "Create your workspace",
    detail: "Done when you signed up.",
    minutes: 1,
    action: "Open",
    done: true,
  },
  {
    id: "import",
    title: "Import last week's orders",
    detail: "A CSV or a connection to your ERP. We plan them so you can compare.",
    minutes: 10,
    action: "Import orders",
  },
  {
    id: "depot",
    title: "Add your depot and cut-off times",
    detail: "Where routes start and the latest an order can land.",
    minutes: 5,
    action: "Add depot",
  },
  {
    id: "drivers",
    title: "Invite two drivers",
    detail: "They get a link to the app. Nothing to install on your side.",
    minutes: 3,
    action: "Invite drivers",
  },
  {
    id: "plan",
    title: "Plan tomorrow",
    detail: "Run the planner and send the routes to the app.",
    minutes: 5,
    action: "Plan routes",
  },
];

/**
 * Getting started — a checklist that opens on the next thing to do, says how long each step
 * takes, counts the minutes that are left, and ends instead of lingering.
 */
export function OnboardingChecklist({
  steps = DEFAULT_STEPS,
  onAction,
  onDismiss,
}: OnboardingChecklistProps) {
  const [done, setDone] = useState(() => steps.filter((step) => step.done).map((step) => step.id));
  const next = steps.find((step) => !done.includes(step.id));
  const [open, setOpen] = useState(next?.id ?? null);
  const left = steps
    .filter((step) => !done.includes(step.id))
    .reduce((sum, step) => sum + step.minutes, 0);

  if (!next) {
    return (
      <Card className="mx-auto w-full max-w-xl" data-slot="onboarding-checklist">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <PartyPopper aria-hidden="true" className="size-10 text-primary" />
          <h2 className="text-subtitle font-semibold">You are set up</h2>
          <p className="text-body text-muted-foreground">
            Tomorrow's routes are with your drivers. This list will not come back.
          </p>
          <Button onClick={onDismiss} variant="outline">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl" data-slot="onboarding-checklist">
      <CardHeader className="gap-3">
        <CardTitle>Get to your first planned route</CardTitle>
        <div className="flex flex-col gap-1.5">
          <Meter
            aria-label={`${done.length} of ${steps.length} steps done`}
            max={steps.length}
            size="sm"
            value={done.length}
          />
          <p className="text-meta text-muted-foreground tabular-nums">
            {done.length} of {steps.length} done · about {left} minutes left
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y divide-border">
          {steps.map((step) => {
            const isDone = done.includes(step.id);
            const isOpen = open === step.id && !isDone;
            return (
              <li className="py-3" key={step.id}>
                <button
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 rounded-md text-start focus-ring disabled:cursor-default"
                  disabled={isDone}
                  onClick={() => setOpen(isOpen ? null : step.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong",
                    )}
                  >
                    {isDone ? <Check className="size-3.5" /> : null}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-body font-medium",
                      isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {step.title}
                    {isDone ? <span className="sr-only"> (done)</span> : null}
                  </span>
                  {isDone ? null : (
                    <>
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {step.minutes} min
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-fast",
                          isOpen && "rotate-90",
                        )}
                      />
                    </>
                  )}
                </button>
                {isOpen ? (
                  <div className="flex flex-col items-start gap-3 ps-9 pt-2">
                    <p className="text-body text-muted-foreground">{step.detail}</p>
                    <Button
                      onClick={() => {
                        onAction?.(step);
                        const nowDone = [...done, step.id];
                        setDone(nowDone);
                        setOpen(steps.find((s) => !nowDone.includes(s.id))?.id ?? null);
                      }}
                      size="sm"
                    >
                      {step.action}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
