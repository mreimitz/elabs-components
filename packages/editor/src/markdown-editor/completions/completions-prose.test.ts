/**
 * Unit tests for the WYSIWYG completions mirror's pure/testable logic (#283) —
 * `nextCompletionState` (the trigger/query state machine), `buildCompletionContext`
 * + `completionReplaceRange` (the ProseMirror-position math), and
 * `insertCompletionItem` (the real doc edit). Same pattern as
 * `../slash/brand-slash-plugin.test.ts`: a real headless Milkdown editor
 * supplies real `Transaction`/`Node` objects — jsdom can't render the editor,
 * but building transactions against a live doc needs no rendering.
 */
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  CLOSED,
  buildCompletionContext,
  completionReplaceRange,
  completionsPluginKey,
  insertCompletionItem,
  nextCompletionState,
  type CompletionPluginState,
} from "./completions-prose";

let editorRoot: HTMLDivElement | null = null;

async function makeEditor(initial = ""): Promise<Editor> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  editorRoot = root;
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial);
    })
    .use(commonmark)
    .use(gfm)
    .create();
}

beforeEach(() => {
  editorRoot = null;
});
afterEach(() => {
  editorRoot?.remove();
  editorRoot = null;
});

/**
 * Simulate a real typing/editing session against a LIVE view: every
 * transaction is built from the view's CURRENT (already-dispatched) selection
 * and immediately dispatched before the next step — the same sequence the real
 * plugin experiences (`nextCompletionState` runs in `apply`, right before the
 * transaction lands). Building a transaction from a position decoupled from
 * the actual current selection is misleading: an untouched selection doesn't
 * remap through an edit that never touched it, so it can silently stay stale.
 */
function makeTypingSession(view: EditorView, triggerCharacters: string[]) {
  let state: CompletionPluginState = CLOSED;
  const run = (tr: ReturnType<typeof view.state.tr.setMeta>) => {
    state = nextCompletionState(state, tr, triggerCharacters);
    view.dispatch(tr);
    return state;
  };
  return {
    get state() {
      return state;
    },
    type: (ch: string) => run(view.state.tr.insertText(ch, view.state.selection.from)),
    backspace: () => {
      const from = view.state.selection.from;
      return run(view.state.tr.delete(from - 1, from));
    },
    moveCaretTo: (pos: number) =>
      run(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos)))),
    selectRange: (from: number, to: number) =>
      run(
        view.state.tr.setSelection(
          TextSelection.between(view.state.doc.resolve(from), view.state.doc.resolve(to)),
        ),
      ),
  };
}

describe("nextCompletionState — trigger detection (real typing sequence)", () => {
  test("a non-trigger character leaves CLOSED unchanged", async () => {
    const editor = await makeEditor("");
    await editor.action((ctx) => {
      const session = makeTypingSession(ctx.get(editorViewCtx), ["["]);
      expect(session.type("x")).toBe(CLOSED);
    });
  });

  test("typing `[[note` tracks the LAST `[`, extends the query, and closes on whitespace", async () => {
    const editor = await makeEditor("");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const session = makeTypingSession(view, ["["]);

      let s = session.type("[");
      expect(s.active).toBe(true);
      expect(s.triggerChar).toBe("[");
      expect(s.query).toBe("");
      expect(s.requestId).toBe(1);
      const firstFrom = s.from;

      // The SECOND "[" re-anchors `from` to ITS position (not the first).
      s = session.type("[");
      expect(s.active).toBe(true);
      expect(s.from).toBeGreaterThan(firstFrom);
      expect(s.query).toBe("");
      expect(s.requestId).toBe(2);
      const secondFrom = s.from;

      s = session.type("n");
      expect(s.query).toBe("n");
      expect(s.from).toBe(secondFrom); // unchanged — still anchored at the 2nd `[`
      expect(s.requestId).toBe(3);

      s = session.type("o");
      expect(s.query).toBe("no");
      expect(s.requestId).toBe(4);

      s = session.type(" ");
      expect(s.active).toBe(false);
    });
  });

  test("backspacing the query, then past the trigger, closes without a false re-trigger", async () => {
    const editor = await makeEditor("");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const session = makeTypingSession(view, ["["]);
      session.type("[");
      session.type("[");
      session.type("n");

      // Backspacing "n" exposes the trigger "[" immediately before the new
      // caret — this must NOT be misread as "just typed a trigger character"
      // (the net-single-char-insert guard in `nextCompletionState`).
      let s = session.backspace();
      expect(s.active).toBe(true);
      expect(s.query).toBe("");

      // Backspacing the trigger `[` itself moves the caret to/before `from`.
      s = session.backspace();
      expect(s.active).toBe(false);
    });
  });

  test("moving the caret out of the tracked block (without typing) closes", async () => {
    const editor = await makeEditor("[[no\n\nAnother paragraph");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // Manually seed an "active" session at the 2nd `[` of the FIRST paragraph
      // (position 2, established by the sequential-typing tests above), then
      // move the caret into the SECOND paragraph without typing anything.
      const seeded: CompletionPluginState = {
        active: true,
        from: 2,
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 1,
      };
      const tr = view.state.tr.setSelection(
        TextSelection.near(view.state.doc.resolve(view.state.doc.content.size)),
      );
      const next = nextCompletionState(seeded, tr, ["["]);
      expect(next.active).toBe(false);
    });
  });

  test("a non-empty (real) selection closes an active popup", async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const session = makeTypingSession(view, ["["]);
      session.type("[");
      session.type("[");
      const active = session.state;
      expect(active.active).toBe(true);

      const tr = view.state.tr.setSelection(
        TextSelection.between(view.state.doc.resolve(1), view.state.doc.resolve(3)),
      );
      const next = nextCompletionState(active, tr, ["["]);
      expect(next.active).toBe(false);
    });
  });
});

