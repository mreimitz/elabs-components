/**
 * The float plane (RM-094): three decorative duplicates — the tool call, one KPI, a
 * flow-node-styled card (a ui `Card`, never `@elabs-ai/components-flow`: the hero ships no
 * canvas engine) — offset ≤ 24 px outside the frame on `ParallaxPlane plane="float"` (rate 1.2),
 * so scrolling shows depth. Hidden below 1024 px; `inert` + `aria-hidden` because the scene
 * already carries the real versions. Each card duplicates a fixture fact the scene reads (the
 * conversation's tool call, the churn KPI, the pipeline's active step — see hero-stream.ts).
 *
 * Placement keeps every card off scene content (measured 0 px² against the KPI cards, the
 * DataTable cells and the chat panel at 1024/1280/1440): the tool card straddles the top edge
 * over the header band's empty middle, the KPI and flow-node cards straddle the start edge
 * over the nav rail below its four items (rail 11rem; content starts 1rem past it).
 */
import { Card, ParallaxPlane, StatusBadge } from "@elabs-ai/components-ui";
import { MetricCard } from "@elabs-ai/components-charts";
import { HERO_SEED, formatKpi } from "./hero-stream";

const { chat, pipeline } = HERO_SEED;
const KPI = HERO_SEED.churnKpi;

export function HeroFloat() {
  return (
    <div aria-hidden="true" inert className="pointer-events-none absolute inset-0 hidden lg:block">
      <ParallaxPlane plane="float" className="absolute start-72 -top-6 w-52">
        <Card className="gap-2 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-code">{chat.tool.name}</span>
            <StatusBadge status="complete" />
          </div>
          <span className="text-meta text-muted-foreground">{chat.tool.result}</span>
        </Card>
      </ParallaxPlane>
      <ParallaxPlane plane="float" className="absolute -start-6 top-60 w-48">
        <MetricCard
          className="shadow-lg"
          label={KPI.label}
          value={formatKpi(KPI, KPI.value)}
          delta={KPI.delta}
          deltaDirection={KPI.direction}
          positiveIsGood={KPI.positiveIsGood}
        />
      </ParallaxPlane>
      <ParallaxPlane plane="float" className="absolute -start-4 -bottom-6 w-44">
        <Card className="flex flex-col gap-1 border-s-4 border-s-primary p-3 shadow-lg">
          <span className="text-body font-medium">{pipeline.node}</span>
          <span className="text-meta text-muted-foreground">{pipeline.step}</span>
        </Card>
      </ParallaxPlane>
    </div>
  );
}
