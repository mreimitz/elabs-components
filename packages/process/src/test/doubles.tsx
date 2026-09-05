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

import type { ProcessGraph, Variant } from "../core/types";
import {
  assertProcessContract,
  buildProcessDoublePayload,
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

function createProcessDouble<P extends DoubleOwnProps>(name: string, spec: ProcessContractSpec) {
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

export type { ProcessMapDoubleProps, VariantExplorerDoubleProps, ProcessKpiStripDoubleProps };
