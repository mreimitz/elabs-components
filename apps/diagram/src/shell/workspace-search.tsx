/**
 * DG-sidebar-search — maintainer 2026-09-28: "also add a search box in the left side main nav
 * panel below the home button and before the workspaces start. it should search and filter
 * the entire workspace." Sits in the rail (`rail-nav.tsx`) between Home and Workspace; its
 * query (`search-store.ts`) is read by `WorkspaceTree` to narrow the tree.
 *
 * Collapsed icon rail: shows as a plain icon button (tooltip "Search workspace") that opens
 * the sidebar and focuses the input, the same move `rail-nav.tsx` already makes for the
 * Workspace entry.
 */
import { useEffect, useId, useRef } from "react";
import { Search, X } from "lucide-react";
import {
  SidebarInput,
  SidebarMenuButton,
  SidebarMenuItem,
  cn,
  useSidebar,
} from "@elabs-ai/components-ui";
import { focusSoon, treeRowElement, workspaceElement } from "./focus";
import { searchActions, useSearchFocusToken, useSearchQuery } from "./search-store";

/** The search box's strings, in one place (`conventions/i18n-strings`). */
const SEARCH_LABELS = {
  label: "Search workspace",
  placeholder: "Search workspace…",
  clear: "Clear search",
} as const;

export function WorkspaceSearch() {
  const query = useSearchQuery();
  const focusToken = useSearchFocusToken();
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // A request from outside the input (the "/" shortcut, or the collapsed rail's icon button):
  // open the sidebar first when it is collapsed, then focus the field once it is on screen.
  useEffect(() => {
    if (focusToken === 0) return;
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
    focusSoon(() => inputRef.current);
    // Reacts only to a new request, not to `isMobile`/`setOpen`/`setOpenMobile` themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  const clear = () => {
    searchActions.clear();
    inputRef.current?.focus();
  };

  /** Escape: clear the query first (staying in the field); a second Escape leaves it. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (query !== "") {
      clear();
      return;
    }
    inputRef.current?.blur();
    focusSoon(() => treeRowElement(""), workspaceElement);
  };

  return (
    <>
      <SidebarMenuItem className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
        <div className="relative">
          <label htmlFor={inputId} className="sr-only">
            {SEARCH_LABELS.label}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-sidebar-muted-foreground"
          />
          <SidebarInput
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            placeholder={SEARCH_LABELS.placeholder}
            className={cn("ps-8", query !== "" && "pe-8")}
            onChange={(event) => searchActions.setQuery(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          {query !== "" ? (
            <button
              type="button"
              onClick={clear}
              aria-label={SEARCH_LABELS.clear}
              className="absolute end-2 top-1/2 size-5 -translate-y-1/2 rounded-sm p-0.5 text-sidebar-muted-foreground transition-colors duration-fast ease-standard hover:text-sidebar-foreground focus-ring"
            >
              <X aria-hidden="true" className="size-full" />
            </button>
          ) : null}
        </div>
      </SidebarMenuItem>
      <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
        <SidebarMenuButton
          tooltip={SEARCH_LABELS.label}
          onClick={() => searchActions.requestFocus()}
        >
          <Search aria-hidden="true" />
          <span>{SEARCH_LABELS.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
