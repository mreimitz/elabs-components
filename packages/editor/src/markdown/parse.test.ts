import { describe, expect, it } from "vitest";

import { parseMarkdown } from "./parse";

/** Minimal recursive mdast shape for walking without pulling the full types. */
type MdNode = { type: string; name?: string; children?: MdNode[] };

function nodeTypes(tree: MdNode): Set<string> {
  const types = new Set<string>();
  const walk = (n: MdNode) => {
    types.add(n.type);
    for (const c of n.children ?? []) walk(c);
  };
  walk(tree);
  return types;
}

describe("parseMarkdown", () => {
  it("parses gfm + directives + frontmatter into one mdast tree", () => {
    const tree = parseMarkdown(
      [
        "---",
        "title: X",
        "---",
        "# Heading",
        "",
        ':::card{title="T"}',
        "body",
        ":::",
        "",
        "| a | b |",
        "| - | - |",
        "| 1 | 2 |",
      ].join("\n"),
    ) as unknown as MdNode;

    const types = nodeTypes(tree);
    expect(tree.type).toBe("root");
    expect(types.has("yaml")).toBe(true); // frontmatter
    expect(types.has("containerDirective")).toBe(true); // remark-directive
    expect(types.has("table")).toBe(true); // gfm
  });

  it("parses inline + leaf directives", () => {
    // Inline `:entity` sits mid-sentence; a leaf `::metric` occupies its own line.
    const tree = parseMarkdown(
      "Owner :entity[Acme]{kind=org} ships it.\n\n::metric{value=1}",
    ) as unknown as MdNode;
    const types = nodeTypes(tree);
    expect(types.has("textDirective")).toBe(true);
    expect(types.has("leafDirective")).toBe(true);
  });

  it("returns RAW directive mdast — it does NOT rewrite to <brand-directive>", () => {
    const tree = parseMarkdown(":::card\nx\n:::") as unknown as MdNode;
    const json = JSON.stringify(tree);
    expect(json).toContain("containerDirective");
    expect(json).not.toContain("brand-directive");
  });
});
