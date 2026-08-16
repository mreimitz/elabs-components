/**
 * Unit tests for the Monaco registration lifecycle (#283) —
 * `attachCompletionsMonaco`'s refcount/dispose behavior + the per-model
 * scoping that keeps suggestions out of markdown models `@elabs-ai/components-editor` never
 * attached. Monaco can't render in jsdom, so `monaco-editor` is mocked (the
 * `markdown-workspace.test.tsx` / `calc-editor-monaco.ts` precedent); the real
 * suggest-widget UI is verified via `test-storybook`.
 *
 * These tests run as ONE ordered sequence (not `vi.resetModules()` per test) so
 * they exercise the REAL module-singleton refcount across "two workspaces
 * mounted" the same way the app would: attach, attach again, detach, detach —
 * asserting `registerCompletionItemProvider` is called exactly once per live
 * span and disposed only once the last consumer detaches.
 */
import { describe, expect, it, vi } from "vitest";

const { registerCompletionItemProvider } = vi.hoisted(() => ({
  registerCompletionItemProvider: vi.fn(),
}));

vi.mock("monaco-editor", () => ({
  languages: {
    registerCompletionItemProvider,
    CompletionItemKind: { Text: 18 },
  },
}));

import { attachCompletionsMonaco } from "./editor-completions-monaco";
import type { EditorCompletionProvider } from "./editor-completions";

// ---------------------------------------------------------------------------
// Minimal Monaco editor mock — mirrors the shape used by
// markdown-workspace.test.tsx, extended with a mutable model + trigger().
// ---------------------------------------------------------------------------

function makeModel(id: string, value = "", lineText = "") {
  return {
    id,
    getValue: vi.fn(() => value),
    getLineContent: vi.fn(() => lineText),
  };
}

function makeEditor(initialModel: ReturnType<typeof makeModel>) {
  let model = initialModel;
  const contentHandlers: Array<(e: { changes: { text: string }[] }) => void> = [];
  const modelHandlers: Array<() => void> = [];
  const disposeContent = vi.fn();
  const disposeModel = vi.fn();

  return {
    getModel: vi.fn(() => model),
    setModel: (m: ReturnType<typeof makeModel>) => {
      model = m;
    },
    onDidChangeModelContent: vi.fn((cb: (e: { changes: { text: string }[] }) => void) => {
      contentHandlers.push(cb);
      return { dispose: disposeContent };
    }),
    onDidChangeModel: vi.fn((cb: () => void) => {
      modelHandlers.push(cb);
      return { dispose: disposeModel };
    }),
    trigger: vi.fn(),
    fireContentChange: (text: string) =>
      contentHandlers.forEach((cb) => cb({ changes: [{ text }] })),
    fireModelChange: () => modelHandlers.forEach((cb) => cb()),
    disposeContent,
    disposeModel,
  };
}

const wikilinkProvider: EditorCompletionProvider = {
  id: "wikilink",
  triggerCharacters: ["["],
  provide: () => [{ label: "note-one", insertText: "note-one]]" }],
};

