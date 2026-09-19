/**
 * Gallery data — the chart and component galleries' example datasets. Same company, same
 * quarter as every other fixture here (Ashgrove Systems, Q3 FY26): series that already exist
 * are READ from `kpis.ts`, the rest are seeded derivations over `company.ts`' regions and
 * products, so a gallery tile never shows a number that contradicts the hero or the tour.
 */
import { FISCAL_QUARTER_WEEKS, PRODUCTS, REGIONS } from "./company";
import { ARR_SERIES, CHURN_BY_REGION, CHURN_SERIES } from "./kpis";
import { mulberry32 } from "./lib/prng";

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Weekly logo churn, overall — `Date` x values for the time-scale charts. */
export const GALLERY_CHURN_WEEKLY = CHURN_SERIES.points.map((p) => ({
  date: new Date(p.week),
  churn: p.value,
}));

/** Weekly churn per region, one row per week — line and area tiles. */
export const GALLERY_CHURN_BY_REGION = FISCAL_QUARTER_WEEKS.map((week, i) => ({
  date: new Date(week),
  EMEA: CHURN_BY_REGION.EMEA.points[i]!.value,
  AMER: CHURN_BY_REGION.AMER.points[i]!.value,
  APAC: CHURN_BY_REGION.APAC.points[i]!.value,
  LATAM: CHURN_BY_REGION.LATAM.points[i]!.value,
}));

/**
 * Net new ARR per week in $k (the week-over-week difference of `ARR_SERIES`) with its
 * three-week trailing average — the composed (bar + line) tile. Both share one scale.
 */
export const GALLERY_NET_NEW_ARR = FISCAL_QUARTER_WEEKS.slice(1).map((week, i) => {
  const delta = (j: number) =>
    (ARR_SERIES.points[j + 1]!.value - ARR_SERIES.points[j]!.value) / 1_000;
  const window = [i - 2, i - 1, i].filter((j) => j >= 0).map(delta);
  return {
    date: new Date(week),
    netNew: Math.round(delta(i)),
    trailing: Math.round(window.reduce((sum, v) => sum + v, 0) / window.length),
  };
});

/** New vs. expansion bookings per region, $k — grouped and stacked bars. */
export const GALLERY_BOOKINGS = (() => {
  const rnd = mulberry32(301);
  return REGIONS.map((region, i) => ({
    region,
    newBusiness: Math.round(620 - i * 95 + rnd() * 140),
    expansion: Math.round(410 - i * 60 + rnd() * 120),
    renewal: Math.round(880 - i * 130 + rnd() * 160),
  }));
})();

/** Revenue share by product family — pie, ring, unit. Sums to 100. */
export const GALLERY_REVENUE_MIX = [
  { label: "Ledger", value: 38 },
  { label: "Billing", value: 31 },
  { label: "Usage Metering", value: 17 },
  { label: "Studio", value: 14 },
];

/** Quota attainment per region, percent of target — bullets and the gauge. */
export const GALLERY_ATTAINMENT = (() => {
  const rnd = mulberry32(302);
  return REGIONS.map((region, i) => ({
    label: region,
    value: Math.round(92 - i * 9 + rnd() * 10),
    maxValue: 100,
  }));
})();

/** Renewals closed against renewals due this quarter, per region — rings. */
export const GALLERY_RENEWALS_CLOSED = (() => {
  const rnd = mulberry32(309);
  return REGIONS.map((region, i) => {
    const due = 140 - i * 22;
    return { label: region, value: Math.round(due * (0.62 + rnd() * 0.3)), maxValue: due };
  });
})();

/**
 * Opening-to-closing ARR bridge for the quarter, $M — waterfall. The two totals are READ from
 * `ARR_SERIES` (first and last weekly point), and the four movements split the difference in
 * fixed shares, so the bridge always closes on the same ARR the KPI tile shows.
 */
export const GALLERY_ARR_BRIDGE = (() => {
  const opening = ARR_SERIES.points[0]!.value / 1_000_000;
  const closing = ARR_SERIES.points.at(-1)!.value / 1_000_000;
  const net = closing - opening;
  // Shares of the net movement: gains sum to +1.5, losses to -0.5.
  const newBusiness = round(net * 0.95, 2);
  const expansion = round(net * 0.55, 2);
  const contraction = round(net * -0.22, 2);
  const churn = round(net - newBusiness - expansion - contraction, 2);
  return [
    { kind: "total" as const, label: "Opening ARR", value: round(opening, 2) },
    { label: "New", value: newBusiness },
    { label: "Expansion", value: expansion },
    { label: "Contraction", value: contraction },
    { label: "Churn", value: churn },
    { kind: "total" as const, label: "Closing ARR", value: round(closing, 2) },
  ];
})();

