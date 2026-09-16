/**
 * OCEL 2.0 adapter — RM-066.
 *
 * The Object-Centric Event Log standard (OCEL 2.0, ocel-standard.org) drops the single
 * case notion: an event references any number of OBJECTS of any number of object TYPES
 * (`order`, `item`, `package`, …). This adapter reads the standard's JSON serialization
 * and FLATTENS it once per object type — the projection every object-centric
 * directly-follows graph starts from: for object type `T`, every object of type `T` is a
 * case, and every event that references that object is one row of that case.
 *
 * ## JSON only, on purpose
 *
 * OCEL 2.0 also ships as XML and SQLite. Only JSON is read here: it needs nothing beyond
 * `JSON.parse`, which runs identically in Node, a worker and a browser main thread, and
 * `/core` takes no parser dependency (the same format-choice precedent `fromXes` set in
 * RM-063). SQLite would need a WASM engine; XML would need a second hand-rolled tokenizer
 * for a format whose producers all also emit JSON. Convert an XML/SQLite log to JSON with
 * the producing tool first.
 *
 * ## What survives the flattening
 *
 * Each emitted {@link EventRow} carries two reserved attributes so the object-centric
 * discovery step can re-merge the projections:
 *
 * - `__ocelEventId` — the OCEL event's own id, so a shared activity is counted once per
 *   EVENT rather than once per referenced object;
 * - `__objectRefs` — the event's full object map (`{ order: ["o1"], item: ["i1", "i2"] }`),
 *   JSON-encoded because `EventRow.attributes` values are scalars by contract (RM-049's
 *   frozen types). Read it back with {@link readObjectRefs}.
 */
import type { EventLog, EventRow } from "../types";

/** One `{ name, … }` type declaration (`objectTypes` / `eventTypes`). */
export interface OcelTypeDeclaration {
  name: string;
  attributes?: { name: string; type?: string }[];
}

/** An event or object attribute value. Object attributes carry a `time` (they can change). */
export interface OcelAttribute {
  name: string;
  value: string | number | boolean | null;
  time?: string;
}

/** A qualified reference from an event (or object) to an object. */
export interface OcelRelationship {
  objectId: string;
  qualifier?: string;
}

/** One OCEL 2.0 event. `type` is the activity; `time` is an ISO-8601 timestamp. */
export interface OcelEvent {
  id: string;
  type: string;
  time: string;
  attributes?: OcelAttribute[];
  relationships?: OcelRelationship[];
}

/** One OCEL 2.0 object. */
export interface OcelObject {
  id: string;
  type: string;
  attributes?: OcelAttribute[];
  relationships?: OcelRelationship[];
}

/** An OCEL 2.0 JSON document (OCEL 2.0 specification, JSON serialization). */
export interface OcelJson {
  objectTypes: OcelTypeDeclaration[];
  eventTypes?: OcelTypeDeclaration[];
  objects: OcelObject[];
  events: OcelEvent[];
}

/** Options for {@link fromOcel}. */
export interface OcelParseOptions {
  /**
   * Which object types to project a log for, in output order. Defaults to every declared
   * object type, in declaration order. Naming an undeclared type is an error.
   */
  objectTypes?: string[];
}

/** One problem found while reading an OCEL 2.0 document. */
export interface OcelParseError {
  type:
    | "malformed_json"
    | "invalid_document"
    | "missing_event_id"
    | "missing_event_type"
    | "missing_timestamp"
    | "unknown_object"
    | "unknown_object_type";
  message: string;
  eventIndex?: number;
  objectIndex?: number;
}

/**
 * `fromOcel`'s result — the same `{ ok: true, … } | { ok: false, errors }` shape as
 * `fromXes`. `logs` is keyed by object type; `activities` lists every event type that
 * occurs, in first-appearance order; `objectTypes` is the projected types, in order.
 */
export type OcelParseResult =
  | { ok: true; logs: Record<string, EventLog>; activities: string[]; objectTypes: string[] }
  | { ok: false; errors: OcelParseError[] };

