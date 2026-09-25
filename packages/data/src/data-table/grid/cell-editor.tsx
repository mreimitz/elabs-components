"use client";

/**
 * cell-editor.tsx — the in-place editor a DataGrid cell shows while it is
 * being edited: a text / number field, a native date field or a select,
 * laid over the cell. Enter commits and moves down (Shift+Enter up), Tab
 * commits and moves across (Shift+Tab back), Escape cancels, leaving the
 * field commits in place. A rejected value keeps the editor open with the
 * reason beside it.
 */
import { useId, useRef, useState } from "react";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { EditOption, EditorKind } from "./edit-model";

export type EditMove = "down" | "up" | "right" | "left" | null;

export interface CellEditorProps {
  kind: Exclude<EditorKind, "checkbox">;
  /** The column's plain-text name (the field's accessible name). */
  label: string;
  /** Text the editor starts with (the raw value, or the key that started the edit). */
  initialText: string;
  /** Typing started the edit: place the caret at the end instead of selecting. */
  replaced: boolean;
  options: readonly EditOption[];
  /** Why the last commit was rejected (shown, and the editor stays open). */
  error?: string | null;
  numeric?: boolean;
  /**
   * Commit `text`; `move` says where the active cell goes next. `fromBlur`:
   * focus left the editor (an invalid value is then dropped, not kept open).
   */
  onCommit: (text: string, move: EditMove, fromBlur?: boolean) => void;
  onCancel: () => void;
}

const FIELD =
  "absolute inset-0 z-20 h-full w-full min-w-0 rounded-none border-0 bg-background px-3 text-body shadow-none focus-ring-inset";

export function CellEditor({
  kind,
  label,
  initialText,
  replaced,
  options,
  error,
  numeric,
  onCommit,
  onCancel,
}: CellEditorProps) {
  const [text, setText] = useState(initialText);
  const errorId = useId();
  // Escape / Enter / Tab already settled the edit; the blur that follows the
  // editor unmounting must not commit a second time.
  const settled = useRef(false);
  const settle = (fn: () => void) => {
    if (settled.current) return;
    settled.current = true;
    fn();
  };

  const errorNode = error ? (
    <span
      id={errorId}
      role="alert"
      data-slot="data-table-cell-editor-error"
      className="absolute start-0 top-full z-30 mt-1 whitespace-nowrap rounded-md bg-destructive px-2 py-1 text-meta text-destructive-foreground shadow-ring-md"
    >
      {error}
    </span>
  ) : null;

  if (kind === "select") {
    return (
      <>
        <Select
          defaultOpen
          value={text === "" ? undefined : text}
          onValueChange={(value) => {
            setText(value);
            // After Radix has closed the list and released focus, so the
            // grid's refocus of the cell is the last word.
            setTimeout(() => settle(() => onCommit(value, null)), 0);
          }}
          onOpenChange={(open) => {
            if (!open) setTimeout(() => settle(onCancel), 0);
          }}
        >
          <SelectTrigger
            aria-label={label}
            data-slot="data-table-cell-editor"
            className={cn(FIELD, "justify-between")}
          >
            <SelectValue />
          </SelectTrigger>
          {/* The grid puts focus back on the cell itself; Radix must not
              restore it to the trigger, which is gone by then. */}
          <SelectContent onCloseAutoFocus={(event) => event.preventDefault()}>
            {options.map((o) => (
              <SelectItem key={String(o.value)} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorNode}
      </>
    );
  }

  return (
    <>
      <Input
        autoFocus
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-slot="data-table-cell-editor"
        type={kind === "date" ? "date" : "text"}
        inputMode={kind === "number" ? "decimal" : undefined}
        className={cn(
          FIELD,
          numeric && "text-end tabular-nums",
          error && "ring-2 ring-destructive",
        )}
        value={text}
        ref={(el) => {
          // Typing to edit keeps what was typed and puts the caret after it;
          // Enter / F2 / double-click select the whole value to overtype.
          if (el && !el.dataset.placed) {
            el.dataset.placed = "1";
            if (kind !== "date") {
              if (replaced) el.setSelectionRange(el.value.length, el.value.length);
              else el.select();
            }
          }
        }}
        onChange={(event) => {
          settled.current = false;
          setText(event.target.value);
        }}
        onKeyDown={(event) => {
          // Keys belong to the editor, never to the grid around it.
          event.stopPropagation();
          // A rejected commit keeps the editor open: every key is a new attempt.
          settled.current = false;
          if (event.key === "Enter") {
            event.preventDefault();
            settle(() => onCommit(text, event.shiftKey ? "up" : "down"));
          } else if (event.key === "Tab") {
            event.preventDefault();
            settle(() => onCommit(text, event.shiftKey ? "left" : "right"));
          } else if (event.key === "Escape") {
            event.preventDefault();
            settle(onCancel);
          }
        }}
        onBlur={() => {
          // Focus leaving after a rejected Enter / Tab drops the edit; after a
          // successful one (focus moved on to the next cell) it is a no-op.
          if (settled.current && !error) return;
          settled.current = true;
          onCommit(text, null, true);
        }}
      />
      {errorNode}
    </>
  );
}