/** Trial-to-paid funnel for the quarter. */
export const GALLERY_FUNNEL = [
  { label: "Trials started", value: 4_820 },
  { label: "Connected billing", value: 2_960 },
  { label: "First invoice sent", value: 1_710 },
  { label: "Converted to paid", value: 940 },
];

/** Renewal rate per region, last quarter against this one — dumbbell. */
export const GALLERY_RENEWALS = (() => {
  const rnd = mulberry32(303);
  return REGIONS.map((region, i) => {
    const before = Math.round(84 + rnd() * 6 - i);
    return { region, before, after: before + Math.round(rnd() * 9) - (region === "EMEA" ? 6 : 0) };
  });
})();

/** Product rank by net new ARR per month — bump. */
export const GALLERY_PRODUCT_RANK = (() => {
  const rnd = mulberry32(304);
  const months = ["Jun", "Jul", "Aug", "Sep"];
  const entities = PRODUCTS.slice(0, 5);
  return months.flatMap((month, m) =>
    entities.map((product, p) => ({
      month,
      product,
      arr: Math.round(40 + ((p * 17 + m * 23) % 50) + rnd() * 25),
    })),
  );
})();

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
/** Invoices issued per weekday and hour — heatmap. */
export const GALLERY_INVOICE_HEAT = (() => {
  const rnd = mulberry32(305);
  const rows: { day: string; hour: string; count: number }[] = [];
  for (const day of WEEKDAYS) {
    const weekend = day === "Sat" || day === "Sun";
    for (const hour of HOURS) {
      const h = Number(hour);
      const office = h >= 8 && h <= 18 ? 1 : 0.12;
      rows.push({
        day,
        hour,
        count: Math.round((weekend ? 6 : 44) * office * (0.55 + rnd() * 0.9)),
      });
    }
  }
  return { rows, days: WEEKDAYS, hours: HOURS };
})();

/** Deal size against sales-cycle length, one point per closed deal — scatter. */
export const GALLERY_DEALS = (() => {
  const rnd = mulberry32(306);
  return Array.from({ length: 28 }, (_, i) => {
    const cycle = Math.round(18 + rnd() * 90);
    return {
      date: new Date(Date.UTC(2026, 6, 1 + i * 3)),
      cycleDays: cycle,
      dealSize: Math.round(12 + cycle * 0.55 + rnd() * 40),
    };
  });
})();

/** Days-to-pay per invoice by region, record level — strip / box / histogram. */
export const GALLERY_DAYS_TO_PAY = (() => {
  const rnd = mulberry32(307);
  return REGIONS.flatMap((region, r) =>
    Array.from({ length: 48 }, (_, i) => {
      const u = rnd();
      const days = region === "LATAM" ? 14 + u * u * 70 : 9 + u * (22 + r * 6);
      return { id: `${region}-${i}`, region, days: round(days) };
    }),
  );
})();

/** ARR by product family and module, $M — treemap. */
export const GALLERY_ARR_TREE = {
  name: "ARR",
  children: [
    {
      name: "Ledger",
      children: [
        { name: "Ledger Core", value: 9.8 },
        { name: "Ledger Insights", value: 6.1 },
      ],
    },
    {
      name: "Billing",
      children: [
        { name: "Billing Cloud", value: 8.4 },
        { name: "Billing Connect", value: 4.5 },
      ],
    },
    {
      name: "Usage",
      children: [
        { name: "Usage Metering", value: 5.2 },
        { name: "Revenue Recognition", value: 1.9 },
      ],
    },
    {
      name: "Studio",
      children: [
        { name: "Renewals Studio", value: 3.1 },
        { name: "Forecast Studio", value: 2.5 },
      ],
    },
  ],
};

/** Revenue organisation — tree. */
export const GALLERY_ORG_TREE = {
  name: "Revenue",
  children: [
    { name: "Sales", children: [{ name: "EMEA" }, { name: "AMER" }, { name: "APAC" }] },
    { name: "Success", children: [{ name: "Onboarding" }, { name: "Renewals" }] },
    { name: "RevOps", children: [{ name: "Billing" }, { name: "Forecast" }] },
  ],
};