/** The reserved attribute holding an emitted row's OCEL event id. */
export const OCEL_EVENT_ID_ATTRIBUTE = "__ocelEventId";
/** The reserved attribute holding an emitted row's JSON-encoded object map. */
export const OCEL_OBJECT_REFS_ATTRIBUTE = "__objectRefs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * An object's attributes as a flat record: for a time-varying attribute the value with the
 * LATEST `time` wins (document order breaks ties), which is the object's final state.
 */
function objectAttributes(object: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!Array.isArray(object.attributes)) return undefined;
  const latest = new Map<string, { time: number; value: unknown }>();
  for (const raw of object.attributes) {
    if (!isRecord(raw) || !nonEmptyString(raw.name) || !isScalar(raw.value)) continue;
    const parsed = typeof raw.time === "string" ? Date.parse(raw.time) : Number.NEGATIVE_INFINITY;
    const time = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    const previous = latest.get(raw.name);
    if (previous === undefined || time >= previous.time) {
      latest.set(raw.name, { time, value: raw.value });
    }
  }
  if (latest.size === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const [name, entry] of latest) out[name] = entry.value;
  return out;
}

/**
 * Read an OCEL 2.0 JSON document (a string, or an already-parsed object) into one
 * {@link EventLog} per object type.
 *
 * Collects every per-event problem (a missing id, type or parsable `time`; a relationship
 * to an object the document never declares) rather than stopping at the first; only a
 * document that is not JSON, or not shaped like OCEL at all, short-circuits. Any error
 * fails the whole read — a silently-dropped event would change every count downstream.
 */
