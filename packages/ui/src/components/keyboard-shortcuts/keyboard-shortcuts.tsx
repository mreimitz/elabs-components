"use client";

import { forwardRef, useId, useMemo, useState, type ComponentProps } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { Input } from "../input";
import { Kbd } from "../kbd";
import { useLocale } from "../locale-provider";
import { StatePanel } from "../state-panel";

/** One keyboard shortcut: the action it performs and its ordered key tokens. */
export interface Shortcut {
  action: string;
  /** Ordered key tokens, e.g. `["⌘", "K"]`. Rendered via {@link Kbd}. */
  keys: string[];
}

/**
 * A named group of shortcuts. There is deliberately no `count` field — the
 * displayed count is always derived from `items.length`, never supplied by
 * the caller (see issue #113: brainless, the upstream this was adapted from,
 * shipped a `count` with no `items`, an honestly-unverifiable number).
 */
export interface ShortcutGroup {
  id: string;
  label: string;
  items: Shortcut[];
  /** Whether this group starts expanded when search is inactive. @default false */
  defaultOpen?: boolean;
}

export interface KeyboardShortcutsProps extends Omit<ComponentProps<"div">, "onChange"> {
  groups: ShortcutGroup[];
  /** Show the built-in search field. @default true */
  searchable?: boolean;
  /** Controlled search query, if the app owns it. */
  query?: string;
  onQueryChange?: (query: string) => void;
}

function matchesQuery(shortcut: Shortcut, normalizedQuery: string): boolean {
  if (shortcut.action.toLowerCase().includes(normalizedQuery)) return true;
  return shortcut.keys.some((key) => key.toLowerCase().includes(normalizedQuery));
}

interface FilteredGroup {
  group: ShortcutGroup;
  items: Shortcut[];
}

/**
 * A grouped, searchable presentation of a shortcut set. Renders **content
 * only** — the app supplies the `Dialog`/`Sheet` shell, so the same
 * component works in a modal, a settings page or a sidebar.
 *
 * Group counts are always derived from `items.length` (or the number of
 * matching items while a search is active) — never a value passed in.
 */
export const KeyboardShortcuts = forwardRef<HTMLDivElement, KeyboardShortcutsProps>(
  function KeyboardShortcuts(
    { groups, searchable = true, query: queryProp, onQueryChange, className, ...props },
    ref,
  ) {
    const isControlled = queryProp !== undefined;
    const [internalQuery, setInternalQuery] = useState("");
    const query = isControlled ? queryProp : internalQuery;
    const normalizedQuery = query.trim().toLowerCase();
    const isFiltering = normalizedQuery.length > 0;
    const { t } = useLocale();
    const searchId = useId();

    const setQuery = (next: string) => {
      if (!isControlled) setInternalQuery(next);
      onQueryChange?.(next);
    };

    const filteredGroups = useMemo<FilteredGroup[]>(() => {
      return groups
        .map((group) => ({
          group,
          items: isFiltering
            ? group.items.filter((item) => matchesQuery(item, normalizedQuery))
            : group.items,
        }))
        .filter(({ items }) => items.length > 0);
    }, [groups, isFiltering, normalizedQuery]);

    return (
      <div
        ref={ref}
        data-slot="keyboard-shortcuts"
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        {searchable && (
          <div data-slot="keyboard-shortcuts-search" className="relative">
            <label htmlFor={searchId} className="sr-only">
              Search shortcuts
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              autoComplete="off"
              placeholder={t("ui.keyboardShortcuts.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
            />
          </div>
        )}

        {filteredGroups.length === 0 ? (
          <div data-slot="keyboard-shortcuts-empty">
            <StatePanel
              kind="empty"
              title={t("ui.keyboardShortcuts.emptyTitle")}
              description={
                isFiltering
                  ? t("ui.keyboardShortcuts.emptyFiltered", { query: query.trim() })
                  : t("ui.keyboardShortcuts.empty")
              }
            />
          </div>
        ) : (
          <div data-slot="keyboard-shortcuts-groups" className="flex flex-col gap-2">
            {filteredGroups.map(({ group, items }) => (
              <ShortcutGroupItem
                key={group.id}
                group={group}
                items={items}
                forceOpen={isFiltering}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

interface ShortcutGroupItemProps {
  group: ShortcutGroup;
  /** Items to display — the full group, or the subset matching the active search. */
  items: Shortcut[];
  /** Force the group open (search is active) without discarding the user's manual toggle. */
  forceOpen: boolean;
}

function ShortcutGroupItem({ group, items, forceOpen }: ShortcutGroupItemProps) {
  const [open, setOpen] = useState(group.defaultOpen ?? false);

  return (
    <Collapsible
      data-slot="keyboard-shortcuts-group"
      open={forceOpen || open}
      onOpenChange={setOpen}
      className="rounded-md border"
    >
      <CollapsibleTrigger
        data-slot="keyboard-shortcuts-group-trigger"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start",
          "focus-ring",
          "[&[data-state=open]>svg]:rotate-180",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-body font-medium text-foreground">{group.label}</span>
          {/* Derived from items.length — never a caller-supplied count (see #113). */}
          <Badge variant="secondary">{items.length}</Badge>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-base ease-standard"
        />
      </CollapsibleTrigger>
      <CollapsibleContent data-slot="keyboard-shortcuts-group-content">
        <ul className="flex flex-col gap-1 px-3 pb-3">
          {items.map((item, index) => (
            <li
              key={`${item.action}-${index}`}
              data-slot="keyboard-shortcuts-item"
              className="flex items-center justify-between gap-4 py-1"
            >
              <span className="text-body text-muted-foreground">{item.action}</span>
              <span className="flex items-center gap-1">
                {item.keys.map((key, keyIndex) => (
                  <Kbd key={`${key}-${keyIndex}`}>{key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
