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
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  SidebarInput,
  SidebarMenuButton,
  SidebarMenuItem,
  cn,
  useSidebar,
} from "@elabs-ai/components-ui";
import { firstResultElement, focusSoon, treeRowElement, workspaceElement } from "./focus";
import {
  consumeExplicitOpen,
  searchActions,
  useSearchFocusToken,
  useSearchQuery,
} from "./search-store";

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
  // The token this component has already acted on, seeded from whatever it is at MOUNT time
  // (not `0`) — so a remount (leaving presenting, a mobile sheet reopening, a breakpoint
  // resize) never replays an older request it never actually served. Only a token that is
  // newer than this one, front a "/" press or the collapsed rail's icon after mount, is acted
  // on (m2/F2).
  const handledFocusToken = useRef(focusToken);

  // The mobile sheet remounts this component on every open, and Radix auto-focuses its first
  // tabbable element on open — this input, ahead of the Workspace button main used to land on
  // (s6). Read once at construction (before any layout effect, Radix's included): an ordinary
  // open (not a "/" press or the collapsed rail's icon) keeps the input out of the initial tab
  // search by giving it `tabIndex={-1}`, then rejoins the normal tab order on the next tick so
  // keyboard users can still reach it directly afterwards.
  const [tabExcluded, setTabExcluded] = useState(() => isMobile && !consumeExplicitOpen());
  useEffect(() => {
    if (!tabExcluded) return;
    const id = setTimeout(() => setTabExcluded(false), 0);
    return () => clearTimeout(id);
  }, [tabExcluded]);

  // A request from outside the input (the "/" shortcut, or the collapsed rail's icon button):
  // open the sidebar first when it is collapsed, then focus the field once it is on screen.
  useEffect(() => {
    if (focusToken === handledFocusToken.current) return;
    handledFocusToken.current = focusToken;
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

  /**
   * Escape: clear the query first (staying in the field); a second Escape leaves it.
   * ArrowDown / Enter while a query is filtering: jump straight to the top result — the tree
   * below has already done the matching and ordering, this just reads the DOM row it rendered
   * first (F11), so there is no second copy of that logic here.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query !== "") {
        clear();
        return;
      }
      inputRef.current?.blur();
      focusSoon(() => treeRowElement(""), workspaceElement);
      return;
    }
    if (query !== "" && (event.key === "ArrowDown" || event.key === "Enter")) {
      const first = firstResultElement();
      if (!first) return;
      event.preventDefault();
      if (event.key === "Enter") first.click();
      else first.focus();
    }
  };

  return (
    <>
      <SidebarMenuItem className="pb-1 group-data-[collapsible=icon]:hidden">
        <div role="search" className="relative">
          <label htmlFor={inputId} className="sr-only">
            {SEARCH_LABELS.label}
          </label>
          {/* `text-muted-foreground`, not a `sidebar-*` token: `SidebarInput` is a `bg-background`
              field dropped onto the (often dark) sidebar surface, not the sidebar surface
              itself — the sidebar's own ink tokens under-contrast on it in the light theme (F1).
              `no-canvas-ink-in-sidebar` does not know about this nested `bg-background` island
              (it flags any canvas ink structurally inside a Sidebar* element), so it is
              disabled on the two lines below, not worked around with the wrong token. */}
          <Search
            aria-hidden="true"
            // eslint-disable-next-line sidebar-a11y/no-canvas-ink-in-sidebar -- on SidebarInput's own bg-background surface, not bg-sidebar (F1).
            className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <SidebarInput
            ref={inputRef}
            id={inputId}
            // `text`, not `search`: the browser's own search-field cancel decoration would
            // double up with the clear button below, and its own Escape handling would race
            // ours (clear, then a second Escape leaves the field).
            type="text"
            autoComplete="off"
            value={query}
            placeholder={SEARCH_LABELS.placeholder}
            className={cn("ps-8", query !== "" && "pe-9")}
            tabIndex={tabExcluded ? -1 : undefined}
            onChange={(event) => searchActions.setQuery(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          {query !== "" ? (
            <button
              type="button"
              onClick={clear}
              aria-label={SEARCH_LABELS.clear}
              // `size-6` (24px), the WCAG 2.2 AA 2.5.8 minimum hit target (F10).
              // eslint-disable-next-line sidebar-a11y/no-canvas-ink-in-sidebar -- on SidebarInput's own bg-background surface, not bg-sidebar (F1).
              className="absolute end-1 top-1/2 size-6 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground focus-ring"
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
