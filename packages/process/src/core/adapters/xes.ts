/**
 * XES adapter — RM-063.
 *
 * IEEE 1849-2016's interchange format for event logs: a `<log>` of `<trace>`s of
 * `<event>`s, each carrying `key`/`value` attributes typed by their own element name
 * (`string`, `date`, `int`, `float`, `boolean`). It is the format most public benchmark
 * logs — including the BPI Challenge series RM-049's synthetic fixture is modelled on —
 * actually ship in.
 *
 * Parsing is hand-rolled here on purpose, and NOT behind a `DOMParser` fast path:
 * `/core` must run identically in Node, in a worker and in a browser main thread, and a
 * parser this narrow — six element names, attribute-only values, the five standard XML
 * entities, self-closing tags — does not need a general XML engine. `DOMParser` is
 * unavailable in Node/workers anyway, and branching on its presence would leave one of
 * the two code paths permanently untested. Do not reach for an XML dependency or
 * `DOMParser` here; extend the tokenizer below instead.
 */
import type { EventLog, EventRow } from "../types";

/** Options for {@link fromXes}. */
export interface XesParseOptions {
  /**
   * Event attribute keys that jointly identify an activity, applied in order and joined
   * with `"+"` when there is more than one — the same semantics as an XES `<classifier>`
   * element's `keys` attribute. Defaults to the log's own first `<classifier>`, or
   * `["concept:name"]` when the log declares none.
   */
  classifiers?: string[];
  /**
   * How `lifecycle:transition` maps onto {@link EventRow.lifecycle}. `"standard"`
   * (default) maps the literal value `"start"` to `"start"` and every other XES
   * lifecycle value (`"complete"`, `"schedule"`, `"suspend"`, …) to `"complete"`;
   * `"none"` ignores the attribute entirely, so every event stays atomic.
   */
  lifecycleModel?: "standard" | "none";
}

/** One recoverable problem found while reading a XES document. */
export interface XesParseError {
  type: "malformed_xml" | "missing_trace" | "missing_concept_name" | "missing_timestamp";
  message: string;
  traceIndex?: number;
  eventIndex?: number;
}

/**
 * `fromXes`'s result — mirrors the worker's `{ ok: true, … } | { ok: false, … }` result
 * convention (`worker/process-worker.ts`), because unlike `fromCsv`/`fromFlatRows` (which
 * silently skip an incomplete row) a XES document can be genuinely malformed XML, which
 * has nothing sound left to skip to.
 */
export type XesParseResult = { ok: true; log: EventLog } | { ok: false; errors: XesParseError[] };

type XesAttributeValue = string | number | boolean | null;

/** A parsed XML element, scoped to the tags XES actually uses (see the file header). */
interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlElement[];
}

/** Thrown only inside {@link parseXmlDocument}; always caught and turned into `malformed_xml`. */
class XmlSyntaxError extends Error {}

const NAME_STOP = /[\s/>=]/;
const ENTITY_NAMES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Resolve `&amp;`, `&#39;`, `&#x27;` and friends. Anything unrecognized is left as written. */
function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITY_NAMES[body] ?? match;
  });
}

/**
 * Parse well-formed XML into a tree of {@link XmlElement}, decoding entities as it goes.
 * Deliberately narrow: no namespaces, no DTDs, no processing-instruction content, no
 * nested-attribute (XES 2.0) support — the trace/event/string/date/int/float/boolean/
 * classifier/global vocabulary this adapter reads needs none of that.
 */
