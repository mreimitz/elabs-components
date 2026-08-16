/**
 * Vendored + adapted from `@milkdown/react` (MIT — Copyright (c) 2020-present
 * Mirone, https://github.com/Milkdown/milkdown).
 *
 * We vendor the ~120-line React integration so `@qlik-coe-emea/qlabs-components-editor` depends only on
 * the headless `@milkdown/kit` — NOT `@milkdown/react`, which hard-depends on
 * `@milkdown/crepe` (and therefore Vue 3). The upstream `GetEditor` union with
 * `CrepeBuilder` is intentionally dropped: we never use Crepe.
 */
import type { Editor } from "@milkdown/kit/core";
import type { Dispatch, RefObject, SetStateAction } from "react";

export type GetEditor = (container: HTMLElement) => Editor | undefined;

export interface UseEditorReturn {
  readonly loading: boolean;
  readonly get: () => Editor | undefined;
}

export interface EditorInfoCtx {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  dom: RefObject<HTMLDivElement | undefined>;
  editor: RefObject<Editor | undefined>;
  editorFactory: GetEditor | undefined;
  setEditorFactory: Dispatch<SetStateAction<GetEditor | undefined>>;
}
