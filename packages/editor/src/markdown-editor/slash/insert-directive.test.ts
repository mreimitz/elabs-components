/**
 * Unit tests for the load-bearing slash-menu logic: the pure ProseMirror
 * insertion commands. We boot a HEADLESS Milkdown editor (no React, no widget —
 * jsdom can't render the popup) with the real directive schemas + serializer, run
 * the insertion through `resolveBrandInsert` / `resolveBasicInsert` exactly as the
 * plugin does, and assert the document serializes to the correct `:::` / `::`
 * markdown (the lossless round-trip the preview already understands).
 *
 * The live popup + keyboard UX (the React widget) is verified separately via
 * Storybook / a browser — see slash-menu.stories.tsx.
 */
import { Editor, defaultValueCtx, rootCtx, editorViewCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { getMarkdown } from "@milkdown/kit/utils";
import { Selection } from "@milkdown/kit/prose/state";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { directivePlugins } from "../directive-nodes";
import {
  __DIRECTIVE_DEFAULTS,
  CALC_FENCE_SEED,
  isContainerDirective,
  isLeafDirective,
  resolveBasicInsert,
  resolveBrandInsert,
  resolveCalcInsert,
  resolveGuidedIterationInsert,
  type InsertableDirective,
} from "./insert-directive";

/** Boot a headless Milkdown editor with the brand directive pipeline. */
async function makeEditor(initial = ""): Promise<Editor> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial);
    })
    .use(commonmark)
    .use(gfm)
    .use(directivePlugins)
    .create();
  return editor;
}

/** Serialize the editor's current doc to markdown. */
function serialize(editor: Editor): string {
  return editor.action(getMarkdown());
}

/** Move the caret to the end of the document. */
function caretToEnd(editor: Editor): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const tr = view.state.tr.setSelection(Selection.atEnd(view.state.doc));
    view.dispatch(tr);
  });
}

/**
 * Place the caret at the end of the document, then run a brand insert there
 * (range=null → insert at the cursor). Returns the resulting markdown.
 */
function insertBrandAtEnd(editor: Editor, name: InsertableDirective): string {
  caretToEnd(editor);
  editor.action((ctx) => resolveBrandInsert(ctx, name, null));
  return serialize(editor);
}

let editor: Editor;

beforeEach(async () => {
  editor = await makeEditor("Intro paragraph.\n");
});

afterEach(async () => {
  await editor.destroy();
  document.body.innerHTML = "";
});