describe("nextCompletionState — meta transactions", () => {
  test('a "close" meta returns CLOSED', async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const active: CompletionPluginState = {
        active: true,
        from: 2,
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 3,
      };
      const tr = view.state.tr.setMeta(completionsPluginKey, "close");
      expect(nextCompletionState(active, tr, ["["]).active).toBe(false);
    });
  });

  test('a matching-requestId "items" meta updates items; a stale one is ignored', async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const active: CompletionPluginState = {
        active: true,
        from: 2,
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 3,
      };
      const freshItems = [{ label: "note-one", insertText: "note-one]]" }];
      const freshTr = view.state.tr.setMeta(completionsPluginKey, {
        type: "items",
        items: freshItems,
        requestId: 3,
      });
      const withFresh = nextCompletionState(active, freshTr, ["["]);
      expect(withFresh.items).toEqual(freshItems);

      // A stale requestId (superseded by further typing) must NOT apply.
      const staleTr = view.state.tr.setMeta(completionsPluginKey, {
        type: "items",
        items: [{ label: "stale", insertText: "stale" }],
        requestId: 2,
      });
      const withStale = nextCompletionState(withFresh, staleTr, ["["]);
      expect(withStale.items).toEqual(freshItems);
    });
  });

  test('a "nav" meta updates the highlighted index only while active', async () => {
    const editor = await makeEditor("");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const active: CompletionPluginState = {
        active: true,
        from: 0,
        triggerChar: "[",
        query: "",
        items: [
          { label: "a", insertText: "a" },
          { label: "b", insertText: "b" },
        ],
        index: 0,
        requestId: 1,
      };
      const navTr = view.state.tr.setMeta(completionsPluginKey, { type: "nav", index: 1 });
      expect(nextCompletionState(active, navTr, ["["]).index).toBe(1);

      const navOnClosed = nextCompletionState(CLOSED, navTr, ["["]);
      expect(navOnClosed).toBe(CLOSED);
    });
  });
});

describe("buildCompletionContext + completionReplaceRange", () => {
  test("resolves line/column against the current textblock (best-effort, see file doc)", async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const state: CompletionPluginState = {
        active: true,
        from: 2, // the SECOND '[' (parentOffset 1)
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 1,
      };
      const context = buildCompletionContext(view.state.doc, state);
      expect(context).toEqual({ source: "[[no", line: 1, column: 5, lineText: "[[no" });
    });
  });

  test("replaces only the typed query, preserving the already-typed trigger characters", async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const state: CompletionPluginState = {
        active: true,
        from: 2,
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 1,
      };
      const item = { label: "note-one", insertText: "note-one]]" };
      const range = completionReplaceRange(view.state.doc, state, item);
      // Positions 3..5 are exactly "no" (the query) — the leading "[[" survives.
      expect(range).toEqual({ from: 3, to: 5 });
      expect(view.state.doc.textBetween(range.from, range.to)).toBe("no");
    });
  });

  test("honors an explicit replaceFrom over the trigger-query default", async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const state: CompletionPluginState = {
        active: true,
        from: 2,
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 1,
      };
      // replaceFrom: 1 → column 1 → doc position blockStart + 0 = 1 (replaces the WHOLE "[[no").
      const item = { label: "x", insertText: "y", replaceFrom: 1 };
      const range = completionReplaceRange(view.state.doc, state, item);
      expect(range).toEqual({ from: 1, to: 5 });
    });
  });
});

describe("insertCompletionItem", () => {
  test("replaces the typed query with insertText and closes the popup", async () => {
    const editor = await makeEditor("[[no");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const state: CompletionPluginState = {
        active: true,
        from: 2,
        triggerChar: "[",
        query: "no",
        items: [],
        index: 0,
        requestId: 1,
      };
      insertCompletionItem(view, state, { label: "note-one", insertText: "note-one]]" });
      // Assert directly against the doc (not the serialized markdown) — the
      // markdown SERIALIZER escapes a leading "[" (`\[`) to avoid it reading as
      // link/footnote syntax, which is correct output but would make a
      // string-equality assertion on `serialize()` fragile here.
      expect(view.state.doc.textContent).toBe("[[note-one]]");
    });
  });
});
