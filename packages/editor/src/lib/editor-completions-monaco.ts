"use client";

/**
 * Monaco registration lifecycle for the declarative completion-provider API
 * (#283) — the engine that backs the `completions` prop on `MarkdownWorkspace`.
 *
 * `monaco.languages.registerCompletionItemProvider` is GLOBAL PER LANGUAGE, not
 * per editor instance (the root cause #283 exists to fix — see the issue). So
 * this module owns a single, REFCOUNTED registration for the "markdown"
 * language: the first `attachCompletionsMonaco` call registers it, each
 * subsequent call (a second mounted `MarkdownWorkspace`) bumps the refcount,
 * and the registration is disposed ONLY when the LAST attached editor's
 * disposer runs — no leak, no double-registration (#283 acceptance).
 *
 * Suggestions are scoped to the models THIS module attached (a `REGISTRY` keyed
 * by `ITextModel`) — any other "markdown" model in the app (one the host built
 * itself, outside `@elabs-ai/components-editor`) is ignored, never suggested into.
 *
 * `getProviders` is read fresh from the registry on every `provideCompletionItems`
 * call — NOT captured as a closure at registration time — so a rebuilt provider
 * list (a new `completions` array identity from React state/props) is picked up
 * WITHOUT re-registering (#283 acceptance). Mirrors the calc layer's
 * `REGISTRY`/`getHooks` pattern in `calc-block/calc-editor-monaco.ts`.
 */
import * as monaco from "monaco-editor";

import {
  collectCompletions,
  resolveReplaceRange,
  type EditorCompletionProvider,
} from "./editor-completions";

/** Resolver of the latest provider list for a model (read fresh on every call). */
type ProvidersGetter = () => EditorCompletionProvider[] | undefined;

/** Per-model provider registry — scopes suggestions to OUR editor instances. */
const REGISTRY = new Map<monaco.editor.ITextModel, ProvidersGetter>();

let refCount = 0;
let registration: monaco.IDisposable | null = null;

/** Register the "markdown" completion provider once (idempotent while refs > 0). */
function ensureRegistered(): void {
  if (registration) return;
  registration = monaco.languages.registerCompletionItemProvider("markdown", {
    provideCompletionItems(model, position) {
      const getProviders = REGISTRY.get(model);
      if (!getProviders) return { suggestions: [] };
      const providers = getProviders();
      if (!providers || providers.length === 0) return { suggestions: [] };
      const lineText = model.getLineContent(position.lineNumber);
      const ctx = {
        source: model.getValue(),
        line: position.lineNumber,
        column: position.column,
        lineText,
      };
      return collectCompletions(providers, ctx).then((matches) => ({
        suggestions: matches.map(({ provider, item }) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: item.insertText,
          detail: item.detail,
          range: resolveReplaceRange(item, position, lineText, provider.triggerCharacters),
        })),
      }));
    },
  });
}

/**
 * Attach the declarative completion providers to a Monaco editor instance.
 * `getProviders` is read live on every suggestion request (see module doc) —
 * pass a ref-backed getter so a fresh `completions` array identity on every
 * render never forces a re-attach.
 *
 * Also force-opens Monaco's native suggest widget (`editor.action.triggerSuggest`)
 * whenever the user types a character matching one of the CURRENTLY-configured
 * providers' `triggerCharacters` — read live, so changing that set never needs a
 * re-registration either. Markdown punctuation like `[` doesn't extend a "word",
 * so without this Monaco's own quick-suggestions heuristic would never invoke a
 * provider on it.
 *
 * Returns a disposer. Call it on unmount / when `completions` is removed —
 * refcounted, so the GLOBAL "markdown" registration is only torn down once the
 * LAST attached editor calls its disposer (#283 acceptance: no leak, no
 * double-registration with two workspaces mounted).
 */
export function attachCompletionsMonaco(
  editor: monaco.editor.IStandaloneCodeEditor,
  getProviders: ProvidersGetter,
): () => void {
  ensureRegistered();
  refCount++;

  let model = editor.getModel();
  if (model) REGISTRY.set(model, getProviders);

  const contentSub = editor.onDidChangeModelContent((e) => {
    const providers = getProviders();
    if (!providers || providers.length === 0) return;
    for (const change of e.changes) {
      if (change.text.length !== 1) continue;
      if (providers.some((p) => p.triggerCharacters?.includes(change.text))) {
        editor.trigger("brand-completions", "editor.action.triggerSuggest", {});
        return;
      }
    }
  });

  const modelSub = editor.onDidChangeModel(() => {
    if (model) REGISTRY.delete(model);
    model = editor.getModel();
    if (model) REGISTRY.set(model, getProviders);
  });

  return () => {
    contentSub.dispose();
    modelSub.dispose();
    if (model) REGISTRY.delete(model);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      registration?.dispose();
      registration = null;
    }
  };
}
