// registry: energy-operations-page — copied 2026-09-23
/**
 * Energy operations — the site desk of a utility that runs the grid connection of eight
 * industrial parks.
 *
 * What it shows a copier: a headline computed from the fleet (who is above contract, who is
 * near capacity), the sites as a `DataTable` beside a `MapCanvas` whose markers say the same
 * thing in the same colours AND shapes, the `energy-desk-01` block re-reading the SELECTED
 * site's 120 days of meters, and a dock the selection summons — the site's contract, its open
 * alarms with the runbook's response, and an analyst conversation whose first turn is a tool
 * call over the meters. Selection is one state, shared by the table, the map, the desk and the
 * dock: the pattern for any screen where a list and a map name the same things.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CircleCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  MapPinned,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Composer,
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  Suggestion,
  Suggestions,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@elabs-ai/components-ai";
import { MetricCard, MetricGrid } from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  MapCanvas,
  MapControls,
  MapMarker,
  MapMarkerContent,
  MapMarkerLabel,
  MapMarkerTooltip,
} from "@elabs-ai/components-maps";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { EnergyDesk } from "../energy-desk-01/energy-desk";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";
import {
  SITES_AS_OF,
  readingsFor,
  siteAlarms,
  sites as defaultSites,
  type AlarmSeverity,
  type Site,
  type SiteAlarm,
  type SiteStatus,
} from "./data/sites";

export interface EnergyOperationsPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  sites?: Site[];
  alarms?: SiteAlarm[];
  /** No basemap tiles — markers on a blank canvas, with no request to a tile server. */
  blankMap?: boolean;
  locale?: string;
}

/** Status is a colour AND a glyph AND a word — never the colour alone. */
const STATUS: Record<
  SiteStatus,
  { label: string; badge: "success" | "warning" | "destructive"; mark: string; Icon: typeof Zap }
> = {
  normal: {
    label: "normal",
    badge: "success",
    mark: "bg-success text-success-foreground",
    Icon: Zap,
  },
  watch: {
    label: "watch",
    badge: "warning",
    mark: "bg-warning text-warning-foreground",
    Icon: Gauge,
  },
  alarm: {
    label: "alarm",
    badge: "destructive",
    mark: "bg-destructive text-destructive-foreground",
    Icon: AlertTriangle,
  },
};

const SEVERITY_BADGE: Record<AlarmSeverity, "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  major: "warning",
  minor: "secondary",
};

type Turn = { id: string; from: "user" | "assistant"; text: string };

