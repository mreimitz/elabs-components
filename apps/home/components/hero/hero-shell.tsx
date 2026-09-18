"use client";
/**
 * The hero scene (RM-094): the flagship app shell at real product size — nav rail, KPI row,
 * one AutoChart line, a chat panel with a tool call, an 8-row DataTable and a tile row. Real
 * components with real semantics; every fact is a fixture value read in hero-stream.ts, and the
 * stream-in plays once (see there).
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
import {
  HERO_SEED,
  formatKpi,
  formatUsd,
  kpiValueAt,
  textAt,
  toolOpenAt,
  type HeroMover,
} from "./hero-stream";
import { useHeroStream } from "./use-hero-stream";

const scene = heroCopy.scene;
const { chat, pipeline } = HERO_SEED;

const NAV = [
  { id: "overview", label: scene.nav.overview },
  { id: "accounts", label: scene.nav.accounts },
  { id: "orders", label: scene.nav.orders },
  { id: "settings", label: scene.nav.settings },
];

const CHART: ChartSpec = {
  type: "line",
  title: HERO_SEED.churn.title,
  data: HERO_SEED.churn.points.map((d) => ({ ...d })),
  x: "week",
  xType: "time",
  series: [{ key: "churn", label: HERO_SEED.churn.label }],
};

const COLUMNS: ColumnDef<HeroMover>[] = [
  { accessorKey: "account", header: scene.columns.account },
  { accessorKey: "region", header: scene.columns.region },
  {
    accessorKey: "lastMonth",
    header: scene.columns.monthMrr(HERO_SEED.moversMonth),
    meta: { numeric: true },
    cell: ({ row }) => formatUsd(row.original.lastMonth),
  },
  {
    accessorKey: "mrrChange",
    header: scene.columns.change,
    meta: { numeric: true },
    cell: ({ row }) => formatUsd(row.original.mrrChange, true),
  },
];

/** Hidden (opacity only) while the inline gate marks a stream-in as about to play. */
const STREAMED =
  "transition-opacity duration-fast ease-standard group-data-stream-pending/stream:opacity-0";

export function HeroShell() {
  const ref = useRef<HTMLDivElement>(null);
  const stream = useHeroStream(ref);
  const assistant = textAt(chat.answer, stream);
  const toolOpen = toolOpenAt(stream);

  return (
    <div ref={ref} data-slot="hero-scene" className="flex h-full min-w-175">
      <HeroNavRail
        productName={HERO_SEED.product}
        orgName={HERO_SEED.org}
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
                label={kpi.label}
                description={HERO_SEED.kpiSince}
                value={
                  <span className={STREAMED} data-kpi-value="">
                    {formatKpi(kpi, kpiValueAt(kpi, stream))}
                  </span>
                }
                delta={kpi.delta}
                deltaDirection={kpi.direction}
                positiveIsGood={kpi.positiveIsGood}
              />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Card className="col-span-3 p-3">
              <AutoChart spec={CHART} height={176} />
            </Card>
            <Card className="col-span-2 flex h-64 flex-col gap-0 p-0">
              <Conversation className="min-h-0" aria-label={scene.chatLabel}>
                <ConversationContent className="gap-2 p-3">
                  <Message from="user">
                    <MessageContent>{chat.question}</MessageContent>
                  </Message>
                  <Message from="assistant">
                    <Tool open={toolOpen} className="mb-0">
                      <ToolHeader
                        type={`tool-${chat.tool.name}`}
                        title={chat.tool.name}
                        summary={chat.tool.summary}
                        state={toolOpen ? chat.tool.state : "input-available"}
                      />
                      <ToolContent className="p-3">
                        <p className="text-meta text-muted-foreground">{chat.tool.result}</p>
                      </ToolContent>
                    </Tool>
                    {/* Clamped so the question and the tool call stay in view: the panel
                        sticks to the bottom, and the fixture's full answer would scroll both
                        out. The whole answer stays in the DOM for assistive tech. */}
                    <MessageContent className={`${STREAMED} line-clamp-2`} data-stream-text="">
                      {assistant}
                    </MessageContent>
                  </Message>
                </ConversationContent>
              </Conversation>
            </Card>
          </div>
          <DataTable columns={COLUMNS} data={HERO_SEED.movers} />
          <div className="grid grid-cols-3 gap-3">
            {HERO_SEED.tiles.map((kpi) => (
              <Card key={kpi.id} className="gap-1 p-3">
                <span className="text-meta text-muted-foreground">{kpi.label}</span>
                <span className="text-kpi tabular-nums">{formatKpi(kpi, kpi.value)}</span>
              </Card>
            ))}
            <Card className="gap-2 p-3">
              <span className="text-meta text-muted-foreground">{scene.tiles.pipeline}</span>
              <Progress value={pipeline.progress} aria-label={scene.tiles.pipeline} />
              <span className="text-meta text-muted-foreground">
                {pipeline.node} · {pipeline.step}
              </span>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
