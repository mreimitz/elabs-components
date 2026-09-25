/**
 * Orders with line items — a fulfilment lead works the order queue.
 *
 * What it shows a copier: master / detail and the filter UI working together.
 * Every order row expands (chevron, or Enter on the row) into `renderDetail`:
 * its line items as a compact `DataTable`, the delivery details and the actions
 * that belong to one order. Floating filters sit under the headers (type
 * `>500` under Total, pick statuses from a value list with counts under Status)
 * and every active filter shows as a removable chip. Status is a badge with an
 * icon AND a word, so it still reads in greyscale.
 */
"use client";

import { useMemo, type ComponentType } from "react";
import { CircleCheck, Clock, Mail, PackageCheck, Truck, Undo2 } from "lucide-react";
import { DataGrid, DataTable, type ColumnDef, type Row } from "@elabs-ai/components-data";
import { Badge, Button, toast } from "@elabs-ai/components-ui";
import { makeOrders, type Order, type OrderLine, type OrderStatus } from "./data/orders";

const STATUS: Record<
  OrderStatus,
  {
    variant: "secondary" | "info" | "warning" | "success" | "outline";
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  }
> = {
  Pending: { variant: "warning", icon: Clock },
  Packed: { variant: "secondary", icon: PackageCheck },
  Shipped: { variant: "info", icon: Truck },
  Delivered: { variant: "success", icon: CircleCheck },
  Returned: { variant: "outline", icon: Undo2 },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { variant, icon: Icon } = STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden={true} className="size-3" />
      {status}
    </Badge>
  );
}

const eur = { style: "currency", currency: "EUR", abbreviate: false, decimals: 2 } as const;

const COLUMNS: ColumnDef<Order>[] = [
  { accessorKey: "id", header: "Order", size: 120 },
  { accessorKey: "placed", header: "Placed", size: 120 },
  { accessorKey: "customer", header: "Customer", size: 170, meta: { filter: "text" } },
  { accessorKey: "channel", header: "Channel", size: 130, meta: { filter: "set" } },
  {
    accessorKey: "status",
    header: "Status",
    size: 130,
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    meta: { filter: "set" },
  },
  {
    id: "items",
    header: "Items",
    size: 90,
    accessorFn: (row) => row.lines.reduce((sum, line) => sum + line.quantity, 0),
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
  },
  { accessorKey: "city", header: "Ship to", size: 120, meta: { filter: "set" } },
  {
    accessorKey: "total",
    header: "Total",
    size: 130,
    meta: { numeric: true, format: eur, filter: "number" },
  },
];

const LINE_COLUMNS: ColumnDef<OrderLine>[] = [
  { accessorKey: "sku", header: "SKU", size: 110 },
  { accessorKey: "product", header: "Product" },
  {
    accessorKey: "quantity",
    header: "Qty",
    size: 70,
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
  },
  { accessorKey: "unitPrice", header: "Unit", size: 110, meta: { numeric: true, format: eur } },
  {
    id: "lineTotal",
    header: "Line total",
    size: 120,
    accessorFn: (line) => line.quantity * line.unitPrice,
    meta: { numeric: true, format: eur },
  },
];

function OrderDetail({ order }: { order: Order }) {
  return (
    <div className="grid gap-4 py-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <DataTable
        caption={`Line items of ${order.id}`}
        columns={LINE_COLUMNS}
        data={order.lines}
        density="compact"
        getRowId={(line, i) => `${line.sku}-${i}`}
      />
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="min-w-0 truncate">{order.email}</dd>
          <dt className="text-muted-foreground">Carrier</dt>
          <dd>{order.carrier}</dd>
          <dt className="text-muted-foreground">Ship to</dt>
          <dd>{order.city}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <OrderStatusBadge status={order.status} />
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => toast.success(`Confirmation re-sent to ${order.email}`)}
            size="sm"
            variant="outline"
          >
            <Mail aria-hidden="true" />
            Resend confirmation
          </Button>
          {order.status === "Pending" ? (
            <Button
              onClick={() => toast.success(`${order.id} sent to the packing queue`)}
              size="sm"
            >
              <PackageCheck aria-hidden="true" />
              Release to packing
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export interface OrdersDetailProps {
  orders?: Order[];
  /** Order id opened on first render. */
  defaultExpandedId?: string;
}

export function OrdersDetail({ orders, defaultExpandedId }: OrdersDetailProps) {
  const data = useMemo(() => orders ?? makeOrders(), [orders]);
  const open = defaultExpandedId ?? data[0]?.id;
  const pending = data.filter((order) => order.status === "Pending").length;

  return (
    <section
      aria-labelledby="orders-detail-title"
      className="flex flex-col gap-3"
      data-slot="orders-detail"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-subtitle font-semibold" id="orders-detail-title">
          Orders
        </h2>
        <p className="text-meta text-muted-foreground tabular-nums">
          {data.length} orders in the last 45 days · {pending} waiting to be packed. Open a row for
          its line items.
        </p>
      </div>
      <DataGrid
        caption="Customer orders"
        columns={COLUMNS}
        data={data}
        exportFileName="orders"
        floatingFilters
        getRowId={(order) => order.id}
        // Detail rows are not virtualized, so a long queue pages instead.
        enablePagination
        initialView={{ expanded: open ? { [open]: true } : {} }}
        pageSize={15}
        renderDetail={(row: Row<Order>) => <OrderDetail order={row.original} />}
      />
    </section>
  );
}
