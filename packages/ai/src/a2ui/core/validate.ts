/**
 * validate.ts — `validateA2uiSurface`: is this JSON a surface the catalog can
 * render? Never throws, never repairs; every problem is a typed `A2uiError` with
 * a path, so an agent can fix its own output from the message and a host can
 * prune the failing subtree while streaming (`invalidNodePaths`).
 */
import {
  A2UI_COMMON_PROPS,
  A2UI_VERSION,
  type A2uiAction,
  type A2uiCatalogSchema,
  type A2uiCatalogTypeSchema,
  type A2uiElement,
  type A2uiError,
  type A2uiNode,
  type A2uiPropSchema,
  type A2uiSurfaceSpec,
} from "./spec";

export type A2uiValidation =
  // `errors` means exactly what it always meant — blocking issues only, so
  // `errors.length === 0` ⇔ `ok`. Non-blocking issues (today only `deprecated-prop`) live
  // in `warnings` (ADR 0042 §8). A surface naming a deprecated prop is still `ok: true` with
  // one entry in `warnings` — never in `errors`.
  //
  // `warnings` is typed optional so a caller that constructs this type itself (a typed test
  // double, a wrapper) doesn't break on the new field — `validateA2uiSurface` itself ALWAYS
  // sets it (empty array when there are none). A result read straight from `validateA2uiSurface`
  // may keep reading `.warnings` directly; anything else should read `result.warnings ?? []`.
  | { ok: true; spec: A2uiSurfaceSpec; errors: []; warnings?: A2uiError[] }
  | { ok: false; spec: A2uiSurfaceSpec | null; errors: A2uiError[]; warnings?: A2uiError[] };

type Report = (e: Omit<A2uiError, "node">) => void;

/** A short, human name for one alternative shape — `describeShape({type:"number"})` → `"a number"`. */
function describeShape(s: A2uiPropSchema): string {
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join("|");
  if (s.properties) {
    const parts = Object.keys(s.properties).map((k) =>
      s.requiredProperties?.includes(k) ? k : `${k}?`,
    );
    return `{ ${parts.join(", ")} }`;
  }
  switch (s.type) {
    case "string":
      return "a string";
    case "number":
      return "a number";
    case "boolean":
      return "a boolean";
    case "array":
      return "an array";
    case "object":
      return "an object";
    case "node":
      return "a node";
    default:
      return s.type;
  }
}

