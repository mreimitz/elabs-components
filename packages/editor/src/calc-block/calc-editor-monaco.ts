"use client";

/**
 * Monaco calc layer (#220) — live highlighting + autocomplete + result inlays for
 * ```calc fences inside a markdown Monaco model.
 *
 * - HIGHLIGHT is a decoration pass (not a Monarch language): the model is markdown,
 *   so we tokenize each calc fence body via the consumer's `tokenize` hook and apply
 *   `inlineClassName` decorations colored from the `--calc-*` tokens (calc-editor.css).
 * - COMPLETIONS come from a markdown `CompletionItemProvider` scoped to calc fences,
 *   delegating to the consumer's `complete` hook.
 * - INLAYS are Monaco inlay hints (themed via the theme bridge's `editorInlayHint.*`
 *   colors, so they re-apply on theme change), built from the consumer's `evaluate`.
 *
 * The providers register ONCE per language and look the active hooks up per-model via
 * a registry, so any number of markdown editors can be wired independently. All the
 * column/position math lives in `calc-editor.ts` (engine-neutral + unit-tested);
 * this module only maps those specs to Monaco objects and owns the lifecycle.
 */
import * as monaco from "monaco-editor";

import "./calc-editor.css";

import {
  calcDecorationSpecs,
  calcInlaySpecs,
  findCalcFences,
  identifierPrefix,
  type CalcFence,
} from "./calc-editor";
import type { CalcCompletionKind, CalcEditorHooks } from "./types";

/** Resolver of the latest hooks for a model (read through a ref so prop-identity churn is free). */
type HooksGetter = () => CalcEditorHooks | undefined;

/** Per-model hook registry the global providers consult. */
const REGISTRY = new Map<monaco.editor.ITextModel, HooksGetter>();

let providersRegistered = false;
let inlayEmitter: monaco.Emitter<void> | null = null;

/** Read a fence body's EOL-free line texts straight from the model (CRLF-safe). */
function bodyLineTexts(model: monaco.editor.ITextModel, fence: CalcFence): string[] {
  const out: string[] = [];
  for (let ln = fence.bodyStartLine; ln <= fence.bodyEndLine; ln++) {
    out.push(model.getLineContent(ln));
  }
  return out;
}

/** All ```calc fences in the model, scanned from LF-normalized text. */
function modelFences(model: monaco.editor.ITextModel): CalcFence[] {
  return findCalcFences(model.getValue(monaco.editor.EndOfLinePreference.LF));
}

/** Highlight decorations for every calc fence in the model. */
function buildDecorations(
  model: monaco.editor.ITextModel,
  hooks: CalcEditorHooks,
): monaco.editor.IModelDeltaDecoration[] {
  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const fence of modelFences(model)) {
    if (fence.bodyEndLine < fence.bodyStartLine) continue;
    const specs = calcDecorationSpecs(hooks, fence.bodyStartLine, bodyLineTexts(model, fence));
    for (const s of specs) {
      decorations.push({
        range: new monaco.Range(s.lineNumber, s.startColumn, s.lineNumber, s.endColumn),
        options: { inlineClassName: s.className },
      });
    }
  }
  return decorations;
}

const COMPLETION_KIND: Record<CalcCompletionKind, () => monaco.languages.CompletionItemKind> = {
  variable: () => monaco.languages.CompletionItemKind.Variable,
  function: () => monaco.languages.CompletionItemKind.Function,
  unit: () => monaco.languages.CompletionItemKind.Unit,
  currency: () => monaco.languages.CompletionItemKind.Unit,
  constant: () => monaco.languages.CompletionItemKind.Constant,
  reference: () => monaco.languages.CompletionItemKind.Reference,
  keyword: () => monaco.languages.CompletionItemKind.Keyword,
  snippet: () => monaco.languages.CompletionItemKind.Snippet,
};

function mapCompletionKind(kind?: CalcCompletionKind): monaco.languages.CompletionItemKind {
  return (COMPLETION_KIND[kind ?? "variable"] ?? COMPLETION_KIND.variable)();
}

