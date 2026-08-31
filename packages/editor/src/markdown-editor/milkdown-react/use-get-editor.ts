/**
 * Vendored + adapted from `@milkdown/react` (MIT — © 2020-present Mirone).
 *
 * The actual ProseMirror mount/destroy lifecycle. This is the file that matters
 * for React 19 StrictMode: the effect kicks off an async `editor.create()` on
 * mount and `editor.destroy()` on cleanup. StrictMode runs mount → cleanup →
 * mount in dev, so a destroy can fire while the first create is still pending —
 * which `@milkdown/core`'s Editor guards (it defers destroy until OnCreate
 * settles), so the double-mount converges to a single editor. The co-located
 * `markdown-editor.strictmode.test.tsx` is the gate that proves that convergence
 * for our vendored copy; harden here only if that test ever shows >1 surface.
 *
 * DESTROY gets the same rigor (issue #65). Effect cleanup fires
 * `editor.destroy()` but nothing awaited it, and `@milkdown/ctx` schedules its
 * own internal async cleanup (a timer) inside that promise — so an unmount that
 * doesn't wait can let the timer fire after Vitest has already recycled the
 * file's jsdom environment (`ReferenceError: removeEventListener is not
 * defined`). `pendingDestroys` tracks every in-flight `destroy()`, and
 * `waitForPendingMilkdownTeardown()` lets a caller — a test's `afterEach`, or any
 * consumer that cares — await "every Milkdown teardown has settled" the same way
 * `create()` already converges before this effect resolves.
 */
import { createContext, useContext, useEffect, useRef } from "react";

import type { EditorInfoCtx } from "./types";

export const editorInfoContext = createContext<EditorInfoCtx>({} as EditorInfoCtx);

/** Module-scoped registry of in-flight Milkdown `destroy()` promises. Not part
 *  of the package's public API (not re-exported from `./index`) — reached by
 *  relative import from tests/consumers that specifically need to await
 *  teardown, mirroring how `editorInfoContext` itself stays internal. */
const pendingDestroys = new Set<Promise<unknown>>();

/** True while at least one Milkdown `destroy()` is still in flight. */
export function hasPendingMilkdownTeardown(): boolean {
  return pendingDestroys.size > 0;
}

/** Await every Milkdown `destroy()` currently in flight. Resolves immediately
 *  when none are pending. Never rejects — `destroy()` already routes its own
 *  failure through `console.error` (see the cleanup below), so a caller awaiting
 *  teardown only needs "settled", not "succeeded". */
export function waitForPendingMilkdownTeardown(): Promise<void> {
  return Promise.all(pendingDestroys).then(() => undefined);
}

export function useGetEditor() {
  const {
    dom,
    editor: editorRef,
    setLoading,
    editorFactory: getEditor,
  } = useContext(editorInfoContext);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = domRef.current;

    if (!getEditor) return;
    if (!div) return;

    dom.current = div;

    const editor = getEditor(div);
    if (!editor) return;

    setLoading(true);
    editor
      .create()
      .then((editor) => {
        editorRef.current = editor;
      })
      .finally(() => {
        setLoading(false);
      })
      .catch(console.error);

    return () => {
      // `.catch(console.error)` means this promise itself never rejects, so
      // it's safe to await via `Promise.all` in `waitForPendingMilkdownTeardown`
      // without a stray unhandled rejection.
      const destroyPromise = editor.destroy().catch(console.error);
      pendingDestroys.add(destroyPromise);
      void destroyPromise.finally(() => {
        pendingDestroys.delete(destroyPromise);
      });
    };
  }, [dom, editorRef, getEditor, setLoading]);

  return domRef;
}
