/**
 * Revenue operations — a whole analytics workspace, not a dashboard in a box.
 *
 * What it shows a copier: the workspace shell with real navigation and a summoned assistant,
 * a page header whose controls all do something (the period re-slices every chart, the
 * region filters the pipeline), the `command-center-revenue-01` block as the body, and a
 * pipeline `DataTable` whose rows carry their own evidence — a probability meter, an
 * activity sparkline, a computed "stalled" flag — with selection feeding a summary bar.
 */
"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Download,
  FileText,
  LayoutDashboard,
  LineChart,
  Target,
  Users,
} from "lucide-react";
import { Sparkline } from "@elabs-ai/components-charts";
import { DataTable, FilterBar, SearchInput, type ColumnDef } from "@elabs-ai/components-data";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Meter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { CommandCenterRevenue } from "@/components/command-center-revenue-01/command-center-revenue";
import { revenueWeeks } from "@/components/command-center-revenue-01/data/revenue-command";
import { WorkspaceAssistant } from "@/components/workspace-shell/workspace-assistant";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";
import { deals, STALLED_TOUCHES, type Deal, type DealStage } from "./data/deals";

const NAV: WorkspaceNavGroup[] = [
  {
    label: "Revenue",
    items: [
      { id: "desk", label: "Revenue desk", href: "#desk", icon: LayoutDashboard },
      { id: "pipeline", label: "Pipeline", href: "#pipeline", icon: BarChart3, badge: "12" },
      { id: "forecast", label: "Forecast", href: "#forecast", icon: LineChart },
      { id: "targets", label: "Targets", href: "#targets", icon: Target },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "accounts", label: "Accounts", href: "#accounts", icon: Building2 },
      { id: "people", label: "People", href: "#people", icon: Users },
      { id: "reports", label: "Reports", href: "#reports", icon: FileText },
    ],
  },
];

const STAGE_BADGE: Record<DealStage, "secondary" | "info" | "warning" | "success"> = {
  Qualified: "secondary",
  Proposal: "info",
  Negotiation: "warning",
  Commit: "success",
};

