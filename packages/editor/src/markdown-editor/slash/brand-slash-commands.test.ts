/**
 * Unit tests for the slash-command registry — pure data: shape, grouping, and the
 * query filter. (The `run` insertion path is covered against a real editor in
 * insert-directive.test.ts.)
 */
import type { Ctx } from "@milkdown/kit/ctx";
import { describe, expect, test } from "vitest";

import type {
  IterationEditHandler,
  IterationEditRequest,
} from "../../markdown-iteration/edit-context";
import {
  BRAND_SLASH_COMMANDS,
  filterSlashCommands,
  groupSlashCommands,
} from "./brand-slash-commands";

describe("BRAND_SLASH_COMMANDS shape", () => {
  test("every command has a unique id, a label, a group, and a run", () => {
    const ids = new Set<string>();
    for (const c of BRAND_SLASH_COMMANDS) {
      expect(typeof c.id).toBe("string");
      expect(c.id.length).toBeGreaterThan(0);
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(typeof c.label).toBe("string");
      expect(c.label.length).toBeGreaterThan(0);
      expect(typeof c.group).toBe("string");
      expect(typeof c.run).toBe("function");
    }
  });

  test("covers the four brand directives + the basic blocks", () => {
    const labels = BRAND_SLASH_COMMANDS.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(["Card", "Callout", "Metric", "Timeline"]));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Heading",
        "Bullet list",
        "Numbered list",
        "Quote",
        "Code block",
        "Divider",
      ]),
    );
  });

  test("brand blocks are in the 'Brand blocks' group, basics in 'Basic'", () => {
    const brand = BRAND_SLASH_COMMANDS.filter((c) => c.group === "Brand blocks");
    const basic = BRAND_SLASH_COMMANDS.filter((c) => c.group === "Basic");
    expect(brand.map((c) => c.label)).toEqual([
      "Card",
      "Callout",
      "Metric",
      "Timeline",
      "Iterate",
      "Pivot",
      "Calc",
    ]);
    expect(basic.length).toBe(6);
  });

  test("the /calc command (#220) is registered and inserts a calc fence", () => {
    const calc = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-calc");
    expect(calc).toBeDefined();
    expect(calc?.label).toBe("Calc");
    expect(calc?.keywords).toEqual(expect.arrayContaining(["calc", "math", "formula"]));
  });
});

describe("filterSlashCommands", () => {
  test("an empty query returns the full list in order", () => {
    expect(filterSlashCommands(BRAND_SLASH_COMMANDS, "")).toBe(BRAND_SLASH_COMMANDS);
    expect(filterSlashCommands(BRAND_SLASH_COMMANDS, "   ")).toBe(BRAND_SLASH_COMMANDS);
  });

  test("matches on the label (case-insensitive substring)", () => {
    const r = filterSlashCommands(BRAND_SLASH_COMMANDS, "ca");
    const labels = r.map((c) => c.label);
    // "ca" matches Card + Callout (label) and others via keywords.
    expect(labels).toEqual(expect.arrayContaining(["Card", "Callout"]));
  });

  test("matches on keywords too (e.g. 'kpi' → Metric)", () => {
    const r = filterSlashCommands(BRAND_SLASH_COMMANDS, "kpi");
    expect(r.map((c) => c.label)).toContain("Metric");
  });

  test("matches 'alert' → Callout via keyword", () => {
    const r = filterSlashCommands(BRAND_SLASH_COMMANDS, "alert");
    expect(r.map((c) => c.label)).toContain("Callout");
  });

  test("a no-match query returns an empty list", () => {
    expect(filterSlashCommands(BRAND_SLASH_COMMANDS, "zzzznotacommand")).toHaveLength(0);
  });
});