/** "a number, { aspect }, or { base, medium?, narrow? }" — an Oxford-comma'd shape list. */
function describeShapes(alts: A2uiPropSchema[]): string {
  const shapes = alts.map(describeShape);
  if (shapes.length < 2) return shapes.join("");
  if (shapes.length === 2) return shapes.join(" or ");
  return `${shapes.slice(0, -1).join(", ")}, or ${shapes[shapes.length - 1]}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** An element-shaped value: an object with a string `type`. */
export const isA2uiElement = (v: unknown): v is A2uiElement =>
  isRecord(v) && typeof v.type === "string";

/** Reserved keys on an element — anything else is a typo, not a prop. */
const ELEMENT_KEYS = new Set(["type", "id", "props", "children", "on"]);

function checkValue(
  value: unknown,
  schema: A2uiPropSchema,
  path: string,
  report: Report,
  errors: A2uiError[],
  warnings: A2uiError[],
  catalog: A2uiCatalogSchema,
): void {
  if (schema.enum) {
    if (!schema.enum.includes(value as string | number)) {
      report({
        path,
        code: "invalid-value",
        message: `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}; got ${JSON.stringify(value)}`,
      });
    }
    return;
  }
  // A closed set of alternative shapes (e.g. `Responsive<T>`): valid against ANY one of
  // them — `anyOf`, never `oneOf` (a JSON Schema `oneOf` misfires the moment two
  // alternatives are structurally similar; P1-1). Each alternative is tried in an isolated
  // trial list so a failing attempt never leaks its own sub-errors into the real result.
  if (schema.anyOf) {
    const matches = schema.anyOf.some((alt) => {
      const trialErrors: A2uiError[] = [];
      const trialWarnings: A2uiError[] = [];
      checkValue(
        value,
        alt,
        path,
        (e) => trialErrors.push({ ...e, node: "" }),
        trialErrors,
        trialWarnings,
        catalog,
      );
      return trialErrors.length === 0;
    });
    if (!matches) {
      report({
        path,
        code: "invalid-value",
        message: `expected ${describeShapes(schema.anyOf)}; got ${Array.isArray(value) ? "array" : typeof value}`,
      });
    }
    return;
  }
  const t = schema.type;
  const bad = (expected: string) =>
    report({
      path,
      code: "invalid-value",
      message: `expected ${expected}; got ${Array.isArray(value) ? "array" : typeof value}`,
    });
  switch (t) {
    case "string":
      if (typeof value !== "string") bad("a string");
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) bad("a number");
      break;
    case "boolean":
      if (typeof value !== "boolean") bad("a boolean");
      break;
    case "array":
      if (!Array.isArray(value)) bad("an array");
      break;
    case "object":
      if (!isRecord(value)) {
        bad("an object");
      } else if (schema.properties) {
        // A closed set of named sub-fields (P1-3, e.g. `{ aspect }` / `{ base, medium?,
        // narrow? }`) — an unlisted key or a missing required one rejects the whole value,
        // same as the surface's own `additionalProperties: false`.
        for (const key of Object.keys(value)) {
          if (!schema.properties[key]) {
            report({
              path: `${path}.${key}`,
              code: "invalid-value",
              message: `unknown key "${key}" (allowed: ${Object.keys(schema.properties).join(", ") || "none"})`,
            });
            return;
          }
        }
        for (const req of schema.requiredProperties || []) {
          if (value[req] === undefined) {
            report({
              path: `${path}.${req}`,
              code: "invalid-value",
              message: `"${req}" is required`,
            });
            return;
          }
        }
        for (const [key, sub] of Object.entries(schema.properties)) {
          if (value[key] !== undefined) {
            checkValue(value[key], sub, `${path}.${key}`, report, errors, warnings, catalog);
          }
        }
      }
      break;
    case "node": {
      // Text, a number, one element, or a list of nodes — each element validated.
      const items = Array.isArray(value) ? value : [value];
      items.forEach((item, i) => {
        const p = Array.isArray(value) ? `${path}[${i}]` : path;
        if (typeof item === "string" || typeof item === "number") return;
        if (isA2uiElement(item)) return checkNode(item, p, errors, warnings, catalog);
        report({
          path: p,
          code: "invalid-value",
          message: "expected text or a node ({ type, … })",
        });
      });
      break;
    }
    case "any":
      break;
  }
}

function checkAction(value: unknown, path: string, report: Report): value is A2uiAction {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) {
    report({
      path,
      code: "invalid-action",
      message: 'an action is { "name": "<host verb>", "payload"?: <json> }',
    });
    return false;
  }
  return true;
}

