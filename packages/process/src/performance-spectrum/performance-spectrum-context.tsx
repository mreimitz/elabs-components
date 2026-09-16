"use client";

/**
 * The context `PerformanceSpectrum` shares with its rows — RM-060.
 *
 * Every row paints against the SAME time domain, ticks, ramp and formatters; lifting
 * them into one provider keeps the row component prop-light and guarantees two rows can
 * never disagree about where an instant sits on the shared x-axis.
 */
import { createContext, useContext } from "react";
import type { SpectrumLine } from "./aggregate-segments";

/** Every user-visible string `PerformanceSpectrum` renders. `{name}` placeholders fill. */
export interface PerformanceSpectrumLabels {
  /** Accessible name of the whole view. */
  label: string;
  /** `{from}`, `{to}` — a row's accessible name and default visible label. */
  segment: string;
  /** Appended to a selected row's accessible name. */
  selected: string;
  /** `{count}`, `{cases}`, `{median}`, `{p90}` — a row's parallel summary. */
  rowSummary: string;
  /** `{caseId}`, `{start}`, `{end}`, `{duration}`, `{quartile}` — one line, spoken. */
  occurrence: string;
  /** `{start}`, `{end}`, `{count}`, `{median}`, `{quartile}` — one aggregated bar, spoken. */
  bin: string;
  tooltipSegment: string;
  tooltipStart: string;
  tooltipEnd: string;
  tooltipDuration: string;
  tooltipQuartile: string;
  tooltipCount: string;
  tooltipMedian: string;
  /** `{n}` — a quartile's short name. */
  quartile: string;
  quartileFastest: string;
  quartileSlowest: string;
  /** Heading of the colour key. */
  legend: string;
  /** Accessible name of the time-axis brush track. */
  brush: string;
  brushHint: string;
  /** `{start}`, `{end}`, `{count}` — announced when a range is set. */
  brushRange: string;
  columnSegment: string;
  columnCases: string;
  columnMedian: string;
  columnP90: string;
  tableCaption: string;
  loading: string;
  empty: string;
  emptyBody: string;
}

/** The shipped English labels. */
export const PERFORMANCE_SPECTRUM_DEFAULT_LABELS: Readonly<PerformanceSpectrumLabels> =
  Object.freeze({
    label: "Performance spectrum",
    segment: "{from} → {to}",
    selected: "selected",
    rowSummary: "{count} occurrences across {cases} cases, median {median}, 90th percentile {p90}",
    occurrence: "Case {caseId}, {start} to {end}, took {duration}, {quartile}",
    bin: "{start} to {end}: {count} cases entered, median {median}, {quartile}",
    tooltipSegment: "Segment",
    tooltipStart: "Start",
    tooltipEnd: "End",
    tooltipDuration: "Duration",
    tooltipQuartile: "Quartile",
    tooltipCount: "Cases entered",
    tooltipMedian: "Median duration",
    quartile: "Quartile {n}",
    quartileFastest: "fastest",
    quartileSlowest: "slowest",
    legend: "Duration quartile, per segment",
    brush: "Time range",
    brushHint:
      "Drag across the axis, or use Shift with the arrow keys, to pick a time range. Press Enter to filter to cases in the range, Escape to clear.",
    brushRange: "{start} to {end}, {count} cases",
    columnSegment: "Segment",
    columnCases: "Cases",
    columnMedian: "Median duration",
    columnP90: "90th percentile duration",
    tableCaption: "Performance spectrum — cases and duration per segment",
    loading: "Loading segment occurrences…",
    empty: "No segment occurrences",
    emptyBody: "None of the chosen segments occur in this log.",
  });

/** What every spectrum row reads. */
export interface PerformanceSpectrumContextValue {
  labels: PerformanceSpectrumLabels;
  mode: "lines" | "aggregated";
  binSize: number;
  domain: readonly [number, number];
  ticks: readonly number[];
  rowHeight: number;
  /** The four quartile inks as `var(--…)` references, quartile 1 first. */
  quartileColors: readonly string[];
  formatInstant: (ms: number) => string;
  formatDuration: (ms: number) => string;
  quartileName: (quartile: number) => string;
  onCaseSelect?: (caseId: string, occurrence: SpectrumLine) => void;
}

const PerformanceSpectrumContext = createContext<PerformanceSpectrumContextValue | null>(null);

export const PerformanceSpectrumProvider = PerformanceSpectrumContext.Provider;

/** Reads the spectrum context. Throws outside a `PerformanceSpectrum`. */
export function usePerformanceSpectrum(): PerformanceSpectrumContextValue {
  const value = useContext(PerformanceSpectrumContext);
  if (!value) {
    throw new Error("usePerformanceSpectrum must be used inside a PerformanceSpectrum");
  }
  return value;
}
