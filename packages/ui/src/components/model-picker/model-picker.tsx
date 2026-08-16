"use client";

import { forwardRef, useCallback, useState, type HTMLAttributes, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../command";
import { useLocale } from "../locale-provider";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Skeleton } from "../skeleton";
import {
  countItems,
  modelPickerBody,
  showsInlineError,
  type ModelPickerGroup,
  type ModelPickerItem,
  type ModelPickerStatus,
} from "./model-picker-state";

export interface ModelPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Grouped rows. Grouping and heading text are the caller's, never derived. */
  groups: readonly ModelPickerGroup[];
  /** The currently pinned row's id. */
  value?: string;
  /** Fires with the chosen row; the popover closes first. */
  onSelect?: (item: ModelPickerItem) => void;
  /** Drives the four bodies — see `modelPickerBody`. Default `"ready"`. */
  status?: ModelPickerStatus;
  /** Trigger text — usually the pinned row's label. */
  triggerLabel: ReactNode;
  /** Retry action for the error strip and the empty panel. Omit to hide it. */
  onRetry?: () => void;
  /** Search field placeholder. */
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Extra classes for the popover panel (default width `w-96`). */
  contentClassName?: string;
  /** Accessible name for the trigger — what the control is FOR, not what is chosen. */
  "aria-label"?: string;
  /**
   * Controlled popover open state. Omit for the uncontrolled default (internal
   * `useState(false)`, unchanged). `isControlled = open !== undefined` and the
   * mode never flips mid-life — see `component-api.md` "Controlled/uncontrolled".
   */
  open?: boolean;
  /** Fires whenever the popover would open/close — a trigger click, or a row select. */
  onOpenChange?: (open: boolean) => void;
}

function Row({
  item,
  picked,
  onChoose,
}: {
  item: ModelPickerItem;
  picked: boolean;
  onChoose: () => void;
}) {
  return (
    <CommandItem
      value={item.id}
      // cmdk filters on value + keywords, so a hidden keyword ("northwind") finds
      // a row whose visible label never mentions it.
      keywords={item.keywords ?? []}
      disabled={item.disabled}
      onSelect={onChoose}
      data-model-id={item.id}
      // `data-picked`, NOT `data-selected`. cmdk OWNS `data-selected` on a
      // CommandItem — it is the keyboard HIGHLIGHT, set on whichever row the
      // arrow keys are currently on. Writing our own would be silently
      // overwritten, and a test reading it would report the highlighted row as
      // the pinned one.
      data-picked={picked ? "true" : "false"}
      className="gap-2"
    >
      {item.icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{item.label}</span>
        {item.description === undefined ? null : (
          <span className="text-meta text-muted-foreground truncate">{item.description}</span>
        )}
      </span>
      {(item.meta ?? []).map((m) => (
        <span key={m} className="text-meta text-muted-foreground shrink-0">
          {m}
        </span>
      ))}
      {picked ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
    </CommandItem>
  );
}

/**
 * A compact pill that opens a grouped, searchable target list anchored under
 * itself — sized to sit in a composer footer.
 *
 * The inline sibling of `@elabs/components-ai`'s `ModelSelector`,
 * which is the same `Command` internals in a modal `Dialog`. Reach for that one
 * for a full command palette; reach for this one for an in-place picker.
 *
 * **`Command` lives inside a `Popover`, never a `DropdownMenu`, and that is not
 * a stylistic choice.** `DropdownMenuContent` owns roving tabindex and its own
 * typeahead, both of which fight a real `<input>` in its subtree: arrow keys move
 * the menu's focus instead of cmdk's highlight, and keystrokes are swallowed
 * before they reach `CommandInput`. `Popover` contributes positioning and
 * dismissal and claims no keyboard, which is why every combobox is built on it.
 * Do not "simplify" this back.
 */
export const ModelPicker = forwardRef<HTMLDivElement, ModelPickerProps>(function ModelPicker(
  {
    groups,
    value,
    onSelect,
    status = "ready",
    triggerLabel,
    onRetry,
    searchPlaceholder,
    disabled,
    contentClassName,
    className,
    open: openProp,
    onOpenChange,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  // Controlled/uncontrolled per component-api.md: controlled iff `open` is
  // provided; the mode never flips mid-life. Uncontrolled fallback is
  // byte-identical to the old internal `useState(false)`.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );
  const count = countItems(groups);
  const body = modelPickerBody(status, count);

  return (
    <div ref={ref} data-slot="model-picker" className={cn("inline-flex", className)} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            // `role="combobox"` does NOT support name-from-content, so the
            // visible label never becomes the accessible name on its own — the
            // control would ship unnamed. Default to the label (telling AT what
            // is currently CHOSEN, matching `Combobox`); an explicit `aria-label`
            // wins and names what the control is FOR.
            aria-label={
              props["aria-label"] ??
              (typeof triggerLabel === "string" ? triggerLabel : t("ui.modelPicker.label"))
            }
            disabled={disabled}
            data-slot="model-picker-trigger"
            className="max-w-88 justify-between gap-2"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          data-slot="model-picker-content"
          // Radix Popover.Content renders role="dialog"; without a name axe flags it.
          aria-label={props["aria-label"] ?? t("ui.modelPicker.label")}
          className={cn("w-96 p-0", contentClassName)}
        >
          <Command>
            <CommandInput
              placeholder={searchPlaceholder ?? t("ui.modelPicker.searchPlaceholder")}
            />

            {showsInlineError(status, count) ? (
              // Above the list, never instead of it — the list still works.
              <div
                data-slot="model-picker-stale"
                role="status"
                className="border-border flex items-center justify-between gap-2 border-b px-3 py-2"
              >
                <span className="text-meta text-muted-foreground">
                  {t("ui.modelPicker.refreshFailed")}
                </span>
                {onRetry ? (
                  <Button variant="ghost" size="sm" onClick={onRetry}>
                    {t("ui.modelPicker.retry")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <CommandList>
              {body === "loading" ? (
                <div className="space-y-2 p-3" data-slot="model-picker-loading">
                  <span className="sr-only" role="status">
                    {t("loading")}
                  </span>
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-4/5" />
                  <Skeleton className="h-6 w-3/5" />
                </div>
              ) : null}

              {body === "error" || body === "empty" ? (
                <div className="space-y-2 p-4 text-center" data-slot="model-picker-state">
                  <p className="text-body">
                    {body === "error"
                      ? t("ui.modelPicker.loadFailed")
                      : t("ui.modelPicker.nothingYet")}
                  </p>
                  {onRetry ? (
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      {t("ui.modelPicker.retry")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {body === "list" ? (
                <>
                  <CommandEmpty>{t("noResults")}</CommandEmpty>
                  {groups.map((group) => (
                    <CommandGroup key={group.key} heading={group.label}>
                      {group.items.map((item) => (
                        <Row
                          key={item.id}
                          item={item}
                          picked={item.id === value}
                          onChoose={() => {
                            setOpen(false);
                            onSelect?.(item);
                          }}
                        />
                      ))}
                    </CommandGroup>
                  ))}
                </>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
});

export {
  countItems,
  modelPickerBody,
  showsInlineError,
  type ModelPickerGroup,
  type ModelPickerItem,
  type ModelPickerStatus,
};
