import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Monaco can't mount in jsdom — mock it and assert the wrapper's lifecycle.
const h = vi.hoisted(() => {
  interface MockModel {
    value: string;
    language: string;
    getValue: () => string;
    setValue: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }
  const models: MockModel[] = [];
  const createModel = vi.fn((value: string, language: string) => {
    const m = { value, language, getValue: () => value, setValue: vi.fn(), dispose: vi.fn() };
    models.push(m);
    return m;
  });
  const diff = {
    setModel: vi.fn(),
    getModel: vi.fn(() => ({ original: models[0], modified: models[1] })),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  };
  return { models, createModel, diff, createDiffEditor: vi.fn(() => diff) };
});

vi.mock("monaco-editor", () => ({
  editor: {
    createDiffEditor: h.createDiffEditor,
    createModel: h.createModel,
    setModelLanguage: vi.fn(),
    defineTheme: vi.fn(),
    setTheme: vi.fn(),
  },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
}));

import { DiffEditor } from "./diff-editor";

// See the matching note in `../code-editor/code-editor.test.tsx` — the engine
// loads via a dynamic `import("monaco-editor")`; flush it before asserting.
const flush = () => act(async () => {});

beforeEach(() => {
  h.models.length = 0;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("DiffEditor", () => {
  it("creates a diff editor with original + modified models", async () => {
    const { getByTestId } = render(<DiffEditor original="a" modified="b" language="typescript" />);
    expect(getByTestId("diff-editor")).toBeInTheDocument();
    await flush();
    expect(h.createDiffEditor).toHaveBeenCalledTimes(1);
    expect(h.createModel).toHaveBeenNthCalledWith(1, "a", "typescript");
    expect(h.createModel).toHaveBeenNthCalledWith(2, "b", "typescript");
    expect(h.diff.setModel).toHaveBeenCalledWith({
      original: h.models[0],
      modified: h.models[1],
    });
  });

  it("names both sides and keeps the names through every option update", async () => {
    const { rerender } = render(
      <DiffEditor original="a" modified="b" ariaLabel="The change under test" />,
    );
    await flush();
    const names = {
      originalAriaLabel: "The change under test (original)",
      modifiedAriaLabel: "The change under test (modified)",
    };
    expect(h.createDiffEditor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining(names),
    );
    // Monaco derives each side's `ariaLabel` from the CHANGED options only, so an update that
    // omitted the names would blank both surfaces.
    rerender(
      <DiffEditor original="a" modified="b" ariaLabel="The change under test" readOnly={false} />,
    );
    for (const [changed] of h.diff.updateOptions.mock.calls) expect(changed).toMatchObject(names);
    expect(h.diff.updateOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: false }),
    );
  });

  it("disposes the editor + both models on unmount", async () => {
    const { unmount } = render(<DiffEditor original="a" modified="b" />);
    await flush();
    const [original, modified] = h.models;
    unmount();
    expect(h.diff.dispose).toHaveBeenCalledTimes(1);
    expect(original!.dispose).toHaveBeenCalledTimes(1);
    expect(modified!.dispose).toHaveBeenCalledTimes(1);
  });
});
