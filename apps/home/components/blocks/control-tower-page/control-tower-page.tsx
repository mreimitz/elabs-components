// registry: control-tower-page — copied 2026-09-19
/**
 * Logistics control tower — the screen an operations team keeps open all day.
 *
 * What it shows a copier: a status strip whose words are computed from the exceptions, the
 * two map blocks behind tabs (`geo-network-map-01`, `geo-fleet-tracker-01`), an exceptions
 * `DataTable` sorted by what is at stake, and a dock that a ROW CLICK summons — the selected
 * shipment's promise, its journey as a `Timeline`, and the recommended next step with its
 * two decisions. The dock is controlled here, which is the pattern for any master-detail
 * screen built on the workspace shell.
 */
"use client";

import { useMemo, useState } from "react";
import { Boxes, Globe, LayoutDashboard, ShieldAlert, Ship, Truck, Warehouse } from "lucide-react";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { GeoFleetTracker } from "../geo-fleet-tracker-01/geo-fleet-tracker";
import { GeoNetworkMap } from "../geo-network-map-01/geo-network-map";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";
import { shipmentExceptions, type ExceptionState, type ShipmentException } from "./data/exceptions";

const STATE_BADGE: Record<ExceptionState, "destructive" | "warning" | "success"> = {
  open: "destructive",
  mitigating: "warning",
  resolved: "success",
};

export interface ControlTowerPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  exceptions?: ShipmentException[];
  locale?: string;
}

