"use client";
/**
 * The hero scene (RM-094): the flagship app shell at real product size — nav rail, KPI row,
 * one AutoChart line, a chat panel with a tool call, an 8-row DataTable and a tile row. Real
 * components with real semantics; the stream-in plays once (see hero-stream.ts).
 */
import { useRef } from "react";
import { Card, Progress, StatusBadge } from "@elabs-ai/components-ui";
import { AutoChart, MetricCard, type ChartSpec } from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  Tool,
  ToolContent,
  ToolHeader,
} from "@elabs-ai/components-ai";
import { HeroNavRail } from "../blocks/app-shell/hero-nav-rail";
import { heroCopy } from "../../content/copy";
import { HERO_SEED, formatKpi, kpiValueAt, textAt, toolOpenAt } from "./hero-stream";
import { useHeroStream } from "./use-hero-stream";

const scene = heroCopy.scene;
type Run = (typeof HERO_SEED.runs)[number];

const NAV = [
  { id: "overview", label: scene.nav.overview },
  { id: "runs", label: scene.nav.runs },
  { id: "agents", label: scene.nav.agents },
  { id: "settings", label: scene.nav.settings },
];

const CHART: ChartSpec = {
  type: "line",
  title: scene.chartTitle,
  data: HERO_SEED.runsPerDay.map((d) => ({ ...d })),
  x: "day",
  xType: "category",
  series: [{ key: "runs", label: scene.chartSeries }],
};

const COLUMNS: ColumnDef<Run>[] = [
  { accessorKey: "id", header: scene.columns.id },
  { accessorKey: "agent", header: scene.columns.agent },
  {
    accessorKey: "status",
    header: scene.columns.status,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: "duration", header: scene.columns.duration },
];

/** Hidden (opacity only) while the inline gate marks a stream-in as about to play. */
const STREAMED =
  "transition-opacity duration-fast ease-standard group-data-stream-pending/stream:opacity-0";

export function HeroShell() {
  const ref = useRef<HTMLDivElement>(null);
  const stream = useHeroStream(ref);
  const assistant = textAt(scene.assistantMessage, stream);
  const toolOpen = toolOpenAt(stream);

  return (
    <div ref={ref} data-slot="hero-scene" className="flex h-full min-w-175">
      <HeroNavRail
        productName={scene.product}
        orgName={scene.org}
        items={NAV}
        activeId="overview"
      />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-header shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-subtitle font-semibold">{scene.title}</h2>
          <StatusBadge status="running" />
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {HERO_SEED.kpis.map((kpi) => (
              <MetricCard
                key={kpi.id}
                data-kpi={kpi.id}
                data-final={formatKpi(kpi, kpi.value)}
                label={scene.kpis[kpi.id].label}
                description={scene.kpis[kpi.id].description}
                value={
                  <span className={STREAMED} data-kpi-value="">
                    {formatKpi(kpi, kpiValueAt(kpi, stream))}
                  </span>
                }
                delta={kpi.delta}
                deltaDirection={kpi.direction}
              />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Card className="col-span-3 p-3">
              <AutoChart spec={CHART} height={176} />
            </Card>
            <Card className="col-span-2 flex h-64 flex-col gap-0 p-0">
              <Conversation className="min-h-0" aria-label={scene.chatLabel}>
                <ConversationContent className="gap-3 p-3">
                  <Message from="user">
                    <MessageContent>{scene.userMessage}</MessageContent>
                  </Message>
                  <Message from="assistant">
                    <Tool open={toolOpen} className="mb-0">
                      <ToolHeader
                        type={`tool-${scene.toolTitle}`}
                        title={scene.toolTitle}
                        summary={scene.toolSummary}
                        state={toolOpen ? "output-available" : "input-available"}
                      />
                      <ToolContent className="p-3">
                        <p className="text-meta text-muted-foreground">{scene.toolResult}</p>
                      </ToolContent>
                    </Tool>
                    <MessageContent className={STREAMED} data-stream-text="">
                      {assistant}
                    </MessageContent>
                  </Message>
                </ConversationContent>
              </Conversation>
            </Card>
          </div>
          <DataTable columns={COLUMNS} data={[...HERO_SEED.runs]} />
          <div className="grid grid-cols-3 gap-3">
            <Card className="gap-1 p-3">
              <span className="text-meta text-muted-foreground">{scene.tiles.queue}</span>
              <span className="text-kpi tabular-nums">{HERO_SEED.tiles.queue}</span>
            </Card>
            <Card className="gap-1 p-3">
              <span className="text-meta text-muted-foreground">{scene.tiles.model}</span>
              <span className="font-mono text-code">{HERO_SEED.tiles.model}</span>
            </Card>
            <Card className="gap-2 p-3">
              <span className="text-meta text-muted-foreground">{scene.tiles.budget}</span>
              <Progress value={HERO_SEED.tiles.budget} aria-label={scene.tiles.budget} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
