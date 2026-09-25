"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  FileText,
  type LucideIcon,
  PackageCheck,
  PackageSearch,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  Undo2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  StatePanel,
  Timeline,
  type TimelineEntry,
} from "@elabs-ai/components-ui";
import {
  formatMoney,
  ProductArt,
  products as catalog,
  type Product,
} from "@/components/commerce-parts/catalog";

export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled" | "returned";

export interface OrderLine {
  product: Product;
  quantity: number;
  /** Unit price at the time of the order. */
  price: number;
  variant?: string;
}

export interface OrderStep {
  id: "placed" | "packed" | "shipped" | "delivered";
  /** ISO date-time when the step happened; missing = not yet. */
  at?: string;
  detail?: string;
}

export interface Order {
  id: string;
  number: string;
  /** ISO date-time the order was placed. */
  placedAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  shipping: number;
  /** Carrier and tracking code, once shipped. */
  tracking?: { carrier: string; code: string };
  steps: OrderStep[];
  /** Why it was cancelled or returned, when it was. */
  note?: string;
}

export interface OrderHistoryProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Heading level of the title — `"h1"` when this block titles the page, `"h2"` inside a page that has one. */
  titleAs?: "h1" | "h2";
  orders?: Order[];
  /** ISO date-time “today”, the anchor for the period filter. */
  now?: string;
  onTrack?: (order: Order) => void;
  onReorder?: (order: Order) => void;
  onInvoice?: (order: Order) => void;
  onShop?: () => void;
  locale?: string;
  currency?: string;
  className?: string;
}

type Period = "30d" | "3m" | "6m" | "1y" | "all";

const PERIODS: { id: Period; label: string; days: number | null }[] = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "3m", label: "Last 3 months", days: 91 },
  { id: "6m", label: "Last 6 months", days: 182 },
  { id: "1y", label: "Last year", days: 365 },
  { id: "all", label: "All time", days: null },
];

const STATUS: Record<
  OrderStatus,
  {
    label: string;
    icon: LucideIcon;
    variant: "info" | "warning" | "success" | "secondary" | "destructive";
  }
> = {
  processing: { label: "Being packed", icon: PackageSearch, variant: "warning" },
  shipped: { label: "On its way", icon: Truck, variant: "info" },
  delivered: { label: "Delivered", icon: CheckCircle2, variant: "success" },
  cancelled: { label: "Cancelled", icon: Ban, variant: "secondary" },
  returned: { label: "Returned", icon: Undo2, variant: "secondary" },
};

