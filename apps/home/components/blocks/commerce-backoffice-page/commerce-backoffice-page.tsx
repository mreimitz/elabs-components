// registry: commerce-backoffice-page — copied 2026-09-25
/**
 * Commerce back office — an operations manager runs orders, stock and prices
 * for a furniture web shop.
 *
 * What it shows a copier: three DataGrid jobs behind one set of tabs in the
 * workspace shell. Orders is the `grid-orders-detail-01` block (master /
 * detail, floating filters). Replenishment is built here: stock lines grouped
 * by warehouse with sums, a computed "order now" flag (icon + words, never
 * colour alone) and an editable order quantity — type it, paste a column from
 * a planning sheet, or fill it down with Ctrl/⌘+D; "Fill suggested" writes the
 * suggestion into every flagged line in one undoable batch. Prices is the
 * `grid-price-editor-01` block.
 */
"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Sparkles,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { DataGrid, applyCellChanges, type ColumnDef } from "@elabs-ai/components-data";
import {
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { OrdersDetail } from "../grid-orders-detail-01/orders-detail";
import { PriceEditor } from "../grid-price-editor-01/price-editor";
import { WorkspaceAssistant } from "../workspace-shell/workspace-assistant";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";
import { coverDays, makeStock, needsOrder, suggestedOrder, type StockLine } from "./data/stock";

const NAV: WorkspaceNavGroup[] = [
  {
    label: "Store",
    items: [
      { id: "overview", label: "Overview", href: "#overview", icon: LayoutDashboard },
      { id: "operations", label: "Operations", href: "#operations", icon: ClipboardList },
      { id: "catalogue", label: "Catalogue", href: "#catalogue", icon: Tags },
      { id: "customers", label: "Customers", href: "#customers", icon: Users },
    ],
  },
  {
    label: "Supply",
    items: [
      { id: "stock", label: "Stock", href: "#stock", icon: Boxes },
      { id: "suppliers", label: "Suppliers", href: "#suppliers", icon: Truck },
    ],
  },
];

const units = { abbreviate: false, decimals: 0 } as const;

const STOCK_COLUMNS: ColumnDef<StockLine>[] = [
  { accessorKey: "warehouse", header: "Warehouse", size: 150, meta: { filter: "set" } },
  { accessorKey: "sku", header: "SKU", size: 110 },
  { accessorKey: "product", header: "Product", size: 170, meta: { filter: "set" } },
  {
    accessorKey: "onHand",
    header: "On hand",
    size: 110,
    meta: { numeric: true, format: units, aggregate: "sum" },
  },
  {
    accessorKey: "dailySales",
    header: "Sold / day",
    size: 110,
    meta: { numeric: true, format: { abbreviate: false, decimals: 1 }, aggregate: "sum" },
  },
  {
    accessorKey: "leadTime",
    header: "Lead time",
    size: 110,
    meta: { numeric: true, format: { ...units, suffix: " d" } },
  },
  {
    id: "cover",
    header: "Cover",
    size: 170,
    accessorFn: (line) => Math.round(coverDays(line)),
    cell: ({ row, getValue }) =>
      row.getIsGrouped() ? null : (
        <span className="flex items-center justify-end gap-2 tabular-nums">
          {needsOrder(row.original) ? (
            <Badge variant="warning">
              <AlertTriangle aria-hidden="true" className="size-3" />
              Order now
            </Badge>
          ) : null}
          {`${getValue<number>()} d`}
        </span>
      ),
    meta: { numeric: true, filter: "number" },
  },
  {
    id: "suggested",
    header: "Suggested",
    size: 120,
    accessorFn: suggestedOrder,
    meta: { numeric: true, format: units },
  },
  {
    accessorKey: "reorder",
    header: "Order qty",
    size: 120,
    meta: {
      numeric: true,
      format: units,
      aggregate: "sum",
      editable: true,
      validate: (value) => {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) return "Enter a whole number of units.";
        if (n % 5 !== 0) return "Order in cases of 5.";
        return null;
      },
    },
  },
];

