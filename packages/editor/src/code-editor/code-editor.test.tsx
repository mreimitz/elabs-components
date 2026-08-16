import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Monaco needs real layout/canvas, so it cannot mount in jsdom — mock the engine
// and assert the wrapper's lifecycle contract. Real rendering + a11y are covered
// by the Storybook interaction tests.
const h = vi.hoisted(() => {
  const state = { changeHandler: undefined as undefined | (() => void), value: "" };
  const model = { dispose: vi.fn() };
  const actionDisposable = { dispose: vi.fn() };
  const editor = {
    onDidChangeModelContent: vi.fn((cb: () => void) => {
      state.changeHandler = cb;
      return { dispose: vi.fn() };
    }),
    getValue: vi.fn(() => state.value),
    setValue: vi.fn((v: string) => {
      state.value = v;
    }),
    getModel: vi.fn(() => model),
    updateOptions: vi.fn(),
    addAction: vi.fn(() => actionDisposable),
    // Minimal DOM node so the aria-forwarding effect can find (or not) a textarea.
    getDomNode: vi.fn(() => null as HTMLElement | null),
    dispose: vi.fn(),
  };
  return {
    state,
    model,
    actionDisposable,
    editor,
    create: vi.fn(() => editor),
    createModel: vi.fn((value: string) => {
      state.value = value;
      return model;
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
}));

import { CodeEditor } from "./code-editor";

beforeEach(() => {
  h.state.changeHandler = undefined;
  h.state.value = "";
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("CodeEditor", () => {
  it("creates a Monaco editor with the initial value + language", () => {
    const { getByTestId } = render(
      <CodeEditor defaultValue="const a = 1;" language="typescript" />,
    );
    expect(getByTestId("code-editor")).toBeInTheDocument();
    expect(h.create).toHaveBeenCalledTimes(1);
    // No `path` → no model URI.
    expect(h.createModel).toHaveBeenCalledWith("const a = 1;", "typescript", undefined);
  });

  it("creates the model with a URI derived from `path`", () => {
    render(<CodeEditor defaultValue="x" language="json" path="config/app.json" />);
    expect(h.createModel).toHaveBeenCalledWith("x", "json", {
      toString: expect.any(Function),
    });
  });

  it("forwards content edits to onChange", () => {
    const onChange = vi.fn();
    render(<CodeEditor defaultValue="" onChange={onChange} />);
    expect(h.state.changeHandler).toBeTypeOf("function");
    act(() => {
      h.state.value = "typed";
      h.state.changeHandler?.();
    });
    expect(onChange).toHaveBeenCalledWith("typed");
  });

  it("disposes the editor + model on unmount", () => {
    const { unmount } = render(<CodeEditor defaultValue="x" />);
    unmount();
    expect(h.editor.dispose).toHaveBeenCalledTimes(1);
    expect(h.model.dispose).toHaveBeenCalledTimes(1);
  });

  describe("actions prop", () => {
    it("calls addAction once per descriptor on mount", () => {
      const actions = [
        { id: "test.one", label: "One", run: vi.fn() },
        { id: "test.two", label: "Two", run: vi.fn() },
      ];
      render(<CodeEditor defaultValue="" actions={actions} />);
      expect(h.editor.addAction).toHaveBeenCalledTimes(2);
      expect(h.editor.addAction).toHaveBeenCalledWith(actions[0]);
      expect(h.editor.addAction).toHaveBeenCalledWith(actions[1]);
    });

    it("disposes old disposables and re-adds when the actions array identity changes", () => {
      const actionsV1 = [{ id: "test.a", label: "A", run: vi.fn() }];
      const actionsV2 = [
        { id: "test.a", label: "A", run: vi.fn() },
        { id: "test.b", label: "B", run: vi.fn() },
      ];
      const { rerender } = render(<CodeEditor defaultValue="" actions={actionsV1} />);
      expect(h.editor.addAction).toHaveBeenCalledTimes(1);

      rerender(<CodeEditor defaultValue="" actions={actionsV2} />);
      // Old disposable disposed, then re-added for both new actions.
      expect(h.actionDisposable.dispose).toHaveBeenCalledTimes(1);
      expect(h.editor.addAction).toHaveBeenCalledTimes(3); // 1 + 2
    });

    it("disposes all action disposables on unmount", () => {
      const actions = [
        { id: "test.x", label: "X", run: vi.fn() },
        { id: "test.y", label: "Y", run: vi.fn() },
      ];
      const { unmount } = render(<CodeEditor defaultValue="" actions={actions} />);
      expect(h.editor.addAction).toHaveBeenCalledTimes(2);
      unmount();
      expect(h.actionDisposable.dispose).toHaveBeenCalledTimes(2);
    });
  });
});
