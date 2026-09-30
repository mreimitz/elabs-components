import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (file) =>
  (await runnerImport(`${root}src/visual/${file}`, { root, configFile: false, logLevel: "error" }))
    .module;
const { layoutVisualLens, boxHeight, visualTextWidth } = await load("lane-layout.ts");
const { buildVisualGraph } = await load("build-visual-graph.ts");
const { visualGeometryIssues } = await load("check-visual-geometry.ts");
const fixture = () => ({
  lanes: [
    { id: "cloud", role: "vendor-cloud", title: "Control cloud" },
    { id: "ingest", role: "sources", title: "Data in" },
    { id: "store", role: "targets", title: "Stored data" },
  ],
  boxes: [
    {
      id: "box:orchestrator",
      lane: "cloud",
      title: "Orchestrator",
      members: [{ id: "control", title: "Orchestrator" }],
      owner: "saas",
      controlPlane: true,
    },
    {
      id: "box:source",
      lane: "ingest",
      title: "Sources",
      members: [{ id: "db", title: "Database" }],
      owner: "customer",
    },
    {
      id: "box:target",
      lane: "store",
      title: "Warehouse",
      members: [{ id: "wh", title: "Warehouse" }],
      owner: "saas",
      processes: ["storage", "transform"],
      sub: ["wh"],
    },
    {
      id: "box:archive",
      lane: "store",
      title: "Archive",
      members: [{ id: "cold", title: "Archive" }],
      owner: "customer",
    },
  ],
  flows: [
    {
      id: "in",
      from: "box:source",
      to: "box:target",
      kind: "data",
      bidirectional: false,
      label: "CDC",
    },
    {
      id: "govern",
      from: "box:orchestrator",
      to: "box:archive",
      kind: "other",
      bidirectional: false,
    },
    {
      id: "status",
      from: "box:source",
      to: "box:orchestrator",
      kind: "other",
      bidirectional: false,
    },
    {
      id: "copy",
      from: "box:target",
      to: "box:archive",
      kind: "data",
      bidirectional: false,
      process: "elt",
    },
  ],
});
test("named lane IDs place every authored box once and retain lane names", () => {
  const lens = fixture(),
    layout = layoutVisualLens(lens),
    graph = buildVisualGraph(lens, layout);
  assert.equal(layout.boxes.length, 4);
  assert.equal(new Set(layout.boxes.map(({ box }) => box.id)).size, 4);
  assert.equal(graph.nodes.find((n) => n.id === "box:source").data.laneTitle, "Data in");
  assert.ok(layout.lanes.find((l) => l.lane.id === "@control-plane"));
  const control = layout.boxes.find((b) => b.box.controlPlane).rect;
  assert.ok(
    layout.boxes
      .filter((b) => !b.box.controlPlane)
      .every((b) => b.rect.y > control.y + control.height),
  );
});
test("control, reverse and same-lane routes avoid boxes and shared runs", () => {
  assert.deepEqual(visualGeometryIssues(fixture()), []);
});
test("geometry is independent of names and deterministic", () => {
  const lens = fixture();
  const shape = (l) => layoutVisualLens(l).boxes.map(({ box, rect }) => ({ id: box.id, rect }));
  const expected = shape(lens);
  lens.boxes.forEach((box) => {
    box.title = "A different name";
    box.members[0].title = "A different name";
  });
  // Preserve the multi-name source anatomy while changing the actual words.
  lens.boxes[1].members[0].title = "Different member";
  assert.deepEqual(shape(lens), expected);
});
test("process pills and explicit labels reach render data", () => {
  const lens = fixture(),
    graph = buildVisualGraph(lens, layoutVisualLens(lens));
  assert.deepEqual(graph.nodes.find((n) => n.id === "box:target").data.processes, [
    "storage",
    "transform",
  ]);
  assert.equal(graph.edges.find((e) => e.id === "copy").data.process, "elt");
  assert.equal(graph.edges.find((e) => e.id === "in").data.label, "CDC");
});