describe("groupSlashCommands", () => {
  test("preserves first-seen group order and keeps every command", () => {
    const grouped = groupSlashCommands(BRAND_SLASH_COMMANDS);
    expect(grouped.map((g) => g.group)).toEqual(["Brand blocks", "Basic"]);
    const total = grouped.reduce((n, g) => n + g.commands.length, 0);
    expect(total).toBe(BRAND_SLASH_COMMANDS.length);
  });

  test("a filtered list groups correctly (only matching groups appear)", () => {
    const filtered = filterSlashCommands(BRAND_SLASH_COMMANDS, "card");
    const grouped = groupSlashCommands(filtered);
    // "card" only matches a brand block → only the Brand blocks group shows.
    expect(grouped.map((g) => g.group)).toEqual(["Brand blocks"]);
  });
});

describe("source-mode snippets (A4 — source/split Insert-menu parity)", () => {
  test("every Brand block carries a markdown snippet; basics carry none", () => {
    for (const c of BRAND_SLASH_COMMANDS) {
      if (c.group === "Brand blocks") {
        expect(typeof c.snippet).toBe("string");
        expect((c.snippet ?? "").length).toBeGreaterThan(0);
      } else {
        expect(c.snippet).toBeUndefined();
      }
    }
  });

  test("each snippet carries the matching directive / fence marker", () => {
    const byId = new Map(BRAND_SLASH_COMMANDS.map((c) => [c.id, c.snippet ?? ""]));
    expect(byId.get("brand-card")).toContain(":::card");
    expect(byId.get("brand-callout")).toContain(":::callout");
    expect(byId.get("brand-metric")).toContain("::metric");
    expect(byId.get("brand-timeline")).toContain(":::timeline");
    expect(byId.get("brand-iterate")).toContain(":::iterate");
    expect(byId.get("brand-pivot")).toContain(":::pivot");
    expect(byId.get("brand-calc")).toContain("```calc");
  });

  test("iterate / pivot snippets seed a template token so the block isn't empty", () => {
    const byId = new Map(BRAND_SLASH_COMMANDS.map((c) => [c.id, c.snippet ?? ""]));
    expect(byId.get("brand-iterate")).toContain("{{item.name}}");
    expect(byId.get("brand-pivot")).toContain("{{cell}}");
  });
});

describe("guided commands (#223 — /iterate and /pivot open the guided modal when wired)", () => {
  test("only iterate and pivot carry a `guided` variant", () => {
    const byId = new Map(BRAND_SLASH_COMMANDS.map((c) => [c.id, c]));
    expect(typeof byId.get("brand-iterate")?.guided).toBe("function");
    expect(typeof byId.get("brand-pivot")?.guided).toBe("function");
    for (const id of [
      "brand-card",
      "brand-callout",
      "brand-metric",
      "brand-timeline",
      "brand-calc",
    ]) {
      expect(byId.get(id)?.guided).toBeUndefined();
    }
  });

  test("guided path: iterate emits an edit request seeded BLANK (no values, default template) — not a bare insert", () => {
    const iterate = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-iterate")!;
    let captured: IterationEditRequest | undefined;
    const handler: IterationEditHandler = (request) => {
      captured = request;
    };
    iterate.guided!({ ctx: {} as Ctx, range: null }, handler);
    expect(captured?.kind).toBe("iterate");
    expect(captured?.attributes).toEqual({});
    expect(captured?.template).toBe("{{item.name}}");
    expect(typeof captured?.onSave).toBe("function");
    expect(typeof captured?.onSaveData).toBe("function");
  });

  test("guided path: pivot emits an edit request seeded with the pivot default template", () => {
    const pivot = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-pivot")!;
    let captured: IterationEditRequest | undefined;
    pivot.guided!({ ctx: {} as Ctx, range: null }, (request) => {
      captured = request;
    });
    expect(captured?.kind).toBe("pivot");
    expect(captured?.attributes).toEqual({});
    expect(captured?.template).toBe("{{row}} · {{col}}");
  });

  test("fallback path: without a handler, `run` still inserts the bare directive directly (unchanged)", () => {
    // Covered end-to-end (against a real ProseMirror doc) in insert-directive.test.ts;
    // this only asserts the command still exposes the plain `run` unconditionally, so
    // a consumer with no IterationEditContext wired keeps today's behaviour.
    const iterate = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-iterate")!;
    expect(typeof iterate.run).toBe("function");
  });
});