const PERIODS = [
  { value: "26", label: "Last 26 weeks" },
  { value: "13", label: "Last 13 weeks" },
  { value: "8", label: "Last 8 weeks" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

const isStalled = (deal: Deal) =>
  deal.activity.slice(-3).reduce((sum, touches) => sum + touches, 0) < STALLED_TOUCHES;

export interface RevenueOpsPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  locale?: string;
}

export default function RevenueOpsPage({
  frame = "viewport",
  locale = "en-US",
}: RevenueOpsPageProps) {
  const [period, setPeriod] = useState("26");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Record<string, boolean>>({});

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const weeks = useMemo(() => revenueWeeks.slice(-Number(period)), [period]);
  const rows = useMemo(
    () => (region === "all" ? deals : deals.filter((deal) => deal.region === region)),
    [region],
  );
  const weighted = rows.reduce((sum, deal) => sum + (deal.value * deal.probability) / 100, 0);
  const stalled = rows.filter(isStalled);
  const picked = rows.filter((deal) => selection[deal.id]);

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: "account",
        header: "Account",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.original.account}</span>
            <span className="text-caption text-muted-foreground">
              {row.original.id} · {row.original.region}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Badge variant={STAGE_BADGE[row.original.stage]}>{row.original.stage}</Badge>
            {isStalled(row.original) ? <Badge variant="destructive">Stalled</Badge> : null}
          </span>
        ),
      },
      {
        accessorKey: "owner",
        header: "Owner",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-caption">
                {initials(row.original.owner)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{row.original.owner}</span>
          </span>
        ),
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => (
          <span className="tabular-nums">{money.format(row.original.value)}k</span>
        ),
      },
      {
        accessorKey: "probability",
        header: "Win probability",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Meter
              aria-label={`${row.original.probability}% win probability`}
              className="w-20"
              size="xs"
              value={row.original.probability}
            />
            <span className="w-9 text-end text-meta text-muted-foreground tabular-nums">
              {row.original.probability}%
            </span>
          </span>
        ),
      },
      {
        id: "activity",
        header: "Activity, 8 wk",
        enableSorting: false,
        cell: ({ row }) => (
          <Sparkline
            height={24}
            label={`${row.original.account}: touches per week, last 8 weeks`}
            values={row.original.activity}
            width={96}
          />
        ),
      },
      {
        accessorKey: "closes",
        header: "Closes",
        cell: ({ row }) => (
          <span className="tabular-nums">{date.format(new Date(row.original.closes))}</span>
        ),
      },
    ],
    // Formatters are rebuilt per render but are value-equal for a locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  return (
    <>
      <WorkspaceShell
        activeId="desk"
        dock={{
          title: "Revenue analyst",
          description: "Reads the desk and the pipeline on this screen.",
          showLabel: "Show the revenue analyst",
          hideLabel: "Hide the revenue analyst",
          // Open on a real screen; summoned inside a preview box, where width is scarce.
          defaultOpen: frame === "viewport",
          defaultWidth: 380,
          children: (
            <WorkspaceAssistant
              brief={[
                {
                  title:
                    stalled.length === 1
                      ? "One deal has gone quiet"
                      : `${stalled.length} deals have gone quiet`,
                  body: `${stalled.map((deal) => deal.account).join(" and ") || "None"} — fewer than ${STALLED_TOUCHES} touches in three weeks.`,
                },
                {
                  title: `${money.format(Math.round(weighted))}k weighted pipeline`,
                  body: "Value times win probability, for the region selected.",
                },
              ]}
              prompts={[
                {
                  prompt: "Which deals decide the quarter?",
                  answer:
                    "**Northwind Retail** ($640k, 90%) and **Halden Pharma** ($520k, 70%) are 54% of the weighted pipeline that closes before quarter end. Halden is the one to watch: it is still in negotiation with nine days left.",
                },
                {
                  prompt: "Why is Kestrel Foods at risk?",
                  answer:
                    "Touches fell from 5 a week to 1 over eight weeks while the deal stayed in negotiation. The last logged activity is a pricing objection with no reply. Suggested next step: bring in the solutions lead before the 9 Oct close date slips.",
                },
                {
                  prompt: "Draft the Monday pipeline note",
                  answer:
                    "**Pipeline, week 38** — Commit is $1.05M across three deals, all active. Two deals are stalled (Kestrel Foods, Summit Outdoor; $705k combined). Weekly revenue has cleared the plan line for nine straight weeks.",
                },
              ]}
            />
          ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          {
            id: "1",
            fallback: "AR",
            text: "Ava Reyes moved Northwind Retail to Commit",
            time: "12m ago",
          },
          {
            id: "2",
            fallback: "SM",
            text: "Sam Mori logged a pricing objection on Kestrel Foods",
            time: "1h ago",
          },
        ]}
        orgName="Acme Logistics"
        productName="Revenue"
        trail={[
          { href: "#revenue", label: "Revenue" },
          { href: "#desk", label: "Revenue desk" },
        ]}
        user={{ name: "Ada Okonkwo", email: "ada@acme-logistics.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold">Revenue desk</h1>
              <p className="text-body text-muted-foreground">
                Bookings, mix and the accounts that decide the quarter. Every chart follows the
                period you pick.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select onValueChange={setPeriod} value={period}>
                <SelectTrigger aria-label="Period" className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  toast.success("Export queued", {
                    description: `Revenue desk, ${PERIODS.find((item) => item.value === period)?.label.toLowerCase()}, as a workbook.`,
                  })
                }
                variant="outline"
              >
                <Download aria-hidden="true" />
                Export
              </Button>
            </div>
          </div>

          <CommandCenterRevenue locale={locale} weeks={weeks} />

          <section aria-labelledby="pipeline-title" className="flex flex-col gap-3" id="pipeline">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-subtitle font-semibold" id="pipeline-title">
                  Open pipeline
                </h2>
                <p className="text-meta text-muted-foreground tabular-nums">
                  {rows.length} deals ·{" "}
                  {money.format(rows.reduce((sum, deal) => sum + deal.value, 0))}k open ·{" "}
                  {money.format(Math.round(weighted))}k weighted
                </p>
              </div>
              <ToggleGroup
                aria-label="Region"
                onValueChange={(value) => value && setRegion(value)}
                size="sm"
                type="single"
                value={region}
                variant="segmented"
              >
                <ToggleGroupItem value="all">All regions</ToggleGroupItem>
                <ToggleGroupItem value="EMEA">EMEA</ToggleGroupItem>
                <ToggleGroupItem value="AMER">AMER</ToggleGroupItem>
                <ToggleGroupItem value="APAC">APAC</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <DataTable
              caption="Open pipeline"
              columns={columns}
              data={rows}
              enablePagination
              enableRowSelection
              getRowId={(deal) => deal.id}
              globalFilter={search}
              onGlobalFilterChange={setSearch}
              onRowSelectionChange={setSelection}
              pageSize={8}
              rowSelection={selection}
              toolbar={() => (
                <FilterBar
                  actions={
                    picked.length > 0 ? (
                      <span className="flex items-center gap-3 text-meta tabular-nums">
                        {picked.length} selected ·{" "}
                        {money.format(picked.reduce((sum, deal) => sum + deal.value, 0))}k
                        <Button
                          onClick={() => {
                            toast.success(`Review requested for ${picked.length} deals`);
                            setSelection({});
                          }}
                          size="sm"
                        >
                          Request deal review
                        </Button>
                      </span>
                    ) : null
                  }
                >
                  <SearchInput
                    onValueChange={setSearch}
                    placeholder="Search deals…"
                    value={search}
                  />
                </FilterBar>
              )}
            />
          </section>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
