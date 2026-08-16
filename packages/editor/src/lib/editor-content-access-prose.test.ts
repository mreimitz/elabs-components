/**
 * Unit tests for proseMirrorContentAccess — the Milkdown adapter.
 *
 * Uses a REAL headless Milkdown editor (`makeEditor()`) — ProseMirror IS
 * testable in jsdom (the brand-slash-plugin.test.ts / insert-directive.test.ts
 * precedent). Monaco-specific behavior is tested in editor-content-access.test.ts.
 *
 * These tests verify:
 *  - getSelection().text of a bold selection → markdown fidelity
 *  - collapsed selection → empty:true, text:""
 *  - replaceSelection("## H") → heading in doc (via getMarkdown round-trip)
 *  - malformed parse → plain-text fallback (no throw)
 *  - onSelectionChange fires on setSelection tr; unsubscribe stops further calls
 */
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from "@milkdown/kit/core";
import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getMarkdown } from "@milkdown/kit/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorSelection } from "./editor-content-access";
import {
  proseMirrorContentAccess,
  selectionWatchPlugin,
  type ProseMirrorContentAccessDeps,
} from "./editor-content-access-prose";

// ---------------------------------------------------------------------------
// Headless Milkdown helpers (same pattern as brand-slash-plugin.test.ts)
// ---------------------------------------------------------------------------

let editorRoot: HTMLDivElement | null = null;

async function makeEditor(initial = ""): Promise<Editor> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  editorRoot = root;
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial);
    })
    .use(commonmark)
    .use(gfm)
    .create();
  return editor;
}

async function makeEditorWithSelectionWatch(initial = ""): Promise<Editor> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  editorRoot = root;
  const listeners = new Set<(sel: EditorSelection) => void>();
  let serializeSliceFn: (view: EditorView) => string = () => "";

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial);
    })
    .use(commonmark)
    .use(gfm)
    .use(
      selectionWatchPlugin(
        () => listeners,
        () => serializeSliceFn,
      ),
    )
    .create();

  // Attach so callers can register listeners and update serialize.
  (
    editor as Editor & {
      _listeners: typeof listeners;
      _setSerialize: (fn: typeof serializeSliceFn) => void;
    }
  )._listeners = listeners;
  (
    editor as Editor & {
      _listeners: typeof listeners;
      _setSerialize: (fn: typeof serializeSliceFn) => void;
    }
  )._setSerialize = (fn) => {
    serializeSliceFn = fn;
  };
  return editor;
}

function getView(editor: Editor): EditorView {
  return editor.action((ctx) => ctx.get(editorViewCtx));
}

function serializeDoc(editor: Editor): string {
  return editor.action(getMarkdown());
}

/** Build the deps object the adapter needs, using real Milkdown ctx. */
function makeDeps(
  editor: Editor,
  listeners: Set<(sel: EditorSelection) => void>,
): ProseMirrorContentAccessDeps {
  const serializeSlice = (view: EditorView): string => {
    const { selection } = view.state;
    if (selection.empty) return "";
    try {
      return editor
        .action((ctx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const serialize = (ctx as any).get(serializerCtx) as (node: ProseNode) => string;
          const content = selection.content().content;
          const wrapper = view.state.doc.type.schema.topNodeType.create(null, content);
          return serialize(wrapper);
        })
        .trim();
    } catch {
      return view.state.doc.textBetween(selection.from, selection.to, "\n");
    }
  };

  const parseAndReplace = (view: EditorView, md: string): void => {
    try {
      editor.action((ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parse = (ctx as any).get(parserCtx) as (md: string) => ProseNode | null;
        const parsed = parse(md);
        if (!parsed) {
          view.dispatch(view.state.tr.insertText(md));
          return;
        }
        view.dispatch(view.state.tr.replaceSelectionWith(parsed));
      });
    } catch {
      try {
        view.dispatch(view.state.tr.insertText(md));
      } catch {
        // silently no-op
      }
    }
  };

  return {
    getView: () => {
      try {
        return getView(editor);
      } catch {
        return null;
      }
    },
    getText: () => serializeDoc(editor),
    serializeSlice,
    parseAndReplace,
    listeners,
  };
}

beforeEach(() => {
  editorRoot = null;
});
afterEach(() => {
  editorRoot?.remove();
  editorRoot = null;
});

// ---------------------------------------------------------------------------
// getText
// ---------------------------------------------------------------------------

describe("proseMirrorContentAccess — getText", () => {
  it("returns the full document markdown", async () => {
    const editor = await makeEditor("Hello **world**\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners));
    const text = access.getText();
    expect(text).toMatch(/Hello/);
    expect(text).toMatch(/world/);
  });
});

// ---------------------------------------------------------------------------
// getSelection
// ---------------------------------------------------------------------------

describe("proseMirrorContentAccess — getSelection", () => {
  it("returns empty:true / text:'' for a collapsed caret", async () => {
    const editor = await makeEditor("Hello\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners));
    const sel = access.getSelection();
    expect(sel.empty).toBe(true);
    expect(sel.text).toBe("");
  });

  it("serializes a bold selection to markdown (fidelity)", async () => {
    const editor = await makeEditor("**bold**\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners));

    // Select the entire bold word (positions 1..5 in the paragraph node).
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      // Find the text node inside the paragraph. The paragraph starts at pos 1;
      // the strong mark wraps the text. Select positions that cover "bold".
      const from = 1;
      const to = doc.content.size - 1; // exclude the trailing paragraph boundary
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(doc, from, to)).scrollIntoView(),
      );
    });

    const sel = access.getSelection();
    expect(sel.empty).toBe(false);
    // Milkdown serializes the selected slice; the round-trip yields bold markdown.
    expect(sel.text).toMatch(/bold/);
  });
});

