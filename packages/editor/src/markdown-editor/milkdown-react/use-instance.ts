/**
 * Vendored + adapted from `@milkdown/react` (MIT — © 2020-present Mirone).
 *
 * `useInstance()` reads the live editor instance from context. Returns
 * `[loading, getInstance]`; only call `getInstance()` once `loading` is false.
 */
import type { Editor } from "@milkdown/kit/core";

import { useCallback, useContext } from "react";

import { editorInfoContext } from "./use-get-editor";

export type Instance = [true, () => undefined] | [false, () => Editor];

export function useInstance() {
  const editorInfo = useContext(editorInfoContext);

  const getInstance = useCallback(() => {
    return editorInfo.editor.current;
  }, [editorInfo.editor]);

  return [editorInfo.loading, getInstance] as Instance;
}
