import { normalizeFileSource } from "@elabs-ai/components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isViewerError } from "../../core/errors";
import jsonModule, { toTreeNodes, type JsonDocument } from "./json-adapter";

const parse = (text: string) =>
  jsonModule
    .create()
    .load(
      normalizeFileSource({ kind: "text", text, name: "data.json" }),
      {},
    ) as Promise<JsonDocument>;

describe("toTreeNodes", () => {
  it("uses the JSON path as the node id, so ids are stable and addressable", () => {
    const nodes = toTreeNodes({ items: [{ name: "a" }] });
    expect(nodes[0]?.id).toBe("$.items");
    expect(nodes[0]?.children?.[0]?.id).toBe("$.items[0]");
    expect(nodes[0]?.children?.[0]?.children?.[0]?.id).toBe("$.items[0].name");
  });

  it("gives scalars no children, so they render as leaves", () => {
    const nodes = toTreeNodes({ n: 1, s: "x", b: true, nul: null });
    expect(nodes.map((node) => node.children)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("returns nothing for a scalar root — there is no structure to expand", () => {
    expect(toTreeNodes(42)).toEqual([]);
    expect(toTreeNodes("hello")).toEqual([]);
    expect(toTreeNodes(null)).toEqual([]);
  });

  it("keeps empty containers expandable-looking but childless", () => {
    const nodes = toTreeNodes({ empty: {}, none: [] });
    expect(nodes[0]?.children).toEqual([]);
    expect(nodes[1]?.children).toEqual([]);
  });
});

describe("json adapter — parsing", () => {
  it("parses to a real value and keeps the source text", async () => {
    const doc = await parse('{"a":1}');
    expect(doc.value).toEqual({ a: 1 });
    expect(doc.text).toBe('{"a":1}');
  });

  it("fails invalid JSON terminally rather than falling through to plain text", async () => {
    const error = await parse("{ not json ").catch((e: unknown) => e);
    expect(isViewerError(error) && error.code).toBe("parse-failed");
    // The engine's own message carries the position — the one fact the user needs.
    expect(isViewerError(error) && error.fileName).toBe("data.json");
  });
});

describe("json adapter — rendering", () => {
  const source = normalizeFileSource({ kind: "text", text: "", name: "data.json" });

  it("renders a named tree", async () => {
    const doc = await parse('{"items":[1,2]}');
    render(<jsonModule.Renderer document={doc} source={source} />);
    expect(screen.getByRole("tree", { name: "JSON structure" })).toBeInTheDocument();
  });

  it("falls back to the raw text for a scalar document", async () => {
    const doc = await parse("42");
    const { container } = render(<jsonModule.Renderer document={doc} source={source} />);
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(container.querySelector("pre")).toHaveTextContent("42");
  });
});
