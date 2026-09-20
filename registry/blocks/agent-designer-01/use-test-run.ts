"use client";

/**
 * A SIMULATED test run, so the designer can show what a run looks like: which steps light
 * up, where it waits for a person, what it used. Timers and canned numbers — no model is
 * called. Replace `start` with a call to your runtime and feed its events into the same
 * state (`statuses`, `transit`, `log`).
 */
import { useEffect, useRef, useState } from "react";
import { nodeTitle, type DesignerEdge, type DesignerNode, type RunStatus } from "./types";

export interface RunLogEntry {
  id: string;
  nodeId: string;
  title: string;
  detail: string;
  status: RunStatus;
  ms?: number;
  usd?: number;
}

export interface TestRunState {
  phase: "idle" | "running" | "awaiting-approval" | "done";
  statuses: Record<string, RunStatus>;
  /** The flow edge the run is travelling along right now, with its 0..1 progress. */
  transit: { edgeId: string; progress: number } | null;
  travelled: string[];
  log: RunLogEntry[];
}

const IDLE: TestRunState = { phase: "idle", statuses: {}, transit: null, travelled: [], log: [] };

interface Options {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  /** Router id → branch id the run should take. Unlisted routers take their first branch. */
  path?: Record<string, string>;
  /** Skip the animation between steps. */
  reducedMotion?: boolean;
}

export function useTestRun({ nodes, edges, path = {}, reducedMotion = false }: Options) {
  const [state, setState] = useState<TestRunState>(IDLE);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pending = useRef<{ nodeId: string } | null>(null);
  // The graph as it was when the run started: edits during a run do not redirect it.
  const graph = useRef({ nodes, edges });

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, reducedMotion ? Math.min(ms, 120) : ms));
  };

  // `visit` and `advance` call each other across timers. A timer must reach the functions of
  // the CURRENT render, so they go through this ref instead of closing over each other.
  const engine = useRef({
    visit: (_nodeId: string) => {},
    advance: (_from: string, _handle: string) => {},
  });

  const visit = (nodeId: string) => {
    const node = graph.current.nodes.find((item) => item.id === nodeId);
    if (!node) return setState((s) => ({ ...s, phase: "done", transit: null }));
    const { data } = node;
    const equipment = graph.current.edges
      .filter((edge) => edge.data?.link === "attach" && edge.source === nodeId)
      .map((edge) => graph.current.nodes.find((item) => item.id === edge.target))
      .filter((item): item is DesignerNode => Boolean(item));

    const mark = (status: RunStatus, entry?: Omit<RunLogEntry, "id" | "nodeId" | "status">) =>
      setState((s) => ({
        ...s,
        transit: null,
        statuses: {
          ...s.statuses,
          [nodeId]: status,
          // An agent’s equipment lights up with it.
          ...Object.fromEntries(equipment.map((item) => [item.id, status])),
        },
        log: entry
          ? [
              ...s.log.filter((item) => item.nodeId !== nodeId),
              { id: `${nodeId}:${s.log.length}`, nodeId, status, ...entry },
            ]
          : s.log,
      }));

    if (data.kind === "approval") {
      pending.current = { nodeId };
      mark("awaiting-approval", {
        title: data.name,
        detail: `Waiting for ${data.approvers} in ${data.channel} (SLA ${data.slaHours} h)`,
      });
      return setState((s) => ({ ...s, phase: "awaiting-approval" }));
    }

    mark("running", { title: nodeTitle(data), detail: "Working…" });
    const work = data.kind === "agent" ? 1500 : 600;
    later(work, () => {
      let handle = "out";
      let detail = "";
      let usd: number | undefined;
      if (data.kind === "agent") {
        const used = equipment
          .filter((item) => item.data.kind !== "model")
          .map((item) => nodeTitle(item.data));
        const model = equipment.find((item) => item.data.kind === "model");
        usd = Math.round(data.budgetUsd * 0.62 * 100) / 100;
        detail = `${model ? nodeTitle(model.data) : "No model"}${used.length ? ` · used ${used.join(", ")}` : ""}`;
      } else if (data.kind === "router") {
        const branch = data.branches.find((item) => item.id === path[nodeId]) ?? data.branches[0];
        handle = `branch:${branch?.id}`;
        detail = branch ? `Took “${branch.label}” — ${branch.condition}` : "No branch";
      } else if (data.kind === "guardrail") {
        detail = `${data.checks.length} checks passed`;
      } else if (data.kind === "trigger") {
        detail = `Sample event from ${data.source}`;
      } else if (data.kind === "action") {
        detail = `Dry run: ${data.system}.${data.operation} was not called`;
      }
      mark("complete", { title: nodeTitle(data), detail, ms: work + 40, usd });
      engine.current.advance(nodeId, handle);
    });
  };

  const advance = (fromId: string, handle: string) => {
    const edge = graph.current.edges.find(
      (item) =>
        item.data?.link !== "attach" &&
        item.source === fromId &&
        (item.sourceHandle ?? "out") === handle,
    );
    if (!edge) return setState((s) => ({ ...s, phase: "done", transit: null }));
    const steps = reducedMotion ? [1] : [0.05, 0.25, 0.5, 0.75, 1];
    steps.forEach((progress, index) =>
      later(index * 110, () => setState((s) => ({ ...s, transit: { edgeId: edge.id, progress } }))),
    );
    later(steps.length * 110, () => {
      setState((s) => ({ ...s, transit: null, travelled: [...s.travelled, edge.id] }));
      engine.current.visit(edge.target);
    });
  };

  useEffect(() => {
    engine.current = { visit, advance };
  });

  const start = () => {
    clear();
    pending.current = null;
    graph.current = { nodes, edges };
    const trigger = nodes.find((node) => node.data.kind === "trigger");
    if (!trigger) return;
    setState({ ...IDLE, phase: "running" });
    visit(trigger.id);
  };

  const decide = (approved: boolean) => {
    const waiting = pending.current;
    if (!waiting) return;
    pending.current = null;
    setState((s) => ({
      ...s,
      phase: "running",
      statuses: { ...s.statuses, [waiting.nodeId]: approved ? "complete" : "denied" },
      log: s.log.map((entry) =>
        entry.nodeId === waiting.nodeId
          ? {
              ...entry,
              status: approved ? "complete" : "denied",
              detail: approved ? "Approved by you (test)" : "Rejected by you (test)",
            }
          : entry,
      ),
    }));
    advance(waiting.nodeId, approved ? "approved" : "rejected");
  };

  const reset = () => {
    clear();
    pending.current = null;
    setState(IDLE);
  };

  return { ...state, start, decide, reset };
}
