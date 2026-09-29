import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { groupFlowLabels } = (
  await runnerImport(`${root}src/edges/group-flow-labels.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;

function edge(id, source, target, data = {}, props = {}) {
  return {
    id,
    source,
    target,
    type: "arch/flow",
    data: { label: "CDC & bulk", ...data },
    ...props,
  };
}

test("fan-in shares one stable caption without changing independent edge identities", () => {
  const edges = [edge("b", "sap", "replicate"), edge("a", "mainframe", "replicate")];
  const groups = groupFlowLabels(edges);
  assert.deepEqual(groups.get("a"), {
    ownerId: "a",
    memberIds: ["a", "b"],
    endpoint: "target",
    endpointId: "replicate",
    handle: null,
  });
  assert.equal(groups.get("a"), groups.get("b"));
  assert.deepEqual(groupFlowLabels([...edges].reverse()), groups);
});

test("fan-out and repeated source/target pairs are supported", () => {
  const fanOut = groupFlowLabels([edge("a", "s", "x"), edge("b", "s", "y")]);
  assert.equal(fanOut.get("a").endpoint, "source");
  const duplicates = groupFlowLabels([edge("a", "s", "t"), edge("b", "s", "t")]);
  assert.equal(duplicates.get("a").endpoint, "target");
  assert.deepEqual(duplicates.get("a").memberIds, ["a", "b"]);
});

test("hidden, non-flow and blank-label edges do not join visible groups", () => {
  const edges = [
    edge("a", "a", "t"),
    edge("hidden", "b", "t", {}, { hidden: true }),
    edge("other", "c", "t", {}, { type: "default" }),
    edge("empty", "d", "t", { label: "" }),
    edge("spaces", "e", "t", { label: "  " }),
    edge("missing", "f", "t", { label: undefined }),
  ];
  assert.equal(groupFlowLabels(edges).size, 0);
  assert.deepEqual(groupFlowLabels([...edges, edge("b", "b", "t")]).get("a").memberIds, ["a", "b"]);
});

test("exact captions and all displayed metadata distinguish groups", () => {
  for (const changed of [
    { label: "cdc & bulk" },
    { label: "CDC & bulk " },
    { kind: "access" },
    { style: "dashed" },
    { secure: "tls" },
    { direction: "back" },
    { direction: "both" },
    { protocol: "HTTPS" },
    { schedule: "nightly" },
    { step: 1 },
    { animated: true },
    { classes: ["sensitive"] },
  ]) {
    assert.equal(
      groupFlowLabels([edge("a", "s1", "t"), edge("b", "s2", "t", changed)]).size,
      0,
      JSON.stringify(changed),
    );
  }
});

test("omitted renderer defaults and explicit defaults share a group", () => {
  const defaults = {
    kind: "data",
    style: "solid",
    secure: "none",
    direction: "forward",
    protocol: "",
    schedule: "",
    animated: false,
    classes: [],
  };
  assert.equal(groupFlowLabels([edge("a", "s1", "t"), edge("b", "s2", "t", defaults)]).size, 2);
  assert.equal(
    groupFlowLabels([
      edge("a", "s1", "t", { kind: "control" }),
      edge("b", "s2", "t", { kind: "control", style: "dotted" }),
    ]).size,
    2,
  );
  assert.equal(
    groupFlowLabels([
      edge("a", "s1", "t", { animated: true }),
      edge("b", "s2", "t", {}, { animated: true }),
    ]).size,
    2,
  );
  assert.equal(
    groupFlowLabels([
      edge("a", "s1", "t", { animated: false }, { animated: true }),
      edge("b", "s2", "t"),
    ]).size,
    2,
  );
});

test("class and CSS differences stay separate, regardless of property insertion order", () => {
  for (const props of [
    { className: "highlight" },
    { style: { stroke: "var(--primary)" } },
    { animated: true },
  ]) {
    assert.equal(groupFlowLabels([edge("a", "s1", "t"), edge("b", "s2", "t", {}, props)]).size, 0);
  }
  assert.equal(
    groupFlowLabels([
      edge("a", "s1", "t", {}, { style: { opacity: 0.5, strokeWidth: 2 } }),
      edge("b", "s2", "t", {}, { style: { strokeWidth: 2, opacity: 0.5 } }),
    ]).size,
    2,
  );
});

test("actual shared handles and composite inner endpoint identities must match", () => {
  for (const endpoint of ["source", "target"]) {
    const make = (id, data = {}, props = {}) =>
      endpoint === "target"
        ? edge(id, id, "shared", data, props)
        : edge(id, "shared", id, data, props);
    const handle = `${endpoint}Handle`;
    const inner = endpoint === "source" ? "innerSource" : "innerTarget";
    assert.equal(
      groupFlowLabels([make("a", {}, { [handle]: "x" }), make("b", {}, { [handle]: "y" })]).size,
      0,
    );
    assert.equal(
      groupFlowLabels([make("a", { [inner]: "x" }), make("b", { [inner]: "y" })]).size,
      0,
    );
    const matching = groupFlowLabels([
      make("a", { [inner]: "x" }, { [handle]: "port" }),
      make("b", { [inner]: "x" }, { [handle]: "port" }),
    ]);
    assert.equal(matching.size, 2);
    assert.equal(matching.get("a").handle, "port");
    assert.equal(groupFlowLabels([make("a"), make("b", {}, { [handle]: null })]).size, 2);
  }
});

test("separate endpoint identities cannot collide through concatenated strings", () => {
  assert.equal(
    groupFlowLabels([
      edge("a", "a", "target:port", {}, { targetHandle: "end" }),
      edge("b", "b", "target", {}, { targetHandle: "port:end" }),
    ]).size,
    0,
  );
});

test("a chain never groups merely because one edge's target is another's source", () => {
  assert.equal(groupFlowLabels([edge("a", "s", "m"), edge("b", "m", "t")]).size, 0);
});

test("diamonds form independent groups rather than a transitive caption", () => {
  const groups = groupFlowLabels([
    edge("a", "s", "left"),
    edge("b", "s", "right"),
    edge("c", "left", "t"),
    edge("d", "right", "t"),
  ]);
  assert.deepEqual(groups.get("a").memberIds, ["a", "b"]);
  assert.deepEqual(groups.get("c").memberIds, ["c", "d"]);
  assert.notEqual(groups.get("a"), groups.get("c"));
});

test("crossing fan-in/out prefers the largest available group with deterministic ties", () => {
  const edges = [
    edge("a", "s", "t1"),
    edge("b", "s", "t2"),
    edge("c", "s", "t3"),
    edge("d", "x", "t1"),
    edge("e", "y", "t1"),
    edge("f", "z", "t1"),
  ];
  const groups = groupFlowLabels(edges);
  assert.deepEqual(groups.get("a").memberIds, ["a", "d", "e", "f"]);
  assert.deepEqual(groups.get("b").memberIds, ["b", "c"]);
  assert.deepEqual(groupFlowLabels([...edges].reverse()), groups);
  const tie = groupFlowLabels(edges.slice(0, 5));
  assert.equal(tie.get("a").endpoint, "target");
});

test("grouping accepts deeply frozen inputs and returns fresh results", () => {
  const freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const edges = freeze([edge("b", "s1", "t", { classes: [] }), edge("a", "s2", "t")]);
  const original = JSON.stringify(edges);
  const first = groupFlowLabels(edges);
  const second = groupFlowLabels(edges);
  assert.equal(JSON.stringify(edges), original);
  assert.deepEqual(first, second);
  assert.notEqual(first.get("a"), second.get("a"));
  assert.notEqual(first.get("a").memberIds, second.get("a").memberIds);
});
