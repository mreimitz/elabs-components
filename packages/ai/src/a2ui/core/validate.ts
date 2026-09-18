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
  | { ok: true; spec: A2uiSurfaceSpec; errors: [] }
  | { ok: false; spec: A2uiSurfaceSpec | null; errors: A2uiError[] };

type Report = (e: Omit<A2uiError, "node">) => void;

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
      if (!isRecord(value)) bad("an object");
      break;
    case "node": {
      // Text, a number, one element, or a list of nodes — each element validated.
      const items = Array.isArray(value) ? value : [value];
      items.forEach((item, i) => {
        const p = Array.isArray(value) ? `${path}[${i}]` : path;
        if (typeof item === "string" || typeof item === "number") return;
        if (isA2uiElement(item)) return checkNode(item, p, errors, catalog);
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
  catalog: A2uiCatalogSchema,
): void {
  const report: Report = (e) => errors.push({ ...e, node: path });
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
        checkValue(value, schema, `${path}.props.${name}`, report, errors, catalog);
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
        checkNode(child, `${path}.children[${i}]`, errors, catalog),
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
    checkNode(input.root, "root", errors, catalog);
  }
  const spec = input as unknown as A2uiSurfaceSpec;
  return errors.length ? { ok: false, spec, errors } : { ok: true, spec, errors: [] };
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
