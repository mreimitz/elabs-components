import { describe, expect, it } from "vitest";

import { topLevelBlockOf, typewriterDelta } from "./focus-writing";

describe("topLevelBlockOf", () => {
  const build = () => {
    const root = document.createElement("div");
    root.innerHTML = `<p id="a">one</p><ul id="list"><li id="li">two <strong id="deep">deep</strong></li></ul>`;
    return root;
  };

  it("returns the node itself when it is a direct child", () => {
    const root = build();
    const a = root.querySelector("#a")!;
    expect(topLevelBlockOf(root, a)).toBe(a);
  });

  it("walks nested nodes up to the top-level block", () => {
    const root = build();
    const deep = root.querySelector("#deep")!.firstChild!; // the text node
    expect(topLevelBlockOf(root, deep)).toBe(root.querySelector("#list"));
  });

  it("returns null for nodes outside the root (and for null)", () => {
    const root = build();
    const stranger = document.createElement("p");
    expect(topLevelBlockOf(root, stranger)).toBeNull();
    expect(topLevelBlockOf(root, null)).toBeNull();
  });
});

describe("typewriterDelta", () => {
  // Host: top 100, height 600 → center 400; band 0.22 → tolerance ±66.
  it("returns 0 while the caret sits inside the center band", () => {
    expect(typewriterDelta(390, 20, 100, 600)).toBe(0); // mid 400 = center
    expect(typewriterDelta(440, 20, 100, 600)).toBe(0); // mid 450, off 50 < 66
  });

  it("returns a positive delta when the caret drifts below center", () => {
    const d = typewriterDelta(580, 20, 100, 600); // mid 590, off 190
    expect(d).toBe(190);
  });

  it("returns a negative delta when the caret drifts above center", () => {
    const d = typewriterDelta(120, 20, 100, 600); // mid 130, off -270
    expect(d).toBe(-270);
  });

  it("is inert for an unmeasured host", () => {
    expect(typewriterDelta(0, 0, 0, 0)).toBe(0);
  });
});
