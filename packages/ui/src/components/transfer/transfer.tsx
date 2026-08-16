// a2ui.exposed: yes
"use client";

import {
  forwardRef,
  useCallback,
  useId,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import { ScrollArea } from "../scroll-area";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TransferItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface TransferProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Full data set. Source = items NOT in target; target = items IN target. */
  dataSource: TransferItem[];
  /** Controlled: values in the RIGHT (target) list. */
  targetKeys?: string[];
  /** Uncontrolled initial target keys. */
  defaultTargetKeys?: string[];
  /** Called whenever the target key-set changes. */
  onChange?: (targetKeys: string[]) => void;
  /** Show per-panel search input. @default false */
  showSearch?: boolean;
  /** Panel titles. @default ["Source", "Target"] */
  titles?: [ReactNode, ReactNode];
  /** Custom row renderer. @default (item) => item.label */
  renderItem?: (item: TransferItem) => ReactNode;
  className?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Determine label as string for search filtering (ReactNode guard). */
function labelAsString(label: ReactNode): string {
  if (typeof label === "string") return label;
  if (typeof label === "number") return String(label);
  return "";
}

// ─── Panel sub-component ──────────────────────────────────────────────────────

interface PanelProps {
  title: ReactNode;
  items: TransferItem[];
  checked: Set<string>;
  onCheckItem: (value: string, on: boolean) => void;
  onCheckAll: (on: boolean) => void;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  renderItem: (item: TransferItem) => ReactNode;
  searchInputId: string;
  /** id applied to the panel's CardTitle; the panel region is labelled by it. */
  titleId: string;
  /** id prefix for per-row checkbox + label wiring. */
  rowIdBase: string;
}

function TransferPanel({
  title,
  items,
  checked,
  onCheckItem,
  onCheckAll,
  showSearch,
  searchQuery,
  onSearchChange,
  renderItem,
  searchInputId,
  titleId,
  rowIdBase,
}: PanelProps) {
  // When a search is active, filter visible items; move operations affect VISIBLE enabled items.
  const visibleItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((it) => labelAsString(it.label).toLowerCase().includes(q));
  }, [items, searchQuery]);

  const enabledVisible = useMemo(() => visibleItems.filter((it) => !it.disabled), [visibleItems]);
  const checkedCount = checked.size;
  const totalCount = visibleItems.length;

  const allChecked =
    enabledVisible.length > 0 && enabledVisible.every((it) => checked.has(it.value));
  const someChecked = !allChecked && enabledVisible.some((it) => checked.has(it.value));

  return (
    <Card role="region" aria-labelledby={titleId} className="flex flex-1 flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={someChecked ? "indeterminate" : allChecked}
            onCheckedChange={(v) => onCheckAll(v === true)}
            aria-label={`Select all in ${typeof title === "string" ? title : "panel"}`}
            disabled={enabledVisible.length === 0}
          />
          <CardTitle id={titleId} className="text-sm">
            {title}
          </CardTitle>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {checkedCount > 0 ? `${checkedCount}/${totalCount}` : totalCount}
        </Badge>
      </CardHeader>

      {showSearch && (
        <div className="px-3 pb-2">
          <label htmlFor={searchInputId} className="sr-only">
            Search {typeof title === "string" ? title : "items"}
          </label>
          <Input
            id={searchInputId}
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      )}

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full min-h-[200px]">
          {visibleItems.length === 0 ? (
            <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No items
            </p>
          ) : (
            <ul role="list" className="flex flex-col py-1">
              {visibleItems.map((item) => {
                const isChecked = checked.has(item.value);
                const cbId = `${rowIdBase}-cb-${item.value}`;
                const lblId = `${rowIdBase}-lbl-${item.value}`;
                return (
                  // Plain list row: the Checkbox is the interactive control (named via
                  // aria-labelledby) and the <label htmlFor> gives a second hit target.
                  // No role="option" — an interactive checkbox cannot live inside one.
                  <li
                    key={item.value}
                    className={cn(
                      "flex select-none items-center gap-2 px-3 py-1.5 text-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      item.disabled && "opacity-50 hover:bg-transparent hover:text-foreground",
                    )}
                  >
                    <Checkbox
                      id={cbId}
                      checked={isChecked}
                      onCheckedChange={(v) => !item.disabled && onCheckItem(item.value, v === true)}
                      disabled={item.disabled}
                      aria-labelledby={lblId}
                    />
                    <label
                      id={lblId}
                      htmlFor={cbId}
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        item.disabled ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      {renderItem(item)}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Transfer (main) ──────────────────────────────────────────────────────────

export const Transfer = forwardRef<HTMLDivElement, TransferProps>(function Transfer(
  {
    dataSource,
    targetKeys: controlledTargetKeys,
    defaultTargetKeys,
    onChange,
    showSearch = false,
    titles = ["Source", "Target"],
    renderItem = (item) => item.label,
    className,
    ...props
  },
  ref,
) {
  const isControlled = controlledTargetKeys !== undefined;

  // Uncontrolled internal state
  const [internalTargetKeys, setInternalTargetKeys] = useState<string[]>(
    () => defaultTargetKeys ?? [],
  );

  const targetKeys: string[] = isControlled ? controlledTargetKeys : internalTargetKeys;

  const targetSet = useMemo(() => new Set(targetKeys), [targetKeys]);

  // Per-panel row selection (which items are "checked for move")
  const [sourceChecked, setSourceChecked] = useState<Set<string>>(new Set());
  const [targetChecked, setTargetChecked] = useState<Set<string>>(new Set());

  // SR-only live announcement for move outcomes.
  const [announcement, setAnnouncement] = useState("");

  // Per-panel search
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");

  // Derive panels from dataSource (preserving order)
  const sourceItems = useMemo(
    () => dataSource.filter((it) => !targetSet.has(it.value)),
    [dataSource, targetSet],
  );
  const targetItems = useMemo(
    () => dataSource.filter((it) => targetSet.has(it.value)),
    [dataSource, targetSet],
  );

  // ── Apply a move: compute next targetKeys, update state ──────────────────
  const applyMove = useCallback(
    (nextTargetKeys: string[]) => {
      if (!isControlled) setInternalTargetKeys(nextTargetKeys);
      onChange?.(nextTargetKeys);
    },
    [isControlled, onChange],
  );

  // ── Filtered visible items for "move all visible" decisions ───────────────
  const visibleSourceEnabled = useMemo(() => {
    const q = sourceSearch.toLowerCase();
    return sourceItems.filter(
      (it) => !it.disabled && (!sourceSearch || labelAsString(it.label).toLowerCase().includes(q)),
    );
  }, [sourceItems, sourceSearch]);

  const visibleTargetEnabled = useMemo(() => {
    const q = targetSearch.toLowerCase();
    return targetItems.filter(
      (it) => !it.disabled && (!targetSearch || labelAsString(it.label).toLowerCase().includes(q)),
    );
  }, [targetItems, targetSearch]);

  // ── Move handlers ─────────────────────────────────────────────────────────

  /** Move source-panel checked items → target */
  const handleMoveCheckedRight = useCallback(() => {
    const toMove = new Set(
      [...sourceChecked].filter((v) => {
        const item = dataSource.find((it) => it.value === v);
        return item && !item.disabled && !targetSet.has(v);
      }),
    );
    if (toMove.size === 0) return;
    applyMove([...targetKeys, ...toMove]);
    setAnnouncement(`${toMove.size} item${toMove.size === 1 ? "" : "s"} moved to the target list.`);
    setSourceChecked((prev) => {
      const next = new Set(prev);
      toMove.forEach((v) => next.delete(v));
      return next;
    });
  }, [sourceChecked, dataSource, targetKeys, targetSet, applyMove]);

  /** Move ALL visible enabled source items → target */
  const handleMoveAllRight = useCallback(() => {
    // When search is active, move visible enabled items; otherwise move all enabled.
    // CHOICE: move currently-VISIBLE enabled items when a search is active so "move all"
    // respects the user's current filter view (predictable, WYSIWYG).
    const toAdd = visibleSourceEnabled.map((it) => it.value);
    if (toAdd.length === 0) return;
    const next = [...new Set([...targetKeys, ...toAdd])];
    applyMove(next);
    setAnnouncement(
      `${toAdd.length} item${toAdd.length === 1 ? "" : "s"} moved to the target list.`,
    );
    setSourceChecked(new Set());
  }, [visibleSourceEnabled, targetKeys, applyMove]);

  /** Move target-panel checked items → source */
  const handleMoveCheckedLeft = useCallback(() => {
    const toRemove = new Set(
      [...targetChecked].filter((v) => {
        const item = dataSource.find((it) => it.value === v);
        return item && !item.disabled && targetSet.has(v);
      }),
    );
    if (toRemove.size === 0) return;
    applyMove(targetKeys.filter((k) => !toRemove.has(k)));
    setAnnouncement(
      `${toRemove.size} item${toRemove.size === 1 ? "" : "s"} moved to the source list.`,
    );
    setTargetChecked((prev) => {
      const next = new Set(prev);
      toRemove.forEach((v) => next.delete(v));
      return next;
    });
  }, [targetChecked, dataSource, targetKeys, targetSet, applyMove]);

  /** Move ALL visible enabled target items → source */
  const handleMoveAllLeft = useCallback(() => {
    const toRemove = new Set(visibleTargetEnabled.map((it) => it.value));
    if (toRemove.size === 0) return;
    applyMove(targetKeys.filter((k) => !toRemove.has(k)));
    setAnnouncement(
      `${toRemove.size} item${toRemove.size === 1 ? "" : "s"} moved to the source list.`,
    );
    setTargetChecked(new Set());
  }, [visibleTargetEnabled, targetKeys, applyMove]);

  // ── Per-panel check handlers ──────────────────────────────────────────────

  const handleSourceCheckItem = useCallback((value: string, on: boolean) => {
    setSourceChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  }, []);

  const handleTargetCheckItem = useCallback((value: string, on: boolean) => {
    setTargetChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  }, []);

  const handleSourceCheckAll = useCallback(
    (on: boolean) => {
      const q = sourceSearch.toLowerCase();
      const visible = sourceItems.filter(
        (it) =>
          !it.disabled && (!sourceSearch || labelAsString(it.label).toLowerCase().includes(q)),
      );
      setSourceChecked(on ? new Set(visible.map((it) => it.value)) : new Set());
    },
    [sourceItems, sourceSearch],
  );

  const handleTargetCheckAll = useCallback(
    (on: boolean) => {
      const q = targetSearch.toLowerCase();
      const visible = targetItems.filter(
        (it) =>
          !it.disabled && (!targetSearch || labelAsString(it.label).toLowerCase().includes(q)),
      );
      setTargetChecked(on ? new Set(visible.map((it) => it.value)) : new Set());
    },
    [targetItems, targetSearch],
  );

  // ── Button disabled states ────────────────────────────────────────────────
  // Enabled only when a checked item is actually movable (still on this side and
  // not disabled) — a stale checked id (e.g. moved via a controlled targetKeys
  // change) must not light up a button that would then no-op.
  const canMoveCheckedRight = [...sourceChecked].some(
    (v) => !targetSet.has(v) && !dataSource.find((it) => it.value === v)?.disabled,
  );
  const canMoveAllRight = visibleSourceEnabled.length > 0;
  const canMoveCheckedLeft = [...targetChecked].some(
    (v) => targetSet.has(v) && !dataSource.find((it) => it.value === v)?.disabled,
  );
  const canMoveAllLeft = visibleTargetEnabled.length > 0;

  // Unique IDs for search inputs, panel-title labelling and row wiring
  const uid = useId();
  const sourceSearchId = `transfer-source-search-${uid}`;
  const targetSearchId = `transfer-target-search-${uid}`;
  const sourceTitleId = `transfer-source-title-${uid}`;
  const targetTitleId = `transfer-target-title-${uid}`;
  const sourceRowBase = `transfer-source-${uid}`;
  const targetRowBase = `transfer-target-${uid}`;

  return (
    <div ref={ref} className={cn("flex items-stretch gap-2", className)} {...props}>
      {/* SR-only live region announcing move outcomes */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* ── Source panel ─────────────────────────────── */}
      <TransferPanel
        title={titles[0]}
        items={sourceItems}
        checked={sourceChecked}
        onCheckItem={handleSourceCheckItem}
        onCheckAll={handleSourceCheckAll}
        showSearch={showSearch}
        searchQuery={sourceSearch}
        onSearchChange={setSourceSearch}
        renderItem={renderItem}
        searchInputId={sourceSearchId}
        titleId={sourceTitleId}
        rowIdBase={sourceRowBase}
      />

      {/* ── Move controls (center column) ────────────── */}
      <div
        className="flex flex-col items-center justify-center gap-1"
        role="group"
        aria-label="Move controls"
      >
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Move selected right"
          disabled={!canMoveCheckedRight}
          onClick={handleMoveCheckedRight}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Move all right"
          disabled={!canMoveAllRight}
          onClick={handleMoveAllRight}
        >
          <ChevronsRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Move selected left"
          disabled={!canMoveCheckedLeft}
          onClick={handleMoveCheckedLeft}
          className="mt-2"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Move all left"
          disabled={!canMoveAllLeft}
          onClick={handleMoveAllLeft}
        >
          <ChevronsLeft aria-hidden="true" />
        </Button>
      </div>

      {/* ── Target panel ─────────────────────────────── */}
      <TransferPanel
        title={titles[1]}
        items={targetItems}
        checked={targetChecked}
        onCheckItem={handleTargetCheckItem}
        onCheckAll={handleTargetCheckAll}
        showSearch={showSearch}
        searchQuery={targetSearch}
        onSearchChange={setTargetSearch}
        renderItem={renderItem}
        searchInputId={targetSearchId}
        titleId={targetTitleId}
        rowIdBase={targetRowBase}
      />
    </div>
  );
});
