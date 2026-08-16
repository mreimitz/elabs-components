"use client";

import {
  forwardRef,
  useCallback,
  useMemo,
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

  const addRow = useCallback(() => {
    if (max !== undefined && rows.length >= max) return;
    commit([...rows, ""]);
  }, [rows, max, commit]);

  const updateRow = useCallback(
    (index: number, next: string) => {
      commit(rows.map((row, i) => (i === index ? next : row)));
    },
    [rows, commit],
  );

  const removeRow = useCallback(
    (index: number) => {
      commit(rows.filter((_, i) => i !== index));
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
      commit(next);
    },
    [rows, commit],
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
          {rows.map((row, index) => (
            <div key={index} data-slot="list-editor-row" className="flex items-center gap-1">
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
          ))}
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