export function fromOcel(input: string | OcelJson, options?: OcelParseOptions): OcelParseResult {
  let document: unknown = input;
  if (typeof input === "string") {
    try {
      document = JSON.parse(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, errors: [{ type: "malformed_json", message }] };
    }
  }

  if (
    !isRecord(document) ||
    !Array.isArray(document.objectTypes) ||
    !Array.isArray(document.objects) ||
    !Array.isArray(document.events)
  ) {
    return {
      ok: false,
      errors: [
        {
          type: "invalid_document",
          message: "expected an object with objectTypes, objects and events arrays",
        },
      ],
    };
  }

  const errors: OcelParseError[] = [];

  const declaredTypes: string[] = [];
  for (const declaration of document.objectTypes) {
    if (isRecord(declaration) && nonEmptyString(declaration.name)) {
      if (!declaredTypes.includes(declaration.name)) declaredTypes.push(declaration.name);
    }
  }

  const projected = options?.objectTypes ?? declaredTypes;
  for (const type of projected) {
    if (!declaredTypes.includes(type)) {
      errors.push({
        type: "unknown_object_type",
        message: `object type "${type}" is not declared in objectTypes`,
      });
    }
  }
  const projectedSet = new Set(projected);

  const typeOfObject = new Map<string, string>();
  const attributesOfObject = new Map<string, Record<string, unknown>>();
  document.objects.forEach((object, objectIndex) => {
    if (!isRecord(object) || !nonEmptyString(object.id) || !nonEmptyString(object.type)) {
      errors.push({
        type: "invalid_document",
        message: "object is missing its id or type",
        objectIndex,
      });
      return;
    }
    if (!declaredTypes.includes(object.type)) {
      errors.push({
        type: "unknown_object_type",
        message: `object "${object.id}" has undeclared type "${object.type}"`,
        objectIndex,
      });
      return;
    }
    typeOfObject.set(object.id, object.type);
    const attributes = objectAttributes(object);
    if (attributes !== undefined) attributesOfObject.set(object.id, attributes);
  });

  const rowsByType = new Map<string, EventRow[]>(projected.map((type) => [type, []]));
  const activities: string[] = [];
  const seenActivities = new Set<string>();

  document.events.forEach((event, eventIndex) => {
    if (!isRecord(event)) {
      errors.push({ type: "invalid_document", message: "event is not an object", eventIndex });
      return;
    }
    if (!nonEmptyString(event.id)) {
      errors.push({ type: "missing_event_id", message: "event is missing its id", eventIndex });
      return;
    }
    if (!nonEmptyString(event.type)) {
      errors.push({
        type: "missing_event_type",
        message: `event "${event.id}" is missing its type`,
        eventIndex,
      });
      return;
    }
    if (!nonEmptyString(event.time) || Number.isNaN(Date.parse(event.time))) {
      errors.push({
        type: "missing_timestamp",
        message: `event "${event.id}" has no parsable time`,
        eventIndex,
      });
      return;
    }

    // Group this event's references by object type, deduplicated (the same object can be
    // referenced twice under two qualifiers) and in document order.
    const refs: Record<string, string[]> = {};
    let broken = false;
    const relationships = Array.isArray(event.relationships) ? event.relationships : [];
    for (const relationship of relationships) {
      if (!isRecord(relationship) || !nonEmptyString(relationship.objectId)) continue;
      const type = typeOfObject.get(relationship.objectId);
      if (type === undefined) {
        errors.push({
          type: "unknown_object",
          message: `event "${event.id}" references undeclared object "${relationship.objectId}"`,
          eventIndex,
        });
        broken = true;
        continue;
      }
      const ids = (refs[type] ??= []);
      if (!ids.includes(relationship.objectId)) ids.push(relationship.objectId);
    }
    if (broken) return;

    if (!seenActivities.has(event.type)) {
      seenActivities.add(event.type);
      activities.push(event.type);
    }

    let attributes: Record<string, string | number | boolean | null> | undefined;
    if (Array.isArray(event.attributes)) {
      for (const attribute of event.attributes) {
        if (!isRecord(attribute) || !nonEmptyString(attribute.name)) continue;
        if (!isScalar(attribute.value)) continue;
        attributes ??= {};
        attributes[attribute.name] = attribute.value;
      }
    }
    const encodedRefs = JSON.stringify(refs);

    for (const [type, objectIds] of Object.entries(refs)) {
      if (!projectedSet.has(type)) continue;
      const rows = rowsByType.get(type) as EventRow[];
      for (const objectId of objectIds) {
        rows.push({
          caseId: objectId,
          activity: event.type,
          timestamp: event.time,
          attributes: {
            ...attributes,
            [OCEL_EVENT_ID_ATTRIBUTE]: event.id,
            [OCEL_OBJECT_REFS_ATTRIBUTE]: encodedRefs,
          },
        });
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  const logs: Record<string, EventLog> = {};
  for (const type of projected) {
    const events = rowsByType.get(type) as EventRow[];
    const log: EventLog = { events };
    let caseAttributes: Record<string, Record<string, unknown>> | undefined;
    for (const row of events) {
      const attributes = attributesOfObject.get(row.caseId);
      if (attributes === undefined || caseAttributes?.[row.caseId] !== undefined) continue;
      caseAttributes ??= {};
      caseAttributes[row.caseId] = attributes;
    }
    if (caseAttributes !== undefined) log.caseAttributes = caseAttributes;
    logs[type] = log;
  }

  return { ok: true, logs, activities, objectTypes: [...projected] };
}

/**
 * The object map an emitted row was flattened from (`{ order: ["o1"], item: ["i1"] }`), or
 * `undefined` for a row that did not come from {@link fromOcel}.
 */
export function readObjectRefs(row: EventRow): Record<string, string[]> | undefined {
  const raw = row.attributes?.[OCEL_OBJECT_REFS_ATTRIBUTE];
  if (typeof raw !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return undefined;
    const out: Record<string, string[]> = {};
    for (const [type, ids] of Object.entries(parsed)) {
      if (Array.isArray(ids)) out[type] = ids.filter((id): id is string => typeof id === "string");
    }
    return out;
  } catch {
    return undefined;
  }
}
