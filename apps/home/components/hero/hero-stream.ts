/**
 * hero-stream.ts — the hero scene's seed data and its one-time stream-in (RM-094).
 *
 * The seed is READ from the fixture set (`content/fixtures/**`, RM-095): the scene is Ashgrove
 * Systems' own revenue console (`company.ts`), its KPI row and tiles are `KPI_HEADLINES`, the
 * line chart is `CHURN_SERIES` (so its last point is the churn KPI), the table is
 * `CHURN_MOVERS`, the chat is `CONVERSATION`'s question, answer and tool call, and the
 * pipeline tile and flow-node float are `FLOW_NODES` at `FLOW_ACTIVE_NODE_ID`. Nothing below
 * is a typed number: every value is a fixture value, and every delta is the fixture's
 * computed delta. Only labels and sentence frames come from `copy.ts` (`heroCopy.scene`).
 * Imports name the fixture modules one by one (never the barrel) so the hero never pulls in
 * the process log (the churn movers do generate their 6,000-order sample on import).
 *
 * The stream-in plays once per session, on first mount, with motion on: KPIs count up to the
 * fixture value over 600 ms on `--ease-entrance`, the assistant reply arrives word by word
 * over ~900 ms and the tool call opens; everything is settled by `STREAM_TOTAL_MS`. Reduced
 * motion or a return visit renders the final state — the fixture values themselves.
 *
 * Server-safe: no React import, so the server-rendered hero can read the seed and the gate
 * script. The client hook that drives the stream lives in `use-hero-stream.ts`.
 */
import { heroCopy } from "../../content/copy";
import { COMPANY_FULL_NAME, CONSOLE_PRODUCT, FISCAL_QUARTER } from "../../content/fixtures/company";
import {
  CHURN_BY_REGION,
  CHURN_SERIES,
  KPI_HEADLINES,
  type KpiHeadline,
} from "../../content/fixtures/kpis";
import { CHURN_MOVERS } from "../../content/fixtures/churn";
import { CONVERSATION } from "../../content/fixtures/conversation";
import { FLOW_ACTIVE_NODE_ID, FLOW_NODES } from "../../content/fixtures/flow";

export const STREAM_SESSION_KEY = "brand-ui-hero-streamed";
/** Set on the scene host by the inline gate script while a stream-in is about to play. */
export const STREAM_PENDING_ATTR = "data-stream-pending";
export const KPI_MS = 600;
export const CHAT_START_MS = 250;
export const CHAT_MS = 900;
export const STREAM_TOTAL_MS = CHAT_START_MS + CHAT_MS + 100;

const scene = heroCopy.scene;
const LOCALE = "en-US";

type KpiFormat = "currency" | "percent" | "number";
const FORMAT_BY_UNIT: Record<KpiHeadline["unit"], KpiFormat> = {
  usd: "currency",
  percent: "percent",
  accounts: "number",
  tickets: "number",
};
/** Metrics where a rise is bad news — the delta colours flip for these. */
const LOWER_IS_BETTER: ReadonlySet<string> = new Set(["churn", "support-backlog"]);

const FORMATTERS = {
  number: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  percent: new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  currency: new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    // Explicit: currency style's default minimum (2 for USD) is clamped differently across ICU
    // versions — Node rendered "$162.0K" where Chromium rendered "$162K".
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }),
} as const;
/**
 * Signed values: the sign is prefixed by hand over the unsigned formatter, so a delta and the
 * value it sits beside share one formatting path — the server and the browser must render the
 * same text or the scene fails to hydrate.
 */
