import { describe, expect, it } from "vitest";

import { defaultInterpolate } from "./iteration";
import { specFromDirective } from "./directive";

describe("defaultInterpolate", () => {
  it("substitutes a top-level token", () => {
    expect(defaultInterpolate("Hi {{name}}", { name: "Ada" })).toBe("Hi Ada");
  });

  it("resolves a dot path", () => {
    expect(defaultInterpolate("{{item.role}}", { item: { role: "Eng" } })).toBe("Eng");
  });

  it("leaves an unresolved token literal (so nested templates compose)", () => {
    expect(defaultInterpolate("[{{nope}}]", {})).toBe("[{{nope}}]");
  });

  it("leaves non-token text untouched (markdown survives)", () => {
    expect(defaultInterpolate("**{{n}}** and `code`", { n: "x" })).toBe("**x** and `code`");
  });
});

describe("specFromDirective", () => {
  it("defaults iterate to the stacked layout, item var", () => {
    const spec = specFromDirective("iterate", {}, "body");
    expect(spec).toMatchObject({
      kind: "iterate",
      layout: "stacked",
      as: "item",
      template: "body",
    });
  });

  it("defaults pivot to the matrix layout", () => {
    expect(specFromDirective("pivot", {}, "").layout).toBe("matrix");
  });

  it("honors an explicit layout + as + columns", () => {
    const spec = specFromDirective("iterate", { layout: "grid", as: "p", columns: "2" }, "t");
    expect(spec).toMatchObject({ layout: "grid", as: "p", columns: 2 });
  });

  it("ignores an invalid layout (falls back to the default)", () => {
    expect(specFromDirective("iterate", { layout: "bogus" }, "t").layout).toBe("stacked");
  });

  it("passes the raw attributes through (escape hatch for evaluate)", () => {
    expect(specFromDirective("iterate", { source: "sales", region: "EU" }, "t").attributes).toEqual(
      {
        source: "sales",
        region: "EU",
      },
    );
  });
});
