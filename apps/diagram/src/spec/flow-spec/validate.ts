/** `validateFlowSpec(spec, definitions)` — review §4.4. Never throws. React-free. */
import {
  FLOW_SPEC_VERSION,
  type FlowFieldDefinition,
  type FlowSpec,
  type FlowSpecDefinition,
  type FlowSpecDefinitions,
  type FlowSpecIssue,
  type FlowSpecIssueCode,
  type FlowSpecNode,
} from "./types";

type Push = (code: FlowSpecIssueCode, path: string, message: string) => void;

function fieldOk(field: FlowFieldDefinition, value: unknown): boolean {
  switch (field.kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string[]":
      return Array.isArray(value) && value.every((v) => typeof v === "string");
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

function checkFields(
  def: FlowSpecDefinition,
  data: Record<string, unknown>,
  path: string,
  push: Push,
): void {
  for (const [key, field] of Object.entries(def.fields)) {
    const value = data[key];
    if (value === undefined) {
      if (field.required) push("missing-field", `${path}.${key}`, `"${key}" is required.`);
    } else if (!fieldOk(field, value)) {
      push("wrong-field-type", `${path}.${key}`, `"${key}" must be a ${field.kind}.`);
    }
  }
}

export function validateFlowSpec(
  spec: FlowSpec,
  definitions: FlowSpecDefinitions,
): FlowSpecIssue[] {
  const out: FlowSpecIssue[] = [];
  const push: Push = (code, path, message) => out.push({ code, path, message, severity: "error" });

  if (spec.flow !== FLOW_SPEC_VERSION) {
    push(
      "unsupported-flow-version",
      "flow",
      `FlowSpec version "${String(spec.flow)}" is not supported.`,
    );
  }

  const nodes = new Map<string, FlowSpecNode>();
  spec.nodes.forEach((node, i) => {
    const path = `nodes[${i}]`;
    if (nodes.has(node.id)) push("duplicate-id", `${path}.id`, `Duplicate node id "${node.id}".`);
    else nodes.set(node.id, node);
    const def = definitions.get(node.type);
    if (!def || def.kind !== "node") {
      push("unknown-type", `${path}.type`, `Unknown node type "${node.type}".`);
      return;
    }
    checkFields(def, node.data, `${path}.data`, push);
    if (spec.layout.engine === "none" && !node.position) {
      push(
        "missing-position",
        `${path}.position`,
        `"${node.id}" needs a position under manual layout.`,
      );
    }
  });

  spec.nodes.forEach((node, i) => {
    if (node.parent === undefined) return;
    const path = `nodes[${i}].parent`;
    const parent = nodes.get(node.parent);
    if (!parent) {
      push("unknown-parent", path, `No node has the id "${node.parent}".`);
      return;
    }
    if (!definitions.get(parent.type)?.capabilities?.container) {
      push("parent-not-container", path, `"${node.parent}" (${parent.type}) cannot contain nodes.`);
    }
    const seen = new Set([node.id]);
    for (
      let p: FlowSpecNode | undefined = parent;
      p;
      p = p.parent ? nodes.get(p.parent) : undefined
    ) {
      if (seen.has(p.id)) {
        push("parent-cycle", path, `"${node.id}" is inside itself.`);
        break;
      }
      seen.add(p.id);
    }
  });

  const edgeIds = new Set<string>();
  const portUse = new Map<string, number>();
  spec.edges.forEach((edge, i) => {
    const path = `edges[${i}]`;
    if (edgeIds.has(edge.id)) push("duplicate-id", `${path}.id`, `Duplicate edge id "${edge.id}".`);
    edgeIds.add(edge.id);
    const def = definitions.get(edge.type);
    if (!def || def.kind !== "edge")
      push("unknown-type", `${path}.type`, `Unknown edge type "${edge.type}".`);
    else checkFields(def, edge.data, `${path}.data`, push);

    for (const end of ["source", "target"] as const) {
      const node = nodes.get(edge[end]);
      if (!node) {
        push("dangling-edge", `${path}.${end}`, `No node has the id "${edge[end]}".`);
        continue;
      }
      const want = end === "source" ? "output" : "input";
      const ports = definitions.get(node.type)?.targets ?? {};
      const name = end === "source" ? edge.sourcePort : edge.targetPort;
      if (name === undefined) {
        if (!Object.values(ports).some((p) => p.direction === want)) {
          push("no-port", `${path}.${end}`, `"${node.id}" (${node.type}) has no ${want} port.`);
        }
        continue;
      }
      const port = ports[name];
      if (!port || port.direction !== want) {
        push("unknown-port", `${path}.${end}Port`, `"${node.id}" has no ${want} port "${name}".`);
        continue;
      }
      const key = `${node.id}\u0000${name}`;
      const used = (portUse.get(key) ?? 0) + 1;
      portUse.set(key, used);
      if (port.max !== undefined && used > port.max) {
        push(
          "port-limit",
          `${path}.${end}Port`,
          `Port "${name}" on "${node.id}" takes ${port.max}.`,
        );
      }
    }
  });

  return out;
}