export default function EnergyOperationsPage({
  frame = "viewport",
  sites = defaultSites,
  alarms = siteAlarms,
  blankMap = false,
  locale = "en-US",
}: EnergyOperationsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const number = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }),
    [locale],
  );

  // Acknowledging every critical alarm of a site steps it down to "watch": status is derived.
  const openAlarms = useMemo(
    () => alarms.filter((alarm) => !acknowledged.includes(alarm.id)),
    [alarms, acknowledged],
  );
  const rows = useMemo(
    () =>
      sites.map((site) => {
        const own = openAlarms.filter((alarm) => alarm.siteId === site.id);
        const status: SiteStatus = own.some((a) => a.severity === "critical")
          ? "alarm"
          : own.length > 0 || site.status !== "normal"
            ? "watch"
            : "normal";
        return { ...site, status, openAlarms: own.length };
      }),
    [sites, openAlarms],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const readings = useMemo(() => (selected ? readingsFor(selected) : null), [selected]);

  const fleetLoad = rows.reduce((sum, row) => sum + row.loadMw, 0);
  const fleetCapacity = rows.reduce((sum, row) => sum + row.capacityMw, 0);
  const aboveContract = rows.filter((row) => row.spotPrice > row.contractPrice);
  const nearCapacity = rows.filter((row) => row.loadMw / row.capacityMw >= 0.8);
  const exposure = aboveContract.reduce(
    (sum, row) => sum + (row.spotPrice - row.contractPrice) * row.loadMw,
    0,
  );
  const byPrice = [...rows].sort((a, b) => a.spotPrice - b.spotPrice);
  const cheapest = byPrice[0] ?? rows[0];
  const dearest = byPrice[byPrice.length - 1] ?? rows[0];

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Site desk",
      items: [
        { id: "sites", label: "Sites", href: "#sites", icon: LayoutDashboard },
        {
          id: "alarms",
          label: "Alarms",
          href: "#alarms",
          icon: Bell,
          badge: String(openAlarms.length),
        },
        { id: "map", label: "Map", href: "#map", icon: MapPinned },
        { id: "forecast", label: "Forecast", href: "#forecast", icon: TrendingUp },
      ],
    },
    {
      label: "Commercial",
      items: [
        { id: "contracts", label: "Contracts", href: "#contracts", icon: FileText },
        { id: "reports", label: "Reports", href: "#reports", icon: Gauge },
      ],
    },
  ];

  const columns = useMemo<ColumnDef<(typeof rows)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Site",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-caption text-muted-foreground">
              {row.original.id} · {row.original.zone}, {row.original.country}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "loadMw",
        header: "Load",
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {number.format(row.original.loadMw)} / {row.original.capacityMw} MW
          </span>
        ),
      },
      {
        id: "utilisation",
        accessorFn: (row) => row.loadMw / row.capacityMw,
        header: "Of contract",
        cell: ({ row }) => {
          const share = row.original.loadMw / row.original.capacityMw;
          return (
            <span className={cn("tabular-nums", share >= 0.8 && "font-semibold text-warning-text")}>
              {percent.format(share)}
            </span>
          );
        },
      },
      {
        accessorKey: "spotPrice",
        header: "Spot vs contract",
        cell: ({ row }) => {
          const delta = row.original.spotPrice - row.original.contractPrice;
          return (
            <span className="flex flex-col tabular-nums whitespace-nowrap">
              <span>{money.format(row.original.spotPrice)}/MWh</span>
              <span
                className={cn(
                  "text-caption",
                  delta > 0 ? "text-destructive-text" : "text-muted-foreground",
                )}
              >
                {delta > 0 ? "+" : ""}
                {money.format(delta)} vs contract
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const { label, badge, Icon } = STATUS[row.original.status];
          return (
            <Badge className="gap-1 whitespace-nowrap" variant={badge}>
              <Icon aria-hidden="true" className="size-3" />
              {label}
              {row.original.openAlarms > 0 ? ` · ${row.original.openAlarms}` : ""}
            </Badge>
          );
        },
      },
    ],
    [money, number, percent],
  );

  const acknowledge = useCallback((alarm: SiteAlarm, site: Site) => {
    setAcknowledged((prev) => [...prev, alarm.id]);
    toast.success("Alarm acknowledged", { description: `${alarm.id} · ${site.name}` });
  }, []);

  // The analyst's answer is computed from the meters, so it is honest for any site handed in.
  const analysis = useMemo(() => {
    if (!selected || !readings) return null;
    const week = readings.slice(-7 * 24);
    let cost = 0;
    let energy = 0;
    let eveningCost = 0;
    let aboveContractHours = 0;
    for (const row of week) {
      const h = row.hour.getUTCHours();
      cost += row.consumption * row.price;
      energy += row.consumption;
      if (h >= 17 && h < 21) eveningCost += row.consumption * row.price;
      if (row.price > selected.contractPrice) aboveContractHours += 1;
    }
    return {
      cost,
      energy,
      effective: energy > 0 ? cost / energy : 0,
      eveningShare: cost > 0 ? eveningCost / cost : 0,
      aboveContractHours,
      hours: week.length,
    };
  }, [selected, readings]);

  const summaryFor = useCallback(
    (site: Site, a: NonNullable<typeof analysis>) =>
      `Over the last seven days ${site.name} drew ${number.format(a.energy)} MWh for ${money.format(a.cost)} — ${money.format(a.effective)}/MWh against a contract of ${money.format(site.contractPrice)}. ${percent.format(a.eveningShare)} of the cost falls in the 17:00–21:00 ramp, and the spot price sat above contract for ${a.aboveContractHours} of ${a.hours} hours. ${site.note}`,
    [money, number, percent],
  );

  const ask = useCallback(
    (text: string) => {
      if (!selected || !analysis) return;
      const id = String(turns.length + 1);
      setTurns((prev) => [
        ...prev,
        { id: `u${id}`, from: "user", text },
        {
          id: `a${id}`,
          from: "assistant",
          text: /shift|ramp|evening/i.test(text)
            ? `Moving a fifth of the evening load to after 21:00 would cut the week's cost by about ${money.format(analysis.cost * analysis.eveningShare * 0.2 * 0.35)} at last week's prices — the site's own note says what can move: ${selected.note}`
            : /fleet|compare|other/i.test(text) && cheapest && dearest
              ? `${selected.name} pays ${money.format(analysis.effective)}/MWh; the fleet's cheapest zone right now is ${cheapest.zone} at ${money.format(cheapest.spotPrice)} and the dearest ${dearest.zone} at ${money.format(dearest.spotPrice)}.`
              : summaryFor(selected, analysis),
        },
      ]);
    },
    [selected, analysis, turns.length, money, cheapest, dearest, summaryFor],
  );

  const select = (id: string | null) => {
    setSelectedId(id);
    setTurns([]);
  };

  const siteAlarmRows = selected ? openAlarms.filter((a) => a.siteId === selected.id) : [];

  return (
    <>
      <WorkspaceShell
        activeId="sites"
        dock={{
          title: selected ? selected.name : "Site",
          description: selected
            ? `${selected.zone} · ${selected.supplier} until ${selected.contractEnds}`
            : "Select a site to see its contract, its alarms and the analyst.",
          showLabel: "Show site details",
          hideLabel: "Hide site details",
          open: selected !== null,
          onOpenChange: (open) => select(open ? (rows[0]?.id ?? null) : null),
          defaultWidth: 420,
          children:
            selected && analysis ? (
              <div className="flex flex-col gap-6" data-testid="site-dock">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1" variant={STATUS[selected.status].badge}>
                    {(() => {
                      const Icon = STATUS[selected.status].Icon;
                      return <Icon aria-hidden="true" className="size-3" />;
                    })()}
                    {STATUS[selected.status].label}
                  </Badge>
                  <Badge variant="outline">{selected.zone}</Badge>
                </div>
                <Descriptions columns={2}>
                  <DescriptionsItem label="Load" numeric>
                    {number.format(selected.loadMw)} MW
                  </DescriptionsItem>
                  <DescriptionsItem label="Capacity" numeric>
                    {selected.capacityMw} MW
                  </DescriptionsItem>
                  <DescriptionsItem label="Spot" numeric>
                    {money.format(selected.spotPrice)}/MWh
                  </DescriptionsItem>
                  <DescriptionsItem label="Contract" numeric>
                    {money.format(selected.contractPrice)}/MWh
                  </DescriptionsItem>
                </Descriptions>

                <section aria-labelledby="dock-alarms" className="flex flex-col gap-2">
                  <h3 className="text-body font-semibold" id="dock-alarms">
                    Open alarms
                  </h3>
                  {siteAlarmRows.length === 0 ? (
                    <p className="flex items-center gap-2 text-body text-muted-foreground">
                      <CircleCheck aria-hidden="true" className="size-4 text-success" />
                      Nothing open at this site.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {siteAlarmRows.map((alarm) => (
                        <li
                          className="flex flex-col gap-2 rounded-md border-s-2 border-border ps-3"
                          key={alarm.id}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={SEVERITY_BADGE[alarm.severity]}>{alarm.severity}</Badge>
                            <span className="text-caption text-muted-foreground">
                              {alarm.id} · {alarm.raised}
                            </span>
                          </div>
                          <p className="text-body">{alarm.message}</p>
                          <p className="text-meta text-muted-foreground">{alarm.action}</p>
                          <div>
                            <Button
                              onClick={() => acknowledge(alarm, selected)}
                              size="sm"
                              variant="outline"
                            >
                              Acknowledge
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="dock-analyst" className="flex flex-col gap-3">
                  <h3 className="flex items-center gap-2 text-body font-semibold" id="dock-analyst">
                    <Sparkles aria-hidden="true" className="size-4 text-primary" />
                    Analyst
                  </h3>
                  <Conversation className="max-h-96">
                    <ConversationContent>
                      <Message from="user">
                        <MessageContent>
                          <MessageResponse>
                            {`What is driving cost at ${selected.name} this week?`}
                          </MessageResponse>
                        </MessageContent>
                      </Message>
                      <Message from="assistant">
                        <MessageContent>
                          <Tool>
                            <ToolHeader
                              state="output-available"
                              summary={`${analysis.hours} hourly rows · ${analysis.aboveContractHours} above contract`}
                              title="Read site meters"
                              toolName="readMeters"
                              type="dynamic-tool"
                            />
                            <ToolContent>
                              <ToolInput input={{ site: selected.id, span: "7d" }} />
                              <ToolOutput
                                errorText={undefined}
                                output={{
                                  mwh: Math.round(analysis.energy),
                                  cost: Math.round(analysis.cost),
                                  eveningShare: Math.round(analysis.eveningShare * 100) / 100,
                                }}
                              />
                            </ToolContent>
                          </Tool>
                          <MessageResponse>{summaryFor(selected, analysis)}</MessageResponse>
                        </MessageContent>
                      </Message>
                      {turns.map((turn) => (
                        <Message from={turn.from} key={turn.id}>
                          <MessageContent>
                            <MessageResponse>{turn.text}</MessageResponse>
                          </MessageContent>
                        </Message>
                      ))}
                    </ConversationContent>
                  </Conversation>
                  <Suggestions>
                    <Suggestion onClick={ask} suggestion="What if we shift the evening ramp?" />
                    <Suggestion onClick={ask} suggestion="Compare with the rest of the fleet" />
                  </Suggestions>
                  <Composer
                    onSubmit={(message) => {
                      const text = message.text?.trim();
                      if (text) ask(text);
                    }}
                    placeholder={`Ask about ${selected.id}…`}
                    sendStatus="ready"
                    showAttach={false}
                    showVoice={false}
                    status="Answers are computed from the site's meters"
                  />
                </section>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">
                Select a site in the table or on the map to see its contract, its alarms and the
                analyst.
              </p>
            ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          {
            id: "1",
            fallback: "JS",
            text: "Jysk Strøm confirmed the DK1 evening price forecast",
            time: "12m ago",
          },
          {
            id: "2",
            fallback: "MK",
            text: "Midt Kraft opened the Trondheim capacity uplift ticket",
            time: "1h ago",
          },
        ]}
        orgName="Nordvik Energy"
        productName="Site desk"
        trail={[
          { href: "#sites", label: "Site desk" },
          { href: "#overview", label: "Overview" },
        ]}
        user={{ name: "Ingrid Solheim", email: "ingrid@nordvik-energy.example" }}
      >
        <div className="@container mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold text-balance">
                {aboveContract.length} of {rows.length} sites are buying above contract
                {nearCapacity.length > 0
                  ? `, and ${nearCapacity.length === 1 ? "one is" : `${nearCapacity.length} are`} within a fifth of their capacity band`
                  : ""}
              </h1>
              <p className="text-body text-muted-foreground tabular-nums">
                {number.format(fleetLoad)} of {fleetCapacity} MW contracted is in use; the exposure
                this hour is {money.format(exposure)} above contract.
              </p>
            </div>
            <Badge variant="success">Live · {SITES_AS_OF}</Badge>
          </div>

          <MetricGrid columns={4}>
            <MetricCard
              description="Across eight sites"
              label="Fleet load"
              value={`${number.format(fleetLoad)} MW`}
            />
            <MetricCard
              description={`${aboveContract.length} sites above contract this hour`}
              label="Exposure"
              value={`${money.format(exposure)}/h`}
            />
            <MetricCard
              description={dearest ? `${dearest.zone} · ${dearest.name}` : "—"}
              label="Dearest zone"
              value={dearest ? `${money.format(dearest.spotPrice)}/MWh` : "—"}
            />
            <MetricCard
              description={cheapest ? `${cheapest.zone} · ${cheapest.name}` : "—"}
              label="Cheapest zone"
              value={cheapest ? `${money.format(cheapest.spotPrice)}/MWh` : "—"}
            />
          </MetricGrid>

          <div className="grid gap-6 @5xl:grid-cols-5" id="sites">
            <section
              aria-labelledby="sites-title"
              className="flex min-w-0 flex-col gap-3 @5xl:col-span-3"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-subtitle font-semibold" id="sites-title">
                  Sites, as the meters see them
                </h2>
                <p className="text-meta text-muted-foreground">
                  Select a site to read its meters below and open its alarms beside the table.
                </p>
              </div>
              <Card className="p-0">
                <CardContent className="p-0">
                  <DataTable
                    caption="Sites"
                    columns={columns}
                    data={rows}
                    getRowId={(row) => row.id}
                    onRowClick={(row) => select(row.original.id)}
                    rowActionLabel={(row) => `Open ${row.original.name}`}
                    rowClassName={(row) =>
                      row.original.id === selectedId ? "bg-selection-muted" : ""
                    }
                  />
                </CardContent>
              </Card>
            </section>

            <section
              aria-labelledby="map-title"
              className="flex min-h-96 flex-col gap-3 @5xl:col-span-2"
              id="map"
            >
              <h2 className="text-subtitle font-semibold" id="map-title">
                Where the load is
              </h2>
              <div className="relative min-h-80 flex-1 overflow-hidden rounded-lg border border-border bg-card">
                <MapCanvas blank={blankMap} center={[9.5, 60.8]} zoom={3.4}>
                  {rows.map((site) => {
                    const { label, mark, Icon } = STATUS[site.status];
                    const faded = selectedId !== null && selectedId !== site.id;
                    return (
                      <MapMarker
                        key={site.id}
                        latitude={site.position[1]}
                        longitude={site.position[0]}
                        onClick={() => select(selectedId === site.id ? null : site.id)}
                      >
                        <MapMarkerContent>
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-full border-2 border-background shadow-sm transition-opacity duration-fast ease-standard",
                              mark,
                              faded && "opacity-40",
                            )}
                          >
                            <Icon aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">
                              {site.name}, {label}
                            </span>
                          </span>
                        </MapMarkerContent>
                        <MapMarkerLabel position="bottom">{site.id}</MapMarkerLabel>
                        <MapMarkerTooltip>
                          {site.name} · {number.format(site.loadMw)} MW ·{" "}
                          {money.format(site.spotPrice)}/MWh
                        </MapMarkerTooltip>
                      </MapMarker>
                    );
                  })}
                  <MapControls position="bottom-right" />
                </MapCanvas>
              </div>
            </section>
          </div>

          <section aria-labelledby="desk-title" className="flex flex-col gap-3" id="forecast">
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="desk-title">
                {selected
                  ? `${selected.name} — 120 days of meters`
                  : "Pick a site to read its meters"}
              </h2>
              <p className="text-meta text-muted-foreground">
                {selected
                  ? "The price chart owns the window; drag a range on the consumption chart to price a period."
                  : "The energy desk below re-reads the selected site's hourly consumption and its zone's spot price."}
              </p>
            </div>
            {selected && readings ? (
              <Card>
                <CardContent className="pt-6">
                  <EnergyDesk key={selected.id} locale={locale} readings={readings} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex min-h-40 items-center justify-center pt-6">
                  <p className="text-body text-muted-foreground">
                    No site selected — the desk opens on the first row or marker you pick.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
