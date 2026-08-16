/**
 * Unit tests for the engine-neutral completion-provider helpers (#283) —
 * `triggerQueryStart` / `resolveReplaceRange` (the pure range math both the
 * Monaco and Milkdown adapters share) + `collectCompletions` (the provider
 * fan-out that degrades safely on a throwing/rejecting `provide()`).
 */
import { describe, expect, it, vi } from "vitest";

import {
  collectCompletions,
  resolveReplaceRange,
  triggerQueryStart,
  type EditorCompletionItem,
  type EditorCompletionProvider,
} from "./editor-completions";

describe("triggerQueryStart", () => {
  it("resolves to the column right after the LAST trigger char before the caret", () => {
    // "[[no" — caret after "no" (column 5). The `[` at index 1 (0-based) is the
    // one whose query we want to replace, so the query start is column 3
    // (right after the second `[`), preserving the typed "[[".
    expect(triggerQueryStart("[[no", 5, ["["])).toBe(3);
  });

  it("returns null when no trigger character precedes the caret", () => {
    expect(triggerQueryStart("hello world", 6, ["["])).toBeNull();
  });

  it("returns null when triggerCharacters is undefined or empty", () => {
    expect(triggerQueryStart("[[no", 5, undefined)).toBeNull();
    expect(triggerQueryStart("[[no", 5, [])).toBeNull();
  });

  it("picks the LATEST of several distinct trigger characters", () => {
    // "@user:na" with triggers "@" and ":" — the `:` (later) wins.
    expect(triggerQueryStart("@user:na", 9, ["@", ":"])).toBe(7);
  });

  it("handles the trigger character sitting at column 1", () => {
    expect(triggerQueryStart("[abc", 5, ["["])).toBe(2);
  });
});

describe("resolveReplaceRange", () => {
  const position = { lineNumber: 3, column: 5 };

  it("uses item.replaceFrom when present, ignoring trigger detection", () => {
    const item: EditorCompletionItem = { label: "x", insertText: "y", replaceFrom: 2 };
    const range = resolveReplaceRange(item, position, "[[no", ["["]);
    expect(range).toEqual({
      startLineNumber: 3,
      startColumn: 2,
      endLineNumber: 3,
      endColumn: 5,
    });
  });

  it("falls back to the trigger-query start when replaceFrom is absent", () => {
    const item: EditorCompletionItem = { label: "x", insertText: "y" };
    const range = resolveReplaceRange(item, position, "[[no", ["["]);
    expect(range).toEqual({
      startLineNumber: 3,
      startColumn: 3,
      endLineNumber: 3,
      endColumn: 5,
    });
  });

  it("falls back to a bare insert at the caret when neither is available", () => {
    const item: EditorCompletionItem = { label: "x", insertText: "y" };
    const range = resolveReplaceRange(item, position, "no trigger here", ["["]);
    expect(range).toEqual({
      startLineNumber: 3,
      startColumn: 5,
      endLineNumber: 3,
      endColumn: 5,
    });
  });

  it("clamps an out-of-range replaceFrom into [1, column] rather than producing a backwards edit", () => {
    const item: EditorCompletionItem = { label: "x", insertText: "y", replaceFrom: 999 };
    const range = resolveReplaceRange(item, position, "[[no", ["["]);
    expect(range.startColumn).toBe(5);
    const negative: EditorCompletionItem = { label: "x", insertText: "y", replaceFrom: -3 };
    expect(resolveReplaceRange(negative, position, "[[no", ["["]).startColumn).toBe(1);
  });
});

describe("collectCompletions", () => {
  const ctx = { source: "[[no", line: 1, column: 5, lineText: "[[no" };

  it("pairs each returned item with its provider", async () => {
    const providerA: EditorCompletionProvider = {
      id: "a",
      provide: () => [{ label: "Alpha", insertText: "alpha" }],
    };
    const providerB: EditorCompletionProvider = {
      id: "b",
      provide: () => [{ label: "Beta", insertText: "beta" }],
    };
    const matches = await collectCompletions([providerA, providerB], ctx);
    expect(matches).toEqual([
      { provider: providerA, item: { label: "Alpha", insertText: "alpha" } },
      { provider: providerB, item: { label: "Beta", insertText: "beta" } },
    ]);
  });

  it("awaits an async provide()", async () => {
    const provider: EditorCompletionProvider = {
      id: "async",
      provide: async () => [{ label: "Async", insertText: "async" }],
    };
    const matches = await collectCompletions([provider], ctx);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.item.label).toBe("Async");
  });

  it("a throwing provide() contributes zero items without affecting others", async () => {
    const bad: EditorCompletionProvider = {
      id: "bad",
      provide: () => {
        throw new Error("boom");
      },
    };
    const good: EditorCompletionProvider = {
      id: "good",
      provide: () => [{ label: "Good", insertText: "good" }],
    };
    const matches = await collectCompletions([bad, good], ctx);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.item.label).toBe("Good");
  });

  it("a rejecting async provide() contributes zero items without affecting others", async () => {
    const bad: EditorCompletionProvider = {
      id: "bad-async",
      provide: async () => Promise.reject(new Error("nope")),
    };
    const good: EditorCompletionProvider = {
      id: "good",
      provide: () => [{ label: "Good", insertText: "good" }],
    };
    const matches = await collectCompletions([bad, good], ctx);
    expect(matches).toHaveLength(1);
  });

  it("passes the context through to provide()", async () => {
    const provide = vi.fn().mockReturnValue([]);
    await collectCompletions([{ id: "spy", provide }], ctx);
    expect(provide).toHaveBeenCalledWith(ctx);
  });

  it("an empty provider list resolves to an empty array", async () => {
    expect(await collectCompletions([], ctx)).toEqual([]);
  });
});
