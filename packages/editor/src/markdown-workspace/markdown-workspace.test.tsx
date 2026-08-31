import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";

import type { SlashCommand } from "../markdown-editor/slash";
import {
  hasPendingMilkdownTeardown,
  waitForPendingMilkdownTeardown,
} from "../markdown-editor/milkdown-react/use-get-editor";

// ---------------------------------------------------------------------------
// Monaco mock — extended with revealLine / revealLineInCenter / getLineCount
// for the #273 MarkdownWorkspaceHandle tests, and addAction / onDidBlurEditorText
// / getPosition / getScrolledVisiblePosition for the #271 source slash tests.
// ---------------------------------------------------------------------------
const revealLine = vi.fn();
const revealLineInCenter = vi.fn();
// Default model has 20 lines so range checks pass.
const getLineCount = vi.fn(() => 20);
const addAction = vi.fn(() => ({ dispose: vi.fn() }));

vi.mock("monaco-editor", () => ({
  editor: {
    create: vi.fn(() => ({
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
      onDidScrollChange: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
      onDidBlurEditorText: vi.fn(() => ({ dispose: vi.fn() })),
      getValue: vi.fn(() => ""),
      setValue: vi.fn(),
      getSelection: vi.fn(() => null),
      getModel: vi.fn(() => ({ dispose: vi.fn(), getLineCount })),
      updateOptions: vi.fn(),
      dispose: vi.fn(),
      getDomNode: vi.fn(() => null),
      getVisibleRanges: vi.fn(() => []),
      getTopForLineNumber: vi.fn(() => 0),
      setScrollTop: vi.fn(),
      getPosition: vi.fn(() => null),
      getScrolledVisiblePosition: vi.fn(() => null),
      revealLine,
      revealLineInCenter,
      addAction,
      focus: vi.fn(),
    })),
    createModel: vi.fn(() => ({ dispose: vi.fn() })),
    setModelLanguage: vi.fn(),
    defineTheme: vi.fn(),
    setTheme: vi.fn(),
  },
  // KeyMod / KeyCode are used by parseShortcut inside the sourceActions useMemo.
  KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 },
  KeyCode: {
    Slash: 85,
    KeyA: 31,
    KeyB: 32,
    KeyC: 33,
    KeyD: 34,
    KeyE: 35,
    KeyF: 36,
    KeyG: 37,
    KeyH: 38,
    KeyI: 39,
    KeyJ: 40,
    KeyK: 41,
    KeyL: 42,
    KeyM: 43,
    KeyN: 44,
    KeyO: 45,
    KeyP: 46,
    KeyQ: 47,
    KeyR: 48,
    KeyS: 49,
    KeyT: 50,
    KeyU: 51,
    KeyV: 52,
    KeyW: 53,
    KeyX: 54,
    KeyY: 55,
    KeyZ: 56,
  },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  Range: class {},
  Selection: class {},
}));

import { MarkdownWorkspace, type MarkdownWorkspaceHandle } from "./markdown-workspace";

// #65 — `cleanup()` unmounts synchronously but Milkdown's own `editor.destroy()`
// is async (`@milkdown/ctx` schedules an internal cleanup timer inside it), so
// returning here without waiting let that timer fire after Vitest recycled this
// file's jsdom environment: `ReferenceError: removeEventListener is not defined`.
// Await every pending Milkdown teardown (tracked in `use-get-editor.ts`) before
// the next test's `vi.clearAllMocks()` / setup runs.
afterEach(async () => {
  cleanup();
  await waitForPendingMilkdownTeardown();
  vi.clearAllMocks();
});

