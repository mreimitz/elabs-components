import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Monaco needs real layout/canvas, so it cannot mount in jsdom — mock the engine
// and assert the wrapper's lifecycle contract. Real rendering + a11y are covered
// by the Storybook interaction tests.
const h = vi.hoisted(() => {
  const state = { changeHandler: undefined as undefined | (() => void), value: "" };
  const models: {
    dispose: Mock;
    uri: { toString(): string } | undefined;
    getValue: () => string;
    getPositionAt: (offset: number) => { lineNumber: number; column: number };
    _value: string;
  }[] = [];
  const actionDisposable = { dispose: vi.fn() };
  // The most recently created/set model — a simple single-document stand-in
  // (columns are 1-based character OFFSETS, not real Monaco line/column) good
  // enough to exercise `executeEdits`'s edit shape without a real Monaco model.
  let currentModel: (typeof models)[number] | undefined;
  const editor = {
    onDidChangeModelContent: vi.fn((cb: () => void) => {
      state.changeHandler = cb;
      return { dispose: vi.fn() };
    }),
    getValue: vi.fn(() => state.value),
    setValue: vi.fn((v: string) => {
      state.value = v;
    }),
    getModel: vi.fn(() => currentModel),
    setModel: vi.fn((m: (typeof models)[number]) => {
      currentModel = m;
    }),
    executeEdits: vi.fn(
      (_source: string, edits: { range: { start: number; end: number }; text: string }[]) => {
        const edit = edits[0]!;
        const next =
          state.value.slice(0, edit.range.start) + edit.text + state.value.slice(edit.range.end);
        state.value = next;
        if (currentModel) currentModel._value = next;
      },
    ),
    updateOptions: vi.fn(),
    addAction: vi.fn(() => actionDisposable),
    // Minimal DOM node so the aria-forwarding effect can find (or not) a textarea.
    getDomNode: vi.fn(() => null as HTMLElement | null),
    dispose: vi.fn(),
  };
  return {
    state,
    models,
    get model() {
      return models[0];
    },
    actionDisposable,
    editor,
    create: vi.fn(() => editor),
    createModel: vi.fn((value: string, _language: string, uri?: { toString(): string }) => {
      state.value = value;
      const m = {
        dispose: vi.fn(),
        uri,
        _value: value,
        getValue(this: { _value: string }) {
          return this._value;
        },
        getPositionAt(offset: number) {
          return { lineNumber: 1, column: offset };
        },
      };
      models.push(m);
      currentModel = m;
      return m;
    }),
  };
});

vi.mock("monaco-editor", () => ({
  editor: {
    create: h.create,
    createModel: h.createModel,
    setModelLanguage: vi.fn(),
    defineTheme: vi.fn(),
    setTheme: vi.fn(),
  },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  Range: {
    fromPositions: (start: { column: number }, end: { column: number }) => ({
      start: start.column,
      end: end.column,
    }),
  },
}));

import { CodeEditor } from "./code-editor";

// The engine now loads via a dynamic `import("monaco-editor")` inside the
// mount effect (kept lazy so the barrel never evaluates Monaco just for
// `CopyButton`/`EDITOR_LANGUAGES` — see barrel-monaco-lazy.test.ts). The mock
// module still resolves through that dynamic import, but only after a
// microtask: flush it with `await act(async () => {})` after every
// render/rerender that expects the editor to already exist.
const flush = () => act(async () => {});

