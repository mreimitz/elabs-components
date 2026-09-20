/**
 * Market desk — a pricing and trading workspace: watch the market, then act on it.
 *
 * What it shows a copier: the `command-center-market-tape-01` block as the read side, a
 * watchlist `DataTable` whose row click pre-fills the ticket, and a docked ORDER TICKET that
 * is a real form — `FieldRoot`/`FieldError` validation that speaks in the trader's terms, a
 * `NumberInput` with currency formatting, a computed notional and its check against a limit,
 * a review step before anything is placed, and a blotter that fills as orders go in.
 */
"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  CandlestickChart as CandlestickIcon,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import { Sparkline } from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  NumberInput,
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
import { CommandCenterMarketTape } from "@/components/command-center-market-tape-01/command-center-market-tape";
import {
  marketLanes,
  type MarketLane,
} from "@/components/command-center-market-tape-01/data/market";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";

const NAV: WorkspaceNavGroup[] = [
  {
    label: "Desk",
    items: [
      { id: "market", label: "Market", href: "#market", icon: LayoutDashboard },
      { id: "watchlist", label: "Watchlist", href: "#watchlist", icon: Star },
      { id: "charts", label: "Charts", href: "#charts", icon: CandlestickIcon },
      { id: "orders", label: "Orders", href: "#orders", icon: ClipboardList },
    ],
  },
  {
    label: "Book",
    items: [
      { id: "positions", label: "Positions", href: "#positions", icon: Wallet },
      { id: "limits", label: "Limits", href: "#limits", icon: ShieldCheck },
      { id: "research", label: "Research", href: "#research", icon: BookOpenText },
    ],
  },
];

/** The most one ticket may commit, $ — above it the desk head signs. */
const TICKET_LIMIT = 500_000;

interface PlacedOrder {
  id: number;
  side: "buy" | "sell";
  symbol: string;
  boxes: number;
  price: number;
}

export interface MarketDeskPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  lanes?: MarketLane[];
  locale?: string;
}

