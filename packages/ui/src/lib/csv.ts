/**
 * Shared CSV (RFC 4180) primitives — value stringification + injection-guarded
 * field quoting. Pure, no DOM, SSR-safe.
 *
 * The single home for logic previously duplicated between `@elabs-ai/components-data`'s
 * `toCsv` and `@elabs-ai/components-charts`'s `ChartFrame` local serializer (charts may not
 * depend on data per the one-way package rule, so both import this instead of
 * one importing the other).
 */

/** Leading characters a spreadsheet may interpret as a formula trigger. */
const INJECTION_TRIGGER = /^[=+\-@]/;

/**
 * True when `field` parses as a plain finite number, e.g. "-5" or "+12.3".
 * A negative/positive number is not a formula — only guard fields that
 * START with a trigger character AND are not actually numeric.
 */
function isNumericLiteral(field: string): boolean {
  const trimmed = field.trim();
  if (trimmed === "") return false;
  return Number.isFinite(Number(trimmed));
}

/** Stringify a cell value for CSV: dates → ISO, objects → JSON, else `String()`. */
export function csvStringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Quote/escape one CSV field: prefixes a leading `'` when the field starts
 * with a formula-trigger character and is not a plain number (CSV-injection
 * guard), then RFC-4180-quotes when it contains the delimiter, a double
 * quote, or a line break.
 */
export function csvQuoteField(field: string, delimiter: string): string {
  let out = field;
  if (INJECTION_TRIGGER.test(out) && !isNumericLiteral(out)) {
    out = "'" + out;
  }
  if (out.includes(delimiter) || out.includes('"') || out.includes("\n") || out.includes("\r")) {
    return '"' + out.replaceAll('"', '""') + '"';
  }
  return out;
}
