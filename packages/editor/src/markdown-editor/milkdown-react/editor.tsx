"use client";

/**
 * Vendored + adapted from `@milkdown/react` (MIT — © 2020-present Mirone).
 *
 * `<MilkdownProvider>` holds the editor instance/loading state in context;
 * `<Milkdown />` renders the root node the ProseMirror view mounts into.
 */
import type { Editor } from "@milkdown/kit/core";
import { type FC, type ReactNode, useMemo, useRef, useState } from "react";

import type { EditorInfoCtx, GetEditor } from "./types";
import { editorInfoContext, useGetEditor } from "./use-get-editor";

export const Milkdown: FC = () => {
  const domRef = useGetEditor();

  return <div data-milkdown-root ref={domRef} />;
};

export const MilkdownProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const dom = useRef<HTMLDivElement | undefined>(undefined);
  const [editorFactory, setEditorFactory] = useState<GetEditor | undefined>(undefined);
  const editor = useRef<Editor | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const editorInfoCtx = useMemo<EditorInfoCtx>(
    () => ({ loading, dom, editor, setLoading, editorFactory, setEditorFactory }),
    [loading, editorFactory],
  );

  return <editorInfoContext.Provider value={editorInfoCtx}>{children}</editorInfoContext.Provider>;
};