export default function MarketDeskPage({
  frame = "viewport",
  lanes = marketLanes,
  locale = "en-US",
}: MarketDeskPageProps) {
  const [ticketOpen, setTicketOpen] = useState(frame === "viewport");
  const [symbol, setSymbol] = useState(lanes[0]?.symbol ?? "");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [boxes, setBoxes] = useState<number | null>(40);
  const [reviewing, setReviewing] = useState(false);
  const [touched, setTouched] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const signed = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "always",
  });

  const lane = lanes.find((item) => item.symbol === symbol);
  const price = lane?.closes.at(-1) ?? 0;
  const notional = (boxes ?? 0) * price;
  const boxesError =
    boxes === null || boxes <= 0
      ? "Enter how many forty-foot boxes to trade."
      : notional > TICKET_LIMIT
        ? `This ticket commits ${money.format(notional)}; the desk limit is ${money.format(TICKET_LIMIT)} without the desk head's sign-off.`
        : null;

  const columns = useMemo<ColumnDef<MarketLane>[]>(
    () => [
      {
        accessorKey: "symbol",
        header: "Lane",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-code font-medium">{row.original.symbol}</span>
            <span className="text-caption text-muted-foreground">{row.original.name}</span>
          </div>
        ),
      },
      {
        id: "last",
        header: "Last",
        accessorFn: (row) => row.closes.at(-1) ?? 0,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{money.format(getValue<number>())}</span>
        ),
      },
      {
        id: "move",
        header: "20-day move",
        accessorFn: (row) =>
          ((row.closes.at(-1) ?? 0) - (row.closes[0] ?? 0)) / (row.closes[0] || 1),
        cell: ({ getValue }) => {
          const move = getValue<number>();
          return (
            <Badge variant={move >= 0 ? "success" : "destructive"}>{signed.format(move)}</Badge>
          );
        },
      },
      {
        id: "trend",
        header: "Trend",
        enableSorting: false,
        cell: ({ row }) => (
          <Sparkline
            fitDomain
            height={24}
            label={`${row.original.name}, last 20 closes`}
            values={row.original.closes}
            variant="line"
            width={110}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const place = () => {
    if (!lane || boxes === null) return;
    setOrders((prev) => [{ id: prev.length + 1, side, symbol, boxes, price }, ...prev]);
    setReviewing(false);
    setTouched(false);
    toast.success(`${side === "buy" ? "Bought" : "Sold"} ${boxes} boxes of ${symbol}`, {
      description: `${money.format(notional)} at ${money.format(price)} a box`,
    });
  };

  return (
    <>
      <WorkspaceShell
        activeId="market"
        dock={{
          title: "Order ticket",
          description: "Nothing is placed until you review it.",
          showLabel: "Show the order ticket",
          hideLabel: "Hide the order ticket",
          open: ticketOpen,
          onOpenChange: setTicketOpen,
          defaultWidth: 380,
          children: (
            <div className="flex flex-col gap-6" data-slot="order-ticket">
              {reviewing && lane ? (
                <>
                  <Descriptions columns={1}>
                    <DescriptionsItem label="Side">
                      {side === "buy" ? "Buy" : "Sell"}
                    </DescriptionsItem>
                    <DescriptionsItem label="Lane">{lane.name}</DescriptionsItem>
                    <DescriptionsItem label="Boxes" numeric>
                      {boxes}
                    </DescriptionsItem>
                    <DescriptionsItem label="Price" numeric>
                      {money.format(price)}
                    </DescriptionsItem>
                    <DescriptionsItem label="Commits" numeric>
                      {money.format(notional)}
                    </DescriptionsItem>
                  </Descriptions>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={place}>
                      Place order
                    </Button>
                    <Button onClick={() => setReviewing(false)} variant="outline">
                      Back
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <ToggleGroup
                    aria-label="Side"
                    className="w-full"
                    onValueChange={(value) => value && setSide(value as "buy" | "sell")}
                    type="single"
                    value={side}
                    variant="segmented"
                  >
                    <ToggleGroupItem className="flex-1" value="buy">
                      Buy
                    </ToggleGroupItem>
                    <ToggleGroupItem className="flex-1" value="sell">
                      Sell
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <FieldRoot>
                    <FieldLabel>Lane</FieldLabel>
                    <FieldControl>
                      <Select onValueChange={setSymbol} value={symbol}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {lanes.map((item) => (
                            <SelectItem key={item.symbol} value={item.symbol}>
                              {item.symbol} · {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldControl>
                    <FieldDescription>
                      Last {money.format(price)} a forty-foot box.
                    </FieldDescription>
                  </FieldRoot>

                  <FieldRoot invalid={touched && boxesError !== null} required>
                    <FieldLabel>Boxes</FieldLabel>
                    <FieldControl>
                      <NumberInput
                        min={0}
                        onValueChange={(value) => {
                          setBoxes(value);
                          setTouched(true);
                        }}
                        step={5}
                        value={boxes}
                      />
                    </FieldControl>
                    <FieldDescription>
                      Commits {money.format(notional)} of a {money.format(TICKET_LIMIT)} ticket
                      limit.
                    </FieldDescription>
                    {touched && boxesError ? <FieldError>{boxesError}</FieldError> : null}
                  </FieldRoot>

                  <Button
                    onClick={() => {
                      setTouched(true);
                      if (!boxesError) setReviewing(true);
                    }}
                  >
                    Review order
                  </Button>
                </>
              )}

              <section aria-labelledby="blotter-title" className="flex flex-col gap-2">
                <h3 className="text-body font-semibold" id="blotter-title">
                  Today's orders
                </h3>
                {orders.length === 0 ? (
                  <p className="text-meta text-muted-foreground">
                    Nothing placed yet. Orders land here the moment they go in.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {orders.map((order) => (
                      <li
                        className="flex items-center justify-between gap-2 py-2 text-meta"
                        key={order.id}
                      >
                        <span className="flex items-center gap-2">
                          <Badge variant={order.side === "buy" ? "success" : "destructive"}>
                            {order.side}
                          </Badge>
                          <span className="text-code">{order.symbol}</span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {order.boxes} × {money.format(order.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ),
        }}
        frame={frame}
        nav={NAV}
        orgName="Acme Logistics"
        productName="Rates"
        trail={[
          { href: "#desk", label: "Rate desk" },
          { href: "#market", label: "Market" },
        ]}
        user={{ name: "Mei Tanaka", email: "mei@acme-logistics.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <CommandCenterMarketTape lanes={lanes} locale={locale} />

          <section aria-labelledby="watchlist-title" className="flex flex-col gap-3" id="watchlist">
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="watchlist-title">
                Watchlist
              </h2>
              <p className="text-meta text-muted-foreground">
                Select a lane to put it on the ticket.
              </p>
            </div>
            <Card className="p-0">
              <CardContent className="p-0">
                <DataTable
                  caption="Watchlist"
                  columns={columns}
                  data={lanes}
                  getRowId={(row) => row.symbol}
                  onRowClick={(row) => {
                    setSymbol(row.original.symbol);
                    setReviewing(false);
                    setTicketOpen(true);
                  }}
                  rowActionLabel={(row) => `Trade ${row.original.symbol}`}
                  rowClassName={(row) => (row.original.symbol === symbol ? "bg-accent" : "")}
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
