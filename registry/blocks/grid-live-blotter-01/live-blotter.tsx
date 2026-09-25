/**
 * Live positions blotter — a portfolio manager watches the book re-price.
 *
 * What it shows a copier: `flashChanges` on a feed. Each tick replaces only the
 * positions that moved (immutable rows), so the grid diffs those rows alone and
 * flashes the cells that changed — green up, red down — at any book size. The
 * symbol stays pinned, the trend is the in-cell `sparkline` visual over the last
 * ten prints, and the totals row keeps market value and P&L summed as prices
 * move. A Pause control stops the feed (moving content must be pausable,
 * WCAG 2.2.2), and the feed is paused from the start when the person prefers
 * reduced motion.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { DataGrid, type ColumnDef } from "@elabs-ai/components-data";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { Button } from "@elabs-ai/components-ui";
import { TREND_KEYS, makePositions, tick, type Position } from "./data/positions";

const money = { style: "currency", abbreviate: false, decimals: 0 } as const;

const COLUMNS: ColumnDef<Position>[] = [
  { accessorKey: "symbol", header: "Symbol", size: 100 },
  { accessorKey: "name", header: "Name", size: 170 },
  { accessorKey: "sector", header: "Sector", size: 140, meta: { filter: "set" } },
  {
    accessorKey: "quantity",
    header: "Quantity",
    size: 110,
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
  },
  {
    accessorKey: "last",
    header: "Last",
    size: 100,
    meta: {
      numeric: true,
      format: { abbreviate: false, decimals: 2, optionalDecimals: false },
    },
  },
  {
    id: "change",
    header: "Day %",
    size: 100,
    accessorFn: (row) => (row.last - row.prevClose) / row.prevClose,
    meta: { numeric: true, format: { style: "percent", decimals: 2, sign: "always" } },
  },
  {
    id: "trend",
    header: "Trend",
    size: 130,
    enableSorting: false,
    accessorFn: (row) => row.last,
    meta: { visual: { kind: "sparkline", keys: TREND_KEYS, fill: true }, filter: false },
  },
  {
    id: "marketValue",
    header: "Market value",
    size: 140,
    accessorFn: (row) => Math.round(row.quantity * row.last),
    meta: { numeric: true, format: money, aggregate: "sum" },
  },
  {
    id: "pnl",
    header: "Unrealized P&L",
    size: 150,
    accessorFn: (row) => Math.round(row.quantity * (row.last - row.avgCost)),
    meta: { numeric: true, format: { ...money, sign: "always" }, aggregate: "sum" },
  },
];

export interface LiveBlotterProps {
  /** Milliseconds between ticks. Default 900. */
  interval?: number;
  /** Start with the feed paused (it always starts paused under reduced motion). */
  defaultPaused?: boolean;
}

export function LiveBlotter({ interval = 900, defaultPaused = false }: LiveBlotterProps) {
  const reducedMotion = useReducedMotion();
  const [rows, setRows] = useState(makePositions);
  // `null` until the person presses Pause / Resume; until then the default decides.
  const [paused, setPaused] = useState<boolean | null>(null);
  const live = paused === null ? !(defaultPaused || reducedMotion) : !paused;
  const [ticks, setTicks] = useState(0);
  const step = useRef(0);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const s = ++step.current;
      setTicks(s);
      setRows((current) => tick(current, s));
    }, interval);
    return () => clearInterval(id);
  }, [live, interval]);

  const pnl = useMemo(
    () => rows.reduce((sum, row) => sum + row.quantity * (row.last - row.avgCost), 0),
    [rows],
  );

  return (
    <section
      aria-labelledby="live-blotter-title"
      className="flex flex-col gap-3"
      data-slot="live-blotter"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-subtitle font-semibold" id="live-blotter-title">
            Equity book — live
          </h2>
          <p className="text-meta text-muted-foreground tabular-nums">
            {rows.length} positions · unrealized P&L{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
              signDisplay: "always",
            }).format(pnl)}{" "}
            · {ticks} updates
          </p>
        </div>
        <Button aria-pressed={!live} onClick={() => setPaused(live)} size="sm" variant="outline">
          {live ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {live ? "Pause feed" : "Resume feed"}
        </Button>
      </div>
      <DataGrid
        caption="Equity positions, live prices"
        columns={COLUMNS}
        data={rows}
        enableGrouping
        flashChanges
        getRowId={(row) => row.symbol}
        initialView={{ columnPinning: { left: ["symbol"] } }}
        showTotals
      />
    </section>
  );
}
