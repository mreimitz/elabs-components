// registry: security-operations-page — copied 2026-09-23
/**
 * Security operations — the SOC of an insurer with offices and data centres on four continents.
 *
 * What it shows a copier: a headline computed from the queue (how many alerts are open, how many
 * critical, how old the oldest is), the queue as a filtered `DataTable` (a `FilterBar` of search
 * and facets above it) beside a `MapCanvas` whose `MapClusterLayer` shows where the open alerts
 * fire, the `incident-explorer-01` block re-read as 90 days of security incidents by source, and
 * a triage dock the selection summons — the alert's indicators, the linked alerts, and an agent
 * conversation whose enrichment is a tool call and whose containment WAITS for the analyst:
 * "Contain asset" runs the second tool and steps the alert down, with an undo on the toast.
 * Selection is one state, shared by the table, the map and the dock.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bug,
  CircleCheck,
  FileText,
  Info,
  Inbox,
  MapPinned,
  MinusCircle,
  Radar,
  ShieldCheck,
  Sparkles,
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
import {
  DataTable,
  FacetFilter,
  FilterBar,
  SearchInput,
  type ColumnDef,
} from "@elabs-ai/components-data";
import { MapCanvas, MapClusterLayer, MapControls } from "@elabs-ai/components-maps";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  StatusBadge,
  Toaster,
  toast,
  type CustomStatus,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { IncidentExplorer } from "../incident-explorer-01/incident-explorer";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";
import {
  ALERT_SEVERITIES,
  ALERT_SOURCES,
  ALERTS_AS_OF,
  alerts as defaultAlerts,
  assets as defaultAssets,
  securityIncidents,
  sites as defaultSites,
  sourceNames,
  type Alert,
  type AlertSeverity,
  type AlertStatus,
  type Asset,
  type Site,
} from "./data/alerts";

export interface SecurityOpsPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  alerts?: Alert[];
  assets?: Asset[];
  sites?: Site[];
  /** No basemap tiles — the cluster layer on a blank canvas, with no request to a tile server. */
  blankMap?: boolean;
  locale?: string;
}

/** Severity is meaning, so it is a colour AND a glyph AND a word — never the colour alone. */
const SEVERITY: Record<AlertSeverity, CustomStatus> = {
  critical: { label: "critical", tone: "destructive", icon: AlertOctagon },
  high: { label: "high", tone: "warning", icon: AlertTriangle },
  medium: { label: "medium", tone: "info", icon: Info },
  low: { label: "low", tone: "neutral", icon: MinusCircle },
};

