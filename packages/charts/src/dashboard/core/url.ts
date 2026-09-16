/**
 * The URL/bookmark state codec (RM-083; analysis §4 R18–R20, Sources: Grafana `var-<name>=`
 * URL params, Qlik bookmarks — selection + variables + optional sheet, never layout — and
 * nuqs as the common React URL-state library a host may already use). Framework-free, pure:
 * no `window`/`history`/router import anywhere in this module (D5) — `useDashboardUrlState`
 * (`dashboard-sheet/use-dashboard-url-state.ts`) is the seam a host wires to its own router.
 *
 * `decodeDashboardState` NEVER throws: malformed or oversized input returns `null`, and an
 * unrecognised segment inside an otherwise-valid string is ignored (forward compatible with
 * a later version's own fields).
 *
 * Wire format — deterministic key order so two equal states always produce the same string
 * (a stable share link, and no thrash in a host's own URL-history stack):
 *
 * ```
 * v1[;s.<field>=<tag><value>|<tag><value>...]*[;v.<name>=<tag><value>]*[;b=<id>][;sh=<id>]
 * ```
 *
 * - Selected fields, then variables, each sorted by key; `;` separates segments (chosen, not
 *   `.`, because `.`  is one of `encodeURIComponent`'s unreserved characters — it would
 *   survive inside an encoded value and collide with the separator; `;` never does).
 * - A selection value is tagged `n:` (number) or `s:` (string, including the empty string) so
 *   a field carrying no values (dropped entirely, see below) and one holding a single empty
 *   string (`s.<field>=s:`) never collide.
 * - A variable value is tagged `n:` (number), `b:` (boolean) or `d:` (a string that reads as
 *   an ISO-8601 date — `VariableSpec.type === "date"` values are strings, analysis §5.1) —
 *   otherwise untagged (a plain string).
 * - Every key and value is percent-encoded (`encodeURIComponent`), so `;`, `|`, `=` and `:`
 *   inside a real value can never be mistaken for wire syntax — an untagged string value can
 *   never accidentally start with `n:`/`b:`/`d:`/`s:` either, since `:` is always escaped.
 */
import type { SelectionValue } from "./selection";
import type { VariableValue } from "./spec";

const VERSION = 1;
const VERSION_PREFIX = `v${VERSION}`;

/** Decode refuses anything longer than this — a share link stays small by construction. */
export const DASHBOARD_URL_STATE_MAX_LENGTH = 8 * 1024;

/** What `encodeDashboardState` accepts and `decodeDashboardState` returns on success. */
export interface DecodedState {
  /** Non-empty selections only, one array per field. */
  selection: Record<string, SelectionValue[]>;
  variables: Record<string, VariableValue>;
  /** The bookmark this state was saved from, when it was. */
  bookmarkId?: string;
  /** The sheet this state belongs to, in a multi-sheet workbook. */
  sheetId?: string;
}

