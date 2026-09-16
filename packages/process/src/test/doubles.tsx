"use client";

/**
 * Test doubles for the process package's not-yet-shipped view components — RM-053.
 *
 * Mirrors `@elabs-ai/components-charts/src/test/doubles.tsx`'s factory shape: each double is a
 * plain `forwardRef<HTMLDivElement, P>` that validates its contract
 * ({@link assertProcessContract}) then renders an inert `<div>` carrying its props as a
 * `data-process-props` JSON attribute — cheap enough to mount by the thousand in a test, with
 * nothing that needs a real graph/variant layout to run under jsdom.
 */
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import type { ConformanceResult } from "../core/conformance";
import type { HappyPath } from "../core/reference-model";
import type { EventLog, ProcessGraph, Variant } from "../core/types";
import {
  assertProcessContract,
  buildProcessDoublePayload,
  ProcessContractError,
  type ProcessContractSpec,
  type ProcessSelection,
} from "./contract";

interface DoubleOwnProps extends HTMLAttributes<HTMLDivElement> {
  selection?: ProcessSelection;
  onSelectionChange?: (selection: ProcessSelection) => void;
}

interface ProcessMapDoubleProps extends DoubleOwnProps {
  graph: ProcessGraph;
}

interface VariantExplorerDoubleProps extends DoubleOwnProps {
  variants: Variant[];
}

interface ProcessKpiStripDoubleProps extends HTMLAttributes<HTMLDivElement> {
  graph: ProcessGraph;
}

const PROCESS_MAP_SPEC: ProcessContractSpec = { dataProp: "graph" };
const VARIANT_EXPLORER_SPEC: ProcessContractSpec = { dataProp: "variants" };
const PROCESS_KPI_STRIP_SPEC: ProcessContractSpec = { dataProp: "graph" };

/** The only props the factory itself reads — a double's own contract is its `P`. */
type DoubleRenderProps = Pick<HTMLAttributes<HTMLDivElement>, "className" | "style">;

function createProcessDouble<P extends DoubleRenderProps>(name: string, spec: ProcessContractSpec) {
  const Double = forwardRef<HTMLDivElement, P>(function ProcessTestDouble(props, ref) {
    const record = props as unknown as Record<string, unknown>;
    assertProcessContract(name, record, spec);
    const payload = buildProcessDoublePayload(name, record, spec);
    return (
      <div
        ref={ref}
        data-slot="process-test-double"
        data-process-double={name}
        data-process-props={JSON.stringify(payload)}
        className={props.className}
        style={props.style}
      />
    );
  });
  Double.displayName = name;
  return Double;
}

/** Stand-in for the future `ProcessMap` (RM-051). Named with a `Double` suffix — see contract.ts header. */
export const ProcessMapDouble = createProcessDouble<ProcessMapDoubleProps>(
  "ProcessMapDouble",
  PROCESS_MAP_SPEC,
);

/** Stand-in for the future `VariantExplorer` (RM-052). */
export const VariantExplorerDouble = createProcessDouble<VariantExplorerDoubleProps>(
  "VariantExplorerDouble",
  VARIANT_EXPLORER_SPEC,
);

/** Stand-in for the future `ProcessKpiStrip` (RM-054). */
export const ProcessKpiStripDouble = createProcessDouble<ProcessKpiStripDoubleProps>(
  "ProcessKpiStripDouble",
  PROCESS_KPI_STRIP_SPEC,
);

// DottedChart — RM-059
interface DottedChartDoubleProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  log: EventLog;
  selectedCaseIds?: readonly string[];
  onSelect?: (caseIds: string[]) => void;
}

/** Stand-in for `DottedChart` (RM-059). Asserts a non-empty `log.events` with parsable timestamps. */
export const DottedChartDouble = createProcessDouble<DottedChartDoubleProps>("DottedChartDouble", {
  dataProp: "log",
});

// PerformanceSpectrum — RM-060
interface PerformanceSpectrumDoubleProps extends HTMLAttributes<HTMLDivElement> {
  log: EventLog;
  /** Explicit segments, `"frequency"` (the default) or `{ variantId }` — as the real prop. */
  order?: Array<{ from: string; to: string; label?: string }> | "frequency" | { variantId: string };
  segmentLimit?: number;
  mode?: "lines" | "aggregated";
  binSize?: number;
  onFilterIntent?: (intent: { kind: "cases"; ids: string[] }) => void;
  height?: number;
  tableView?: boolean;
  loading?: boolean;
}

const PERFORMANCE_SPECTRUM_SPEC: ProcessContractSpec = { dataProp: "log", segmentOrder: true };

/** Stand-in for `PerformanceSpectrum` (RM-060); asserts `order` resolves to a segment present in `log`. */
export const PerformanceSpectrumDouble = createProcessDouble<PerformanceSpectrumDoubleProps>(
  "PerformanceSpectrumDouble",
  PERFORMANCE_SPECTRUM_SPEC,
);