function signed(format: KpiFormat, value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${FORMATTERS[format].format(Math.abs(value))}`;
}
const WEEK = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });
const utc = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

export interface HeroKpi {
  id: string;
  label: string;
  value: number;
  format: KpiFormat;
  delta: string;
  direction: "up" | "down" | "neutral";
  positiveIsGood: boolean;
}

function toKpi(h: KpiHeadline): HeroKpi {
  const format = FORMAT_BY_UNIT[h.unit];
  const delta = signed(format, h.delta);
  return {
    id: h.id,
    label: h.label,
    value: h.value,
    format,
    delta: format === "percent" ? `${delta} ${scene.pointsUnit}` : delta,
    direction: h.delta > 0 ? "up" : h.delta < 0 ? "down" : "neutral",
    positiveIsGood: !LOWER_IS_BETTER.has(h.id),
  };
}

function headline(id: string): HeroKpi {
  const h = KPI_HEADLINES.find((k) => k.id === id);
  if (!h) throw new Error(`hero-stream: no KPI_HEADLINES entry "${id}"`);
  return toKpi(h);
}

type Part = (typeof CONVERSATION)[number]["parts"][number];
type TextPart = Extract<Part, { type: "text" }>;
type ToolPart = Extract<Part, { type: `tool-${string}` }>;

const [question, answer] = CONVERSATION;
const lastText = (parts: readonly Part[] = []) =>
  parts.filter((p): p is TextPart => p.type === "text").at(-1)?.text ?? "";
const toolPart = answer?.parts.find((p): p is ToolPart => p.type.startsWith("tool-"));
if (!toolPart) throw new Error("hero-stream: CONVERSATION has no tool call");
const toolInput: unknown = toolPart.input;

const activeIndex = FLOW_NODES.findIndex((n) => n.id === FLOW_ACTIVE_NODE_ID);
const activeNode = FLOW_NODES[activeIndex];
if (!activeNode) throw new Error(`hero-stream: no FLOW_NODES entry "${FLOW_ACTIVE_NODE_ID}"`);

const churn = headline("churn");

export const HERO_SEED = {
  product: CONSOLE_PRODUCT,
  org: COMPANY_FULL_NAME,
  /** The KPI row — churn is the one the chart's last point equals. */
  kpis: [headline("arr"), headline("nrr"), churn],
  churnKpi: churn,
  kpiSince: scene.kpiSince(WEEK.format(utc(CHURN_SERIES.points[0]!.week))),
  churn: {
    title: scene.chartTitle(CHURN_SERIES.label, FISCAL_QUARTER),
    label: CHURN_SERIES.label,
    /** Fractions, because the chart's `"percent"` format follows `Intl` percent semantics. */
    points: CHURN_SERIES.points.map((p) => ({
      week: WEEK.format(utc(p.week)),
      churn: p.value / 100,
    })),
  },
  movers: CHURN_MOVERS.map((m) => ({ ...m })),
  moversMonth: MONTH.format(utc(CHURN_SERIES.points.at(-1)!.week)),
  chat: {
    question: lastText(question?.parts),
    answer: lastText(answer?.parts),
    tool: {
      name: toolPart.type.slice("tool-".length),
      state: toolPart.state,
      summary:
        typeof toolInput === "object" && toolInput !== null
          ? Object.values(toolInput).map(String).join(" · ")
          : "",
      result: scene.toolResult(CHURN_SERIES.points.length, Object.keys(CHURN_BY_REGION).length),
    },
  },
  tiles: [headline("active-accounts"), headline("support-backlog")],
  pipeline: {
    node: activeNode.data.label,
    step: scene.flowStep(activeIndex + 1, FLOW_NODES.length),
    /** Share of steps finished before the active one. */
    progress: Math.round((activeIndex / FLOW_NODES.length) * 100),
  },
};

export type HeroMover = (typeof HERO_SEED.movers)[number];

export function formatKpi(kpi: HeroKpi, value: number): string {
  const text = FORMATTERS[kpi.format].format(value);
  return kpi.format === "percent" ? `${text}%` : text;
}

export function formatUsd(value: number, withSign = false): string {
  return withSign ? signed("currency", value) : FORMATTERS.currency.format(value);
}

export interface HeroStream {
  /** ms since the stream started; `null` once settled or when it never plays. */
  elapsed: number | null;
  ease: (p: number) => number;
}

export function kpiValueAt(kpi: HeroKpi, s: HeroStream): number {
  if (s.elapsed === null) return kpi.value;
  return kpi.value * s.ease(Math.min(s.elapsed / KPI_MS, 1));
}

export function textAt(text: string, s: HeroStream): string {
  if (s.elapsed === null) return text;
  const words = text.split(" ");
  const p = Math.max(0, Math.min((s.elapsed - CHAT_START_MS) / CHAT_MS, 1));
  return words.slice(0, Math.round(words.length * p)).join(" ");
}

export function toolOpenAt(s: HeroStream): boolean {
  return s.elapsed === null || s.elapsed >= CHAT_START_MS + CHAT_MS;
}

/**
 * Inline script placed as the first child of the scene host. Runs during HTML parse, before
 * first paint: marks the host pending only on a first visit with motion on, and clears the mark
 * after 3 s in case hydration never comes.
 */
export function streamGateScript(): string {
  return `(function(){var h=document.currentScript&&document.currentScript.parentElement;if(!h)return;try{if(sessionStorage.getItem(${JSON.stringify(STREAM_SESSION_KEY)}))return}catch(e){return}if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var f=parseFloat(getComputedStyle(h).getPropertyValue("--motion-factor"));if(f===0)return;h.setAttribute(${JSON.stringify(STREAM_PENDING_ATTR)},"");setTimeout(function(){h.removeAttribute(${JSON.stringify(STREAM_PENDING_ATTR)})},3000)})();`;
}
