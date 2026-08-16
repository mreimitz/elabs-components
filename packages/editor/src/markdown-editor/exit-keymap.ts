"use client";

/**
 * Exit-block keymap — let the caret escape a fenced code block (incl. the
 * ```calc fence) to the block that follows it.
 *
 * Inside a `code_block` there is otherwise no keyboard way out: Tab is swallowed
 * (indent) or blurs the editor, and a code block that is the document's LAST
 * child traps the caret entirely — there is no following line to arrow into.
 * This binds Tab and Mod-Enter (collapsed selection, inside a code block) to move
 * the caret to the block AFTER the code block, inserting a trailing empty
 * paragraph first when the code block is the document's last child.
 *
 * Why `props.handleKeyDown` and not a `keymap` plugin: `handleKeyDown` props run
 * BEFORE keymap plugins, so this reliably beats any commonmark Tab→indent
 * binding. It only acts inside a code block, so Tab in a GFM table (`tableKeymap`
 * → next cell) and Tab elsewhere are untouched, and the slash menu (which never
 * opens inside a code block) is unaffected.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { $prose } from "@milkdown/kit/utils";
import type { Command, Transaction } from "@milkdown/kit/prose/state";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";

/**
 * ProseMirror command: if the collapsed selection sits inside a `code_block`,
 * move the caret to the block after it — creating a trailing empty paragraph when
 * the code block is the document's last child. Returns `false` otherwise so other
 * handlers still run. Exported standalone so it can be unit-tested against the
 * real editor schema without a live keyboard event.
 */
export const exitCodeBlock: Command = (state, dispatch) => {
  const { selection } = state;
  if (!selection.empty) return false;
  const { $head } = selection;
  // `spec.code` is set on code-block node types (commonmark's `code_block`,
  // including the ```calc fence) — the same check the slash plugin uses.
  if (!$head.parent.type.spec.code) return false;

  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return false;

  // Position directly after the code-block node (its sibling boundary).
  const after = $head.after($head.depth);

  if (dispatch) {
    const nodeAfter = state.doc.resolve(after).nodeAfter;
    let tr: Transaction = state.tr;
    if (nodeAfter && nodeAfter.isTextblock) {
      // A textblock already follows — step the caret into its content start.
      tr = tr.setSelection(TextSelection.create(tr.doc, after + 1));
    } else {
      // Nothing usable follows (the code block is the last child, or a leaf
      // follows) — insert a fresh empty paragraph and land the caret inside it.
      const para = paragraph.createAndFill();
      if (!para) return false;
      tr = tr.insert(after, para);
      tr = tr.setSelection(TextSelection.create(tr.doc, after + 1));
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * The Milkdown plugin array to `.use()` on the editor chain. Binds Tab and
 * Mod-Enter to {@link exitCodeBlock} via `handleKeyDown`.
 */
export function exitKeymapPlugins(): MilkdownPlugin[] {
  return [
    $prose(
      () =>
        new Plugin({
          props: {
            handleKeyDown: (view, event) => {
              const isTab = event.key === "Tab" && !event.shiftKey;
              const isModEnter = event.key === "Enter" && (event.metaKey || event.ctrlKey);
              if (!isTab && !isModEnter) return false;
              const handled = exitCodeBlock(view.state, view.dispatch);
              if (handled) event.preventDefault();
              return handled;
            },
          },
        }),
    ) as unknown as MilkdownPlugin,
  ];
}
