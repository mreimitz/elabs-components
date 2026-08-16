/**
 * app-spec — the ONE implementation of the app-spec contract (VP-02 #122/#123).
 *
 * The `brand-ui-new-app` interview produces an app-spec (a fenced ```json block
 * inside `app-spec.md`); `brand-ui scaffold` consumes it. Two callers need the
 * exact same reader + validator:
 *
 *   - `scripts/check-app-spec.mjs` (the `pnpm app-spec:check` CI gate), and
 *   - `planScaffold`/`emitScaffold` in `./engine.mjs` (the scaffold engine).
 *
 * Before #123 the validator lived only in the gate, so the engine could not read
 * an `app-spec.md` at all — and any second implementation would have drifted from
 * the gate on day one. It lives here for the same reason `check-anti-slop.mjs`
 * imports its rules from `./audit.mjs`: **one source of truth, imported by both.**
 *
 * Dependency-free (a small JSON-Schema subset — no ajv, no paid deps) and
 * deterministic. Expected failures are returned as `{ error }`, never thrown.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Where the shipped schema lives, relative to the repo root. */
export const SCHEMA_PATH = "skills/brand-ui-new-app/reference/app-spec.schema.json";
/** The shipped example spec (the gate's default fixture), relative to the repo root. */
export const EXAMPLE_PATH = "skills/brand-ui-new-app/reference/app-spec.example.md";

function jsType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function matchesType(v, t) {
  if (t === "object") return v !== null && typeof v === "object" && !Array.isArray(v);
  if (t === "array") return Array.isArray(v);
  if (t === "null") return v === null;
  // JSON Schema's `integer` is a `number` constrained to whole values — JS has
  // one numeric type, so `jsType` alone can't tell them apart (`taste.
  // expressiveness` is the first integer field in the contract).
  if (t === "integer") return typeof v === "number" && Number.isInteger(v);
  return jsType(v) === t; // string | number | boolean
}

/**
 * Validate `value` against a JSON-Schema **subset**. Returns findings (empty = OK).
 * Supports: type (string or array of types, incl. `integer`), required, enum,
 * minLength, minItems, minimum, maximum,
 * properties, items. additionalProperties is intentionally permissive.
 */
export function validate(value, schema, path = "$") {
  const errors = [];
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : null;
  if (types && !types.some((t) => matchesType(value, t))) {
    errors.push(`${path}: expected ${types.join("|")}, got ${jsType(value)}`);
    return errors; // type mismatch — don't cascade into the wrong shape
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in [${schema.enum.join(", ")}]`);
  }
  if (typeof value === "string" && schema.minLength != null && value.length < schema.minLength) {
    errors.push(`${path}: shorter than minLength ${schema.minLength}`);
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path}: fewer than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((v, i) => errors.push(...validate(v, schema.items, `${path}[${i}]`)));
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const req of schema.required ?? []) {
      if (!(req in value)) errors.push(`${path}: missing required "${req}"`);
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) errors.push(...validate(value[k], sub, `${path}.${k}`));
    }
  }
  return errors;
}

/** Validate a parsed spec object against the schema. */
export function validateSpec(spec, schema) {
  return validate(spec, schema, "spec");
}

/** Extract the first fenced ```json block from app-spec.md → { data } | { error }. */
export function extractSpec(md) {
  const m = md.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return { error: "no fenced ```json spec block found in app-spec.md" };
  try {
    return { data: JSON.parse(m[1]) };
  } catch (e) {
    return { error: `invalid JSON in the spec block: ${e.message}` };
  }
}

/** Resolve a spec from a file path: .md → extract the json block; .json → parse. */
export function specFromFile(abs) {
  if (!existsSync(abs)) return { error: `not found: ${abs}` };
  const text = readFileSync(abs, "utf8");
  if (abs.endsWith(".json")) {
    try {
      return { data: JSON.parse(text) };
    } catch (e) {
      return { error: `invalid JSON: ${e.message}` };
    }
  }
  return extractSpec(text);
}

/**
 * Load the shipped schema from a repo root. Returns `null` when it isn't reachable
 * (the CLI installed as a consumer dependency has no `skills/` tree) so callers can
 * degrade to their own minimal checks instead of crashing.
 */
export function loadSchema(root) {
  if (!root) return null;
  const file = join(root, SCHEMA_PATH);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
