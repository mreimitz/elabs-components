// registry: a2ui-form-01 — copied 2026-09-19
"use client";

/**
 * A2UI — a form the agent built, a draft the app owns.
 *
 * The incident agent pre-fills a form from the alert and asks a human to correct it. Every
 * control reports its change as a named action with its value; the host folds those into ONE
 * draft object — shown on the right, live — and only `open-incident` submits it. The agent never
 * sees a DOM event and never holds the state.
 *
 * Copy-own it: `npx shadcn add a2ui-form-01`.
 */
import type { A2uiActionHandler, A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useCallback, useState } from "react";
import { JsonPane } from "../a2ui-parts/json-pane";
import { SurfaceStage } from "../a2ui-parts/surface-stage";
import { INCIDENT_INTAKE, INCIDENT_OPENED } from "../a2ui-parts/surfaces";

/** What the alert already knew — the form's defaults, mirrored so the draft starts complete. */
const INITIAL_DRAFT = {
  title: "Checkout returns 502 for card payments in EU",
  severity: "sev1",
  service: "payments",
  affected: "eu",
  failureShare: 38,
  pageOnCall: true,
  statusPage: false,
};

type Draft = typeof INITIAL_DRAFT;

/** Action name → the draft field it writes. The agent picked the names; the host owns the map. */
const FIELD_OF: Record<string, keyof Draft> = {
  "set-title": "title",
  "set-severity": "severity",
  "set-service": "service",
  "set-affected": "affected",
  "set-failure-share": "failureShare",
  "set-page-oncall": "pageOnCall",
  "set-status-page": "statusPage",
};

export function A2uiForm({ className }: { className?: string }) {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [surface, setSurface] = useState<A2uiSurfaceSpec>(INCIDENT_INTAKE);
  const [submitted, setSubmitted] = useState(false);

  const onAction = useCallback<A2uiActionHandler>((action, context) => {
    const field = FIELD_OF[action.name];
    if (field) {
      const value = Array.isArray(context.value) ? context.value[0] : context.value;
      setDraft((current) => ({ ...current, [field]: value }));
      return;
    }
    if (action.name === "open-incident") {
      setSubmitted(true);
      setSurface(INCIDENT_OPENED);
    }
    if (action.name === "discard-incident") {
      setDraft(INITIAL_DRAFT);
      setSubmitted(false);
      setSurface({ ...INCIDENT_INTAKE });
    }
  }, []);

  return (
    <div className={cn("@container w-full", className)} data-slot="a2ui-form">
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SurfaceStage label="Incident agent · alert #88213" onAction={onAction} spec={surface} />
        <Card className="min-w-0 self-start overflow-hidden">
          <CardHeader>
            <CardTitle>{submitted ? "What was submitted" : "The draft the app holds"}</CardTitle>
            <CardDescription>
              Each control sends a named action with its value. Change a field and watch it land.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 p-0">
            <JsonPane label="Incident draft" text={JSON.stringify(draft, null, 2)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
