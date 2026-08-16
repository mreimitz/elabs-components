/**
 * Vendored + adapted from `@milkdown/react` (MIT — © 2020-present Mirone).
 *
 * `useEditor(getEditor, deps)` registers the editor factory with the provider.
 * `getEditor` is memoized on `deps`, so the mount effect runs exactly once per
 * dependency change (re-creating the editor when `deps` change).
 */
import { type DependencyList, useCallback, useContext, useLayoutEffect } from "react";

import type { GetEditor, UseEditorReturn } from "./types";
import { editorInfoContext } from "./use-get-editor";

export function useEditor(getEditor: GetEditor, deps: DependencyList = []): UseEditorReturn {
  const editorInfo = useContext(editorInfoContext);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useCallback(getEditor, deps);

  useLayoutEffect(() => {
    editorInfo.setEditorFactory(() => factory);
  }, [editorInfo, factory]);

  return {
    loading: editorInfo.loading,
    get: () => editorInfo.editor.current,
  };
}