describe("resolveBrandInsert — container directives round-trip", () => {
  test(":::card inserts and serializes to a card directive with the default title", () => {
    const md = insertBrandAtEnd(editor, "card");
    expect(md).toContain(":::card");
    expect(md).toContain('title="Title"');
    // The opening + closing fence are both present (a valid container directive).
    expect(md.match(/:::/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test(":::callout inserts with the default type + title", () => {
    const md = insertBrandAtEnd(editor, "callout");
    expect(md).toContain(":::callout");
    expect(md).toContain('type="info"');
    expect(md).toContain('title="Note"');
  });

  test(":::timeline inserts with seeded status steps", () => {
    const md = insertBrandAtEnd(editor, "timeline");
    expect(md).toContain(":::timeline");
    expect(md).toContain("Step one");
    expect(md).toContain("(active) Step two");
  });

  test(":::iterate inserts with default attrs + a seeded {{token}} template body", () => {
    const md = insertBrandAtEnd(editor, "iterate");
    expect(md).toContain(":::iterate");
    expect(md).toContain('as="item"');
    expect(md).toContain('layout="stacked"');
    expect(md).toContain("{{item.name}}");
  });

  test(":::pivot inserts with the matrix layout + a seeded template body", () => {
    const md = insertBrandAtEnd(editor, "pivot");
    expect(md).toContain(":::pivot");
    expect(md).toContain('layout="matrix"');
    expect(md).toContain("{{cell}}");
  });
});

describe("resolveBrandInsert — leaf directives round-trip", () => {
  test("::metric inserts and serializes to a leaf directive with default attrs", () => {
    const md = insertBrandAtEnd(editor, "metric");
    // A leaf directive uses a single colon-pair and carries the metric attrs.
    expect(md).toContain("::metric");
    expect(md).toContain('label="Label"');
    expect(md).toContain('value="0"');
    // It is NOT a container (no fenced :::metric block).
    expect(md).not.toContain(":::metric");
  });
});

describe("resolveBasicInsert — native blocks", () => {
  test("heading inserts a markdown heading", () => {
    caretToEnd(editor);
    editor.action((ctx) => resolveBasicInsert(ctx, "heading", null));
    const md = serialize(editor);
    expect(md).toMatch(/^##\s/m);
  });

  test("divider inserts a horizontal rule", () => {
    caretToEnd(editor);
    editor.action((ctx) => resolveBasicInsert(ctx, "divider", null));
    const md = serialize(editor);
    expect(md).toMatch(/^(---|\*\*\*|___)\s*$/m);
  });

  test("quote inserts a blockquote", () => {
    caretToEnd(editor);
    editor.action((ctx) => resolveBasicInsert(ctx, "quote", null));
    const md = serialize(editor);
    expect(md).toMatch(/^>\s?/m);
  });
});

describe("resolveCalcInsert — calc fence (#220)", () => {
  test("inserts a ```calc fence seeded with the example ledger", () => {
    caretToEnd(editor);
    editor.action((ctx) => resolveCalcInsert(ctx, null));
    const md = serialize(editor);
    // A fenced code block with the `calc` info string, carrying the seed.
    expect(md).toMatch(/```calc/);
    expect(md).toContain("items = 3");
    expect(md).toContain("total = items * price");
    expect(CALC_FENCE_SEED).toContain("items = 3");
  });
});

describe("range replacement (the /query is consumed)", () => {
  test("inserting over a range replaces that range (the typed /card text)", () => {
    // Simulate: user typed "/card" at the end; insert with that range so it's removed.
    const md = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // Append "/card" to the intro paragraph.
      const docEnd = view.state.doc.content.size;
      const insertTr = view.state.tr.insertText("/card", docEnd - 1);
      view.dispatch(insertTr);
      return null;
    });
    void md;
    // Now compute the range covering "/card" and insert a card over it.
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const text = view.state.doc.textContent;
      const slashIndex = text.lastIndexOf("/card");
      // Map text index → doc position inside the single paragraph (offset by 1
      // for the paragraph open token).
      const from = slashIndex + 1;
      const to = from + "/card".length;
      return resolveBrandInsert(ctx, "card", { from, to });
    });
    const out = serialize(editor);
    expect(out).toContain(":::card");
    // The literal "/card" trigger text must be gone (consumed by the insert).
    expect(out).not.toContain("/card");
  });
});

describe("resolveGuidedIterationInsert — the GUIDED /iterate /pivot insert path (#223)", () => {
  test("emits a request seeded blank (no values) — the guided builder's onSaveData inserts the fully-bound directive", () => {
    caretToEnd(editor);
    editor.action((ctx) =>
      resolveGuidedIterationInsert(ctx, "iterate", null, (request) => {
        expect(request.kind).toBe("iterate");
        expect(request.attributes).toEqual({});
        expect(request.template).toBe("{{item.name}}");
        request.onSaveData!({
          attributes: { as: "item", layout: "grid", values: "Alice, Bob" },
          template: "{{item.name}}",
        });
      }),
    );
    const md = serialize(editor);
    expect(md).toContain(":::iterate");
    expect(md).toContain('layout="grid"');
    expect(md).toContain('values="Alice, Bob"');
  });

  test("the template-only provider's onSave inserts a directive with default (empty) attrs + the edited template", () => {
    caretToEnd(editor);
    editor.action((ctx) =>
      resolveGuidedIterationInsert(ctx, "pivot", null, (request) => {
        request.onSave("{{row}} → {{col}}");
      }),
    );
    const md = serialize(editor);
    expect(md).toContain(":::pivot");
    expect(md).toContain("{{row}} → {{col}}");
  });

  test("nothing is inserted until the handler actually saves (Cancel leaves the doc untouched)", () => {
    const before = serialize(editor);
    caretToEnd(editor);
    editor.action((ctx) =>
      resolveGuidedIterationInsert(ctx, "iterate", null, () => {
        // Simulate Cancel: the handler never calls onSave/onSaveData.
      }),
    );
    expect(serialize(editor)).toBe(before);
  });
});

describe("directive classification helpers", () => {
  test("container vs leaf split is correct", () => {
    expect(isContainerDirective("card")).toBe(true);
    expect(isContainerDirective("callout")).toBe(true);
    expect(isContainerDirective("timeline")).toBe(true);
    expect(isContainerDirective("metric")).toBe(false);
    expect(isLeafDirective("metric")).toBe(true);
    expect(isLeafDirective("card")).toBe(false);
  });

  test("default attrs mirror the toolbar snippet shapes", () => {
    expect(__DIRECTIVE_DEFAULTS.card).toEqual({ title: "Title" });
    expect(__DIRECTIVE_DEFAULTS.callout).toEqual({ type: "info", title: "Note" });
    expect(__DIRECTIVE_DEFAULTS.metric).toEqual({
      label: "Label",
      value: "0",
      description: "detail",
    });
  });
});
