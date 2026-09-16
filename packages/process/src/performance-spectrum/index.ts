/**
 * PerformanceSpectrum (RM-060) — public surface: the view, its labels, and the pure row /
 * bin model a host can reuse (e.g. to print the same numbers in a report).
 */
export {
  PERFORMANCE_SPECTRUM_DEFAULT_BIN_SIZE,
  PERFORMANCE_SPECTRUM_ROW_HEIGHT,
  PERFORMANCE_SPECTRUM_SEGMENT_LIMIT,
  PerformanceSpectrum,
} from "./performance-spectrum";
export type {
  PerformanceSpectrumFilterIntent,
  PerformanceSpectrumOrder,
  PerformanceSpectrumProps,
} from "./performance-spectrum";
export { PERFORMANCE_SPECTRUM_DEFAULT_LABELS } from "./performance-spectrum-context";
export type { PerformanceSpectrumLabels } from "./performance-spectrum-context";
export {
  aggregateSegmentBins,
  buildSpectrumRows,
  casesInRange,
  spectrumDomain,
  spectrumTicks,
} from "./aggregate-segments";
export type { SpectrumBin, SpectrumLine, SpectrumRow } from "./aggregate-segments";
