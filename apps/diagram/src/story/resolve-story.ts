/** Pure, bounded story target resolution, shared by the browser and MCP validation. */
import { ARROW_DIRECTION, ARROW_RE, END_SOURCE, refFileOf } from "../spec/dialect/ids";
import { issue, type ArchIssue } from "../spec/dialect/issues";
import type { ArchDiagram, ArchFlowSpec } from "../spec/dialect/types";
import { MAX_COMPONENT_DEPTH, type ComponentTable } from "../spec/compose/resolver";
import type { ResolvedStory, ResolvedStoryStep } from "./types";

const END_RE = new RegExp(`^${END_SOURCE}$`);
type Endpoint = { expand: string[]; error?: string; title?: string };
type Flow = { flow: ArchFlowSpec; id: string; from: string; to: string };

function endpoint(ast: ArchDiagram, id: string, components?: ComponentTable): Endpoint {
  if (!END_RE.test(id)) return { expand: [], error: `"${id}" is not an endpoint id.` };
  const parts = id.split(".");
  if (parts.length > MAX_COMPONENT_DEPTH + 1)
    return { expand: [], error: "Story targets may cross at most eight diagram references." };
  const expand: string[] = [];
  let current = ast;
  const visited = new Set<string>();
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    const found = [...current.nodes, ...current.zones].find((entry) => entry.id === part);
    if (!found) return { expand, error: `No node or zone has the id "${id}".` };
    const file = "ref" in found && found.ref ? refFileOf(found.ref) : undefined;
    if (file) expand.push(parts.slice(0, index + 1).join("."));
    if (index === parts.length - 1) return { expand, title: found.title ?? found.id };
    if (!file)
      return {
        expand,
        error: `"${parts.slice(0, index + 1).join(".")}" does not reference a diagram.`,
      };
    if (visited.has(file)) return { expand, error: `"${id}" crosses a cyclic diagram reference.` };
    visited.add(file);
    const entry = components?.get(file);
    // Parsing before asynchronous preload validates the known prefix; the loaded table rechecks all inner ids.
    if (!entry && !components)
      return {
        expand: [
          ...expand,
          ...parts
            .slice(index + 1, -1)
            .map((_p, offset) => parts.slice(0, index + offset + 2).join(".")),
        ],
      };
    if (!entry || entry.status !== "ok")
      return { expand, error: `"${id}" cannot be resolved because ${file} is unavailable.` };
    current = entry.ast;
  }
  return { expand };
}

function flowsOf(ast: ArchDiagram, prefix = "", counts = new Map<string, number>()): Flow[] {
  return ast.flows.map((flow) => {
    const from = `${prefix}${flow.from}`,
      to = `${prefix}${flow.to}`;
    const key = `${from}->${to}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return { flow, from, to, id: count === 1 ? key : `${key}#${count}` };
  });
}

/** Only inspect common containing instances; never enumerate a repeated reference DAG. */
function candidateFlows(
  ast: ArchDiagram,
  from: string,
  to: string,
  components?: ComponentTable,
): Flow[] {
  const counts = new Map<string, number>();
  const result = flowsOf(ast, "", counts);
  const a = from.split("."),
    b = to.split(".");
  let current = ast;
  const visited = new Set<string>();
  for (
    let at = 0;
    at < Math.min(a.length - 1, b.length - 1, MAX_COMPONENT_DEPTH) && a[at] === b[at];
    at++
  ) {
    const node = current.nodes.find((entry) => entry.id === a[at]);
    const file = node?.ref && refFileOf(node.ref);
    if (!file || visited.has(file)) break;
    visited.add(file);
    const entry = components?.get(file);
    if (!entry || entry.status !== "ok") break;
    current = entry.ast;
    result.push(...flowsOf(current, `${a.slice(0, at + 1).join(".")}.`, counts));
  }
  return result;
}

function matches(candidate: Flow, from: string, to: string, direction: string): boolean {
  const own = candidate.flow.direction;
  if (direction === "both")
    return (
      own === "both" &&
      ((candidate.from === from && candidate.to === to) ||
        (candidate.from === to && candidate.to === from))
    );
  if (own === "both") return false;
  const source = direction === "back" ? to : from;
  const target = direction === "back" ? from : to;
  return (
    (own === "back" ? candidate.to : candidate.from) === source &&
    (own === "back" ? candidate.from : candidate.to) === target
  );
}