/** Register the per-language providers once (idempotent). */
function ensureProviders(): void {
  if (providersRegistered) return;
  providersRegistered = true;
  inlayEmitter = new monaco.Emitter<void>();

  monaco.languages.registerInlayHintsProvider("markdown", {
    onDidChangeInlayHints: inlayEmitter.event,
    provideInlayHints(model, range) {
      const empty = { hints: [] as monaco.languages.InlayHint[], dispose() {} };
      const hooks = REGISTRY.get(model)?.();
      if (!hooks?.evaluate) return empty;
      const hints: monaco.languages.InlayHint[] = [];
      for (const fence of modelFences(model)) {
        if (fence.bodyEndLine < fence.bodyStartLine) continue;
        if (
          fence.bodyEndLine < range.startLineNumber ||
          fence.bodyStartLine > range.endLineNumber
        ) {
          continue;
        }
        for (const inlay of calcInlaySpecs(
          hooks,
          fence.bodyStartLine,
          bodyLineTexts(model, fence),
        )) {
          hints.push({
            position: { lineNumber: inlay.lineNumber, column: inlay.column },
            label: inlay.text,
            kind: monaco.languages.InlayHintKind.Type,
            paddingLeft: true,
          });
        }
      }
      return { hints, dispose() {} };
    },
  });

  monaco.languages.registerCompletionItemProvider("markdown", {
    provideCompletionItems(model, position) {
      const hooks = REGISTRY.get(model)?.();
      if (!hooks?.complete) return { suggestions: [] };
      const fence = modelFences(model).find(
        (f) => position.lineNumber >= f.bodyStartLine && position.lineNumber <= f.bodyEndLine,
      );
      if (!fence) return { suggestions: [] };
      const lines = bodyLineTexts(model, fence);
      const line = lines[position.lineNumber - fence.bodyStartLine] ?? "";
      const column = position.column - 1; // 0-based caret within the line
      const prefix = identifierPrefix(line, column);
      let completions;
      try {
        completions = hooks.complete({
          source: lines.join("\n"),
          line,
          lineNumber: position.lineNumber - fence.bodyStartLine + 1,
          column,
          prefix,
        });
      } catch {
        return { suggestions: [] };
      }
      const replace = new monaco.Range(
        position.lineNumber,
        position.column - prefix.length,
        position.lineNumber,
        position.column,
      );
      return {
        suggestions: completions.map((c) => ({
          label: c.label,
          insertText: c.insert,
          detail: c.detail,
          kind: mapCompletionKind(c.kind),
          range: replace,
        })),
      };
    },
  });
}

/**
 * Wire calc highlighting + completion + inlays onto a markdown Monaco editor.
 * `getHooks` is read fresh on each update, so changing the `calc` prop's identity
 * never forces a re-attach. Returns a disposer; call it on unmount / when `calc`
 * is removed.
 */
export function attachCalcMonaco(
  editor: monaco.editor.IStandaloneCodeEditor,
  getHooks: HooksGetter,
): () => void {
  ensureProviders();
  const collection = editor.createDecorationsCollection();
  const subs: monaco.IDisposable[] = [];
  let model = editor.getModel();
  if (model) REGISTRY.set(model, getHooks);

  const refresh = () => {
    const current = editor.getModel();
    const hooks = getHooks();
    if (!current || !hooks) {
      collection.clear();
      return;
    }
    REGISTRY.set(current, getHooks);
    collection.set(buildDecorations(current, hooks));
    inlayEmitter?.fire();
  };

  refresh();
  subs.push(editor.onDidChangeModelContent(refresh));
  subs.push(
    editor.onDidChangeModel(() => {
      if (model) REGISTRY.delete(model);
      model = editor.getModel();
      refresh();
    }),
  );

  return () => {
    for (const s of subs) s.dispose();
    collection.clear();
    if (model) REGISTRY.delete(model);
  };
}