// NOTE: no `beforeEach` mock reset here — this suite is intentionally ONE
// ordered sequence sharing `registerCompletionItemProvider`'s call history, to
// exercise the real module-singleton refcount across "two workspaces mounted"
// exactly like the app would (see file doc).
describe("attachCompletionsMonaco — refcount + dispose lifecycle", () => {
  const registrationDispose = vi.fn();
  registerCompletionItemProvider.mockReturnValue({ dispose: registrationDispose });

  const modelA = makeModel("A", "[[no", "[[no");
  const editorA = makeEditor(modelA);
  const modelB = makeModel("B", "", "");
  const editorB = makeEditor(modelB);

  let detachA: () => void;
  let detachB: () => void;
  // Mutable so the "rebuilt provider list" test can swap it out from UNDER the
  // already-attached editorA — exactly what a re-rendered `completions` prop
  // (a fresh array identity) does, read live via this same getter.
  let editorAProviders: EditorCompletionProvider[] = [wikilinkProvider];

  it("registers the global provider exactly once for the first attach", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detachA = attachCompletionsMonaco(editorA as any, () => editorAProviders);
    expect(registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    expect(registerCompletionItemProvider).toHaveBeenCalledWith("markdown", expect.any(Object));
  });

  it("a second attach (a second mounted workspace) does NOT re-register", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detachB = attachCompletionsMonaco(editorB as any, () => undefined);
    expect(registerCompletionItemProvider).toHaveBeenCalledTimes(1);
  });

  it("scopes suggestions to models THIS module attached — modelA gets suggestions, an unattached model doesn't", async () => {
    const provideCompletionItems = registerCompletionItemProvider.mock.calls[0]?.[1]
      .provideCompletionItems as (
      model: unknown,
      position: unknown,
    ) => Promise<{ suggestions: unknown[] }>;
    const position = { lineNumber: 1, column: 5 };

    const resultA = await provideCompletionItems(modelA, position);
    expect(resultA.suggestions).toHaveLength(1);
    expect((resultA.suggestions[0] as { insertText: string }).insertText).toBe("note-one]]");

    const unattached = makeModel("unattached", "[[no", "[[no");
    const resultUnattached = await provideCompletionItems(unattached, position);
    expect(resultUnattached.suggestions).toHaveLength(0);
  });

  it("reads a rebuilt provider list live — no re-registration needed", async () => {
    const provideCompletionItems = registerCompletionItemProvider.mock.calls[0]?.[1]
      .provideCompletionItems as (
      model: unknown,
      position: unknown,
    ) => Promise<{ suggestions: unknown[] }>;
    const position = { lineNumber: 1, column: 5 };

    const before = await provideCompletionItems(modelA, position);
    expect(before.suggestions).toHaveLength(1);

    // Rebuild the candidate list (a fresh array identity, like a re-rendered
    // `completions` prop) WITHOUT calling attach again — the SAME attach from
    // the first test reads this live through the `editorAProviders` closure.
    editorAProviders = [
      wikilinkProvider,
      { id: "second", triggerCharacters: ["["], provide: () => [{ label: "x", insertText: "x" }] },
    ];
    const after = await provideCompletionItems(modelA, position);
    expect(after.suggestions).toHaveLength(2);
    expect(registerCompletionItemProvider).toHaveBeenCalledTimes(1);
  });

  it("force-opens the suggest widget when a typed char matches a trigger character", () => {
    editorA.fireContentChange("[");
    expect(editorA.trigger).toHaveBeenCalledWith(
      "brand-completions",
      "editor.action.triggerSuggest",
      {},
    );
  });

  it("does NOT force-open the suggest widget for a non-trigger character", () => {
    editorA.trigger.mockClear();
    editorA.fireContentChange("x");
    expect(editorA.trigger).not.toHaveBeenCalled();
  });

  it("moving to a new model re-scopes the registry (old model drops out)", async () => {
    const provideCompletionItems = registerCompletionItemProvider.mock.calls[0]?.[1]
      .provideCompletionItems as (
      model: unknown,
      position: unknown,
    ) => Promise<{ suggestions: unknown[] }>;
    const position = { lineNumber: 1, column: 5 };

    const modelA2 = makeModel("A2", "[[no", "[[no");
    editorA.setModel(modelA2);
    editorA.fireModelChange();

    const resultOld = await provideCompletionItems(modelA, position);
    expect(resultOld.suggestions).toHaveLength(0);
    // 2 providers by this point (the previous test rebuilt `editorAProviders`
    // to include a second one) — the exact count isn't the point, only that
    // the NEW model is now scoped in.
    const resultNew = await provideCompletionItems(modelA2, position);
    expect(resultNew.suggestions.length).toBeGreaterThan(0);
  });

  it("detaching a NON-last consumer does not dispose the global registration", () => {
    detachB();
    expect(registrationDispose).not.toHaveBeenCalled();
  });

  it("detaching the LAST consumer disposes the global registration (no leak)", () => {
    detachA();
    expect(registrationDispose).toHaveBeenCalledTimes(1);
  });

  it("a later attach re-registers fresh once refcount has dropped to zero", () => {
    const modelC = makeModel("C", "", "");
    const editorC = makeEditor(modelC);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detachC = attachCompletionsMonaco(editorC as any, () => [wikilinkProvider]);
    expect(registerCompletionItemProvider).toHaveBeenCalledTimes(2);
    detachC();
  });
});