function parseXmlDocument(text: string): XmlElement {
  let i = 0;
  const n = text.length;

  const skipWhitespace = (): void => {
    while (i < n && /\s/.test(text[i] as string)) i += 1;
  };
  const skipUntil = (marker: string, what: string): void => {
    const at = text.indexOf(marker, i);
    if (at === -1) throw new XmlSyntaxError(`unterminated ${what}`);
    i = at + marker.length;
  };
  const readName = (): string => {
    const start = i;
    while (i < n && !NAME_STOP.test(text[i] as string)) i += 1;
    if (i === start) throw new XmlSyntaxError(`expected a name at offset ${start}`);
    return text.slice(start, i);
  };
  const readAttrs = (): Record<string, string> => {
    const attrs: Record<string, string> = {};
    for (;;) {
      skipWhitespace();
      const c = text[i];
      if (c === undefined) throw new XmlSyntaxError("unexpected end of input in a start tag");
      if (c === "/" || c === ">") return attrs;
      const name = readName();
      skipWhitespace();
      if (text[i] !== "=") throw new XmlSyntaxError(`expected "=" after attribute "${name}"`);
      i += 1;
      skipWhitespace();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") {
        throw new XmlSyntaxError(`expected a quoted value for attribute "${name}"`);
      }
      i += 1;
      const start = i;
      while (i < n && text[i] !== quote) i += 1;
      if (i >= n) throw new XmlSyntaxError(`unterminated value for attribute "${name}"`);
      attrs[name] = decodeXmlEntities(text.slice(start, i));
      i += 1;
    }
  };
  const readElement = (): XmlElement => {
    i += 1; // consume '<'
    const tag = readName();
    const attrs = readAttrs();
    skipWhitespace();
    if (text[i] === "/" && text[i + 1] === ">") {
      i += 2;
      return { tag, attrs, children: [] };
    }
    if (text[i] !== ">") throw new XmlSyntaxError(`expected ">" closing "<${tag}>"`);
    i += 1;
    const children: XmlElement[] = [];
    for (;;) {
      const lt = text.indexOf("<", i);
      if (lt === -1) throw new XmlSyntaxError(`unterminated element "<${tag}>"`);
      i = lt;
      if (text.startsWith("<!--", i)) {
        skipUntil("-->", "comment");
        continue;
      }
      if (text.startsWith("<![CDATA[", i)) {
        skipUntil("]]>", "CDATA section");
        continue;
      }
      if (text.startsWith("</", i)) {
        i += 2;
        const closeName = readName();
        skipWhitespace();
        if (text[i] !== ">") throw new XmlSyntaxError(`expected ">" closing "</${closeName}>"`);
        i += 1;
        if (closeName !== tag) {
          throw new XmlSyntaxError(
            `mismatched closing tag: expected "</${tag}>", found "</${closeName}>"`,
          );
        }
        return { tag, attrs, children };
      }
      children.push(readElement());
    }
  };

  for (;;) {
    skipWhitespace();
    if (i >= n) throw new XmlSyntaxError("empty document");
    if (text.startsWith("<?", i)) {
      skipUntil("?>", "processing instruction");
      continue;
    }
    if (text.startsWith("<!--", i)) {
      skipUntil("-->", "comment");
      continue;
    }
    if (text.startsWith("<!", i)) {
      skipUntil(">", "declaration");
      continue;
    }
    break;
  }
  if (text[i] !== "<") throw new XmlSyntaxError("expected a root element");
  return readElement();
}

const XES_VALUE_TAGS = new Set(["string", "date", "int", "float", "boolean"]);

/** Coerce one `<string|date|int|float|boolean key="…" value="…">` into a typed value. */
function readXesValue(element: XmlElement): XesAttributeValue {
  const raw = element.attrs.value;
  if (raw === undefined) return null;
  if (element.tag === "int") {
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : raw;
  }
  if (element.tag === "float") {
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : raw;
  }
  if (element.tag === "boolean") return raw.trim().toLowerCase() === "true";
  return raw;
}

/** Read every direct `key`/`value` attribute child (`string`/`date`/`int`/`float`/`boolean`). */
function readAttributeChildren(children: readonly XmlElement[]): Record<string, XesAttributeValue> {
  const result: Record<string, XesAttributeValue> = {};
  for (const child of children) {
    if (!XES_VALUE_TAGS.has(child.tag)) continue;
    const key = child.attrs.key;
    if (key === undefined) continue;
    result[key] = readXesValue(child);
  }
  return result;
}

/** `own` values win; a `<global>` default only fills a key `own` never set. */
function withDefaults(
  own: Record<string, XesAttributeValue>,
  defaults: Record<string, XesAttributeValue> | undefined,
): Record<string, XesAttributeValue> {
  return defaults === undefined ? own : { ...defaults, ...own };
}

/** Merge every `<global scope="…">` of the given scope, in document order. */
function collectGlobalDefaults(
  root: XmlElement,
  scope: "event" | "trace",
): Record<string, XesAttributeValue> | undefined {
  let defaults: Record<string, XesAttributeValue> | undefined;
  for (const child of root.children) {
    if (child.tag !== "global" || child.attrs.scope !== scope) continue;
    defaults = withDefaults(readAttributeChildren(child.children), defaults);
  }
  return defaults;
}

/**
 * The keys that jointly name an activity: `options.classifiers` when given, else the
 * log's own first `<classifier>`, else the XES default of `concept:name` alone.
 */
