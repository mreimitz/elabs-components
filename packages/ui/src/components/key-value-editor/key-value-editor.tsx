"use client";

import {
  forwardRef,
  useCallback,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Eye, EyeOff, Plus, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { useLocale } from "../locale-provider";

export interface KeyValueRow {
  key: string;
  value: string;
  /**
   * Marks this row's value as sensitive: it renders masked (`type="password"`)
   * with a reveal toggle, and is never surfaced in plain text via any
   * `title`/`aria-label`/`aria-valuetext`. Defaults to false (a plain,
   * unmasked key/value pair) — the consumer opts a row in explicitly.
   */
  secret?: boolean;
}

export interface KeyValueEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /**
   * Controlled, ORDERED rows. An ordered `{ key, value, secret? }[]` is used
   * instead of `Record<string,string>` because a plain record can't
   * represent an in-progress duplicate key or preserve row order while the
   * user is mid-edit — both happen constantly while typing an env-var map.
   */
  value?: KeyValueRow[];
  /** Uncontrolled initial rows. */
  defaultValue?: KeyValueRow[];
  /** Called when the rows change (add, remove, or edit). */
  onValueChange?: (rows: KeyValueRow[]) => void;
  /** Placeholder for each row's key field. */
  keyPlaceholder?: string;
  /** Placeholder for each row's value field. */
  valuePlaceholder?: string;
  /** Label for the "add row" control. */
  addLabel?: ReactNode;
  /** Disables the whole editor. */
  disabled?: boolean;
}

/**
 * KeyValueEditor — key/value rows with per-row secret masking.
 *
 * Composes the existing `Input` + `Button` (icon vocabulary matches
 * `packages/ai/src/environment-variables.tsx`'s `Eye`/`EyeOff` reveal icons
 * for conceptual consistency, though this component lives in
 * `@elabs/components-ui` — an EDITABLE settings-form primitive
 * is app UI, not the read-only agent tool-output display that
 * `EnvironmentVariables` is).
 *
 * A masked row uses the native `type="password"` input (the correct
 * primitive for an EDITABLE masked field — unlike a read-only display, the
 * value must stay typable, and native masking is what keeps it that way
 * without hand-rolling bullet substitution). The reveal toggle's
 * `aria-label` never contains the secret text itself, and no `title`
 * attribute is ever set from row content.
 *
 * Controlled via `value`/`onValueChange`; uncontrolled via `defaultValue`.
 */
export const KeyValueEditor = forwardRef<HTMLDivElement, KeyValueEditorProps>(
  function KeyValueEditor(
    {
      value: valueProp,
      defaultValue,
      onValueChange,
      keyPlaceholder,
      valuePlaceholder,
      addLabel,
      disabled,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const isControlled = valueProp !== undefined;
    const [internalRows, setInternalRows] = useState<KeyValueRow[]>(defaultValue ?? []);
    const rows = useMemo(
      () => (isControlled ? (valueProp ?? []) : internalRows),
      [isControlled, valueProp, internalRows],
    );
    // Reveal state is keyed by row index AND stamped with the exact value the
    // user chose to reveal. The index alone is NOT safe: the row list can be
    // re-ordered, prepended to, filtered, or left unchanged (a controlled
    // parent that rejects a removal) entirely OUTSIDE this component, and a
    // bare index would then point at a DIFFERENT row — unmasking a secret the
    // user never asked to see. Comparing the stamp against the row's current
    // value makes the check FAIL CLOSED: any row whose value is not exactly
    // the one that was revealed renders masked again.
    const [revealed, setRevealed] = useState<Map<number, string>>(() => new Map());

    const isRevealed = useCallback(
      (index: number, row: KeyValueRow) => revealed.get(index) === row.value,
      [revealed],
    );

    const commit = useCallback(
      (next: KeyValueRow[]) => {
        if (!isControlled) setInternalRows(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const addRow = useCallback(() => {
      commit([...rows, { key: "", value: "", secret: false }]);
    }, [rows, commit]);

    const updateRow = useCallback(
      (index: number, patch: Partial<KeyValueRow>) => {
        commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
        // Typing into a row the user deliberately revealed must not re-mask it
        // mid-keystroke — re-stamp the snapshot with the new value, but ONLY
        // when the old stamp still matched (i.e. it really was revealed).
        if (patch.value !== undefined) {
          const nextValue = patch.value;
          setRevealed((prev) => {
            if (prev.get(index) !== rows[index]?.value) return prev;
            const next = new Map(prev);
            next.set(index, nextValue);
            return next;
          });
        }
      },
      [rows, commit],
    );

    const removeRow = useCallback(
      (index: number) => {
        commit(rows.filter((_, i) => i !== index));
        // Re-index revealed state so a shifted row never inherits a stale
        // reveal — dropping the removed index and shifting later ones down.
        // The value stamp above is the second line of defence: if the parent
        // rejects or rewrites the removal, the shifted stamps stop matching
        // and every row falls back to masked.
        setRevealed((prev) => {
          const next = new Map<number, string>();
          for (const [i, stamp] of prev) {
            if (i === index) continue;
            next.set(i > index ? i - 1 : i, stamp);
          }
          return next;
        });
      },
      [rows, commit],
    );

    const toggleReveal = useCallback((index: number, row: KeyValueRow) => {
      setRevealed((prev) => {
        const next = new Map(prev);
        if (next.get(index) === row.value) next.delete(index);
        else next.set(index, row.value);
        return next;
      });
    }, []);

    return (
      <div
        ref={ref}
        data-slot="key-value-editor"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {rows.length === 0 ? (
          <p data-slot="key-value-editor-empty" className="text-body text-muted-foreground">
            {t("ui.keyValueEditor.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => {
              const isSecret = row.secret === true;
              const rowRevealed = isRevealed(index, row);
              const masked = isSecret && !rowRevealed;
              return (
                <div
                  key={index}
                  data-slot="key-value-editor-row"
                  className="flex items-center gap-1"
                >
                  <Input
                    data-slot="key-value-editor-key"
                    value={row.key}
                    placeholder={keyPlaceholder}
                    disabled={disabled}
                    aria-label={t("ui.keyValueEditor.keyLabel", { n: index + 1 })}
                    onChange={(event) => updateRow(index, { key: event.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1"
                  />
                  <Input
                    data-slot="key-value-editor-value"
                    type={masked ? "password" : "text"}
                    value={row.value}
                    placeholder={valuePlaceholder}
                    disabled={disabled}
                    aria-label={t("ui.keyValueEditor.valueLabel", { n: index + 1 })}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1"
                  />
                  {isSecret && (
                    <Button
                      data-slot="key-value-editor-reveal"
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      aria-label={t(
                        rowRevealed ? "ui.keyValueEditor.hide" : "ui.keyValueEditor.reveal",
                        { n: index + 1 },
                      )}
                      onClick={() => toggleReveal(index, row)}
                    >
                      {rowRevealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                  )}
                  <Button
                    data-slot="key-value-editor-remove"
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={t("ui.keyValueEditor.removeRow", { n: index + 1 })}
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
          data-slot="key-value-editor-add"
          type="button"
          variant="outline-subtle"
          size="sm"
          disabled={disabled}
          onClick={addRow}
          className="self-start"
        >
          <Plus aria-hidden="true" />
          {addLabel ?? t("ui.keyValueEditor.addRow")}
        </Button>
      </div>
    );
  },
);