function Replenishment() {
  const [stock, setStock] = useState(makeStock);
  const flagged = stock.filter(needsOrder);
  const ordered = stock.filter((line) => line.reorder > 0);
  const totalUnits = ordered.reduce((sum, line) => sum + line.reorder, 0);

  const fillSuggested = () => {
    const before = stock;
    setStock((current) =>
      current.map((line) => (needsOrder(line) ? { ...line, reorder: suggestedOrder(line) } : line)),
    );
    toast.success(`Suggested quantities filled for ${flagged.length} lines`, {
      action: { label: "Undo", onClick: () => setStock(before) },
    });
  };

  return (
    <section aria-labelledby="stock-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-subtitle font-semibold" id="stock-title">
            Replenishment
          </h2>
          <p className="text-meta text-muted-foreground tabular-nums">
            {flagged.length === 1 ? "1 line runs" : `${flagged.length} lines run`} out before a new
            delivery could land. Type, paste or fill down (Ctrl/⌘+D) the order quantity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={flagged.length === 0}
            onClick={fillSuggested}
            size="sm"
            variant="outline"
          >
            <Sparkles aria-hidden="true" />
            Fill suggested
          </Button>
          <Button
            disabled={ordered.length === 0}
            onClick={() => {
              const warehouses = new Set(ordered.map((line) => line.warehouse)).size;
              toast.success(
                `${warehouses} purchase order${warehouses === 1 ? "" : "s"} drafted — ${totalUnits.toLocaleString("en-US")} units`,
              );
              setStock((current) => current.map((line) => ({ ...line, reorder: 0 })));
            }}
            size="sm"
          >
            <Truck aria-hidden="true" />
            Draft purchase orders
          </Button>
        </div>
      </div>
      <DataGrid
        caption="Stock by warehouse with order quantities"
        columns={STOCK_COLUMNS}
        data={stock}
        enableGrouping
        exportFileName="replenishment"
        getRowId={(line) => line.id}
        initialView={{ grouping: ["warehouse"], expanded: true }}
        onCellEdit={(changes) =>
          setStock((current) => applyCellChanges(current, changes, (line) => line.id))
        }
        rowClassName={(row) => (row.original.reorder > 0 ? "bg-info/5" : "")}
        showTotals
      />
    </section>
  );
}

export interface CommerceBackofficePageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  /** Tab open on first render. */
  defaultTab?: "orders" | "stock" | "prices";
}

export default function CommerceBackofficePage({
  frame = "viewport",
  defaultTab = "orders",
}: CommerceBackofficePageProps) {
  const [tab, setTab] = useState<string>(defaultTab);
  const lowStock = useMemo(() => makeStock().filter(needsOrder), []);

  return (
    <>
      <WorkspaceShell
        activeId="operations"
        dock={{
          title: "Ops assistant",
          description: "Reads orders, stock and prices on this screen.",
          showLabel: "Show the ops assistant",
          hideLabel: "Hide the ops assistant",
          defaultOpen: false,
          defaultWidth: 380,
          children: (
            <WorkspaceAssistant
              brief={[
                {
                  title: `${lowStock.length} stock lines need an order`,
                  body: `${lowStock
                    .slice(0, 3)
                    .map((line) => `${line.product} (${line.warehouse})`)
                    .join(", ")}${lowStock.length > 3 ? " and more" : ""}.`,
                },
                {
                  title: "Autumn price list is a draft",
                  body: "Publish it before 1 October so the web shop picks it up overnight.",
                },
              ]}
              prompts={[
                {
                  prompt: "Which orders are late?",
                  answer:
                    "Four orders placed more than three days ago are still **Pending** — all Marketplace orders to Milan and Lyon. The DPD pick-up there was missed on Tuesday.",
                },
                {
                  prompt: "Is the chair discount safe?",
                  answer:
                    "A 15 % discount on the **Task chair** leaves a 21 % margin — above the 18 % floor, but it is the lowest in Seating. Hold it at 12 % if the Rotterdam stock can’t cover the demand spike.",
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
            fallback: "RB",
            text: "Rotterdam DC confirmed 3 inbound deliveries",
            time: "40m ago",
          },
          {
            id: "2",
            fallback: "JK",
            text: "Jonas Keller returned ORD-58233",
            time: "3h ago",
          },
        ]}
        orgName="Nordform"
        productName="Back office"
        trail={[
          { href: "#store", label: "Store" },
          { href: "#operations", label: "Operations" },
        ]}
        user={{ name: "Elif Aydın", email: "elif@nordform.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-semibold">Operations</h1>
            <p className="text-body text-muted-foreground">
              Work the order queue, keep three warehouses stocked and get the autumn prices out.
            </p>
          </div>
          <Tabs onValueChange={setTab} value={tab}>
            <TabsList>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="stock">{`Replenishment (${lowStock.length})`}</TabsTrigger>
              <TabsTrigger value="prices">Prices</TabsTrigger>
            </TabsList>
            <TabsContent className="pt-4" value="orders">
              <OrdersDetail />
            </TabsContent>
            <TabsContent className="pt-4" value="stock">
              <Replenishment />
            </TabsContent>
            <TabsContent className="pt-4" value="prices">
              <PriceEditor withToaster={false} />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
