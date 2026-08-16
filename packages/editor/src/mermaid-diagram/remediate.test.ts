import { describe, expect, it } from "vitest";

import { offendingToken, remediateReservedIds } from "./remediate";

const CHART = `flowchart TD
  graph[Microsoft Graph: Outlook, Calendar, Teams]
  web[Approved web URLs]
  graph -->|delta sync| worker
  worker --> graph
  subgraph host["Local host"]
    pg[Postgres]
  end`;

describe("offendingToken", () => {
  it("extracts the token from a mermaid parse error", () => {
    expect(offendingToken("Expecting 'SEMI', 'NEWLINE', got 'GRAPH'")).toBe("graph");
    expect(offendingToken("no token here")).toBeNull();
  });
});

describe("remediateReservedIds", () => {
  it("rewrites reserved node ids but keeps keyword positions", () => {
    const fixed = remediateReservedIds(CHART, "graph")!;
    expect(fixed).toContain("flowchart TD"); // declaration untouched
    expect(fixed).toContain("graph_[Microsoft Graph: Outlook, Calendar, Teams]");
    expect(fixed).toContain("graph_ -->|delta sync| worker");
    expect(fixed).toContain("worker --> graph_");
    expect(fixed).toContain('subgraph host["Local host"]'); // contains "graph" as substring — untouched
    expect(fixed).toContain("\n  end"); // terminator untouched
  });

  it("keeps the declaration line when the diagram uses `graph TD`", () => {
    const fixed = remediateReservedIds("graph TD\n  graph[Node]\n  graph --> b", "graph")!;
    expect(fixed.startsWith("graph TD")).toBe(true);
    expect(fixed).toContain("graph_[Node]");
    expect(fixed).toContain("graph_ --> b");
  });

  it("never touches label text, quotes, or edge text", () => {
    const src =
      'flowchart TD\n  graph[Microsoft Graph API]\n  a -->|graph sync| graph\n  b["graph notes"]';
    const fixed = remediateReservedIds(src, "graph")!;
    expect(fixed).toContain("graph_[Microsoft Graph API]");
    expect(fixed).toContain("|graph sync| graph_");
    expect(fixed).toContain('b["graph notes"]');
  });

  it("preserves lone `end` terminators while fixing `end` ids", () => {
    const src = "flowchart TD\n  end[Finish]\n  a --> end\n  subgraph s\n    b\n  end";
    const fixed = remediateReservedIds(src, "end")!;
    expect(fixed).toContain("end_[Finish]");
    expect(fixed).toContain("a --> end_");
    expect(fixed.trimEnd().endsWith("end")).toBe(true);
  });

  it("returns null for non-reserved tokens or no-op input", () => {
    expect(remediateReservedIds(CHART, "worker")).toBeNull();
    expect(remediateReservedIds("flowchart TD\n  a --> b", "class")).toBeNull();
  });
});