/** Where an invoice goes: channel → status → outcome — sankey threads. */
export const GALLERY_INVOICE_ROUTES = (() => {
  const sources = ["Card", "ACH", "Wire", "Direct debit"];
  const stages = ["Paid on time", "Reminder sent", "Escalated"];
  const outcomes = ["Collected", "Written off"];
  return {
    nodes: [
      ...sources.map((name) => ({ name, category: "source" as const })),
      ...stages.map((name) => ({ name, category: "landing" as const })),
      ...outcomes.map((name) => ({ name, category: "outcome" as const })),
    ],
    links: Array.from({ length: 18 }, (_, i) => ({
      source: 0,
      target: 0,
      value: 5 + ((i * 7) % 20),
      path: [
        sources[i % sources.length]!,
        stages[(i * 2 + 1) % stages.length]!,
        outcomes[i % 7 === 0 ? 1 : 0]!,
      ],
    })),
  };
})();

/** Billing platform services and what calls what — network. */
export const GALLERY_SERVICES = {
  nodes: [
    { id: "gateway", label: "Gateway", value: 12, group: "Edge" },
    { id: "billing", label: "Billing", value: 10, group: "Core" },
    { id: "metering", label: "Metering", value: 8, group: "Core" },
    { id: "ledger", label: "Ledger", value: 11, group: "Core" },
    { id: "tax", label: "Tax", value: 5, group: "Core" },
    { id: "warehouse", label: "Warehouse", value: 14, group: "Data" },
    { id: "cache", label: "Cache", value: 5, group: "Data" },
  ],
  links: [
    { source: "gateway", target: "billing" },
    { source: "gateway", target: "metering" },
    { source: "billing", target: "ledger" },
    { source: "billing", target: "tax" },
    { source: "metering", target: "ledger" },
    { source: "ledger", target: "warehouse" },
    { source: "billing", target: "cache" },
  ],
};

/** Five plans across price, seats and NPS — parallel coordinates. */
export const GALLERY_PLANS = {
  dimensions: [
    { key: "price", label: "Price / seat", format: "currency" as const },
    { key: "seats", label: "Median seats" },
    { key: "nps", label: "NPS" },
  ],
  rows: [
    { plan: "Starter", price: 29, seats: 6, nps: 31 },
    { plan: "Team", price: 59, seats: 18, nps: 42 },
    { plan: "Business", price: 99, seats: 46, nps: 47 },
    { plan: "Scale", price: 149, seats: 120, nps: 38 },
    { plan: "Enterprise", price: 219, seats: 410, nps: 52 },
  ],
};

/** Account health across five dimensions, two segments — radar. */
export const GALLERY_HEALTH = {
  metrics: [
    { key: "adoption", label: "Adoption" },
    { key: "support", label: "Support" },
    { key: "payments", label: "Payments" },
    { key: "expansion", label: "Expansion" },
    { key: "sentiment", label: "Sentiment" },
  ],
  data: [
    {
      label: "Mid-market",
      values: { adoption: 78, support: 64, payments: 88, expansion: 58, sentiment: 72 },
    },
    {
      label: "Enterprise",
      values: { adoption: 66, support: 82, payments: 93, expansion: 74, sentiment: 69 },
    },
  ],
};

/** Ashgrove's own share price, daily OHLC — candlestick. */
export const GALLERY_OHLC = (() => {
  const rnd = mulberry32(308);
  let close = 104;
  return Array.from({ length: 16 }, (_, i) => {
    const open = close;
    close = round(open + (rnd() - 0.45) * 7, 2);
    return {
      date: new Date(Date.UTC(2026, 8, 1 + i + Math.floor(i / 5) * 2)),
      open,
      close,
      high: round(Math.max(open, close) + rnd() * 3, 2),
      low: round(Math.min(open, close) - rnd() * 3, 2),
    };
  });
})();

/** Requests per second on the billing API, the trailing minute — live line seed. */
export const GALLERY_LIVE_SEED = Array.from({ length: 40 }, (_, i) => ({
  offset: i - 39,
  value: round(60 + Math.sin(i / 4) * 18 + Math.cos(i / 2) * 6),
}));