/** `encodeDashboardState`'s input — every field optional, an empty state encodes to `"v1"`. */
export interface EncodeDashboardStateInput {
  selection?: Record<string, SelectionValue[]>;
  variables?: Record<string, VariableValue>;
  bookmarkId?: string;
  sheetId?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function safeDecodeURIComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function encodeSelectionValue(value: SelectionValue): string {
  return typeof value === "number"
    ? `n:${encodeURIComponent(String(value))}`
    : `s:${encodeURIComponent(value)}`;
}

function decodeSelectionValue(raw: string): SelectionValue | undefined {
  if (raw.startsWith("n:")) {
    const decoded = safeDecodeURIComponent(raw.slice(2));
    const n = decoded === undefined ? NaN : Number(decoded);
    return Number.isFinite(n) ? n : undefined;
  }
  if (raw.startsWith("s:")) return safeDecodeURIComponent(raw.slice(2));
  return undefined;
}

function encodeVariableValue(value: VariableValue): string {
  if (typeof value === "number") return `n:${encodeURIComponent(String(value))}`;
  if (typeof value === "boolean") return `b:${value}`;
  if (ISO_DATE_RE.test(value)) return `d:${encodeURIComponent(value)}`;
  return encodeURIComponent(value);
}

function decodeVariableValue(raw: string): VariableValue | undefined {
  if (raw.startsWith("n:")) {
    const decoded = safeDecodeURIComponent(raw.slice(2));
    const n = decoded === undefined ? NaN : Number(decoded);
    return Number.isFinite(n) ? n : undefined;
  }
  if (raw.startsWith("b:")) {
    const rest = raw.slice(2);
    if (rest === "true") return true;
    if (rest === "false") return false;
    return undefined;
  }
  if (raw.startsWith("d:")) return safeDecodeURIComponent(raw.slice(2));
  return safeDecodeURIComponent(raw);
}

/**
 * Encode selection + variables (+ optional bookmark/sheet ids) into a compact, URL-safe,
 * versioned string — a share link's `?d=` value. Pure; deterministic key order (equal
 * states always produce an identical string). A field or variable map with no entries (or
 * only empty-array fields) is simply omitted — `encodeDashboardState({})` is `"v1"`.
 */
export function encodeDashboardState(state: EncodeDashboardStateInput): string {
  const parts: string[] = [VERSION_PREFIX];
  const fields = Object.keys(state.selection ?? {}).sort();
  for (const field of fields) {
    const values = state.selection?.[field] ?? [];
    if (values.length === 0) continue;
    parts.push(`s.${encodeURIComponent(field)}=${values.map(encodeSelectionValue).join("|")}`);
  }
  const names = Object.keys(state.variables ?? {}).sort();
  const variables = state.variables ?? {};
  for (const name of names)
    parts.push(
      `v.${encodeURIComponent(name)}=${encodeVariableValue(variables[name] as VariableValue)}`,
    );
  if (state.bookmarkId) parts.push(`b=${encodeURIComponent(state.bookmarkId)}`);
  if (state.sheetId) parts.push(`sh=${encodeURIComponent(state.sheetId)}`);
  return parts.join(";");
}

/**
 * Decode a string `encodeDashboardState` produced. Never throws: malformed input, an
 * unsupported version or anything over `DASHBOARD_URL_STATE_MAX_LENGTH` (8 kB) returns
 * `null`. Unknown segments inside an otherwise-valid string are ignored.
 */
export function decodeDashboardState(input: string): DecodedState | null {
  if (typeof input !== "string" || input.length === 0) return null;
  if (input.length > DASHBOARD_URL_STATE_MAX_LENGTH) return null;
  const parts = input.split(";");
  if (parts[0] !== VERSION_PREFIX) return null;

  const result: DecodedState = { selection: {}, variables: {} };
  for (const part of parts.slice(1)) {
    if (part.startsWith("s.")) {
      const eq = part.indexOf("=", 2);
      if (eq === -1) continue;
      const field = safeDecodeURIComponent(part.slice(2, eq));
      if (field === undefined) continue;
      const raw = part.slice(eq + 1);
      if (raw === "") continue; // a field with no values is dropped on encode too
      const values = raw.split("|").map(decodeSelectionValue);
      if (values.some((v) => v === undefined)) continue;
      result.selection[field] = values as SelectionValue[];
    } else if (part.startsWith("v.")) {
      const eq = part.indexOf("=", 2);
      if (eq === -1) continue;
      const name = safeDecodeURIComponent(part.slice(2, eq));
      if (name === undefined) continue;
      const value = decodeVariableValue(part.slice(eq + 1));
      if (value === undefined) continue;
      result.variables[name] = value;
    } else if (part.startsWith("b=")) {
      const id = safeDecodeURIComponent(part.slice(2));
      if (id !== undefined) result.bookmarkId = id;
    } else if (part.startsWith("sh=")) {
      const id = safeDecodeURIComponent(part.slice(3));
      if (id !== undefined) result.sheetId = id;
    }
    // else: an unrecognised segment — ignored, forward compatible.
  }
  return result;
}
