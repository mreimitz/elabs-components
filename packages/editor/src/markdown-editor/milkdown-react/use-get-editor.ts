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
 */
import { createContext, useContext, useEffect, useRef } from "react";

import type { EditorInfoCtx } from "./types";

export const editorInfoContext = createContext<EditorInfoCtx>({} as EditorInfoCtx);

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
      editor.destroy().catch(console.error);
    };
  }, [dom, editorRef, getEditor, setLoading]);

  return domRef;
}
