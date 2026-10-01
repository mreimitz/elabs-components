import { describe, expect, it, vi } from "vitest";
import { isStorybookDocument, whenStoryRendered } from "./story-ready";
import { reportStoryTheme } from "./story-theme";
import themes from "../content/generated/themes.json";

const defaultLightBackground = themes
  .find((theme) => theme.isDefault)
  ?.modes.find((mode) => mode.mode === "light")?.background;

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

it("waits for Storybook's theme effect before showing or probing a rendered story", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  try {
    let appliedTheme: string | null = null;
    const doc = {
      body: { classList: { contains: () => false } },
      documentElement: { getAttribute: () => appliedTheme },
      getElementById: () => ({ childElementCount: 1 }),
      defaultView: {
        getComputedStyle: () => ({ getPropertyValue: () => defaultLightBackground }),
      },
    } as unknown as Document;
    const frame = { isConnected: true, contentDocument: doc } as HTMLIFrameElement;
    const done = vi.fn();

    const cancel = whenStoryRendered(frame, done, { theme: "ocean-dark", interval: 120 });
    expect(done).not.toHaveBeenCalled();
    // The old probe treated these temporary light tokens as proof the requested theme was absent.
    expect(reportStoryTheme("ocean-dark", doc)).toBe(false);
    vi.advanceTimersByTime(120);
    expect(done).not.toHaveBeenCalled();

    appliedTheme = "ocean-dark";
    vi.advanceTimersByTime(120);
    expect(done).toHaveBeenCalledExactlyOnceWith("ready");
    cancel();
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