beforeEach(() => {
  h.state.changeHandler = undefined;
  h.state.value = "";
  h.models.length = 0;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("CodeEditor", () => {
  it("creates a Monaco editor with the initial value + language", async () => {
    const { getByTestId } = render(
      <CodeEditor defaultValue="const a = 1;" language="typescript" />,
    );
    expect(getByTestId("code-editor")).toBeInTheDocument();
    await flush();
    expect(h.create).toHaveBeenCalledTimes(1);
    // No `path` → no model URI.
    expect(h.createModel).toHaveBeenCalledWith("const a = 1;", "typescript", undefined);
  });

  it("creates the model with a URI derived from `path`", async () => {
    render(<CodeEditor defaultValue="x" language="json" path="config/app.json" />);
    await flush();
    expect(h.createModel).toHaveBeenCalledWith("x", "json", {
      toString: expect.any(Function),
    });
  });

  it("forwards content edits to onChange", async () => {
    const onChange = vi.fn();
    render(<CodeEditor defaultValue="" onChange={onChange} />);
    await flush();
    expect(h.state.changeHandler).toBeTypeOf("function");
    act(() => {
      h.state.value = "typed";
      h.state.changeHandler?.();
    });
    expect(onChange).toHaveBeenCalledWith("typed");
  });

  it("disposes the editor + model on unmount", async () => {
    const { unmount } = render(<CodeEditor defaultValue="x" />);
    await flush();
    unmount();
    expect(h.editor.dispose).toHaveBeenCalledTimes(1);
    expect(h.model!.dispose).toHaveBeenCalledTimes(1);
  });

  describe("actions prop", () => {
    it("calls addAction once per descriptor on mount", async () => {
      const actions = [
        { id: "test.one", label: "One", run: vi.fn() },
        { id: "test.two", label: "Two", run: vi.fn() },
      ];
      render(<CodeEditor defaultValue="" actions={actions} />);
      await flush();
      expect(h.editor.addAction).toHaveBeenCalledTimes(2);
      expect(h.editor.addAction).toHaveBeenCalledWith(actions[0]);
      expect(h.editor.addAction).toHaveBeenCalledWith(actions[1]);
    });

    it("disposes old disposables and re-adds when the actions array identity changes", async () => {
      const actionsV1 = [{ id: "test.a", label: "A", run: vi.fn() }];
      const actionsV2 = [
        { id: "test.a", label: "A", run: vi.fn() },
        { id: "test.b", label: "B", run: vi.fn() },
      ];
      const { rerender } = render(<CodeEditor defaultValue="" actions={actionsV1} />);
      await flush();
      expect(h.editor.addAction).toHaveBeenCalledTimes(1);

      rerender(<CodeEditor defaultValue="" actions={actionsV2} />);
      // Old disposable disposed, then re-added for both new actions.
      expect(h.actionDisposable.dispose).toHaveBeenCalledTimes(1);
      expect(h.editor.addAction).toHaveBeenCalledTimes(3); // 1 + 2
    });

    it("disposes all action disposables on unmount", async () => {
      const actions = [
        { id: "test.x", label: "X", run: vi.fn() },
        { id: "test.y", label: "Y", run: vi.fn() },
      ];
      const { unmount } = render(<CodeEditor defaultValue="" actions={actions} />);
      await flush();
      expect(h.editor.addAction).toHaveBeenCalledTimes(2);
      unmount();
      expect(h.actionDisposable.dispose).toHaveBeenCalledTimes(2);
    });
  });

  describe("path changes after mount", () => {
    it("swaps the model instead of ignoring the new path (Monaco has no URI setter)", async () => {
      const { rerender } = render(
        <CodeEditor defaultValue="x" path="a.ts" language="typescript" />,
      );
      await flush();
      expect(h.createModel).toHaveBeenCalledTimes(1);
      const firstModel = h.models[0]!;

      rerender(<CodeEditor defaultValue="x" path="b.ts" language="typescript" />);

      expect(h.createModel).toHaveBeenCalledTimes(2);
      expect(h.editor.setModel).toHaveBeenCalledWith(h.models[1]);
      expect(firstModel.dispose).toHaveBeenCalledTimes(1);
    });

    it("does not rebuild the model when path is unchanged across a re-render", async () => {
      const { rerender } = render(<CodeEditor defaultValue="x" path="a.ts" />);
      await flush();
      expect(h.createModel).toHaveBeenCalledTimes(1);

      rerender(<CodeEditor defaultValue="x" path="a.ts" ariaLabel="renamed" />);

      expect(h.createModel).toHaveBeenCalledTimes(1);
      expect(h.editor.setModel).not.toHaveBeenCalled();
    });
  });

  describe("controlled value sync", () => {
    it("applies a single-character change via executeEdits, never setValue", async () => {
      const { rerender } = render(<CodeEditor value="abc" onChange={vi.fn()} />);
      await flush();
      expect(h.state.value).toBe("abc");

      rerender(<CodeEditor value="abd" onChange={vi.fn()} />);

      expect(h.editor.executeEdits).toHaveBeenCalledTimes(1);
      expect(h.editor.setValue).not.toHaveBeenCalled();
      expect(h.state.value).toBe("abd");
    });

    it("does nothing when the controlled value already matches the model", async () => {
      render(<CodeEditor value="same" onChange={vi.fn()} />);
      await flush();
      h.editor.executeEdits.mockClear();

      render(<CodeEditor value="same" onChange={vi.fn()} />);
      await flush();

      expect(h.editor.executeEdits).not.toHaveBeenCalled();
    });
  });

  describe("options changes after mount", () => {
    it("re-applies a changed `options` prop via updateOptions", async () => {
      const { rerender } = render(
        <CodeEditor defaultValue="" options={{ minimap: { enabled: false } }} />,
      );
      await flush();
      h.editor.updateOptions.mockClear();

      rerender(<CodeEditor defaultValue="" options={{ minimap: { enabled: true } }} />);

      expect(h.editor.updateOptions).toHaveBeenCalledWith({ minimap: { enabled: true } });
    });
  });
});
