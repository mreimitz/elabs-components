/**
 * Unit tests for the code-block exit command (A3). We boot a HEADLESS Milkdown
 * editor with the real commonmark + gfm schema (so the `code_block` node — and
 * the ```calc fence, which is just a code block — is the genuine one), position
 * the caret inside a code block, run {@link exitCodeBlock} exactly as the
 * `handleKeyDown` binding does, and assert the caret escapes to a paragraph. The
 * live Tab keypress UX is exercised in the browser via the editor stories.
 */
import { Editor, defaultValueCtx, rootCtx, editorViewCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { Selection, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { afterEach, describe, expect, test } from "vitest";

import { exitCodeBlock } from "./exit-keymap";

const roots: HTMLElement[] = [];

async function makeEditor(initial: string): Promise<Editor> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  roots.push(root);
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial);
    })
    .use(commonmark)
    .use(gfm)
    .create();
}

afterEach(() => {
  for (const r of roots.splice(0)) r.remove();
});

const getView = (editor: Editor): EditorView => editor.action((ctx) => ctx.get(editorViewCtx));

/** Position just inside the first code block's content (or -1 if none). */
function firstCodeBlockContentPos(doc: ProseNode): number {
  let pos = -1;
  doc.descendants((node, p) => {
    if (pos === -1 && node.type.spec.code) pos = p + 1;
    return pos === -1;
  });
  return pos;
}

describe("exitCodeBlock", () => {
  test("from a trailing code block, inserts a following paragraph and lands the caret in it", async () => {
    const editor = await makeEditor("Intro\n\n```\nx = 1\n```\n");
    const v = getView(editor);
    // Caret at the very end of the doc = inside the trailing code block.
    v.dispatch(v.state.tr.setSelection(Selection.atEnd(v.state.doc)));
    expect(v.state.selection.$head.parent.type.spec.code).toBe(true);

    const handled = exitCodeBlock(v.state, v.dispatch);
    expect(handled).toBe(true);
    expect(v.state.selection.$head.parent.type.name).toBe("paragraph");
    expect(v.state.doc.lastChild?.type.name).toBe("paragraph");
  });

  test("steps into an existing following paragraph without inserting a new one", async () => {
    const editor = await makeEditor("```\nx = 1\n```\n\nAfter\n");
    const v = getView(editor);
    v.dispatch(
      v.state.tr.setSelection(
        TextSelection.create(v.state.doc, firstCodeBlockContentPos(v.state.doc)),
      ),
    );
    const before = v.state.doc.childCount;

    const handled = exitCodeBlock(v.state, v.dispatch);
    expect(handled).toBe(true);
    expect(v.state.doc.childCount).toBe(before);
    expect(v.state.selection.$head.parent.type.name).toBe("paragraph");
    expect(v.state.selection.$head.parent.textContent).toBe("After");
  });

  test("returns false when the caret is not inside a code block", async () => {
    const editor = await makeEditor("Just a paragraph.\n");
    const v = getView(editor);
    v.dispatch(v.state.tr.setSelection(Selection.atStart(v.state.doc)));
    expect(exitCodeBlock(v.state, v.dispatch)).toBe(false);
  });
});
