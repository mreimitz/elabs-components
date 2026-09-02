import { describe, expect, it } from "vitest";
import { APPROVAL_SCOPE_DESCRIPTION_KEYS, type ApprovalScope } from "./approval-option";

describe("APPROVAL_SCOPE_DESCRIPTION_KEYS", () => {
  it("has one message key per scope", () => {
    const scopes: ApprovalScope[] = ["once", "session", "always", "deny"];
    for (const scope of scopes) {
      expect(typeof APPROVAL_SCOPE_DESCRIPTION_KEYS[scope]).toBe("string");
      expect(APPROVAL_SCOPE_DESCRIPTION_KEYS[scope].length).toBeGreaterThan(0);
    }
  });

  it("keys are distinct per scope", () => {
    const values = Object.values(APPROVAL_SCOPE_DESCRIPTION_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
