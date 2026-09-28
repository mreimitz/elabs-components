import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (file) =>
  (await runnerImport(`${root}src/visual/${file}`, { root, configFile: false, logLevel: "error" }))
    .module;
const { layoutVisualLens } = await load("lane-layout.ts");
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
  assert(Math.abs(first.labelY - second.labelY) >= 32);
  assert(first.labelMaxWidth > 0 && second.labelMaxWidth > 0);
  assert(graph.edges.every((edge) => edge.ariaLabel.includes("A long transfer label")));
});