function resolveClassifierKeys(root: XmlElement, options: XesParseOptions | undefined): string[] {
  if (options?.classifiers !== undefined && options.classifiers.length > 0) {
    return options.classifiers;
  }
  const classifier = root.children.find((child) => child.tag === "classifier");
  const keys = classifier?.attrs.keys?.trim();
  if (keys !== undefined && keys !== "") return keys.split(/\s+/);
  return ["concept:name"];
}

/** The literal value `"start"` maps to `"start"`; every other value collapses to `"complete"`. */
function mapLifecycle(
  raw: XesAttributeValue | undefined,
  model: "standard" | "none",
): "start" | "complete" | undefined {
  if (typeof raw !== "string" || model === "none") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "") return undefined;
  return value === "start" ? "start" : "complete";
}

/**
 * Read a IEEE 1849 XES document into an {@link EventLog}.
 *
 * Collects every recoverable problem (a trace with no events, an event missing its
 * activity classifier key(s) or `time:timestamp`) rather than stopping at the first one;
 * only malformed XML itself — which leaves nothing sound to keep reading — short-circuits
 * with a single `malformed_xml` error. Output feeds directly into `normalizeLog`, exactly
 * like `fromCsv`/`fromFlatRows` — no XES-specific branching downstream.
 */
export function fromXes(source: string, options?: XesParseOptions): XesParseResult {
  let root: XmlElement;
  try {
    root = parseXmlDocument(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [{ type: "malformed_xml", message }] };
  }

  const lifecycleModel = options?.lifecycleModel ?? "standard";
  const classifierKeys = resolveClassifierKeys(root, options);
  const consumedKeys = new Set([
    ...classifierKeys,
    "time:timestamp",
    "org:resource",
    "lifecycle:transition",
  ]);
  const eventDefaults = collectGlobalDefaults(root, "event");
  const traceDefaults = collectGlobalDefaults(root, "trace");

  const errors: XesParseError[] = [];
  const events: EventRow[] = [];
  let caseAttributes: Record<string, Record<string, unknown>> | undefined;

  const traces = root.children.filter((child) => child.tag === "trace");
  traces.forEach((trace, traceIndex) => {
    const traceEvents = trace.children.filter((child) => child.tag === "event");
    if (traceEvents.length === 0) {
      errors.push({ type: "missing_trace", message: "trace has no events", traceIndex });
      return;
    }

    const { "concept:name": rawCaseId, ...traceValues } = withDefaults(
      readAttributeChildren(trace.children),
      traceDefaults,
    );
    const caseId =
      typeof rawCaseId === "string" && rawCaseId !== "" ? rawCaseId : `trace-${traceIndex}`;

    if (Object.keys(traceValues).length > 0) {
      caseAttributes ??= {};
      caseAttributes[caseId] = traceValues;
    }

    traceEvents.forEach((eventElement, eventIndex) => {
      const values = withDefaults(readAttributeChildren(eventElement.children), eventDefaults);

      const activityParts: string[] = [];
      let missingActivityKey = false;
      for (const key of classifierKeys) {
        const value = values[key];
        if (value === undefined || value === null) {
          missingActivityKey = true;
          break;
        }
        activityParts.push(String(value));
      }
      if (missingActivityKey) {
        errors.push({
          type: "missing_concept_name",
          message: "event is missing its classifier key(s)",
          traceIndex,
          eventIndex,
        });
        return;
      }

      const rawTimestamp = values["time:timestamp"];
      if (rawTimestamp === undefined || rawTimestamp === null) {
        errors.push({
          type: "missing_timestamp",
          message: "event is missing time:timestamp",
          traceIndex,
          eventIndex,
        });
        return;
      }

      const row: EventRow = {
        caseId,
        activity: activityParts.join("+"),
        timestamp: String(rawTimestamp),
      };

      const resource = values["org:resource"];
      if (typeof resource === "string" && resource !== "") row.resource = resource;

      const lifecycle = mapLifecycle(values["lifecycle:transition"], lifecycleModel);
      if (lifecycle !== undefined) row.lifecycle = lifecycle;

      const attributes: Record<string, string | number | boolean | null> = {};
      let anyAttribute = false;
      for (const [key, value] of Object.entries(values)) {
        if (consumedKeys.has(key)) continue;
        attributes[key] = value;
        anyAttribute = true;
      }
      if (anyAttribute) row.attributes = attributes;

      events.push(row);
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const log: EventLog = { events };
  if (caseAttributes !== undefined) log.caseAttributes = caseAttributes;
  return { ok: true, log };
}
