/** Pure authored visual structure over deterministic derivation. */
import type { CatalogLookup } from "../spec/dialect/catalog-refs";
import type { ComponentTable } from "../spec/compose/resolver";
import { MAX_COMPONENT_DEPTH } from "../spec/compose/resolver";
import { ID_RE, refFileOf } from "../spec/dialect/ids";
import { issue, type ArchIssue } from "../spec/dialect/issues";
import type { ArchDiagram, ArchNodeSpec, ArchZoneSpec } from "../spec/dialect/types";
import { aggregateVisualFlows } from "./aggregate-flows";
import { deriveVisualLens } from "./derive-visual";
import {
  LANE_ORDER,
  LANE_TITLE,
  type VisualBox,
  type VisualLane,
  type VisualLens,
} from "./visual-model";
export const VISUAL_PROCESSES = [
  "landing",
  "storage",
  "mirror",
  "transform",
  "elt",
  "replication",
  "quality",
] as const;
export const MAX_VISUAL_MEMBERS = 1000;
export interface VisualContext {
  catalog?: CatalogLookup;
  components?: ComponentTable;
  hero?: string | null;
  pillVocabulary?: ReadonlySet<string>;
  pillFromTags?: Readonly<Record<string, string>>;
}
export interface ResolvedVisual {
  lens: VisualLens;
  issues: ArchIssue[];
}
function memberOf(
  ast: ArchDiagram,
  id: string,
  components?: ComponentTable,
  scopes?: Map<string, ArchDiagram>,
): { entry?: ArchNodeSpec | ArchZoneSpec; pending?: boolean } {
  const parts = id.split(".");
  if (parts.length > MAX_COMPONENT_DEPTH + 1 || parts.some((part) => !ID_RE.test(part))) return {};
  let current = ast;
  let containingParent: string | undefined;
  const visited = new Set<string>();
  for (let index = 0; index < parts.length; index++) {
    const entry =
      current.nodes.find((node) => node.id === parts[index]) ??
      current.zones.find((zone) => zone.id === parts[index]);
    if (!entry) return {};
    if (index === parts.length - 1)
      return {
        entry: {
          ...entry,
          id,
          parent:
            index > 0
              ? entry.parent
                ? `${parts.slice(0, -1).join(".")}.${entry.parent}`
                : containingParent
              : entry.parent,
        },
      };
    const file = "ref" in entry && entry.ref ? refFileOf(entry.ref) : undefined;
    if (!file || visited.has(file)) return {};
    visited.add(file);
    if (!components) return { pending: true };
    const child = components.get(file);
    if (!child) return { pending: true };
    if (child.status !== "ok") return {};
    if (entry.parent) containingParent = [...parts.slice(0, index), entry.parent].join(".");
    current = child.ast;
    scopes?.set(parts.slice(0, index + 1).join("."), current);
  }
  return {};
}
export function resolveVisual(ast: ArchDiagram, context: VisualContext = {}): ResolvedVisual {
  return resolve(ast, context, [], { remaining: MAX_VISUAL_MEMBERS });
}
function resolve(
  ast: ArchDiagram,
  context: VisualContext,
  stack: readonly string[],
  budget: { remaining: number },
): ResolvedVisual {
  const issues: ArchIssue[] = [];
  const bad = (path: string, message: string) =>
    issues.push(issue("invalid-visual", path, message));
  const written = ast.visual;
  const scopes = new Map<string, ArchDiagram>();
  const vocabulary = context.pillVocabulary ?? new Set<string>(VISUAL_PROCESSES);
  const catalogFor = (node: ArchNodeSpec) =>
    context.catalog?.get(
      node.catalogEntry ?? node.ref?.replace(/^catalog\//, "") ?? node.icon ?? "",
    );
  const basic = deriveVisualLens(ast, {
    hero: context.hero,
    capability: (node) => catalogFor(node)?.capability,
  });

  const ownerOf = (id: string): VisualBox["owner"] => {
    let parent = memberOf(ast, id, context.components).entry?.parent;
    const seen = new Set<string>();
    let hasZone = false;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const zone = memberOf(ast, parent, context.components).entry;
      if (!zone || !("kind" in zone)) break;
      hasZone = true;
      if (zone.owner) return zone.owner;
      parent = zone.parent;
    }
    return hasZone ? "customer" : "unowned";
  };
  const overlaps = (a: string, b: string) =>
    a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
  const hidden = new Set<string>();
  const control = new Set<string>();
  const technical = new Map(ast.nodes.map((node) => [node.id, node]));
  const inspect = (id: string, path: string, kind: "node" | "zone") => {
    const found = memberOf(ast, id, context.components, scopes);
    if (
      !found.pending &&
      (!found.entry ||
        (kind === "node"
          ? !("type" in found.entry) || found.entry.type === "note"
          : !("kind" in found.entry)))
    )
      bad(
        path,
        `"${id}" must name an existing technical ${kind}; reference paths are bounded to ${MAX_COMPONENT_DEPTH} levels.`,
      );
    if (found.entry && "type" in found.entry) technical.set(id, found.entry);
    return found;
  };
  const idList = (list: readonly string[] | undefined, path: string, into: Set<string>) =>
    list?.forEach((id, index) => {
      inspect(id, `${path}[${index}]`, "node");
      if (into.has(id)) bad(`${path}[${index}]`, `"${id}" is repeated.`);
      into.add(id);
    });
  idList(written?.hide, "visual.hide", hidden);
  idList(written?.controlPlane, "visual.controlPlane", control);
  written?.controlPlane?.forEach((id, index) => {
    if ([...hidden].some((other) => overlaps(other, id)))
      bad(`visual.controlPlane[${index}]`, `"${id}" is hidden and cannot be in the control plane.`);
  });
  const lanes: VisualLane[] = [];
  const laneIds = new Set<string>();
  const inheritedLaneIds = new Set<string>();
  const ofLane = new Map<string, string>();
  const identifier = (id: string, path: string) => {
    if (!ID_RE.test(id)) bad(path, `"${id}" is not a valid id.`);
  };
  written?.lanes?.forEach((lane, index) => {
    const path = `visual.lanes[${index}]`;
    identifier(lane.id, `${path}.id`);
    if (laneIds.has(lane.id)) bad(`${path}.id`, `Lane "${lane.id}" is repeated.`);
    if (!lane.title.trim()) bad(`${path}.title`, "A lane title must not be blank.");
    laneIds.add(lane.id);
    lanes.push({ ...lane });
    lane.of?.forEach((id, item) => {
      inspect(id, `${path}.of[${item}]`, "zone");
      if (ofLane.has(id)) bad(`${path}.of[${item}]`, `Zone "${id}" already belongs to a lane.`);
      ofLane.set(id, lane.id);
    });
  });
  const roleLane = new Map(
    basic.lanes.map((lane) => [
      lane.role,
      lanes.find((other) => other.role === lane.role)?.id ?? lane.id,
    ]),
  );
  const laneFor = (id: string, fallback: string) => {
    let parent = technical.get(id)?.parent;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (ofLane.has(parent)) return ofLane.get(parent)!;
      seen.add(parent);
      const direct = ast.zones.find((zone) => zone.id === parent);
      if (direct) {
        parent = direct.parent;
        continue;
      }
      const dot = parent.lastIndexOf(".");
      const prefix = parent.slice(0, dot);
      const child = scopes.get(prefix);
      const zone = child?.zones.find((entry) => entry.id === parent!.slice(dot + 1));
      parent = zone?.parent
        ? `${prefix}.${zone.parent}`
        : ast.nodes.find((entry) => entry.id === prefix.split(".")[0])?.parent;
    }
    return roleLane.get(fallback as VisualLane["role"]) ?? fallback;
  };
  const boxes: VisualBox[] = [];
  const boxIds = new Map<string, string>();
  const claimed = new Set<string>();
  let memberCount = 0;
  written?.boxes?.forEach((box, index) => {
    const path = `visual.boxes[${index}]`;
    identifier(box.id, `${path}.id`);
    if (boxIds.has(box.id)) bad(`${path}.id`, `Box "${box.id}" is repeated.`);
    if (!box.title.trim()) bad(`${path}.title`, "A box title must not be blank.");
    if (!laneIds.has(box.lane) && !LANE_ORDER.includes(box.lane as VisualLane["role"]))
      bad(`${path}.lane`, `No lane has id "${box.lane}".`);
    boxIds.set(box.id, `box:${box.id}`);
    const members: VisualBox["members"] = [];
    box.members.forEach((id, item) => {
      if (++memberCount > MAX_VISUAL_MEMBERS) return;
      const found = inspect(id, `${path}.members[${item}]`, "node");
      if ([...claimed].some((other) => overlaps(other, id)))
        bad(`${path}.members[${item}]`, `"${id}" overlaps a member already assigned to a box.`);
      if ([...hidden].some((other) => overlaps(other, id)))
        bad(`${path}.members[${item}]`, `"${id}" is hidden and cannot be a box member.`);
      claimed.add(id);
      if (found.entry && "type" in found.entry)
        members.push({ id, title: found.entry.title, icon: found.entry.icon });
    });
    const seenSub = new Set<string>();
    box.sub?.forEach((id, item) => {
      if (!box.members.includes(id) || seenSub.has(id))
        bad(`${path}.sub[${item}]`, `"${id}" must occur once in this box's members.`);
      seenSub.add(id);
    });
    box.processes?.forEach((process, item) => {
      if (!vocabulary.has(process))
        bad(
          `${path}.processes[${item}]`,
          `Unknown process "${process}". Use ${[...vocabulary].join(", ")}.`,
        );
    });
    boxes.push({
      id: `box:${box.id}`,
      lane: box.lane,
      title: box.title,
      members,
      owner: ownerOf(box.members[0] ?? ""),
      ...(box.aside !== undefined && { aside: box.aside }),
      ...(box.sub && { sub: box.sub }),
      ...(box.processes && { processes: box.processes }),
    });
  });
  if (memberCount > MAX_VISUAL_MEMBERS)
    bad("visual.boxes", `The visual layer supports at most ${MAX_VISUAL_MEMBERS} total members.`);
  const inheritedFlows: VisualLens["flows"] = [];
  const inherited = new Set<string>();
  for (const node of ast.nodes) {
    if ([...hidden, ...claimed].some((id) => id === node.id)) continue;
    const file = node.ref && refFileOf(node.ref);
    const child = file ? context.components?.get(file) : undefined;
    if (
      !file ||
      child?.status !== "ok" ||
      (!child.ast.visual &&
        ![...claimed, ...hidden, ...control, ...ofLane.keys()].some((id) =>
          id.startsWith(`${node.id}.`),
        ))
    )
      continue;
    if (
      stack.includes(file) ||
      stack.length >= MAX_COMPONENT_DEPTH ||
      budget.remaining < child.ast.nodes.length
    ) {
      bad(
        node.path + ".ref",
        "The inherited visual layer exceeds the reference depth or 1000-member budget.",
      );
      continue;
    }
    budget.remaining -= child.ast.nodes.length;
    const result = resolve(child.ast, context, [...stack, file], budget);
    if (result.issues.some((entry) => entry.severity === "error")) {
      bad(node.path + ".ref", `Cannot inherit visual layout: ${result.issues[0]?.message}`);
      continue;
    }
    const visibleBoxes = result.lens.boxes.filter((box) =>
      box.members.some(
        (member) => ![...hidden, ...claimed].some((id) => overlaps(id, `${node.id}.${member.id}`)),
      ),
    );
    for (const id of result.lens.hidden ?? [])
      if (![...claimed].some((member) => overlaps(member, `${node.id}.${id}`)))
        hidden.add(`${node.id}.${id}`);
    const laneMap = new Map<string, string>();
    for (const lane of result.lens.lanes.filter((lane) =>
      visibleBoxes.some((box) => box.lane === lane.id),
    )) {
      let id = `ref-${node.id}-${lane.id}`;
      while (lanes.some((entry) => entry.id === id)) id += "-ref";
      laneMap.set(lane.id, id);
      inheritedLaneIds.add(id);
      lanes.push({ ...lane, id, of: lane.of?.map((entry) => `${node.id}.${entry}`) });
    }
    const boxMap = new Map<string, string>();
    for (const box of visibleBoxes) {
      const members = box.members
        .map((member) => ({ ...member, id: `${node.id}.${member.id}` }))
        .filter((member) => ![...hidden, ...claimed].some((id) => overlaps(id, member.id)));
      if (!members.length) continue;
      const grouped = new Map<string, VisualBox["members"]>();
      for (const member of members) {
        inspect(member.id, node.path + ".ref", "node");
        const lane = laneFor(member.id, laneMap.get(box.lane)!);
        const group = grouped.get(lane) ?? [];
        group.push(member);
        grouped.set(lane, group);
      }
      for (const [lane, group] of grouped) {
        let id = `box:${node.id}.${box.id.replace(/^box:/, "")}`;
        while (boxes.some((entry) => entry.id === id)) id += ":ref";
        if (!boxMap.has(box.id)) boxMap.set(box.id, id);
        boxes.push({
          ...box,
          id,
          lane,
          members: group,
          sub: box.sub
            ?.map((entry) => `${node.id}.${entry}`)
            .filter((entry) => group.some((member) => member.id === entry)),
        });
      }
    }
    for (const flow of result.lens.flows) {
      const from = boxMap.get(flow.from);
      const to = boxMap.get(flow.to);
      if (from && to) inheritedFlows.push({ ...flow, id: `flow:${node.id}:${flow.id}`, from, to });
    }
    inherited.add(node.id);
  }
  for (const box of basic.boxes) {
    const byLane = new Map<string, VisualBox["members"]>();
    for (const member of box.members) {
      if (inherited.has(member.id) || [...hidden, ...claimed].some((id) => overlaps(id, member.id)))
        continue;
      const lane = laneFor(member.id, box.lane);
      const members = byLane.get(lane) ?? [];
      members.push(member);
      byLane.set(lane, members);
    }
    for (const [lane, members] of byLane) {
      let id = byLane.size === 1 ? box.id : `${box.id}:${lane}`;
      while (boxes.some((other) => other.id === id)) id += ":derived";
      boxes.push({ ...box, id, lane, members });
    }
  }
  for (const box of boxes) {
    box.controlPlane ||= box.members.some((member) =>
      [...control].some((id) => overlaps(id, member.id)),
    );
    const processes = new Set(box.processes ?? []);
    if (!box.processes)
      for (const member of box.members) {
        const node = technical.get(member.id);
        if (node)
          for (const tag of catalogFor(node)?.tags ?? []) {
            const process = context.pillFromTags?.[tag] ?? tag;
            if (vocabulary.has(process)) processes.add(process);
          }
      }
    if (processes.size) box.processes = [...processes];
    const providers = box.members.map((member) => {
      const node = technical.get(member.id);
      const vendor = node ? catalogFor(node)?.vendor : undefined;
      if (vendor) return vendor;
      let entry = memberOf(ast, member.id, context.components).entry;
      const visited = new Set<string>();
      while (entry?.parent && !visited.has(entry.parent)) {
        visited.add(entry.parent);
        entry = memberOf(ast, entry.parent, context.components).entry;
        if (entry && "provider" in entry && entry.provider) return entry.provider;
      }
      return undefined;
    });
    box.provider =
      providers.length && providers.every((provider) => provider === providers[0])
        ? providers[0]
        : undefined;
  }
  for (const box of boxes)
    if (!lanes.some((lane) => lane.id === box.lane)) {
      const role = LANE_ORDER.find((candidate) => candidate === box.lane);
      if (role) lanes.push({ id: role, role, title: LANE_TITLE[role] });
    }
  const graph = { ...ast, nodes: [...ast.nodes], zones: [...ast.zones], flows: [...ast.flows] };
  let scopedNodes = 0;
  for (const [prefix, child] of scopes) {
    scopedNodes += child.nodes.length;
    if (scopedNodes > MAX_VISUAL_MEMBERS) {
      bad("visual.boxes", "Qualified visual membership exceeds the 1000-member traversal budget.");
      break;
    }
    graph.nodes.push(
      ...child.nodes.map((node) => ({
        ...node,
        id: `${prefix}.${node.id}`,
        parent: node.parent ? `${prefix}.${node.parent}` : undefined,
      })),
    );
    graph.zones.push(
      ...child.zones.map((zone) => ({
        ...zone,
        id: `${prefix}.${zone.id}`,
        parent: zone.parent ? `${prefix}.${zone.parent}` : undefined,
      })),
    );
    graph.flows.push(
      ...child.flows.map((flow) => ({
        ...flow,
        from: `${prefix}.${flow.from}`,
        to: `${prefix}.${flow.to}`,
      })),
    );
  }
  const flows = aggregateVisualFlows(graph, boxes);
  for (const flow of inheritedFlows) {
    const match = flows.find(
      (entry) => entry.kind === flow.kind && entry.from === flow.from && entry.to === flow.to,
    );
    if (match) Object.assign(match, { label: flow.label, process: flow.process });
    else flows.push(flow);
  }
  const overrides = new Set<string>();
  written?.flows?.forEach((flow, index) => {
    const path = `visual.flows[${index}]`;
    const from = boxIds.get(flow.from) ?? boxes.find((box) => box.id === `box:${flow.from}`)?.id;
    const to = boxIds.get(flow.to) ?? boxes.find((box) => box.id === `box:${flow.to}`)?.id;
    if (!from) bad(`${path}.from`, `No box has id "${flow.from}".`);
    if (!to) bad(`${path}.to`, `No box has id "${flow.to}".`);
    if (from === to && from) bad(path, "A visual flow must connect two different boxes.");
    if (flow.process && !vocabulary.has(flow.process))
      bad(`${path}.process`, `Unknown process "${flow.process}".`);
    const pair = [flow.from, flow.to].sort().join("\0");
    if (overrides.has(pair)) bad(path, "This visual flow pair already has an override.");
    overrides.add(pair);
    if (!from || !to || from === to) return;
    const matches = flows.filter(
      (edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from),
    );
    if (!matches.length)
      bad(
        path,
        "A visual flow annotates an existing technical connection; this box pair has none.",
      );
    else
      for (const edge of matches) Object.assign(edge, { label: flow.label, process: flow.process });
  });
  return {
    lens: {
      lanes: lanes.filter(
        (lane) => !inheritedLaneIds.has(lane.id) || boxes.some((box) => box.lane === lane.id),
      ),
      boxes,
      flows,
      ...(hidden.size && { hidden: [...hidden] }),
    },
    issues,
  };
}