const STEP_LABEL: Record<OrderStep["id"], string> = {
  placed: "Order placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

const byId = (id: string): Product => {
  const found = catalog.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown sample product “${id}”`);
  return found;
};

const DEFAULT_ORDERS: Order[] = [
  {
    id: "o-10482",
    number: "10482",
    placedAt: "2026-09-21T10:14:00Z",
    status: "shipped",
    lines: [
      { product: byId("trail-40"), quantity: 1, price: 189, variant: "Moss" },
      { product: byId("beam-400"), quantity: 2, price: 59, variant: "Black" },
    ],
    shipping: 0,
    tracking: { carrier: "Pelican Lines", code: "PL 4471 2093 88" },
    steps: [
      { id: "placed", at: "2026-09-21T10:14:00Z", detail: "Paid by card ending 4421" },
      { id: "packed", at: "2026-09-22T07:50:00Z", detail: "Depot Leipzig · 2 parcels" },
      { id: "shipped", at: "2026-09-22T16:05:00Z", detail: "Handed to Pelican Lines" },
      { id: "delivered", detail: "Expected Thursday, before 18:00" },
    ],
  },
  {
    id: "o-10377",
    number: "10377",
    placedAt: "2026-09-04T18:32:00Z",
    status: "delivered",
    lines: [{ product: byId("summit-mid"), quantity: 1, price: 215, variant: "Bark · 43" }],
    shipping: 6.9,
    tracking: { carrier: "Pelican Lines", code: "PL 4469 8810 02" },
    steps: [
      { id: "placed", at: "2026-09-04T18:32:00Z" },
      { id: "packed", at: "2026-09-05T08:12:00Z" },
      { id: "shipped", at: "2026-09-05T15:40:00Z" },
      { id: "delivered", at: "2026-09-08T11:27:00Z", detail: "Left with a neighbour, no. 14" },
    ],
  },
  {
    id: "o-10291",
    number: "10291",
    placedAt: "2026-08-19T09:05:00Z",
    status: "processing",
    lines: [{ product: byId("ridge-2"), quantity: 1, price: 429, variant: "Pine" }],
    shipping: 0,
    steps: [
      { id: "placed", at: "2026-08-19T09:05:00Z", detail: "Pre-order, ships when stock lands" },
      { id: "packed", detail: "Stock arrives 30 Sep" },
      { id: "shipped" },
      { id: "delivered" },
    ],
  },
  {
    id: "o-09944",
    number: "09944",
    placedAt: "2026-06-27T13:48:00Z",
    status: "returned",
    lines: [{ product: byId("alti-watch"), quantity: 1, price: 349, variant: "Olive" }],
    shipping: 0,
    note: "Returned 6 Jul · refunded to the original card",
    steps: [
      { id: "placed", at: "2026-06-27T13:48:00Z" },
      { id: "packed", at: "2026-06-28T07:30:00Z" },
      { id: "shipped", at: "2026-06-28T14:20:00Z" },
      { id: "delivered", at: "2026-07-01T10:02:00Z" },
    ],
  },
  {
    id: "o-09810",
    number: "09810",
    placedAt: "2026-05-30T20:11:00Z",
    status: "delivered",
    lines: [
      { product: byId("brew-kit"), quantity: 2, price: 74, variant: "Steel" },
      { product: byId("beam-400"), quantity: 1, price: 69, variant: "Black" },
    ],
    shipping: 6.9,
    steps: [
      { id: "placed", at: "2026-05-30T20:11:00Z" },
      { id: "packed", at: "2026-05-31T09:00:00Z" },
      { id: "shipped", at: "2026-05-31T16:45:00Z" },
      { id: "delivered", at: "2026-06-03T12:15:00Z" },
    ],
  },
  {
    id: "o-09502",
    number: "09502",
    placedAt: "2026-03-12T11:20:00Z",
    status: "cancelled",
    lines: [{ product: byId("trail-40"), quantity: 1, price: 229, variant: "Slate" }],
    shipping: 0,
    note: "Cancelled 12 Mar by you, before packing · nothing was charged",
    steps: [
      { id: "placed", at: "2026-03-12T11:20:00Z" },
      { id: "packed" },
      { id: "shipped" },
      { id: "delivered" },
    ],
  },
];

const orderTotal = (order: Order) =>
  order.lines.reduce((sum, line) => sum + line.price * line.quantity, 0) + order.shipping;

/**
 * Order history — every order as a row that opens in place: what was in it, where it is
 * on the placed → packed → shipped → delivered rail, and the three things a customer
 * actually does next. Status, period and search filters work together and the empty
 * result says which filter to loosen.
 */
export function OrderHistory({
  title = "Your orders",
  titleAs: TitleTag = "h1",
  description = "Everything you bought, newest first. Open an order to see where it is.",
  orders = DEFAULT_ORDERS,
  now = "2026-09-25T12:00:00Z",
  onTrack,
  onReorder,
  onInvoice,
  onShop,
  locale = "en-US",
  currency = "EUR",
  className,
}: OrderHistoryProps) {
  const searchId = useId();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [period, setPeriod] = useState<Period>("6m");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(orders[0]?.id ?? null);
  const [reordered, setReordered] = useState<string | null>(null);

  const longDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const money = (value: number) => formatMoney(value, locale, currency);

  const shown = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)?.days ?? null;
    const floor = days === null ? 0 : new Date(now).getTime() - days * 86_400_000;
    const q = query.trim().toLowerCase();
    return [...orders]
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .filter((order) => status === "all" || order.status === status)
      .filter((order) => new Date(order.placedAt).getTime() >= floor)
      .filter(
        (order) =>
          q === "" ||
          order.number.includes(q) ||
          order.lines.some((line) => line.product.name.toLowerCase().includes(q)),
      );
  }, [now, orders, period, query, status]);

  const filtered = status !== "all" || period !== "all" || query.trim() !== "";

  return (
    <section
      className={cn("@container mx-auto flex w-full max-w-4xl flex-col gap-6", className)}
      data-slot="order-history"
    >
      <header className="flex flex-col gap-1">
        <TitleTag className="text-title font-semibold">{title}</TitleTag>
        <p className="text-body text-muted-foreground">{description}</p>
      </header>

      <div
        className="grid grid-cols-1 gap-3 @2xl:grid-cols-[minmax(0,1fr)_auto_auto]"
        data-slot="order-history-filters"
      >
        <div className="relative">
          <Label className="sr-only" htmlFor={searchId}>
            Search orders
          </Label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="ps-9"
            id={searchId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order number or product"
            type="search"
            value={query}
          />
        </div>
        <Select onValueChange={(value) => setStatus(value as OrderStatus | "all")} value={status}>
          <SelectTrigger aria-label="Status" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {(Object.keys(STATUS) as OrderStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATUS[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => setPeriod(value as Period)} value={period}>
          <SelectTrigger aria-label="Period" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p aria-live="polite" className="text-caption text-muted-foreground tabular-nums">
        {shown.length === orders.length
          ? `${orders.length} orders`
          : `${shown.length} of ${orders.length} orders`}
      </p>

      {shown.length === 0 ? (
        <Card className="py-6">
          <StatePanel
            actions={
              filtered ? (
                <Button
                  onClick={() => {
                    setStatus("all");
                    setPeriod("all");
                    setQuery("");
                  }}
                  variant="outline"
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={onShop}>Start shopping</Button>
              )
            }
            description={
              filtered
                ? "Nothing matches those filters. Try a longer period or any status."
                : "When you buy something it shows up here with its tracking."
            }
            icon={<ShoppingBag aria-hidden="true" />}
            kind="empty"
            title={filtered ? "No orders match" : "No orders yet"}
            titleAs="h2"
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" data-slot="order-history-list">
          {shown.map((order) => {
            const meta = STATUS[order.status];
            const StatusIcon = meta.icon;
            const isOpen = open === order.id;
            const items = order.lines.reduce((sum, line) => sum + line.quantity, 0);
            const timeline: TimelineEntry[] = order.steps.map((step, index) => {
              const done = step.at !== undefined;
              const next = order.steps[index + 1];
              const active =
                done &&
                (next === undefined || next.at === undefined) &&
                order.status !== "delivered";
              return {
                title: STEP_LABEL[step.id],
                description: step.detail,
                status: done ? (active ? "active" : "done") : "pending",
                timestamp: step.at ? time.format(new Date(step.at)) : undefined,
              };
            });
            return (
              <li key={order.id}>
                <Collapsible onOpenChange={(next) => setOpen(next ? order.id : null)} open={isOpen}>
                  <Card className={cn("overflow-hidden p-0", isOpen && "shadow-md")}>
                    <CollapsibleTrigger
                      className="focus-ring-inset flex w-full flex-wrap items-center gap-x-4 gap-y-3 p-4 text-start hover:bg-accent/50"
                      data-slot="order-history-row"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-body font-semibold tabular-nums">
                            Order #{order.number}
                          </span>
                          <Badge variant={meta.variant}>
                            <StatusIcon aria-hidden="true" />
                            {meta.label}
                          </Badge>
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {longDate.format(new Date(order.placedAt))} · {items}{" "}
                          {items === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <ul aria-hidden="true" className="flex -space-x-2">
                        {order.lines.slice(0, 3).map((line) => (
                          <li key={`${line.product.id}-${line.variant ?? ""}`}>
                            <ProductArt
                              className="size-10 rounded-md ring-2 ring-card"
                              product={line.product}
                            />
                          </li>
                        ))}
                      </ul>
                      <span className="text-subtitle font-semibold tabular-nums">
                        {money(orderTotal(order))}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                          isOpen && "rotate-180",
                        )}
                      />
                      <span className="sr-only">{isOpen ? "Hide details" : "Show details"}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div
                        className="grid grid-cols-1 gap-6 p-4 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
                        data-slot="order-history-detail"
                      >
                        <div className="flex flex-col gap-4">
                          <ul className="flex flex-col divide-y divide-border">
                            {order.lines.map((line) => (
                              <li
                                className="flex items-center gap-3 py-3"
                                key={`${line.product.id}-${line.variant ?? ""}`}
                              >
                                <ProductArt className="size-14 shrink-0" product={line.product} />
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-body font-medium">
                                    {line.product.name}
                                  </span>
                                  <span className="text-meta text-muted-foreground tabular-nums">
                                    {line.variant ? `${line.variant} · ` : ""}
                                    {line.quantity} × {money(line.price)}
                                  </span>
                                </div>
                                <span className="text-body font-medium tabular-nums">
                                  {money(line.price * line.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <dl className="flex flex-col gap-1 text-caption tabular-nums">
                            <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Shipping</dt>
                              <dd>{order.shipping === 0 ? "Free" : money(order.shipping)}</dd>
                            </div>
                            <div className="flex justify-between gap-4 text-body font-semibold">
                              <dt>Total</dt>
                              <dd>{money(orderTotal(order))}</dd>
                            </div>
                          </dl>
                          {order.note ? (
                            <p className="text-caption text-muted-foreground">{order.note}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {order.tracking && order.status === "shipped" ? (
                              <Button onClick={() => onTrack?.(order)} size="sm">
                                <Truck aria-hidden="true" />
                                Track parcel
                              </Button>
                            ) : null}
                            <Button
                              onClick={() => {
                                setReordered(order.id);
                                onReorder?.(order);
                              }}
                              size="sm"
                              variant={reordered === order.id ? "secondary" : "outline"}
                            >
                              {reordered === order.id ? (
                                <PackageCheck aria-hidden="true" />
                              ) : (
                                <RotateCcw aria-hidden="true" />
                              )}
                              {reordered === order.id ? "In your cart" : "Buy again"}
                            </Button>
                            {order.status !== "cancelled" ? (
                              <Button onClick={() => onInvoice?.(order)} size="sm" variant="ghost">
                                <FileText aria-hidden="true" />
                                Invoice
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
                          <h2 className="text-body font-semibold">Where it is</h2>
                          <Timeline items={timeline} />
                          {order.tracking ? (
                            <p className="text-meta text-muted-foreground">
                              {order.tracking.carrier} ·{" "}
                              <span className="font-mono text-code tabular-nums">
                                {order.tracking.code}
                              </span>
                            </p>
                          ) : order.status === "processing" ? (
                            <p className="text-meta text-muted-foreground">
                              You get a tracking code the moment it ships.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
      <p aria-live="polite" className="sr-only">
        {reordered
          ? `Order ${orders.find((o) => o.id === reordered)?.number ?? ""} added to your cart.`
          : ""}
      </p>
      {shown.length > 0 ? (
        <p className="text-meta text-muted-foreground">
          Showing orders placed since{" "}
          {period === "all"
            ? "the beginning"
            : shortDate.format(
                new Date(
                  new Date(now).getTime() -
                    (PERIODS.find((p) => p.id === period)?.days ?? 0) * 86_400_000,
                ),
              )}
          .
        </p>
      ) : null}
    </section>
  );
}
