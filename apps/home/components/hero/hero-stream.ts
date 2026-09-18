/**
 * hero-stream.ts — the hero scene's seed data and its one-time stream-in (RM-094).
 *
 * The seed has the shape RM-095's fixtures will export; the orchestrator swaps it after both
 * merge. Values are fixed literals (no Math.random — charts-honesty). The stream-in plays once
 * per session, on first mount, with motion on: KPIs count up over 600 ms on `--ease-entrance`,
 * the assistant reply arrives word by word over ~900 ms and the tool call opens; everything is
 * settled by `STREAM_TOTAL_MS`. Reduced motion or a return visit renders the final state.
 *
 * Server-safe: no React import, so the server-rendered hero can read the seed and the gate
 * script. The client hook that drives the stream lives in `use-hero-stream.ts`.
 */
export const STREAM_SESSION_KEY = "brand-ui-hero-streamed";
/** Set on the scene host by the inline gate script while a stream-in is about to play. */
export const STREAM_PENDING_ATTR = "data-stream-pending";
export const KPI_MS = 600;
export const CHAT_START_MS = 250;
export const CHAT_MS = 900;
export const STREAM_TOTAL_MS = CHAT_START_MS + CHAT_MS + 100;

export const HERO_SEED = {
  kpis: [
    { id: "runs", value: 18_240, format: "number", delta: "+12.4%", direction: "up" },
    { id: "success", value: 97.3, format: "percent", delta: "+0.8 pts", direction: "up" },
    { id: "spend", value: 3_412, format: "currency", delta: "68% of limit", direction: "neutral" },
  ],
  runsPerDay: [
    { day: "Mon", runs: 2410 },
    { day: "Tue", runs: 2630 },
    { day: "Wed", runs: 2580 },
    { day: "Thu", runs: 1980 },
    { day: "Fri", runs: 2890 },
    { day: "Sat", runs: 2760 },
    { day: "Sun", runs: 2990 },
  ],
  runs: [
    { id: "run-4821", agent: "Invoice triage", status: "complete", duration: "42 s" },
    { id: "run-4820", agent: "Support router", status: "running", duration: "18 s" },
    { id: "run-4819", agent: "Invoice triage", status: "complete", duration: "3 min 04 s" },
    { id: "run-4818", agent: "Contract review", status: "complete", duration: "1 min 12 s" },
    { id: "run-4817", agent: "Lead enrichment", status: "pending", duration: "—" },
    { id: "run-4816", agent: "Support router", status: "complete", duration: "21 s" },
    { id: "run-4815", agent: "Contract review", status: "complete", duration: "58 s" },
    { id: "run-4814", agent: "Invoice triage", status: "complete", duration: "39 s" },
  ],
  tiles: { queue: "14", model: "gpt-5-mini", budget: 68 },
} as const;

export type HeroKpi = (typeof HERO_SEED.kpis)[number];

const FORMATTERS = {
  number: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
  percent: new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  currency: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }),
} as const;

export function formatKpi(kpi: HeroKpi, value: number): string {
  const text = FORMATTERS[kpi.format].format(value);
  return kpi.format === "percent" ? `${text}%` : text;
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