export function resolveStory(ast: ArchDiagram, components?: ComponentTable): ResolvedStory {
  const issues: ArchIssue[] = [];
  const steps: ResolvedStoryStep[] = [];
  const empty = (id: string, title: string, duration = 8): ResolvedStoryStep => ({
    id,
    title,
    duration,
    camera: "follow",
    nodeIds: [],
    edgeIds: [],
    expand: [],
    callouts: [],
    follow: [],
  });
  const addEndpoint = (step: ResolvedStoryStep, id: string, path: string) => {
    const resolved = endpoint(ast, id, components);
    if (resolved.error) issues.push(issue("unknown-story-target", path, resolved.error));
    else {
      step.nodeIds.push(id);
      step.expand.push(...resolved.expand);
    }
  };
  const addFlow = (step: ResolvedStoryStep, flow: Flow, path: string) => {
    step.edgeIds.push(flow.id);
    step.follow.push({ edgeId: flow.id, reverse: flow.flow.direction === "back" });
    addEndpoint(step, flow.from, path);
    addEndpoint(step, flow.to, path);
  };
  if (ast.story) {
    if (ast.story.autoplay)
      issues.push(
        issue(
          "story-autoplay-reserved",
          "story.autoplay",
          "Automatic startup is reserved. Use Play to run the story once.",
        ),
      );
    for (const [index, authored] of ast.story.steps.entries()) {
      const step = empty(`story:${index}`, authored.title, authored.duration);
      step.text = authored.text;
      step.camera = authored.targets.every((target) => ARROW_RE.test(target)) ? "follow" : "fit";
      for (const [targetIndex, target] of authored.targets.entries()) {
        const path = `${authored.path}.targets[${targetIndex}]`;
        const arrow = ARROW_RE.exec(target);
        if (!arrow) {
          addEndpoint(step, target, path);
          continue;
        }
        const from = arrow[1]!,
          to = arrow[3]!;
        const direction = ARROW_DIRECTION[arrow[2] as keyof typeof ARROW_DIRECTION];
        const found = candidateFlows(ast, from, to, components).filter((flow) =>
          matches(flow, from, to, direction),
        );
        // Referenced source files are unavailable during the resolver's first structural pass.
        // Recheck this candidate against the loaded table before the browser or MCP accepts it.
        const head = from.split(".")[0];
        const pendingInner =
          !components &&
          found.length === 0 &&
          from.includes(".") &&
          to.includes(".") &&
          head === to.split(".")[0] &&
          ast.nodes.some((node) => node.id === head && node.ref && refFileOf(node.ref));
        if (pendingInner) {
          addEndpoint(step, from, path);
          addEndpoint(step, to, path);
          const edgeId = `${from}->${to}`;
          step.edgeIds.push(edgeId);
          step.follow.push({ edgeId, reverse: direction === "back" });
          continue;
        }
        if (found.length !== 1)
          issues.push(
            issue(
              found.length ? "ambiguous-story-target" : "unknown-story-target",
              path,
              found.length
                ? `"${target}" matches multiple flows; make the flow endpoints unique before targeting it.`
                : `No flow matches "${target}".`,
            ),
          );
        else addFlow(step, found[0]!, path);
      }
      for (const callout of authored.callouts) {
        addEndpoint(step, callout.at, `${callout.path}.at`);
        step.callouts.push({ at: callout.at, text: callout.text });
      }
      steps.push(step);
    }
  } else {
    const grouped = new Map<number, Flow[]>();
    for (const flow of flowsOf(ast))
      if (flow.flow.step !== undefined)
        grouped.set(flow.flow.step, [...(grouped.get(flow.flow.step) ?? []), flow]);
    for (const [number, flows] of [...grouped].sort(([a], [b]) => a - b)) {
      const step = empty(
        `step:${number}`,
        flows
          .map(({ flow, from, to }) => {
            const left = endpoint(ast, from, components).title ?? from;
            const right = endpoint(ast, to, components).title ?? to;
            return (
              flow.label ??
              (flow.direction === "back" ? `${right} → ${left}` : `${left} → ${right}`)
            );
          })
          .join("; "),
      );
      for (const flow of flows) addFlow(step, flow, flow.flow.path);
      steps.push(step);
    }
  }
  for (const step of steps) {
    step.nodeIds = [...new Set(step.nodeIds)];
    step.edgeIds = [...new Set(step.edgeIds)];
    step.expand = [...new Set(step.expand)];
  }
  return {
    explicit: ast.story !== undefined,
    steps: issues.some((entry) => entry.severity === "error") ? [] : steps,
    issues,
  };
}