test("renders the mode switcher and the WYSIWYG editor", async () => {
  render(<MarkdownWorkspace defaultMode="wysiwyg" defaultValue="# Hello" />);
  expect(screen.getByTestId("markdown-workspace")).toBeInTheDocument();
  // Three modes are offered.
  expect(screen.getByRole("radio", { name: "Source" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Split" })).toBeInTheDocument();
  // Milkdown mounts the heading.
  await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
});

// #65 — regression lock for the awaitable Milkdown-destroy handle itself. Proves
// (a) unmounting a Milkdown-backed surface registers a real pending teardown
// (not a no-op — a reverted fix would leave nothing tracked and fail the first
// assertion), and (b) awaiting the exposed handle actually drains it rather than
// resolving early. Five mount/unmount cycles back to back so a leak in the
// tracking Set itself (an entry that never gets removed) would also fail.
test("#65 awaits Milkdown teardown on unmount via the exposed handle", async () => {
  for (let i = 0; i < 5; i += 1) {
    const { unmount } = render(<MarkdownWorkspace defaultMode="wysiwyg" defaultValue="# Hello" />);
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());

    unmount();
    expect(hasPendingMilkdownTeardown()).toBe(true);

    await waitForPendingMilkdownTeardown();
    expect(hasPendingMilkdownTeardown()).toBe(false);
  }
});

// #270 — focusWriting opt-out
test("focusWriting={false} hides the Focus toggle in wysiwyg mode", () => {
  render(<MarkdownWorkspace defaultMode="wysiwyg" focusWriting={false} />);
  expect(screen.queryByRole("button", { name: /focus writing/i })).toBeNull();
});

test("Focus toggle is present by default in wysiwyg mode (regression guard)", () => {
  render(<MarkdownWorkspace defaultMode="wysiwyg" />);
  expect(screen.getByRole("button", { name: /focus writing/i })).toBeInTheDocument();
});

// #272 — modeSwitch opt-out
test("modeSwitch={false} hides the built-in mode items", () => {
  render(<MarkdownWorkspace modeSwitch={false} mode="split" />);
  expect(screen.queryByRole("radio", { name: "Source" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "Split" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "Preview-edit" })).toBeNull();
  // The formatting toolbar (Bold button) is still present in source/split.
  expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
});

test("all three mode items present by default (regression guard)", () => {
  render(<MarkdownWorkspace />);
  expect(screen.getByRole("radio", { name: "Source" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Split" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Preview-edit" })).toBeInTheDocument();
});

// #272 — toolbarActions slot
test("toolbarActions renders in the trailing slot when modeSwitch={false}", () => {
  render(<MarkdownWorkspace modeSwitch={false} mode="split" toolbarActions={<button>X</button>} />);
  expect(screen.getByRole("button", { name: "X" })).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// #273 — MarkdownWorkspaceHandle
// ---------------------------------------------------------------------------

// Helper: render in source mode and wait for the Monaco mock's onMount to fire
// (the mock's `create` is synchronous, so the setMonaco state update fires in
// the same act cycle).
async function renderWithHandle(markdown = "# Section One\n\nParagraph.\n") {
  const ref = createRef<MarkdownWorkspaceHandle>();
  render(<MarkdownWorkspace ref={ref} defaultValue={markdown} defaultMode="source" />);
  // The mock's editor.create fires synchronously, but setMonaco is a state
  // update — wait one tick for it to flush.
  await act(async () => {});
  return ref;
}

test("#273 getElement() returns the root DOM div", async () => {
  const ref = await renderWithHandle();
  const el = ref.current?.getElement();
  expect(el).toBeInstanceOf(HTMLDivElement);
  expect(el).toBe(screen.getByTestId("markdown-workspace"));
});

test("#273 getEditor() returns the mocked Monaco instance after mount", async () => {
  const ref = await renderWithHandle();
  const editor = ref.current?.getEditor();
  expect(editor).toBeTruthy();
  // The mocked editor has revealLineInCenter as a spy.
  expect(typeof editor?.revealLineInCenter).toBe("function");
});

test("#273 revealLine(n) calls revealLineInCenter for in-range line (center default)", async () => {
  const ref = await renderWithHandle();
  act(() => {
    ref.current?.revealLine(5);
  });
  expect(revealLineInCenter).toHaveBeenCalledWith(5);
  expect(revealLine).not.toHaveBeenCalled();
});

test("#273 revealLine(n, { center: false }) calls revealLine (not center)", async () => {
  const ref = await renderWithHandle();
  act(() => {
    ref.current?.revealLine(3, { center: false });
  });
  expect(revealLine).toHaveBeenCalledWith(3);
  expect(revealLineInCenter).not.toHaveBeenCalled();
});

test("#273 revealLine(0) is a no-op (out of range — below 1)", async () => {
  const ref = await renderWithHandle();
  act(() => {
    ref.current?.revealLine(0);
  });
  expect(revealLineInCenter).not.toHaveBeenCalled();
  expect(revealLine).not.toHaveBeenCalled();
});

test("#273 revealLine(999) is a no-op (out of range — above getLineCount)", async () => {
  const ref = await renderWithHandle();
  act(() => {
    ref.current?.revealLine(999);
  });
  expect(revealLineInCenter).not.toHaveBeenCalled();
  expect(revealLine).not.toHaveBeenCalled();
});

test("#273 scrollToHeading resolves slug → line → revealLineInCenter in source mode", async () => {
  // The markdown has "# Section One" as line 1 of the stripped body (no frontmatter).
  // fmOffset = 0, so full-source line = 1.
  const ref = await renderWithHandle("# Section One\n\nParagraph.\n");
  act(() => {
    ref.current?.scrollToHeading("section-one");
  });
  expect(revealLineInCenter).toHaveBeenCalledWith(1);
});

test("#273 scrollToHeading with missing slug is a no-op", async () => {
  const ref = await renderWithHandle("# Actual Heading\n");
  act(() => {
    ref.current?.scrollToHeading("nonexistent-slug");
  });
  expect(revealLineInCenter).not.toHaveBeenCalled();
  expect(revealLine).not.toHaveBeenCalled();
});

test("#273 getEditor() returns null in wysiwyg mode (source pane not mounted)", () => {
  const ref = createRef<MarkdownWorkspaceHandle>();
  render(<MarkdownWorkspace ref={ref} defaultValue="# Hello" defaultMode="wysiwyg" />);
  // In wysiwyg mode the CodeEditor is never mounted so setMonaco never fires.
  expect(ref.current?.getEditor()).toBeNull();
});

// ---------------------------------------------------------------------------
// #271 — source-pane slash menu: CodeEditor action registration
// ---------------------------------------------------------------------------

test("#271 CodeEditor receives a brand.openSlashMenu action when slashMenu is enabled (default)", async () => {
  render(<MarkdownWorkspace defaultMode="source" />);
  // The mock's editor.create fires synchronously; setMonaco is a state update —
  // wait one tick for it to flush so the sourceActions effect fires.
  await act(async () => {});
  expect(addAction).toHaveBeenCalledWith(expect.objectContaining({ id: "brand.openSlashMenu" }));
});

type ActionCall = [{ id: string; label: string; keybindings?: number[] }];

function findActionCall(id: string): ActionCall | undefined {
  const calls = addAction.mock.calls as unknown as ActionCall[];
  return calls.find(([a]) => a.id === id);
}

test("#271 brand.openSlashMenu action label is 'Insert block…'", async () => {
  render(<MarkdownWorkspace defaultMode="source" />);
  await act(async () => {});
  const call = findActionCall("brand.openSlashMenu");
  expect(call?.[0]).toMatchObject({ label: "Insert block…" });
});

test("#271 brand.openSlashMenu action has a keybinding array", async () => {
  render(<MarkdownWorkspace defaultMode="source" />);
  await act(async () => {});
  const call = findActionCall("brand.openSlashMenu");
  expect(Array.isArray(call?.[0].keybindings)).toBe(true);
  expect((call?.[0].keybindings ?? []).length).toBeGreaterThan(0);
});

test("#271 brand.openSlashMenu action is NOT registered when slashMenu={false}", async () => {
  addAction.mockClear();
  render(<MarkdownWorkspace defaultMode="source" slashMenu={false} />);
  await act(async () => {});
  const call = findActionCall("brand.openSlashMenu");
  expect(call).toBeUndefined();
});

test("#271/#299 the source command filter doesn't crash with the default command list", async () => {
  // Regression guard: a run-only WYSIWYG-only command (neither `snippet` NOR
  // `runInSource`) must not reach the source popup. We assert indirectly here
  // (renders without error); the broadened `snippet != null || runInSource`
  // filter is asserted directly below (#299).
  render(<MarkdownWorkspace defaultMode="source" />);
  await act(async () => {});
  expect(screen.getByTestId("markdown-workspace")).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// #299 — run-only commands (runInSource) in the source-pane slash menu
// ---------------------------------------------------------------------------

test("#299 a run-only command (runInSource, no snippet) appears in the source slash menu", async () => {
  const runInSource = vi.fn();
  const commands: SlashCommand[] = [{ id: "ask-ai", label: "Ask AI", run: () => {}, runInSource }];
  const ref = createRef<MarkdownWorkspaceHandle>();
  render(<MarkdownWorkspace ref={ref} defaultMode="source" slashMenu={{ commands }} />);
  await act(async () => {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = ref.current?.getEditor() as any;
  editor.getPosition.mockReturnValue({ lineNumber: 1, column: 1 });
  editor.getScrolledVisiblePosition.mockReturnValue({ top: 10, left: 10, height: 20 });
  editor.getDomNode.mockReturnValue(document.createElement("div"));

  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (findActionCall("brand.openSlashMenu")?.[0] as any).run();
  });

  expect(screen.getByText("Ask AI")).toBeInTheDocument();
});

test("#299 selecting the run-only command strips the trigger and calls runInSource", async () => {
  const runInSource = vi.fn();
  const commands: SlashCommand[] = [{ id: "ask-ai", label: "Ask AI", run: () => {}, runInSource }];
  const ref = createRef<MarkdownWorkspaceHandle>();
  render(<MarkdownWorkspace ref={ref} defaultMode="source" slashMenu={{ commands }} />);
  await act(async () => {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = ref.current?.getEditor() as any;
  editor.getPosition.mockReturnValue({ lineNumber: 1, column: 1 });
  editor.getScrolledVisiblePosition.mockReturnValue({ top: 10, left: 10, height: 20 });
  editor.getDomNode.mockReturnValue(document.createElement("div"));

  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (findActionCall("brand.openSlashMenu")?.[0] as any).run();
  });

  fireEvent.keyDown(editor.getDomNode(), { key: "Enter" });
  expect(runInSource).toHaveBeenCalledTimes(1);
  expect(runInSource.mock.calls[0]?.[0]?.editor).toBe(editor);
});
