/**
 * The float plane (RM-094): three decorative duplicates — the tool call, one KPI, a
 * flow-node-styled card (a ui `Card`, never `@elabs-ai/components-flow`: the hero ships no
 * canvas engine) — offset ≤ 24 px outside the frame on `ParallaxPlane plane="float"` (rate 1.2),
 * so scrolling shows depth. Hidden below 1024 px; `inert` + `aria-hidden` because the scene
 * already carries the real versions.
 */
import { Card, ParallaxPlane, StatusBadge } from "@elabs-ai/components-ui";
import { MetricCard } from "@elabs-ai/components-charts";
import { heroCopy } from "../../content/copy";
import { HERO_SEED, formatKpi } from "./hero-stream";

const scene = heroCopy.scene;
const KPI = HERO_SEED.kpis[1];

export function HeroFloat() {
  return (
    <div aria-hidden="true" inert className="pointer-events-none absolute inset-0 hidden lg:block">
      <ParallaxPlane plane="float" className="absolute -end-6 top-24 w-60">
        <Card className="gap-2 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-code">{scene.toolTitle}</span>
            <StatusBadge status="complete" />
          </div>
          <span className="text-meta text-muted-foreground">{scene.toolResult}</span>
        </Card>
      </ParallaxPlane>
      <ParallaxPlane plane="float" className="absolute -start-6 bottom-24 w-52">
        <MetricCard
          className="shadow-lg"
          label={scene.kpis.success.label}
          value={formatKpi(KPI, KPI.value)}
          delta={KPI.delta}
          deltaDirection={KPI.direction}
        />
      </ParallaxPlane>
      <ParallaxPlane plane="float" className="absolute -end-4 -bottom-6 w-48">
        <Card className="gap-1 border-s-4 border-s-primary p-3 shadow-lg">
          <span className="text-body font-medium">{scene.flowNode.title}</span>
          <span className="text-meta text-muted-foreground">{scene.flowNode.meta}</span>
        </Card>
      </ParallaxPlane>
    </div>
  );
}
