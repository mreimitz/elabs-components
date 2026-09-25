"use client";

/**
 * find-bar.tsx — the Ctrl/⌘+F bar of a DataGrid: a search field, "3 of 12",
 * previous / next and close. Enter / Shift+Enter step through the matches,
 * Escape closes and hands focus back to the grid. Match highlights are
 * painted by `use-find.ts` through `::highlight()` rules this bar renders.
 */
import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button, Input, useLocale } from "@elabs-ai/components-ui";

export interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Matches found, and the 0-based current one (`-1`: none). */
  total: number;
  current: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  /** `::highlight()` names for all matches and the current one. */
  highlightNames: { all: string; active: string };
  /** Bumped by the caller on every Ctrl/⌘+F, to refocus an already-open bar. */
  focusToken: number;
}

export function FindBar({
  query,
  onQueryChange,
  total,
  current,
  onNext,
  onPrevious,
  onClose,
  highlightNames,
  focusToken,
}: FindBarProps) {
  const { t, formatNumber } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken]);
  const status =
    query.trim() === ""
      ? ""
      : total === 0
        ? t("data.table.findNone")
        : t("data.table.findCount", {
            current: formatNumber(current + 1),
            total: formatNumber(total),
          });
  return (
    <div
      role="search"
      aria-label={t("data.table.find")}
      data-slot="data-table-find"
      className="flex items-center gap-1"
    >
      {/* The Custom Highlight API paints matches without touching cell DOM;
          colours are the shared find-in-page tokens. */}
      <style>{`::highlight(${highlightNames.all}){background-color:var(--highlight);color:var(--highlight-foreground)}::highlight(${highlightNames.active}){background-color:var(--highlight-active);color:var(--highlight-active-foreground)}`}</style>
      <Input
        ref={inputRef}
        type="search"
        aria-label={t("data.table.find")}
        placeholder={t("data.table.findPlaceholder")}
        className="h-control-sm w-56"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      />
      <span
        aria-live="polite"
        data-slot="data-table-find-count"
        className="min-w-16 px-1 text-meta tabular-nums text-muted-foreground"
      >
        {status}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("data.table.findPrevious")}
        disabled={total === 0}
        onClick={onPrevious}
      >
        <ChevronUp aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("data.table.findNext")}
        disabled={total === 0}
        onClick={onNext}
      >
        <ChevronDown aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("data.table.findClose")}
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