export default function ControlTowerPage({
  frame = "viewport",
  exceptions = shipmentExceptions,
  locale = "en-US",
}: ControlTowerPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, ExceptionState>>({});
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const rows = useMemo(
    () =>
      exceptions
        .map((row) => ({ ...row, state: states[row.id] ?? row.state }))
        .sort((a, b) => a.hoursToPromise - b.hoursToPromise),
    [exceptions, states],
  );
  const live = rows.filter((row) => row.state !== "resolved");
  const missed = live.filter((row) => row.hoursToPromise < 0);
  const atStake = live.reduce((sum, row) => sum + row.value, 0);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Control tower",
      items: [
        { id: "tower", label: "Overview", href: "#tower", icon: LayoutDashboard },
        {
          id: "exceptions",
          label: "Exceptions",
          href: "#exceptions",
          icon: ShieldAlert,
          badge: String(live.length),
        },
        { id: "shipments", label: "Shipments", href: "#shipments", icon: Ship },
        { id: "fleet", label: "Fleet", href: "#fleet", icon: Truck },
      ],
    },
    {
      label: "Network",
      items: [
        { id: "lanes", label: "Lanes", href: "#lanes", icon: Globe },
        { id: "depots", label: "Depots", href: "#depots", icon: Warehouse },
        { id: "inventory", label: "Inventory", href: "#inventory", icon: Boxes },
      ],
    },
  ];

  const columns = useMemo<ColumnDef<ShipmentException>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Shipment",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{row.original.customer}</span>
            <span className="text-caption text-muted-foreground">
              {row.original.id} · {row.original.lane}
            </span>
          </div>
        ),
      },
      { accessorKey: "cause", header: "Cause" },
      {
        accessorKey: "hoursToPromise",
        header: "Promise",
        cell: ({ row }) =>
          row.original.state === "resolved" ? (
            <span className="text-muted-foreground">on schedule</span>
          ) : row.original.hoursToPromise < 0 ? (
            <Badge variant="destructive">missed by {-row.original.hoursToPromise} h</Badge>
          ) : (
            <span className="tabular-nums">{row.original.hoursToPromise} h left</span>
          ),
      },
      {
        accessorKey: "slipHours",
        header: "Behind",
        cell: ({ row }) => <span className="tabular-nums">{row.original.slipHours} h</span>,
      },
      {
        accessorKey: "value",
        header: "At stake",
        cell: ({ row }) => (
          <span className="tabular-nums">{money.format(row.original.value)}k</span>
        ),
      },
      {
        accessorKey: "state",
        header: "State",
        cell: ({ row }) => (
          <Badge variant={STATE_BADGE[row.original.state]}>{row.original.state}</Badge>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const settle = (row: ShipmentException, state: ExceptionState, message: string) => {
    setStates((prev) => ({ ...prev, [row.id]: state }));
    toast.success(message, { description: `${row.id} · ${row.customer}` });
  };

  return (
    <>
      <WorkspaceShell
        activeId="tower"
        dock={{
          title: selected ? selected.customer : "Shipment",
          description: selected
            ? `${selected.id} · ${selected.lane}`
            : "Select an exception to see its journey and the recommended next step.",
          showLabel: "Show shipment details",
          hideLabel: "Hide shipment details",
          open: selected !== null,
          onOpenChange: (open) => {
            if (!open) setSelectedId(null);
            else setSelectedId(rows[0]?.id ?? null);
          },
          defaultWidth: 400,
          children: selected ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATE_BADGE[selected.state]}>{selected.state}</Badge>
                <Badge variant="outline">{selected.cause}</Badge>
              </div>
              <Descriptions columns={2}>
                <DescriptionsItem label="Promised">{selected.promised}</DescriptionsItem>
                <DescriptionsItem label="Estimated">{selected.eta}</DescriptionsItem>
                <DescriptionsItem label="Carrier">{selected.carrier}</DescriptionsItem>
                <DescriptionsItem label="Containers" numeric>
                  {selected.containers}
                </DescriptionsItem>
                <DescriptionsItem label="At stake" numeric>
                  {money.format(selected.value)}k
                </DescriptionsItem>
                <DescriptionsItem label="Behind" numeric>
                  {selected.slipHours} h
                </DescriptionsItem>
              </Descriptions>
              <section aria-labelledby="dock-next" className="flex flex-col gap-2">
                <h3 className="text-body font-semibold" id="dock-next">
                  Recommended next step
                </h3>
                <p className="border-s-2 border-primary ps-3 text-body text-muted-foreground">
                  {selected.recommendation}
                </p>
                {selected.state === "resolved" ? null : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => settle(selected, "mitigating", "Mitigation started")}
                      size="sm"
                    >
                      Start mitigation
                    </Button>
                    <Button
                      onClick={() => settle(selected, "resolved", "Exception closed")}
                      size="sm"
                      variant="outline"
                    >
                      Mark resolved
                    </Button>
                  </div>
                )}
              </section>
              <section aria-labelledby="dock-journey" className="flex flex-col gap-2">
                <h3 className="text-body font-semibold" id="dock-journey">
                  Journey
                </h3>
                <Timeline
                  items={selected.milestones.map((step) => ({
                    title: step.title,
                    description: step.detail,
                    status: step.status,
                    timestamp: step.time,
                  }))}
                />
              </section>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              Select an exception in the table to see its journey and the recommended next step.
            </p>
          ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          {
            id: "1",
            fallback: "AC",
            text: "Atlas Cargo moved the Long Beach berth estimate again",
            time: "8m ago",
          },
          {
            id: "2",
            fallback: "NF",
            text: "Norden Freight re-filed the Halden Pharma certificate",
            time: "42m ago",
          },
        ]}
        orgName="Acme Logistics"
        productName="Tower"
        trail={[
          { href: "#tower", label: "Control tower" },
          { href: "#overview", label: "Overview" },
        ]}
        user={{ name: "Ravi Menon", email: "ravi@acme-logistics.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold text-balance">
                {live.length} exceptions are open
                {missed.length > 0
                  ? `, and ${missed.length === 1 ? "one has" : `${missed.length} have`} already missed the promise`
                  : ", and every promise still holds"}
              </h1>
              <p className="text-body text-muted-foreground tabular-nums">
                {money.format(atStake)}k of goods at stake across{" "}
                {live.reduce((sum, row) => sum + row.containers, 0)} containers.
              </p>
            </div>
            <Badge variant="success">Live · updated 09:41</Badge>
          </div>

          <Tabs defaultValue="network">
            <TabsList>
              <TabsTrigger value="network">Long haul</TabsTrigger>
              <TabsTrigger value="fleet">Last mile</TabsTrigger>
            </TabsList>
            <TabsContent className="h-128" value="network">
              <GeoNetworkMap locale={locale} />
            </TabsContent>
            <TabsContent className="h-128" value="fleet">
              <GeoFleetTracker />
            </TabsContent>
          </Tabs>

          <section
            aria-labelledby="exceptions-title"
            className="flex flex-col gap-3"
            id="exceptions"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="exceptions-title">
                Exceptions, closest promise first
              </h2>
              <p className="text-meta text-muted-foreground">
                Select a row to open the shipment beside the table — the map and the list stay where
                they are.
              </p>
            </div>
            <Card className="p-0">
              <CardContent className="p-0">
                <DataTable
                  caption="Shipment exceptions"
                  columns={columns}
                  data={rows}
                  getRowId={(row) => row.id}
                  onRowClick={(row) => setSelectedId(row.original.id)}
                  rowActionLabel={(row) => `Open ${row.original.id}, ${row.original.customer}`}
                  rowClassName={(row) => (row.original.id === selectedId ? "bg-accent" : "")}
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
