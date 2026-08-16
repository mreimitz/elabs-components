/**
 * Unit tests for brand-slash-plugin.ts — the `nextState` open-meta path and the
 * `runSlashCommand` range behavior for shortcut mode (#271).
 *
 * We use a real headless Milkdown editor (the insert-directive.test.ts precedent)
 * to verify the pure ProseMirror logic. The React widget and the keyboard UX are
 * verified in Storybook (browser only — jsdom can't render Monaco/Milkdown).
 *
 * No monaco mock is needed: brand-slash-plugin.ts imports only the PURE
 * `./shortcut` (matchesKeyboardEvent); the Monaco-keybinding parser lives in the
 * separate `./shortcut-monaco`, which this plugin never imports — so the WYSIWYG
 * plugin graph stays Monaco-free (and jsdom-safe).
 */
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { getMarkdown } from "@milkdown/kit/utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { directivePlugins } from "../directive-nodes";
import { BRAND_SLASH_COMMANDS } from "./brand-slash-commands";
import {
  CLOSED,
  createSlashController,
  nextState,
  runSlashCommand,
  slashPluginKey,
  type SlashPluginState,
} from "./brand-slash-plugin";

// ---------------------------------------------------------------------------
// Headless Milkdown helpers (same pattern as insert-directive.test.ts)
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
    .use(directivePlugins)
    .create();
  return editor;
}

function serialize(editor: Editor): string {
  return editor.action(getMarkdown());
}

beforeEach(() => {
  editorRoot = null;
});
afterEach(() => {
  editorRoot?.remove();
  editorRoot = null;
});

// ---------------------------------------------------------------------------
// nextState: the `_open` meta opens the menu in shortcut mode (real behavior).
//
// `nextState` is a pure function over (prev, transaction, trigger). We build a
// real ProseMirror transaction from a headless editor and assert the resulting
// state — no source-text regex, no widget mounting needed.
// ---------------------------------------------------------------------------

describe("nextState — shortcut open meta", () => {
  test("CLOSED defaults triggered to 'char'", () => {
    expect(CLOSED.triggered).toBe("char");
    expect(CLOSED.active).toBe(false);
  });

  test("an `_open` meta opens the menu at the given caret in shortcut mode", async () => {
    const editor = await makeEditor("Before text\n");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.setMeta(slashPluginKey, {
        _open: true,
        from: 5,
        triggered: "shortcut",
      });
      const next = nextState(CLOSED, tr, "/");
      expect(next.active).toBe(true);
      expect(next.triggered).toBe("shortcut");
      expect(next.from).toBe(5);
      expect(next.query).toBe("");
      expect(next.index).toBe(0);
    });
  });

  test("a `close` meta returns the CLOSED state", async () => {
    const editor = await makeEditor("Before text\n");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const open: SlashPluginState = {
        active: true,
        from: 5,
        query: "",
        index: 0,
        triggered: "shortcut",
      };
      const tr = view.state.tr.setMeta(slashPluginKey, "close");
      const next = nextState(open, tr, "/");
      expect(next.active).toBe(false);
      expect(next.triggered).toBe("char");
    });
  });
});

// ---------------------------------------------------------------------------
// runSlashCommand — shortcut mode replaces [from, from+query.length]; char mode
// replaces the whole /query run.
// ---------------------------------------------------------------------------

