import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { needsCjkPlugin, preloadCjk, useLazyCjkPlugin } from "./_lazy-cjk";

const fakeCjkPlugin = {
  name: "cjk",
  remarkPlugins: [],
  remarkPluginsAfter: [],
  remarkPluginsBefore: [],
  type: "cjk",
};

vi.mock("@streamdown/cjk", () => ({ cjk: fakeCjkPlugin }));

describe("needsCjkPlugin", () => {
  it("returns false for plain ASCII text", () => {
    expect(needsCjkPlugin("plain text")).toBe(false);
  });

  it("matches CJK Unified Ideographs, Hiragana, Katakana and Hangul", () => {
    expect(needsCjkPlugin("你好")).toBe(true);
    expect(needsCjkPlugin("こんにちは")).toBe(true);
    expect(needsCjkPlugin("コンニチハ")).toBe(true);
    expect(needsCjkPlugin("안녕하세요")).toBe(true);
  });
});

describe("useLazyCjkPlugin", () => {
  it("returns undefined when the text has no CJK codepoints", () => {
    const { result } = renderHook(() => useLazyCjkPlugin("plain text"));
    expect(result.current).toBeUndefined();
  });

  it("loads and returns the plugin once the text needs CJK handling", async () => {
    const { result } = renderHook(() => useLazyCjkPlugin("你好，世界"));
    await waitFor(() => expect(result.current).toBe(fakeCjkPlugin));
  });

  it("preloadCjk resolves without throwing", () => {
    expect(() => preloadCjk()).not.toThrow();
  });
});
