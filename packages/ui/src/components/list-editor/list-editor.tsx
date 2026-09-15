"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { useLocale } from "../locale-provider";

export interface ListEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Controlled list of strings. */
  value?: string[];
  /** Uncontrolled initial list of strings. */
  defaultValue?: string[];
  /** Called when the list changes (add, remove, edit, or reorder). */
  onValueChange?: (value: string[]) => void;
  /**
   * Whether rows can be reordered via move-up/move-down buttons. Default
   * true. Reordering is keyboard-operable (real buttons), never drag-only.
   */
  reorderable?: boolean;
  /** Placeholder shown in each row's text field. */
  placeholder?: string;
  /** Maximum number of rows allowed. */
  max?: number;
  /** Whether the editor is disabled. */
  disabled?: boolean;
  /** Label for the "add item" control. */
  addLabel?: ReactNode;
}

/**
 * ListEditor — one `Input` per row over a `string[]`, with add / remove /
 * keyboard-operable reorder (move-up/move-down buttons, not drag-and-drop —
 * no drag library exists in the monorepo and none should be added for this).
 *
 * Controlled via `value`/`onValueChange`; uncontrolled via `defaultValue`.
 */
export const ListEditor = forwardRef<HTMLDivElement, ListEditorProps>(function ListEditor(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    reorderable = true,
    placeholder,
    max,
    disabled,
    addLabel,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
  const rows = useMemo(
    () => (isControlled ? (valueProp ?? []) : internalValue),
    [isControlled, valueProp, internalValue],
  );

  const commit = useCallback(
    (next: string[]) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  // `rows` is a bare `string[]` with no identity of its own — keying each
  // row's DOM by its ARRAY INDEX means a reorder swaps which row's data a
  // given DOM node (and its focused "Move up" button) renders, not which
  // node holds the moved row's data. A stable per-row id, generated once and
  // carried through add/remove/move in lockstep with `rows`, lets React
  // (and thus keyboard focus) follow the actual row instead of the slot.
  const idCounterRef = useRef(0);
  const makeId = useCallback(() => `list-editor-row-${idCounterRef.current++}`, []);
  const [rowIds, setRowIds] = useState<string[]>(() => rows.map(() => makeId()));
  const lastRowsRef = useRef(rows);
  const upButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const downButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingFocusRef = useRef<{ id: string; want: "up" | "down" } | null>(null);

  // Safety net for a `rows` change that did NOT come from add/remove/move
  // below (e.g. a controlled `value` reset by the app) — keeps `rowIds` the
  // same length as `rows` without guessing at a diff.
  useEffect(() => {
    if (rows === lastRowsRef.current) return;
    lastRowsRef.current = rows;
    setRowIds((prev) => {
      if (prev.length === rows.length) return prev;
      if (rows.length > prev.length) {
        return [...prev, ...Array.from({ length: rows.length - prev.length }, () => makeId())];
      }
      return prev.slice(0, rows.length);
    });
  }, [rows, makeId]);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    const map = pending.want === "up" ? upButtonRefs.current : downButtonRefs.current;
    map.get(pending.id)?.focus();
  }, [rowIds]);

  const addRow = useCallback(() => {
    if (max !== undefined && rows.length >= max) return;
    commit([...rows, ""]);
    setRowIds((ids) => [...ids, makeId()]);
  }, [rows, max, commit, makeId]);

  const updateRow = useCallback(
    (index: number, next: string) => {
      commit(rows.map((row, i) => (i === index ? next : row)));
    },
    [rows, commit],
  );

  const removeRow = useCallback(
    (index: number) => {
      commit(rows.filter((_, i) => i !== index));
      setRowIds((ids) => ids.filter((_, i) => i !== index));
    },
    [rows, commit],
  );

  const moveRow = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return;
      const next = [...rows];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);
      const movedId = rowIds[index]!;
      commit(next);
      setRowIds((ids) => {
        const nextIds = [...ids];
        const [id] = nextIds.splice(index, 1);
        nextIds.splice(target, 0, id!);
        return nextIds;
      });

      // The button the user just pressed keeps focus by default (same id ⇒
      // same DOM node, just repositioned). The one case that needs help: the
      // row landed at the top/bottom, so THIS direction's button is now
      // `disabled` — a browser blurs a focused element the instant it goes
      // disabled, dropping focus to <body>. Redirect to the row's other
      // reorder button instead, which stays enabled.
      const activated: "up" | "down" = direction === -1 ? "up" : "down";
      const willDisable =
        (activated === "up" && target === 0) ||
        (activated === "down" && target === rows.length - 1);
      pendingFocusRef.current = {
        id: movedId,
        want: willDisable ? (activated === "up" ? "down" : "up") : activated,
      };
    },
    [rows, rowIds, commit],
  );

  const atMax = max !== undefined && rows.length >= max;

  return (
    <div
      ref={ref}
      data-slot="list-editor"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {rows.length === 0 ? (
        <p data-slot="list-editor-empty" className="text-body text-muted-foreground">
          {t("ui.listEditor.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const rowId = rowIds[index] ?? String(index);
            return (
              <div key={rowId} data-slot="list-editor-row" className="flex items-center gap-1">
                <Input
                  data-slot="list-editor-item"
                  value={row}
                  placeholder={placeholder}
                  disabled={disabled}
                  aria-label={t("ui.listEditor.itemLabel", { n: index + 1 })}
                  onChange={(event) => updateRow(index, event.target.value)}
                  className="flex-1"
                />
                {reorderable && (
                  <>
                    <Button
                      ref={(el) => {
                        if (el) upButtonRefs.current.set(rowId, el);
                        else upButtonRefs.current.delete(rowId);
                      }}
                      data-slot="list-editor-move-up"
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || index === 0}
                      aria-label={t("ui.listEditor.moveUp", { n: index + 1 })}
                      onClick={() => moveRow(index, -1)}
                    >
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button
                      ref={(el) => {
                        if (el) downButtonRefs.current.set(rowId, el);
                        else downButtonRefs.current.delete(rowId);
                      }}
                      data-slot="list-editor-move-down"
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || index === rows.length - 1}
                      aria-label={t("ui.listEditor.moveDown", { n: index + 1 })}
                      onClick={() => moveRow(index, 1)}
                    >
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  </>
                )}
                <Button
                  data-slot="list-editor-remove"
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={t("ui.listEditor.removeItem", { n: index + 1 })}
                  onClick={() => removeRow(index)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <Button
        data-slot="list-editor-add"
        type="button"
        variant="outline-subtle"
        size="sm"
        disabled={disabled || atMax}
        onClick={addRow}
        className="self-start"
      >
        <Plus aria-hidden="true" />
        {addLabel ?? t("ui.listEditor.addItem")}
      </Button>
    </div>
  );
});