describe("runSlashCommand — shortcut vs char range", () => {
  test("in shortcut mode, the card command inserts at caret without deleting anything", async () => {
    const editor = await makeEditor("Before text\n");

    await editor.action(async (ctx) => {
      const view = ctx.get(editorViewCtx);

      // Shortcut opens at the caret with no typed query — here the caret is at the
      // end of "Before text" (pos 12). An empty-query shortcut inserts at `from`
      // and deletes nothing, so the paragraph text survives intact.
      const shortcutState: SlashPluginState = {
        active: true,
        from: 12,
        query: "",
        index: 0,
        triggered: "shortcut",
      };

      const controller = createSlashController(BRAND_SLASH_COMMANDS, "/");
      controller._ctx = ctx;

      const cardCommand = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-card")!;
      expect(cardCommand).toBeDefined();

      runSlashCommand(view, controller, shortcutState, cardCommand);

      // The document should now contain the card directive.
      const md = serialize(editor);
      expect(md).toContain(":::card");
      // "Before text" must still be present (nothing was deleted).
      expect(md).toContain("Before text");
    });
  });

  test("in char mode, the card command replaces the /query range", async () => {
    const editor = await makeEditor("/\n");

    await editor.action(async (ctx) => {
      const view = ctx.get(editorViewCtx);

      // Char-mode state: the `/` is at position 1 (start of paragraph).
      const charState: SlashPluginState = {
        active: true,
        from: 1,
        query: "",
        index: 0,
        triggered: "char",
      };

      const controller = createSlashController(BRAND_SLASH_COMMANDS, "/");
      controller._ctx = ctx;

      const cardCommand = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-card")!;
      runSlashCommand(view, controller, charState, cardCommand);

      const md = serialize(editor);
      expect(md).toContain(":::card");
      // The `/` trigger should be gone.
      expect(md).not.toMatch(/^\/\s*$/m);
    });
  });

  test("in shortcut mode, a typed filter query is removed (#271 review)", async () => {
    // The shortcut opens with no leading `/`, but any filter the user typed is
    // real document text — runSlashCommand must replace [from, from+query.length].
    const editor = await makeEditor("callout\n");

    await editor.action(async (ctx) => {
      const view = ctx.get(editorViewCtx);
      // Caret-open at paragraph start (pos 1); the 7-char query "callout" follows.
      const shortcutState: SlashPluginState = {
        active: true,
        from: 1,
        query: "callout",
        index: 0,
        triggered: "shortcut",
      };

      const controller = createSlashController(BRAND_SLASH_COMMANDS, "/");
      controller._ctx = ctx;

      const calloutCommand = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-callout")!;
      runSlashCommand(view, controller, shortcutState, calloutCommand);

      const md = serialize(editor);
      expect(md).toContain(":::callout");
      // The typed filter text must NOT survive as a stray paragraph.
      expect(md).not.toMatch(/^callout\s*$/m);
    });
  });
});

// ---------------------------------------------------------------------------
// runSlashCommand — the GUIDED branch (#223) must consume the typed `/query`
// range up front, even when the consumer's handler never saves (Cancel). The
// guided resolver doesn't dispatch an insert transaction until the modal
// SAVES, so without this the literal "/iterate" text was left behind
// permanently whenever the user opened the guided builder and cancelled it.
// ---------------------------------------------------------------------------

describe("runSlashCommand — guided branch consumes the /query range", () => {
  test("typing /iterate and cancelling the guided modal still removes the typed trigger text", async () => {
    const editor = await makeEditor("/iterate\n");

    await editor.action(async (ctx) => {
      const view = ctx.get(editorViewCtx);

      const charState: SlashPluginState = {
        active: true,
        from: 1,
        query: "iterate",
        index: 0,
        triggered: "char",
      };

      // A handler that simulates the user cancelling the guided modal: it
      // receives the edit request but never calls onSave/onSaveData.
      const controller = createSlashController(BRAND_SLASH_COMMANDS, "/", undefined, () => () => {
        // Cancel: intentionally does nothing.
      });
      controller._ctx = ctx;

      const iterateCommand = BRAND_SLASH_COMMANDS.find((c) => c.id === "brand-iterate")!;
      expect(iterateCommand.guided).toBeDefined();

      runSlashCommand(view, controller, charState, iterateCommand);

      const md = serialize(editor);
      // No directive was inserted (Cancel) — but the typed "/iterate" trigger
      // text must be gone too, not left behind as stray body text.
      expect(md).not.toMatch(/\/iterate/);
    });
  });
});