const STATUS: Record<AlertStatus, CustomStatus> = {
  new: { label: "new", tone: "destructive", icon: Inbox },
  triaging: { label: "triaging", tone: "warning", icon: Radar },
  contained: { label: "contained", tone: "info", icon: ShieldCheck },
  closed: { label: "closed", tone: "success", icon: CircleCheck },
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const isOpen = (status: AlertStatus) => status === "new" || status === "triaging";

type Turn = { id: string; from: "user" | "assistant"; text: string };

/** Minutes as the queue reads them: "9 min", "1 h 22 min", "6 h". */
function age(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function SecurityOpsPage({
  frame = "viewport",
  alerts = defaultAlerts,
  assets = defaultAssets,
  sites = defaultSites,
  blankMap = false,
  locale = "en-US",
}: SecurityOpsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AlertStatus>>({});
  const [query, setQuery] = useState("");
  const [severities, setSeverities] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);

  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  // Status is derived: what the data says, unless the analyst has moved the alert this session.
  const rows = useMemo(
    () =>
      alerts
        .map((alert) => {
          const asset = assetById.get(alert.assetId);
          const site = asset ? siteById.get(asset.siteId) : undefined;
          return {
            ...alert,
            status: overrides[alert.id] ?? alert.status,
            hostname: asset?.hostname ?? alert.assetId,
            site: site?.name ?? "—",
            siteId: site?.id ?? "",
            position: asset?.position ?? null,
          };
        })
        .sort(
          (a, b) =>
            Number(isOpen(b.status)) - Number(isOpen(a.status)) ||
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
            a.ageMinutes - b.ageMinutes,
        ),
    [alerts, assetById, siteById, overrides],
  );
  type Row = (typeof rows)[number];

  const open = rows.filter((row) => isOpen(row.status));
  const critical = open.filter((row) => row.severity === "critical");
  const oldest = open.reduce((max, row) => Math.max(max, row.ageMinutes), 0);
  const containedToday = rows.filter((row) => row.status === "contained").length;
  const closedToday = rows.filter((row) => row.status === "closed").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (severities.length === 0 || severities.includes(row.severity)) &&
        (sources.length === 0 || sources.includes(row.source)) &&
        (q === "" ||
          [row.id, row.rule, row.hostname, row.user, row.site, row.tactic]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [rows, query, severities, sources]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const linked = selected
    ? rows.filter(
        (row) =>
          row.id !== selected.id &&
          (row.user === selected.user || row.assetId === selected.assetId),
      )
    : [];

  // Where the OPEN alerts fire, as one point each — the cluster layer groups them by site.
  const points = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { alertId: string }>>(
    () => ({
      type: "FeatureCollection",
      features: open
        .filter((row): row is Row & { position: [number, number] } => row.position !== null)
        .map((row) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: row.position },
          properties: { alertId: row.id },
        })),
    }),
    [open],
  );
  const bySite = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of open) counts.set(row.siteId, (counts.get(row.siteId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ site: siteById.get(id), count }))
      .filter((entry): entry is { site: Site; count: number } => Boolean(entry.site))
      .sort((a, b) => b.count - a.count);
  }, [open, siteById]);

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Triage",
      items: [
        { id: "queue", label: "Queue", href: "#queue", icon: Inbox, badge: String(open.length) },
        { id: "map", label: "Assets", href: "#map", icon: MapPinned },
        { id: "incidents", label: "Incidents", href: "#incidents", icon: Bug },
        { id: "hunts", label: "Hunts", href: "#hunts", icon: Radar },
      ],
    },
    {
      label: "Posture",
      items: [
        { id: "detections", label: "Detections", href: "#detections", icon: ShieldCheck },
        { id: "reports", label: "Reports", href: "#reports", icon: FileText },
      ],
    },
  ];

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "severity",
        header: "Severity",
        cell: ({ row }) => <StatusBadge status={SEVERITY[row.original.severity]} />,
      },
      {
        accessorKey: "rule",
        header: "Alert",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{row.original.rule}</span>
            <span className="text-caption text-muted-foreground">
              {row.original.id} · {row.original.hostname} · {row.original.site}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <Badge variant="outline">{row.original.source}</Badge>,
      },
      {
        accessorKey: "user",
        header: "User",
        cell: ({ row }) => <span className="font-mono text-code">{row.original.user}</span>,
      },
      {
        accessorKey: "ageMinutes",
        header: "Age",
        cell: ({ row }) => (
          <span
            className={cn(
              "tabular-nums whitespace-nowrap",
              isOpen(row.original.status) &&
                row.original.ageMinutes >= 120 &&
                "font-semibold text-warning-text",
            )}
          >
            {age(row.original.ageMinutes)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={STATUS[row.original.status]} />,
      },
    ],
    [],
  );

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setTurns([]);
  }, []);

  const setStatus = useCallback((id: string, status: AlertStatus) => {
    setOverrides((prev) => ({ ...prev, [id]: status }));
  }, []);

  const contain = useCallback(
    (row: Row) => {
      const before = row.status;
      setStatus(row.id, "contained");
      toast.success("Asset contained", {
        description: `${row.hostname} isolated · ${row.id}`,
        action: { label: "Undo", onClick: () => setStatus(row.id, before) },
      });
    },
    [setStatus],
  );

  const close = useCallback(
    (row: Row) => {
      const before = row.status;
      setStatus(row.id, "closed");
      toast("Closed as benign", {
        description: row.id,
        action: { label: "Undo", onClick: () => setStatus(row.id, before) },
      });
    },
    [setStatus],
  );

  // The agent's enrichment is computed from the queue, so it is honest for any alert handed in.
  const enrichment = useMemo(() => {
    if (!selected) return null;
    const sameUser = rows.filter((row) => row.id !== selected.id && row.user === selected.user);
    const sameAsset = rows.filter(
      (row) => row.id !== selected.id && row.assetId === selected.assetId,
    );
    const shared = rows.filter(
      (row) =>
        row.id !== selected.id && row.indicators.some((i) => selected.indicators.includes(i)),
    );
    const openLinked = [...sameUser, ...sameAsset].filter(
      (row, i, all) => isOpen(row.status) && all.indexOf(row) === i,
    );
    return { sameUser, sameAsset, shared, openLinked };
  }, [selected, rows]);

  const verdictFor = useCallback((row: Row, e: NonNullable<typeof enrichment>) => {
    const parts = [
      `${row.rule} on ${row.hostname} (${row.site}), ${age(row.ageMinutes)} ago, filed under ${row.tactic.toLowerCase()}.`,
    ];
    if (e.sameAsset.length > 0)
      parts.push(
        `The same host carries ${e.sameAsset.length === 1 ? "one other alert" : `${e.sameAsset.length} other alerts`} (${e.sameAsset.map((r) => r.id).join(", ")}).`,
      );
    if (e.sameUser.length > 0)
      parts.push(
        `${row.user} appears on ${e.sameUser.length === 1 ? "one more alert" : `${e.sameUser.length} more alerts`} today${e.sameUser.some((r) => r.siteId !== row.siteId) ? ", not all at this site" : ""}.`,
      );
    if (e.shared.length > 0)
      parts.push(`An indicator here was also seen on ${e.shared.map((r) => r.id).join(", ")}.`);
    parts.push(
      row.severity === "critical" || e.openLinked.length >= 2
        ? `This is not noise: ${row.playbook}`
        : row.severity === "low"
          ? `Nothing links it to anything else. ${row.playbook}`
          : `Playbook: ${row.playbook}`,
    );
    return parts.join(" ");
  }, []);

  const ask = useCallback(
    (text: string) => {
      if (!selected || !enrichment) return;
      const id = String(turns.length + 1);
      const answer = /user|touch|else/i.test(text)
        ? enrichment.sameUser.length === 0
          ? `${selected.user} is on no other alert in the queue.`
          : `${selected.user} is on ${enrichment.sameUser.map((r) => `${r.id} (${r.rule}, ${r.site})`).join("; ")}. ${enrichment.sameUser.filter((r) => isOpen(r.status)).length} of those are still open.`
        : /indicator|seen|before/i.test(text)
          ? enrichment.shared.length === 0
            ? `None of ${selected.id}'s indicators appears on another alert in the queue.`
            : `${enrichment.shared.map((r) => r.id).join(", ")} share an indicator with ${selected.id}: ${selected.indicators.filter((i) => enrichment.shared.some((r) => r.indicators.includes(i))).join(", ")}.`
          : verdictFor(selected, enrichment);
      setTurns((prev) => [
        ...prev,
        { id: `u${id}`, from: "user", text },
        { id: `a${id}`, from: "assistant", text: answer },
      ]);
    },
    [selected, enrichment, turns.length, verdictFor],
  );

  return (
    <>
      <WorkspaceShell
        activeId="queue"
        dock={{
          title: selected ? selected.id : "Triage",
          description: selected
            ? selected.rule
            : "Select an alert to see what it saw, what it links to and what the agent found.",
          showLabel: "Show triage",
          hideLabel: "Hide triage",
          open: selected !== null,
          onOpenChange: (isDockOpen) => select(isDockOpen ? (open[0]?.id ?? null) : null),
          defaultWidth: 440,
          children:
            selected && enrichment ? (
              <div className="flex flex-col gap-6" data-testid="triage-dock">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={SEVERITY[selected.severity]} />
                  <StatusBadge status={STATUS[selected.status]} />
                  <Badge variant="outline">{selected.source}</Badge>
                </div>
                <Descriptions columns={2}>
                  <DescriptionsItem label="Asset">{selected.hostname}</DescriptionsItem>
                  <DescriptionsItem label="Site">{selected.site}</DescriptionsItem>
                  <DescriptionsItem label="User">{selected.user}</DescriptionsItem>
                  <DescriptionsItem label="Raised" numeric>
                    {age(selected.ageMinutes)} ago
                  </DescriptionsItem>
                  <DescriptionsItem label="Tactic">{selected.tactic}</DescriptionsItem>
                </Descriptions>
                <p className="text-body">{selected.summary}</p>

                <section aria-labelledby="dock-indicators" className="flex flex-col gap-2">
                  <h3 className="text-body font-semibold" id="dock-indicators">
                    Indicators
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {selected.indicators.map((indicator) => (
                      <li key={indicator}>
                        <Badge className="font-mono" variant="secondary">
                          {indicator}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>

                <section aria-labelledby="dock-linked" className="flex flex-col gap-2">
                  <h3 className="text-body font-semibold" id="dock-linked">
                    Linked alerts
                  </h3>
                  {linked.length === 0 ? (
                    <p className="text-body text-muted-foreground">
                      Nothing else in the queue shares this user or this asset.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {linked.map((row) => (
                        <li key={row.id}>
                          <button
                            className="focus-ring flex w-full items-start gap-2 rounded-md border-s-2 border-border ps-3 text-start"
                            onClick={() => select(row.id)}
                            type="button"
                          >
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-body">{row.rule}</span>
                              <span className="text-caption text-muted-foreground">
                                {row.id} · {row.hostname} · {age(row.ageMinutes)} ago
                              </span>
                            </span>
                            <StatusBadge hideIcon status={SEVERITY[row.severity]} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="dock-agent" className="flex flex-col gap-3">
                  <h3 className="flex items-center gap-2 text-body font-semibold" id="dock-agent">
                    <Sparkles aria-hidden="true" className="size-4 text-primary" />
                    Agent
                  </h3>
                  <Conversation className="max-h-96">
                    <ConversationContent>
                      <Message from="user">
                        <MessageContent>
                          <MessageResponse>{`Triage ${selected.id}.`}</MessageResponse>
                        </MessageContent>
                      </Message>
                      <Message from="assistant">
                        <MessageContent>
                          <Tool>
                            <ToolHeader
                              state="output-available"
                              summary={`${selected.indicators.length} indicators · ${enrichment.shared.length + enrichment.sameUser.length + enrichment.sameAsset.length} links`}
                              title="Enrich indicators"
                              toolName="enrichIndicators"
                              type="dynamic-tool"
                            />
                            <ToolContent>
                              <ToolInput
                                input={{ alert: selected.id, indicators: selected.indicators }}
                              />
                              <ToolOutput
                                errorText={undefined}
                                output={{
                                  sameUser: enrichment.sameUser.map((r) => r.id),
                                  sameAsset: enrichment.sameAsset.map((r) => r.id),
                                  sharedIndicator: enrichment.shared.map((r) => r.id),
                                }}
                              />
                            </ToolContent>
                          </Tool>
                          <MessageResponse>{verdictFor(selected, enrichment)}</MessageResponse>
                          {isOpen(selected.status) ? (
                            <Tool>
                              <ToolHeader
                                state="input-available"
                                summary="Waiting for your approval"
                                title="Isolate host"
                                toolName="isolateHost"
                                type="dynamic-tool"
                              />
                              <ToolContent>
                                <ToolInput
                                  input={{ asset: selected.hostname, reason: selected.id }}
                                />
                              </ToolContent>
                            </Tool>
                          ) : selected.status === "contained" ? (
                            <Tool>
                              <ToolHeader
                                state="output-available"
                                summary={`${selected.hostname} isolated`}
                                title="Isolate host"
                                toolName="isolateHost"
                                type="dynamic-tool"
                              />
                              <ToolContent>
                                <ToolInput
                                  input={{ asset: selected.hostname, reason: selected.id }}
                                />
                                <ToolOutput
                                  errorText={undefined}
                                  output={{ isolated: true, asset: selected.hostname }}
                                />
                              </ToolContent>
                            </Tool>
                          ) : null}
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
                  {isOpen(selected.status) ? (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => contain(selected)} size="sm">
                        <ShieldCheck aria-hidden="true" />
                        Contain asset
                      </Button>
                      <Button onClick={() => close(selected)} size="sm" variant="outline">
                        Close as benign
                      </Button>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-body text-muted-foreground">
                      <CircleCheck aria-hidden="true" className="size-4 text-success" />
                      {selected.status === "contained"
                        ? "Contained — image the host, then close."
                        : "Closed."}
                    </p>
                  )}
                  <Suggestions>
                    <Suggestion onClick={ask} suggestion="What else did this user touch?" />
                    <Suggestion onClick={ask} suggestion="Has this indicator been seen before?" />
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
                    status="Answers are computed from the queue; containment waits for you"
                  />
                </section>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">
                Select an alert in the queue or a point on the map to see what it saw, what it links
                to and what the agent found.
              </p>
            ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          {
            id: "1",
            fallback: "PT",
            text: "Pen-test lead confirmed this week's scan window: Thu 09:00–17:00 UTC",
            time: "25m ago",
          },
          {
            id: "2",
            fallback: "DP",
            text: "Data-protection officer asked for the claims-export access log",
            time: "1h ago",
          },
        ]}
        orgName="Aldermere Mutual"
        productName="Security operations"
        trail={[
          { href: "#queue", label: "Security operations" },
          { href: "#overview", label: "Queue" },
        ]}
        user={{ name: "Amara Okafor", email: "amara@aldermere-mutual.example" }}
      >
        <div className="@container mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold text-balance">
                {open.length} alerts open, {critical.length} critical
                {oldest >= 120 ? `, the oldest ${age(oldest)} old` : ""}
              </h1>
              <p className="text-body text-muted-foreground tabular-nums">
                {containedToday} contained and {closedToday} closed on this shift;{" "}
                {bySite[0]
                  ? `${bySite[0].site.name} carries the most open alerts (${bySite[0].count}).`
                  : "nothing is open."}
              </p>
            </div>
            <Badge variant="success">Live · {ALERTS_AS_OF}</Badge>
          </div>

          <MetricGrid columns={4}>
            <MetricCard
              description={`${critical.length} critical · ${open.filter((r) => r.severity === "high").length} high`}
              label="Open alerts"
              value={number.format(open.length)}
            />
            <MetricCard
              description="Open alerts older than two hours"
              label="Ageing"
              value={number.format(open.filter((r) => r.ageMinutes >= 120).length)}
            />
            <MetricCard
              description="Hosts isolated this shift"
              label="Contained"
              value={number.format(containedToday)}
            />
            <MetricCard
              description="Open alerts filed under credential access or C2"
              label="Active intrusion signals"
              value={number.format(
                open.filter((r) => /credential access|command and control/i.test(r.tactic)).length,
              )}
            />
          </MetricGrid>

          <div className="grid gap-6 @5xl:grid-cols-5" id="queue">
            <section
              aria-labelledby="queue-title"
              className="flex min-w-0 flex-col gap-3 @5xl:col-span-3"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-subtitle font-semibold" id="queue-title">
                  The queue, worst first
                </h2>
                <p className="text-meta text-muted-foreground">
                  Open alerts lead, by severity then by age. Select one to triage it beside the
                  queue.
                </p>
              </div>
              <FilterBar>
                <SearchInput
                  containerClassName="w-64"
                  label="Search the queue"
                  onValueChange={setQuery}
                  placeholder="Rule, host, user…"
                  value={query}
                />
                <FacetFilter
                  onSelectedChange={setSeverities}
                  options={ALERT_SEVERITIES.map((s) => ({ label: s, value: s }))}
                  selected={severities}
                  title="Severity"
                />
                <FacetFilter
                  onSelectedChange={setSources}
                  options={ALERT_SOURCES.map((s) => ({ label: s, value: s }))}
                  selected={sources}
                  title="Source"
                />
              </FilterBar>
              <Card className="p-0">
                <CardContent className="p-0">
                  <DataTable
                    caption="Alert queue"
                    columns={columns}
                    data={filtered}
                    getRowId={(row) => row.id}
                    onRowClick={(row) => select(row.original.id)}
                    rowActionLabel={(row) => `Triage ${row.original.id}`}
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
              <div className="flex flex-col gap-1">
                <h2 className="text-subtitle font-semibold" id="map-title">
                  Where the open alerts fire
                </h2>
                <p className="text-meta text-muted-foreground">
                  One point per open alert, clustered by site. Open a cluster to reach a point;
                  select a point to triage it.
                </p>
              </div>
              <div className="relative min-h-80 flex-1 overflow-hidden rounded-lg border border-border bg-card">
                <MapCanvas blank={blankMap} center={[10, 30]} zoom={0.9}>
                  <MapClusterLayer
                    clusterRadius={40}
                    clusterThresholds={[3, 6]}
                    data={points}
                    onPointClick={(feature) => select(feature.properties.alertId)}
                  />
                  <MapControls position="bottom-right" />
                </MapCanvas>
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label="Open alerts by site">
                {bySite.map(({ site, count }) => (
                  <li key={site.id}>
                    <Badge variant="outline">
                      {site.name} · {count}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="incidents-title" className="flex flex-col gap-3" id="incidents">
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="incidents-title">
                90 days of incidents, by the source that raised them
              </h2>
              <p className="text-meta text-muted-foreground">
                Select a day or a source in either chart; the table and the KPIs follow.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <IncidentExplorer
                  incidents={securityIncidents}
                  locale={locale}
                  services={sourceNames}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
