import { describe, expect, it } from "vitest";

import { parseMarkdownOutline } from "./markdown-outline";

const DOC = `---
title: Plan
---
# Reporting migration plan

Intro text.

## Phase overview

\`\`\`md
# not a heading (fenced)
\`\`\`

### Discovery & *catalog*

## Phase overview
`;

describe("parseMarkdownOutline", () => {
  it("extracts headings with levels and stripped-source lines", () => {
    const items = parseMarkdownOutline(DOC);
    expect(items.map((i) => [i.level, i.text])).toEqual([
      [1, "Reporting migration plan"],
      [2, "Phase overview"],
      [3, "Discovery & catalog"],
      [2, "Phase overview"],
    ]);
    // Line 1 of the STRIPPED body is the H1 (frontmatter removed).
    expect(items[0]!.line).toBe(1);
  });

  it("skips headings inside fenced code blocks", () => {
    expect(parseMarkdownOutline(DOC).some((i) => i.text.includes("not a heading"))).toBe(false);
  });

  it("dedupes repeated slugs", () => {
    const ids = parseMarkdownOutline(DOC).map((i) => i.id);
    expect(ids).toContain("phase-overview");
    expect(ids).toContain("phase-overview-1");
  });

  it("returns [] for heading-free documents", () => {
    expect(parseMarkdownOutline("just text\n\nmore text")).toEqual([]);
  });
});
