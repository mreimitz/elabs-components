// registry: a2ui-decision-01 — copied 2026-09-19
"use client";

/**
 * A2UI — the agent asks for a decision, the app keeps the authority.
 *
 * The support agent has read the ticket, the order and the policy, and DESIGNS the screen it
 * needs: the facts, the one policy exception, a note field and three ways out. Each button only
 * NAMES an action; this component — the host — decides what "approve-refund" does and answers
 * with the agent's next surface. Nothing in the surface can run code.
 *
 * Copy-own it: `npx shadcn add a2ui-decision-01`.
 */
import type { A2uiActionHandler, A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useCallback, useState } from "react";
import { ActionLog, useActionLog } from "../a2ui-parts/action-log";
import { SurfaceStage } from "../a2ui-parts/surface-stage";
import {
  REFUND_APPROVAL,
  REFUND_APPROVED,
  REFUND_CREDIT,
  REFUND_DECLINED,
} from "../a2ui-parts/surfaces";

/** The host's verbs. An action that is not listed here does nothing — that is the point. */
const NEXT_SURFACE: Record<string, A2uiSurfaceSpec> = {
  "approve-refund": REFUND_APPROVED,
  "decline-refund": REFUND_DECLINED,
  "offer-credit": REFUND_CREDIT,
  "undo-decision": REFUND_APPROVAL,
};

export function A2uiDecision({ className }: { className?: string }) {
  const [surface, setSurface] = useState<A2uiSurfaceSpec>(REFUND_APPROVAL);
  const log = useActionLog();

  const onAction = useCallback<A2uiActionHandler>(
    (action, context) => {
      log.record(action, context);
      const next = NEXT_SURFACE[action.name];
      if (next) setSurface(next);
    },
    [log],
  );

  return (
    <div className={cn("@container w-full", className)} data-slot="a2ui-decision">
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SurfaceStage label="Support agent · refund R-2207" onAction={onAction} spec={surface} />
        <Card className="min-w-0 self-start">
          <CardHeader>
            <CardTitle>What the app received</CardTitle>
            <CardDescription>
              A button names an action; the host decides what it means. Type a note, then decide.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 p-0">
            <ActionLog entries={log.entries} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