function checkNode(
  node: unknown,
  path: string,
  errors: A2uiError[],
  warnings: A2uiError[],
  catalog: A2uiCatalogSchema,
): void {
  const report: Report = (e) => errors.push({ ...e, node: path });
  const warn: Report = (e) => warnings.push({ ...e, node: path });
  if (typeof node === "string") return;
  if (!isA2uiElement(node)) {
    report({
      path,
      code: "invalid-node",
      message: 'a node is a string or { "type": "<catalog type>", … }',
    });
    return;
  }
  const entry: A2uiCatalogTypeSchema | undefined = catalog[node.type];
  if (!entry) {
    report({
      path: `${path}.type`,
      code: "unknown-type",
      message: `"${node.type}" is not in the catalog (run \`brand-ui a2ui catalog\`)`,
    });
    return;
  }
  for (const key of Object.keys(node)) {
    if (!ELEMENT_KEYS.has(key)) {
      report({
        path: `${path}.${key}`,
        code: "invalid-node",
        message: `unknown key "${key}" — a node has type, id, props, children, on`,
      });
    }
  }
  if (node.id !== undefined && typeof node.id !== "string") {
    report({ path: `${path}.id`, code: "invalid-value", message: "id must be a string" });
  }
  const props = node.props;
  if (props !== undefined && !isRecord(props)) {
    report({ path: `${path}.props`, code: "invalid-value", message: "props must be an object" });
  } else {
    const allowed: Record<string, A2uiPropSchema> = entry.builtin
      ? entry.props
      : { ...A2UI_COMMON_PROPS, ...entry.props };
    for (const [name, schema] of Object.entries(entry.props)) {
      if (schema.required && (props === undefined || props[name] === undefined)) {
        report({
          path: `${path}.props.${name}`,
          code: "missing-prop",
          message: `"${node.type}" requires "${name}"`,
        });
      }
    }
    if (props) {
      for (const [name, value] of Object.entries(props)) {
        const schema = allowed[name];
        if (!schema) {
          report({
            path: `${path}.props.${name}`,
            code: "unknown-prop",
            message: `"${name}" is not a prop of "${node.type}" (allowed: ${Object.keys(allowed).join(", ") || "none"})`,
          });
          continue;
        }
        // A separate list — never `errors` (ADR 0042 §8, orchestrator design decision after
        // fix round 1): a deprecated prop still validates; `warnings` is how a caller learns
        // about it without that ever risking `ok: false`.
        if (schema.deprecated) {
          const note = (schema.description ?? "").replace(/^Deprecated\s*[—-]\s*/i, "").trim();
          warn({
            path: `${path}.props.${name}`,
            code: "deprecated-prop",
            message: `"${name}" is deprecated${note ? ` — ${note}` : ""}`,
          });
        }
        checkValue(value, schema, `${path}.props.${name}`, report, errors, warnings, catalog);
      }
    }
  }
  if (node.children !== undefined) {
    if (!entry.children) {
      report({
        path: `${path}.children`,
        code: "children-not-allowed",
        message: `"${node.type}" does not take children`,
      });
    } else if (!Array.isArray(node.children)) {
      report({
        path: `${path}.children`,
        code: "invalid-value",
        message: "children must be an array of nodes",
      });
    } else {
      node.children.forEach((child, i) =>
        checkNode(child, `${path}.children[${i}]`, errors, warnings, catalog),
      );
    }
  }
  if (node.on !== undefined) {
    if (!isRecord(node.on)) {
      report({ path: `${path}.on`, code: "invalid-value", message: "on must be an object" });
    } else {
      for (const [event, action] of Object.entries(node.on)) {
        if (!entry.events[event]) {
          report({
            path: `${path}.on.${event}`,
            code: "unknown-event",
            message: `"${node.type}" has no "${event}" event (${Object.keys(entry.events).join(", ") || "none"})`,
          });
          continue;
        }
        checkAction(action, `${path}.on.${event}`, report);
      }
    }
  }
}

/**
 * Validate an untrusted value (a parsed tool result, a streamed JSON prefix)
 * against `catalog`. `ok: false` carries every problem found, in document order.
 */
export function validateA2uiSurface(input: unknown, catalog: A2uiCatalogSchema): A2uiValidation {
  const errors: A2uiError[] = [];
  const warnings: A2uiError[] = [];
  const report: Report = (e) => errors.push({ ...e, node: "root" });
  if (!isRecord(input)) {
    return {
      ok: false,
      spec: null,
      errors: [
        {
          path: "",
          node: "root",
          code: "invalid-root",
          message: 'expected { "a2ui": "1", "root": … }',
        },
      ],
      warnings: [],
    };
  }
  if (input.a2ui !== A2UI_VERSION) {
    report({
      path: "a2ui",
      code: "unsupported-version",
      message: `expected "a2ui": "${A2UI_VERSION}"; got ${JSON.stringify(input.a2ui)}`,
    });
  }
  if (input.title !== undefined && typeof input.title !== "string") {
    report({ path: "title", code: "invalid-value", message: "title must be a string" });
  }
  if (input.root === undefined) {
    report({ path: "root", code: "invalid-root", message: "root is required" });
  } else {
    checkNode(input.root, "root", errors, warnings, catalog);
  }
  const spec = input as unknown as A2uiSurfaceSpec;
  return errors.length
    ? { ok: false, spec, errors, warnings }
    : { ok: true, spec, errors: [], warnings };
}

/**
 * The set of NODE paths (`root`, `root.children[1]`, …) that own at least one
 * error — the renderer drops exactly those subtrees while a surface is still
 * streaming, so a half-arrived node never blanks its finished siblings.
 */
export function invalidNodePaths(errors: A2uiError[]): Set<string> {
  return new Set(errors.map((e) => e.node));
}

/** Re-export for hosts that want the version without importing the whole spec module. */
export { A2UI_VERSION };
export type { A2uiNode };
