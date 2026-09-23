import { describe, expect, it } from "vitest";
import { isStorybookDocument } from "./story-ready";

// A Storybook preview document carries `#storybook-root` in its HTML from the first byte; the
// server's own error page (the `/storybook/` rewrite with its origin down) does not.
function fakeDocument(ids: string[]): Document {
  return {
    getElementById: (id: string) => (ids.includes(id) ? ({} as HTMLElement) : null),
  } as unknown as Document;
}

describe("isStorybookDocument", () => {
  it("recognises a Storybook preview document", () => {
    expect(isStorybookDocument(fakeDocument(["storybook-root", "storybook-docs"]))).toBe(true);
  });

  it("rejects an error page and a missing document", () => {
    expect(isStorybookDocument(fakeDocument(["__next"]))).toBe(false);
    expect(isStorybookDocument(null)).toBe(false);
    expect(isStorybookDocument(undefined)).toBe(false);
  });
});
