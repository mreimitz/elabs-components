"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@qlik-coe-emea/qlabs-components-ui";
import type * as Monaco from "monaco-editor";
import { type ReactNode } from "react";

export interface EditorContextMenuProps {
  /** The Monaco editor instance to act on (null until mounted). */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** Hide editing items (cut/paste/format) for read-only editors. */
  readOnly?: boolean;
  /** The editor element wrapped as the right-click trigger. */
  children: ReactNode;
}

/**
 * Replaces Monaco's built-in context menu with brand-ui's `ContextMenu`, wired
 * to the editor instance. This is the "reuse our components instead of Monaco's
 * built-in ones" path for the right-click menu — set `contextMenu="brand"` on
 * `CodeEditor` (the default) and it disables Monaco's menu and renders this.
 *
 * Clipboard ops use the async Clipboard API + `executeEdits` (reliable in the
 * browser); other entries delegate to the editor's own actions.
 */
export function EditorContextMenu({ editor, readOnly = false, children }: EditorContextMenuProps) {
  const selection = () => {
    if (!editor) return null;
    const model = editor.getModel();
    const sel = editor.getSelection();
    return model && sel ? { editor, model, sel } : null;
  };

  const copy = async () => {
    const ctx = selection();
    if (!ctx) return;
    const text = ctx.model.getValueInRange(ctx.sel);
    if (text && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    ctx.editor.focus();
  };

  const cut = async () => {
    const ctx = selection();
    if (!ctx) return;
    const text = ctx.model.getValueInRange(ctx.sel);
    if (text && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      ctx.editor.executeEdits("brand-cut", [{ range: ctx.sel, text: "", forceMoveMarkers: true }]);
    }
    ctx.editor.focus();
  };

  const paste = async () => {
    const ctx = selection();
    if (!ctx || typeof navigator === "undefined" || !navigator.clipboard) return;
    const text = await navigator.clipboard.readText();
    ctx.editor.executeEdits("brand-paste", [{ range: ctx.sel, text, forceMoveMarkers: true }]);
    ctx.editor.focus();
  };

  const selectAll = () => {
    const ctx = selection();
    if (!ctx) return;
    ctx.editor.setSelection(ctx.model.getFullModelRange());
    ctx.editor.focus();
  };

  const runAction = (id: string) => {
    editor?.focus();
    void editor?.getAction(id)?.run();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {!readOnly ? (
          <ContextMenuItem onSelect={() => void cut()}>
            Cut
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onSelect={() => void copy()}>
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        {!readOnly ? (
          <ContextMenuItem onSelect={() => void paste()}>
            Paste
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={selectAll}>
          Select all
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>
        {!readOnly ? (
          <ContextMenuItem onSelect={() => runAction("editor.action.formatDocument")}>
            Format document
            <ContextMenuShortcut>⇧⌥F</ContextMenuShortcut>
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => runAction("editor.action.quickCommand")}>
          Command palette
          <ContextMenuShortcut>F1</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