test("opposite labeled flows have independent label rows and bounded widths", () => {
  const lens = {
    lanes: [
      { id: "a", role: "sources", title: "Sources" },
      { id: "b", role: "targets", title: "Targets" },
    ],
    boxes: [
      {
        id: "a",
        lane: "a",
        title: "Alpha",
        owner: "unowned",
        members: [{ id: "a", title: "Alpha" }],
      },
      {
        id: "b",
        lane: "b",
        title: "Beta",
        owner: "unowned",
        members: [{ id: "b", title: "Beta" }],
      },
    ],
    flows: [
      {
        id: "forward",
        from: "a",
        to: "b",
        kind: "data",
        bidirectional: false,
        label: "A long transfer label",
        process: "replication",
      },
      {
        id: "reverse",
        from: "b",
        to: "a",
        kind: "other",
        bidirectional: false,
        label: "A long transfer label",
        process: "replication",
      },
    ],
  };
  const graph = buildVisualGraph(lens, layoutVisualLens(lens));
  const [first, second] = graph.edges.map((edge) => edge.data);
  assert(Math.abs(first.labelY - second.labelY) >= 24);
  assert.deepEqual(visualGeometryIssues(lens), []);
  assert(first.labelMaxWidth > 0 && second.labelMaxWidth > 0);
  assert(graph.edges.every((edge) => edge.ariaLabel.includes("A long transfer label")));
});

const journey = () => ({
  composition: "process",
  lanes: ["Connect", "Prepare", "Ask", "Explain", "Review"].map((title, index) => ({
    id: `lane-${index}`,
    role: "customer-managed",
    title,
  })),
  boxes: [
    "Enterprise connectors",
    "Managed knowledge base",
    "Embeddable assistant",
    "Explainable answers",
    "Answer review portal",
  ].map((title, index) => ({
    id: `step-${index}`,
    lane: `lane-${index}`,
    title,
    summary: true,
    slot: 0,
    owner: "saas",
    members: [{ id: `technical-${index}`, title: "Underlying implementation detail" }],
  })),
  flows: Array.from({ length: 4 }, (_, index) => ({
    id: `flow-${index}`,
    from: `step-${index}`,
    to: `step-${index + 1}`,
    kind: "data",
    bidirectional: false,
  })),
});
test("process journey fits a readable desktop overview and retains drilldown members", () => {
  const lens = journey(),
    layout = layoutVisualLens(lens),
    graph = buildVisualGraph(lens, layout);
  assert(layout.bounds.width <= 1420);
  assert.equal(layout.bounds.width, layout.lanes.at(-1).rect.x + layout.lanes.at(-1).rect.width);
  assert.equal(new Set(layout.boxes.map((item) => item.rect.y)).size, 1);
  assert(
    graph.nodes
      .filter((node) => node.type === "visual/box")
      .every((node) => node.data.summary && node.data.members.length === 1),
  );
  assert.deepEqual(visualGeometryIssues(lens), []);
});
test("an edge label only enlarges its local corridor", () => {
  const lens = journey(),
    before = layoutVisualLens(lens);
  lens.flows[1].label = "A detailed transfer label";
  const after = layoutVisualLens(lens);
  assert(after.gutters["lane-1"] > before.gutters["lane-1"]);
  for (const id of ["lane-0", "lane-2", "lane-3", "lane-4"])
    assert.equal(after.gutters[id], before.gutters[id]);
  assert(after.bounds.width - before.bounds.width < 170);
  assert.deepEqual(visualGeometryIssues(lens), []);
});
test("semantic slots align comparable rows and vendor changes preserve positions", () => {
  const lens = journey();
  lens.boxes[0].summary = false;
  lens.boxes[0].members.push({ id: "extra", title: "Another underlying member" });
  const before = layoutVisualLens(lens);
  assert.equal(new Set(before.boxes.map((item) => item.rect.y)).size, 1);
  assert.equal(new Set(before.boxes.map((item) => item.rect.height)).size, 1);
  lens.boxes.forEach((box) => {
    box.provider = "gcp";
    box.members.forEach((member) => (member.icon = "gcp/storage"));
  });
  assert.deepEqual(
    layoutVisualLens(lens).boxes.map((item) => item.rect),
    before.boxes.map((item) => item.rect),
  );
});
test("process composition does not pull logical workflow steps into a deployment band", () => {
  const lens = journey();
  lens.boxes[1].controlPlane = true;
  const layout = layoutVisualLens(lens);
  assert(!layout.lanes.some((item) => item.lane.id === "@control-plane"));
  assert.deepEqual(visualGeometryIssues(lens), []);
});
test("skipping lanes and reverse flows stay in their local corridors", () => {
  const lens = journey();
  lens.flows.push({
    id: "skip",
    from: "step-0",
    to: "step-3",
    kind: "other",
    bidirectional: false,
    label: "Govern",
  });
  lens.flows.push({
    id: "back",
    from: "step-4",
    to: "step-1",
    kind: "other",
    bidirectional: false,
    label: "Feedback",
  });
  assert.deepEqual(visualGeometryIssues(lens), []);
});