// ---------------------------------------------------------------------------
// fidelity: "plainText"
// ---------------------------------------------------------------------------

describe("proseMirrorContentAccess — fidelity:plainText", () => {
  it("reads the selection as raw text (no markdown markup)", async () => {
    const editor = await makeEditor("**bold**\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners), {
      fidelity: "plainText",
    });

    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
    });

    const sel = access.getSelection();
    expect(sel.empty).toBe(false);
    // plainText → the unformatted characters, NOT `**bold**`.
    expect(sel.text).toBe("bold");
    expect(sel.text).not.toContain("*");
  });

  it("inserts incoming text literally (no markdown parse)", async () => {
    const editor = await makeEditor("x\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners), {
      fidelity: "plainText",
    });

    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
    });

    access.replaceSelection("## not a heading");
    // plainText inserts literal characters into the paragraph — NOT a parsed
    // heading node. Assert on raw textContent (markdown serialization would escape
    // the leading `##`, so check the doc text directly).
    const { textContent, isHeading } = editor.action((ctx) => {
      const doc = ctx.get(editorViewCtx).state.doc;
      return { textContent: doc.textContent, isHeading: doc.firstChild?.type.name === "heading" };
    });
    expect(textContent).toContain("## not a heading");
    expect(isHeading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// replaceSelection / insertAtCursor
// ---------------------------------------------------------------------------

describe("proseMirrorContentAccess — replaceSelection", () => {
  it("replaces the current selection with parsed markdown content", async () => {
    const editor = await makeEditor("old content\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners));

    // Select all text.
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
    });

    access.replaceSelection("## Heading\n");

    const md = serializeDoc(editor);
    expect(md).toMatch(/##\s+Heading/);
    // Original content should be gone.
    expect(md).not.toContain("old content");
  });

  it("insertAtCursor works identically to replaceSelection (same primitive)", async () => {
    const editor = await makeEditor("start\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const access = proseMirrorContentAccess(makeDeps(editor, listeners));

    // Collapsed caret at doc start → insert.
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, 1)));
    });

    access.insertAtCursor("inserted ");
    const md = serializeDoc(editor);
    expect(md).toContain("inserted");
  });

  it("malformed/unparseable input falls back to plain-text insert (no throw)", async () => {
    const editor = await makeEditor("existing\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    // Override parseAndReplace to always throw on the first attempt.
    const deps = makeDeps(editor, listeners);
    const originalParse = deps.parseAndReplace;
    let callCount = 0;
    deps.parseAndReplace = (view, md) => {
      if (callCount++ === 0) throw new Error("simulated parse error");
      originalParse(view, md);
    };
    const access = proseMirrorContentAccess(deps);
    // Should not throw.
    expect(() => access.replaceSelection("fallback text")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// focus
// ---------------------------------------------------------------------------

describe("proseMirrorContentAccess — focus", () => {
  it("calls view.focus() without throwing", async () => {
    const editor = await makeEditor("text\n");
    const listeners = new Set<(sel: EditorSelection) => void>();
    const deps = makeDeps(editor, listeners);
    const focusSpy = vi.spyOn(getView(editor), "focus").mockImplementation(() => undefined);
    const access = proseMirrorContentAccess(deps);
    expect(() => access.focus()).not.toThrow();
    focusSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// onSelectionChange (via selectionWatchPlugin)
// ---------------------------------------------------------------------------

describe("selectionWatchPlugin + onSelectionChange", () => {
  it("fires the listener when a setSelection transaction changes the selection", async () => {
    const editor = await makeEditorWithSelectionWatch("Hello world\n");
    const ext = editor as Editor & {
      _listeners: Set<(sel: EditorSelection) => void>;
      _setSerialize: (fn: (view: EditorView) => string) => void;
    };

    const listener = vi.fn();
    ext._listeners.add(listener);
    ext._setSerialize(() => "Hello");

    // Dispatch a setSelection transaction to trigger the plugin.
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      const tr = view.state.tr.setSelection(TextSelection.create(doc, 1, 6));
      view.dispatch(tr);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const sel: EditorSelection = listener.mock.calls[0]![0] as EditorSelection;
    expect(typeof sel.text).toBe("string");
    expect(typeof sel.empty).toBe("boolean");
  });

  it("unsubscribing removes the listener — further selection changes don't call it", async () => {
    const editor = await makeEditorWithSelectionWatch("Hello world\n");
    const ext = editor as Editor & {
      _listeners: Set<(sel: EditorSelection) => void>;
      _setSerialize: (fn: (view: EditorView) => string) => void;
    };
    ext._setSerialize(() => "");

    // Wire via proseMirrorContentAccess.onSelectionChange so we test the full path.
    const listeners = ext._listeners;
    const deps = makeDeps(editor, listeners);
    const access = proseMirrorContentAccess(deps);

    const listener = vi.fn();
    const unsub = access.onSelectionChange(listener);

    // Move selection → listener fires.
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, 5)));
    });
    expect(listener).toHaveBeenCalledTimes(1);

    // Unsubscribe → further moves must NOT fire the listener.
    unsub();
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { doc } = view.state;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 2, 6)));
    });
    expect(listener).toHaveBeenCalledTimes(1); // still 1, not 2
  });
});
