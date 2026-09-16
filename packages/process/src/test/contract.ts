/**
 * The double contract engine — RM-053.
 *
 * Mirrors `@elabs-ai/components-charts/src/test/contract.ts` (issue #364): a real component
 * whose rendering depends on a heavy engine (here, the `flow`-composed process views) gets a
 * `vi.mock`-swappable test double that (a) validates the same required-prop contract the real
 * component would enforce, so a broken test fails loudly instead of silently rendering
 * nothing, (b) never imports the engine, and (c) exposes what it was given as an inspectable
 * `data-process-props` attribute so a test can assert on props without a real graph/variant
 * layout ever running under jsdom.
 *
 * `ProcessMap`, `VariantExplorer` and `ProcessKpiStrip` do not exist yet in this package's
 * public barrel — RM-051/052/054 land them (`src/index.ts` still ships no components on
 * purpose). The doubles built on this contract are therefore named with an explicit `Double`
 * suffix rather than the real component name: there is no real same-named export yet for
 * `vi.mock` to swap in for. A follow-up item that lands the real components should rename the
 * doubles to match (dropping the suffix) so a consumer can
 * `vi.mock("@elabs-ai/components-process", () => import("@elabs-ai/components-process/test"))`
 * the way `@elabs-ai/components-charts` consumers do — that rename is out of this item's scope.
 */
import { toEpochMs } from "../core/event-log";
import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import {
  segmentOrderByFrequency,
  segmentOrderForVariant,
  segmentsFor,
  type SegmentDefinition,
} from "../core/segments";
import type { EventLog, ProcessGraph, Variant } from "../core/types";

/** Selection carried by a process view's coordinated-selection contract (RM-068 completes it). */
export type ProcessSelection = null | { kind: "node"; id: string } | { kind: "edge"; id: string };

/** What {@link assertProcessContract} checks for one double. */
export interface ProcessContractSpec {
  /** Name of the prop carrying the double's primary data payload. */
  dataProp: "graph" | "variants" | "log";
  /** Other props the real component requires; the double must not silently accept `undefined`. */
  requiredProps?: string[];
  /**
   * PerformanceSpectrum — RM-060: the `order` prop (default `"frequency"`) must resolve to
   * at least one segment that actually occurs in `log`, or the real view renders only its
   * empty panel — almost always a test wired to the wrong activity names.
   */
  segmentOrder?: boolean;
}

/** Thrown by {@link assertProcessContract} when a double is used with an invalid prop shape. */
export class ProcessContractError extends Error {
  constructor(componentName: string, message: string) {
    super(`${componentName}: ${message}`);
    this.name = "ProcessContractError";
  }
}

function isProcessGraph(value: unknown): value is ProcessGraph {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as ProcessGraph).activities) &&
    Array.isArray((value as ProcessGraph).transitions)
  );
}

function isEventLog(value: unknown): value is EventLog {
  return !!value && typeof value === "object" && Array.isArray((value as EventLog).events);
}

/** How many occurrences `order` (as `PerformanceSpectrum` reads it) finds in `log`. */
function countSpectrumOccurrences(log: EventLog, order: unknown, limit: unknown): number {
  const cap = typeof limit === "number" ? Math.max(0, Math.floor(limit)) : 12;
  let definitions: SegmentDefinition[] = [];
  if (order === undefined || order === "frequency") {
    definitions = segmentOrderByFrequency(discoverGraph(log), cap);
  } else if (Array.isArray(order)) {
    definitions = (order as SegmentDefinition[]).slice(0, cap);
  } else if (order && typeof order === "object" && "variantId" in order) {
    const id = (order as { variantId: unknown }).variantId;
    const variant = extractVariants(log).find((v) => v.id === id);
    definitions = variant ? segmentOrderForVariant(variant).slice(0, cap) : [];
  }
  return segmentsFor(log, definitions).length;
}

function isVariantArray(value: unknown): value is Variant[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "object" && entry !== null && "sequence" in entry)
  );
}

// DottedChart — RM-059
/** A non-empty event log whose every row carries a parsable timestamp. */
function isTimedEventLog(value: unknown): value is EventLog {
  const events = (value as EventLog | null | undefined)?.events;
  return (
    Array.isArray(events) &&
    events.length > 0 &&
    events.every(
      (row) => !!row && typeof row === "object" && Number.isFinite(toEpochMs(row.timestamp)),
    )
  );
}

/**
 * Validate a double's props against its contract spec. Throws {@link ProcessContractError} on
 * a missing/invalid required prop — mirroring what the real component would fail on at
 * runtime, so a test that gets the props wrong fails loudly rather than silently rendering an
 * empty double.
 */
export function assertProcessContract(
  componentName: string,
  props: Record<string, unknown>,
  spec: ProcessContractSpec,
): void {
  const data = props[spec.dataProp];
  if (spec.dataProp === "graph" && !isProcessGraph(data)) {
    throw new ProcessContractError(
      componentName,
      `"graph" prop must be a ProcessGraph, got ${typeof data}`,
    );
  }
  if (spec.dataProp === "variants" && !isVariantArray(data)) {
    throw new ProcessContractError(
      componentName,
      `"variants" prop must be a Variant[], got ${typeof data}`,
    );
  }
  if (spec.dataProp === "log" && !isTimedEventLog(data)) {
    throw new ProcessContractError(
      componentName,
      `"log" prop must be an EventLog with non-empty events and parsable timestamps`,
    );
  }
  if (
    spec.segmentOrder &&
    isEventLog(data) &&
    data.events.length > 0 &&
    countSpectrumOccurrences(data, props.order, props.segmentLimit) === 0
  ) {
    throw new ProcessContractError(
      componentName,
      `"order" resolves to no segment that occurs in "log"`,
    );
  }
  for (const key of spec.requiredProps ?? []) {
    if (props[key] === undefined) {
      throw new ProcessContractError(componentName, `missing required prop "${key}"`);
    }
  }
}

/** What a double records to `data-process-props`, for assertions without a real layout. */
export interface ProcessDoublePayload {
  component: string;
  dataLength: number;
  selection?: ProcessSelection;
}

/** Build the inspectable payload a double serializes into `data-process-props`. */
export function buildProcessDoublePayload(
  componentName: string,
  props: Record<string, unknown>,
  spec: ProcessContractSpec,
): ProcessDoublePayload {
  const data = props[spec.dataProp];
  const dataLength =
    spec.dataProp === "graph" && isProcessGraph(data)
      ? data.activities.length
      : spec.dataProp === "log" && isTimedEventLog(data)
        ? data.events.length
        : Array.isArray(data)
          ? data.length
          : 0;
  const payload: ProcessDoublePayload = { component: componentName, dataLength };
  if ("selection" in props) payload.selection = props.selection as ProcessSelection;
  return payload;
}

/** Read a mounted double's payload back out of the DOM (companion to {@link buildProcessDoublePayload}). */
export function readProcessDoubleProps(el: Element): ProcessDoublePayload | null {
  const raw = el.getAttribute("data-process-props");
  return raw ? (JSON.parse(raw) as ProcessDoublePayload) : null;
}
