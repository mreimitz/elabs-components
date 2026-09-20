"use client";

/**
 * A2UI — what the catalog refuses, and how the agent repairs it.
 *
 * A surface is data checked against a catalog, so an agent (or a prompt injection riding on it)
 * cannot restyle the app, embed a frame, attach a script or invent an event. The first tab is a
 * surface that tries all of that; `A2uiSurface` renders NONE of it and lists every problem with
 * its path — the same list `brand-ui a2ui validate` prints, which is what the agent reads to
 * produce the second tab.
 *
 * Copy-own it: `npx shadcn add a2ui-guardrail-01`.
 */
import { A2uiSurface, validateA2uiSurface } from "@elabs-ai/components-ai";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { SHOWCASE_CATALOG_SCHEMA, showcaseCatalog } from "@/components/a2ui-parts/catalog";
import { JsonPane } from "@/components/a2ui-parts/json-pane";
import { GUARDRAIL_INVALID, GUARDRAIL_REPAIRED } from "@/components/a2ui-parts/surfaces";

const ATTEMPTS = [
  {
    value: "refused",
    label: "First attempt",
    icon: ShieldAlert,
    spec: GUARDRAIL_INVALID,
    caption:
      "Custom colours, an iframe, an inline script, a made-up event and a string where a number belongs.",
  },
  {
    value: "repaired",
    label: "After repair",
    icon: ShieldCheck,
    spec: GUARDRAIL_REPAIRED,
    caption:
      "The agent read the error list and kept to the catalog. Same offer, the app's own look.",
  },
] as const;

export function A2uiGuardrail({ className }: { className?: string }) {
  return (
    <div className={cn("@container w-full", className)} data-slot="a2ui-guardrail">
      <Tabs defaultValue="refused">
        <TabsList>
          {ATTEMPTS.map(({ value, label, icon: Icon, spec }) => {
            const problems = validateA2uiSurface(spec, SHOWCASE_CATALOG_SCHEMA).errors.length;
            return (
              <TabsTrigger key={value} value={value}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
                <Badge variant={problems > 0 ? "destructive" : "success"}>
                  {problems > 0 ? `${problems} refused` : "valid"}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {ATTEMPTS.map(({ value, spec, caption }) => (
          <TabsContent className="flex flex-col gap-3" key={value} value={value}>
            <p className="text-body-sm text-muted-foreground">{caption}</p>
            <div className="grid gap-4 @3xl:grid-cols-2">
              <div className="h-96 min-w-0 overflow-hidden rounded-lg border border-border">
                <JsonPane label="What the agent sent" text={JSON.stringify(spec, null, 2)} />
              </div>
              <A2uiSurface catalog={showcaseCatalog} className="min-w-0" surface={spec} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