// The control plane routes through bottom ports, so side-port spacing must not inflate it.
test("control-plane summaries size to content while retaining distinct bottom-port routes", () => {
  const lens = fixture();
  const control = lens.boxes.find((box) => box.controlPlane);
  control.summary = true;
  lens.flows.push({
    id: "another-control",
    from: control.id,
    to: "box:source",
    kind: "other",
    bidirectional: false,
    label: "Configure",
  });
  const layout = layoutVisualLens(lens);
  assert.equal(layout.boxes.find((item) => item.box === control).rect.height, boxHeight(control));
  assert.deepEqual(visualGeometryIssues(lens), []);
});

test("adjacent opposite flows retain full label corridors without overlaps", () => {
  const lens = journey();
  lens.composition = "deployment";
  lens.flows[0].label = "Analytics data";
  lens.flows.push({
    id: "return",
    from: "step-1",
    to: "step-0",
    kind: "data",
    bidirectional: false,
    label: "Analytics data",
  });
  const graph = buildVisualGraph(lens, layoutVisualLens(lens));
  for (const edge of graph.edges.filter((edge) => edge.data.label))
    assert.ok(edge.data.labelMaxWidth >= visualTextWidth(edge.data.label) + 8);
  assert.deepEqual(visualGeometryIssues(lens), []);
});

test("an unrelated corridor does not move an existing route", () => {
  const lens = journey();
  const first = lens.flows[0].id;
  const before = buildVisualGraph(lens, layoutVisualLens(lens)).edges.find(
    (edge) => edge.id === first,
  ).data.path;
  lens.flows.push({
    id: "unrelated",
    from: "step-3",
    to: "step-4",
    kind: "other",
    bidirectional: false,
  });
  const after = buildVisualGraph(lens, layoutVisualLens(lens)).edges.find(
    (edge) => edge.id === first,
  ).data.path;
  assert.equal(after, before);
});

test("derived ClickHouse adjacent and skipping flows use distinct physical gutter tracks", async () => {
  const { readFile } = await import("node:fs/promises");
  const { module: api } = await runnerImport(`${root}src/server-surface.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  });
  const { deriveVisualLens } = await load("derive-visual.ts");
  const text = await readFile(`${root}workspace/examples/clickhouse-cloud-stack.yaml`, "utf8");
  const checked = api.checkText(text, api.ICON_NAMES);
  assert(checked.ast);
  const lens = deriveVisualLens(checked.ast);
  assert.deepEqual(visualGeometryIssues(lens), []);
  const graph = buildVisualGraph(lens, layoutVisualLens(lens));
  const reversed = { ...lens, flows: [...lens.flows].reverse() };
  const reverseGraph = buildVisualGraph(reversed, layoutVisualLens(reversed));
  // Track ownership follows stable relationship IDs, independent of flow declaration order.
  for (const edge of graph.edges)
    assert.equal(
      reverseGraph.edges.find((other) => other.id === edge.id).data.path,
      edge.data.path,
    );
});
