"use client";

/**
 * Milkdown / ProseMirror calc layer (#220) — live highlighting + result inlays for
 * ```calc fences inside the WYSIWYG editor.
 *
 * A self-owned raw `$prose` plugin (zero new deps) that builds a `DecorationSet`
 * over every `code_block` whose language is `calc`:
 *   - inline decorations color each token from the `--calc-*` tokens (calc-editor.css);
 *   - a widget decoration after each line shows the computed result inlay.
 * The set is recomputed when the document changes. Hooks are read through a getter
 * so a fresh `calc` prop identity never rebuilds the editor (mirrors `slashConfigRef`).
 *
 * The position math reuses the engine-neutral helpers in `calc-editor.ts`; a
 * ProseMirror code block stores its body as plain text with literal `\n`, so a
 * line's absolute position is `codeBlockContentStart + lineOffset + column`.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

import "./calc-editor.css";

import {
  CALC_FENCE_LANG,
  calcLineLayout,
  calcTokenClassName,
  resolveHighlight,
  resolveInlays,
  type CalcInlay,
} from "./calc-editor";
import type { CalcEditorHooks } from "./types";

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const calcDecorationKey = new PluginKey<DecorationSet>("brand-calc-decorations");

/**
 * Build the inline result-inlay widget DOM (non-editable, announced as text).
 *
 * a11y: the computed value is rendered as TEXT (never color-only) and is NOT
 * `aria-hidden`, so AT reads it in browse mode; a native `title` labels it for
 * mouse users. It is a ProseMirror decoration (not a model node), so a host that
 * must guarantee results to AT in active-editing/forms mode should also surface
 * them via a `role="status"` live region outside the editor.
 */
function inlayWidget(inlay: CalcInlay): HTMLElement {
  const span = document.createElement("span");
  span.className = inlay.isError ? "brand-calc-inlay brand-calc-inlay--error" : "brand-calc-inlay";
  // The number itself is the signal (rendered as text); color is enhancement only.
  span.textContent = inlay.text;
  span.setAttribute("contenteditable", "false");
  span.setAttribute("title", inlay.isError ? "Calc error" : "Calc result");
  return span;
}

/** Walk the doc, decorating every ```calc code block with highlight + inlays. */
function buildCalcDecorations(doc: ProseNode, hooks: CalcEditorHooks | undefined): DecorationSet {
  if (!hooks || (!hooks.tokenize && !hooks.evaluate)) return DecorationSet.empty;
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block" || node.attrs.language !== CALC_FENCE_LANG) {
      return undefined;
    }
    const source = node.textContent;
    const contentStart = pos + 1; // first char inside the code block
    const layout = calcLineLayout(source);
    const tokensByLine = resolveHighlight(hooks, source);

    layout.forEach((span, i) => {
      const lineStart = contentStart + span.offset;
      for (const t of tokensByLine[i] ?? []) {
        const start = clamp(t.start, 0, span.text.length);
        const end = clamp(t.end, start, span.text.length);
        if (end <= start) continue;
        decorations.push(
          Decoration.inline(lineStart + start, lineStart + end, {
            class: calcTokenClassName(t.kind, t.resolved),
          }),
        );
      }
    });

    for (const inlay of resolveInlays(hooks, source)) {
      const span = layout[inlay.lineNumber - 1];
      if (!span) continue;
      const at = contentStart + span.offset + span.text.length;
      decorations.push(
        Decoration.widget(at, () => inlayWidget(inlay), {
          side: 1,
          ignoreSelection: true,
          key: `brand-calc-inlay:${String(inlay.lineNumber)}:${inlay.text}`,
        }),
      );
    }
    return false; // a code block's content is plain text — don't descend
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Build the calc decoration plugin. `getHooks` is read on every recompute so the
 * editor never rebuilds when the `calc` prop identity changes. Returns a Milkdown
 * plugin array to `.use()` (only when calc authoring is enabled).
 */
export function calcProsePlugins(getHooks: () => CalcEditorHooks | undefined): MilkdownPlugin[] {
  const plugin = $prose(
    () =>
      new Plugin<DecorationSet>({
        key: calcDecorationKey,
        state: {
          init: (_config, state) => buildCalcDecorations(state.doc, getHooks()),
          apply: (tr, value, _old, newState) =>
            tr.docChanged ? buildCalcDecorations(newState.doc, getHooks()) : value,
        },
        props: {
          decorations(state) {
            return calcDecorationKey.getState(state);
          },
        },
      }),
  );
  return [plugin as unknown as MilkdownPlugin];
}