// ── RM-062 ───────────────────────────────────────────────────────────────────

interface ConformanceOverlayDoubleProps extends DoubleOwnProps {
  graph: ProcessGraph;
  conformance: ConformanceResult;
}

interface ViolationListDoubleProps extends HTMLAttributes<HTMLDivElement> {
  conformance: ConformanceResult;
}

interface HappyPathEditorDoubleProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: HappyPath;
  onChange: (path: HappyPath) => void;
}

/** Stand-in for `ConformanceOverlay` (RM-062): requires a graph AND a replay result. */
export const ConformanceOverlayDouble = createProcessDouble<ConformanceOverlayDoubleProps>(
  "ConformanceOverlayDouble",
  { dataProp: "conformance", requiredProps: ["graph"] },
);

/** Stand-in for `ViolationList` (RM-062). */
export const ViolationListDouble = createProcessDouble<ViolationListDoubleProps>(
  "ViolationListDouble",
  { dataProp: "conformance" },
);

/** Stand-in for `HappyPathEditor` (RM-062): a controlled editor, so `onChange` is required. */
export const HappyPathEditorDouble = createProcessDouble<HappyPathEditorDoubleProps>(
  "HappyPathEditorDouble",
  { dataProp: "value", requiredProps: ["onChange"] },
);

// ── RM-065 ───────────────────────────────────────────────────────────────────

interface ProcessReplayDoubleProps extends HTMLAttributes<HTMLDivElement> {
  graph: ProcessGraph;
  log: EventLog;
  synchronizedStart?: boolean;
  bucketMs?: number;
  playing?: boolean;
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  time?: number;
  defaultTime?: number;
  onTimeChange?: (time: number) => void;
  speed?: number;
  defaultSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  congestionLimit?: number;
  loading?: boolean;
}

/** Stand-in for `ProcessReplay` (RM-065): requires the log (per-case timing) AND the graph. */
export const ProcessReplayDouble = createProcessDouble<ProcessReplayDoubleProps>(
  "ProcessReplayDouble",
  { dataProp: "log", requiredProps: ["graph"] },
);

export type {
  ProcessReplayDoubleProps,
  DottedChartDoubleProps,
  PerformanceSpectrumDoubleProps,
  ProcessMapDoubleProps,
  VariantExplorerDoubleProps,
  ProcessKpiStripDoubleProps,
  ConformanceOverlayDoubleProps,
  ViolationListDoubleProps,
  HappyPathEditorDoubleProps,
};

// ── ProcessCompareDouble — RM-064 ────────────────────────────────────────────
//
// `ProcessCompare` composes `ProcessMap` twice (or once, superimposed) — a REAL component
// this package already ships, unlike the pre-launch stand-ins above. Its own contract does
// not fit `ProcessContractSpec` (`dataProp: "graph" | "variants"` — a single top-level
// payload), because `ProcessCompare`'s payload is a PAIR (`a`/`b`), so this double validates
// and serializes its own shape directly rather than stretching the shared engine.

interface ProcessCompareSideDoubleProps {
  label: string;
  graph?: ProcessGraph;
}

interface ProcessCompareDoubleProps extends HTMLAttributes<HTMLDivElement> {
  a: ProcessCompareSideDoubleProps;
  b: ProcessCompareSideDoubleProps;
  mode?: "side-by-side" | "superimposed";
}

/** What `ProcessCompareDouble` records to `data-process-props`. */
interface ProcessCompareDoublePayload {
  component: "ProcessCompareDouble";
  mode: "side-by-side" | "superimposed";
  aLabel: string;
  bLabel: string;
  aActivityCount: number;
  bActivityCount: number;
}

/** Stand-in for `ProcessCompare` (RM-064) — cheap enough to mount without a real canvas. */
export const ProcessCompareDouble = forwardRef<HTMLDivElement, ProcessCompareDoubleProps>(
  function ProcessCompareDouble({ a, b, mode = "side-by-side", className, style }, ref) {
    if (!a || typeof a.label !== "string") {
      throw new ProcessContractError("ProcessCompareDouble", 'missing required prop "a.label"');
    }
    if (!b || typeof b.label !== "string") {
      throw new ProcessContractError("ProcessCompareDouble", 'missing required prop "b.label"');
    }
    const payload: ProcessCompareDoublePayload = {
      component: "ProcessCompareDouble",
      mode,
      aLabel: a.label,
      bLabel: b.label,
      aActivityCount: a.graph?.activities.length ?? 0,
      bActivityCount: b.graph?.activities.length ?? 0,
    };
    return (
      <div
        ref={ref}
        data-slot="process-test-double"
        data-process-double="ProcessCompareDouble"
        data-process-props={JSON.stringify(payload)}
        className={className}
        style={style}
      />
    );
  },
);

export type { ProcessCompareDoubleProps, ProcessCompareDoublePayload };
