/**
 * Design checks: what a reviewer would ask before this goes live. Pure functions of the
 * graph — no runtime, no network. Add your own rules to `checkDesign`.
 */
import { nodeTitle, type DesignerEdge, type DesignerNode } from "./types";

export interface DesignIssue {
  id: string;
  severity: "error" | "warning";
  nodeId: string;
  title: string;
  detail: string;
}

export function checkDesign(nodes: DesignerNode[], edges: DesignerEdge[]): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const flowEdges = edges.filter((edge) => edge.data?.link !== "attach");
  const equipmentOf = (agentId: string) =>
    edges
      .filter((edge) => edge.data?.link === "attach" && edge.source === agentId)
      .map((edge) => byId.get(edge.target))
      .filter((node): node is DesignerNode => Boolean(node));

  if (!nodes.some((node) => node.data.kind === "trigger")) {
    const first = nodes[0];
    if (first) {
      issues.push({
        id: "no-trigger",
        severity: "error",
        nodeId: first.id,
        title: "Nothing starts this design",
        detail: "Add a trigger so the flow has a beginning.",
      });
    }
  }

  for (const node of nodes) {
    const { data } = node;
    const name = nodeTitle(data);

    if (data.kind === "agent") {
      const equipment = equipmentOf(node.id);
      const models = equipment.filter((item) => item.data.kind === "model");
      if (models.length === 0) {
        issues.push({
          id: `${node.id}:model`,
          severity: "error",
          nodeId: node.id,
          title: `${name} has no model`,
          detail: "Attach a model to its Model port.",
        });
      }
      if (models.length > 1) {
        issues.push({
          id: `${node.id}:models`,
          severity: "warning",
          nodeId: node.id,
          title: `${name} has ${models.length} models`,
          detail: "Only the first one is used. Remove the others or split the agent.",
        });
      }
      if (!data.instructions.trim()) {
        issues.push({
          id: `${node.id}:instructions`,
          severity: "warning",
          nodeId: node.id,
          title: `${name} has no instructions`,
          detail: "An agent without instructions improvises.",
        });
      }
      if (data.autonomy === "autonomous") {
        const unguarded = equipment.flatMap((item) =>
          item.data.kind === "mcp"
            ? item.data.tools
                .filter((tool) => tool.enabled && tool.access === "write" && !tool.requiresApproval)
                .map((tool) => `${item.data.kind === "mcp" ? item.data.name : ""}.${tool.name}`)
            : [],
        );
        if (unguarded.length > 0) {
          issues.push({
            id: `${node.id}:autonomy`,
            severity: "warning",
            nodeId: node.id,
            title: `${name} can write without asking`,
            detail: `Autonomous, with ${unguarded.join(", ")} set to run without approval.`,
          });
        }
      }
    }

    if (data.kind === "mcp" && data.auth !== "connected") {
      issues.push({
        id: `${node.id}:auth`,
        severity: "error",
        nodeId: node.id,
        title:
          data.auth === "error" ? `${name} cannot be reached` : `${name} needs someone to sign in`,
        detail: "Its tools will fail at run time until the connection works.",
      });
    }

    if (data.kind === "router") {
      for (const branch of data.branches) {
        const wired = flowEdges.some(
          (edge) => edge.source === node.id && edge.sourceHandle === `branch:${branch.id}`,
        );
        if (!wired) {
          issues.push({
            id: `${node.id}:${branch.id}`,
            severity: "warning",
            nodeId: node.id,
            title: `“${branch.label}” leads nowhere`,
            detail: `Work that takes this branch of ${name} is dropped.`,
          });
        }
      }
    }

    const isFlowNode = !["note", "model", "skill", "mcp", "knowledge", "memory"].includes(
      data.kind,
    );
    if (isFlowNode && data.kind !== "trigger") {
      if (!flowEdges.some((edge) => edge.target === node.id)) {
        issues.push({
          id: `${node.id}:unreached`,
          severity: "warning",
          nodeId: node.id,
          title: `${name} is never reached`,
          detail: "Nothing in the flow leads to it.",
        });
      }
    }
    if (["model", "skill", "mcp", "knowledge", "memory"].includes(data.kind)) {
      if (!edges.some((edge) => edge.target === node.id)) {
        issues.push({
          id: `${node.id}:loose`,
          severity: "warning",
          nodeId: node.id,
          title: `${name} is not attached`,
          detail: "Drag from an agent’s port to it, or remove it.",
        });
      }
    }

    // Money and ledger actions: is there a path from a trigger that never meets a person?
    if (data.kind === "action" && data.sensitive) {
      const seen = new Set<string>();
      const stack = [node.id];
      let unattended = false;
      while (stack.length > 0 && !unattended) {
        const current = stack.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        const kind = byId.get(current)?.data.kind;
        if (current !== node.id && kind === "approval") continue; // this path is attended
        if (kind === "trigger") unattended = true;
        for (const edge of flowEdges) if (edge.target === current) stack.push(edge.source);
      }
      if (unattended) {
        issues.push({
          id: `${node.id}:unattended`,
          severity: "warning",
          nodeId: node.id,
          title: `${name} can run without a person`,
          detail: "At least one path reaches it with no approval step on the way.",
        });
      }
    }
  }
  return issues;
}
