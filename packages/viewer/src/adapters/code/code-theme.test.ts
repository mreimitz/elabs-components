import { describe, expect, it } from "vitest";

import { codeViewerTheme } from "./code-theme";

const rules = codeViewerTheme.settings ?? [];

/** Every rule whose scope list contains `scope`, whatever else it contains. */
const rulesFor = (scope: string) =>
  rules.filter((rule) => {
    const declared = rule.scope;
    const list = Array.isArray(declared) ? declared : declared ? [declared] : [];
    return list.includes(scope);
  });

describe("code viewer theme", () => {
  it("colours every scope with a token, never a literal", () => {
    // The whole reason ONE theme is correct in every brand theme. A hex here
    // would freeze at tokenize time and survive a theme switch unchanged.
    for (const rule of rules) {
      expect(rule.settings?.foreground).toMatch(/^var\(--code-[a-z-]+\)$/);
    }
    expect(codeViewerTheme.bg).toBe("transparent");
  });

  it("italicises comments and attribute names — and nothing else", () => {
    const italic = rules.filter((rule) => rule.settings?.fontStyle === "italic");
    const scopes = italic.flatMap((rule) =>
      Array.isArray(rule.scope) ? rule.scope : rule.scope ? [rule.scope] : [],
    );
    expect(scopes).toContain("comment");
    expect(scopes).toContain("entity.other.attribute-name");
    expect(scopes).not.toContain("variable");
    expect(scopes).not.toContain("meta.object-literal.key");
  });

  it("keeps plain identifiers upright", () => {
    // The regression this locks: `entity.other.attribute-name` shared an array
    // with `variable`, and a rule's `fontStyle` applies to its whole scope list
    // — so every local, parameter and imported binding in the file leaned.
    // Asserting on the rule (not on rendered output) is the point: the bug was
    // invisible in any fixture without attributes.
    for (const rule of rulesFor("variable")) {
      expect(rule.settings?.fontStyle).toBeUndefined();
    }
  });
});
