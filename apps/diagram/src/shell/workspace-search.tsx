/**
 * Sidebar search (maintainer request 2026-09-28: "also add a search box in the left side main
 * nav panel below the home button and before the workspaces start. it should search and filter
 * the entire workspace"). Sits in the rail (`rail-nav.tsx`) between Home and Workspace; its
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
  consumePendingFocus,
  isFiltering,
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

/**
 * Renders nothing; mounted once, inside `SidebarProvider` but outside the sidebar itself
 * (`diagram-shell.tsx`), so it survives the mobile sheet unmounting `WorkspaceSearch` on every
 * close. Opens the sidebar, or the mobile sheet, the moment a "/" press or the collapsed rail's
 * icon button asks for the search box, so the request is served even when nothing else is on
 * screen yet to make it happen. `WorkspaceSearch`, once it mounts (or reacts) because of this,
 * only has to focus the input.
 */
export function SearchSidebarBridge() {
  const focusToken = useSearchFocusToken();
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  const seen = useRef(focusToken);
  useEffect(() => {
    if (focusToken === seen.current) return;
    seen.current = focusToken;
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
    // Reacts only to a new request, not to `isMobile`/`setOpen`/`setOpenMobile` themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);
  return null;
}

export function WorkspaceSearch() {
  const query = useSearchQuery();
  const focusToken = useSearchFocusToken();
  const { isMobile } = useSidebar();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Consumed exactly once, at construction, before any effect (Radix's own sheet auto-focus
  // included): was this mount caused by a still-unserved "/" (or the collapsed rail's icon)
  // request, as opposed to an ordinary open? Both `tabExcluded` and `handledFocusToken` below
  // need the same answer for this particular mount, so it is read once, here.
  const [servingRequest] = useState(() => consumePendingFocus());

  // The mobile sheet remounts this component on every open, and Radix auto-focuses its first
  // tabbable element on open — this input (and, once there is a query, the clear button right
  // after it), ahead of the Workspace row an ordinary open means to land on. An ordinary open
  // keeps both out of the initial tab search by giving them `tabIndex={-1}`, then rejoins the
  // normal tab order on the next tick so keyboard users can still reach them directly
  // afterwards. An explicit request does not need this: it focuses the input itself, below.
  const [tabExcluded, setTabExcluded] = useState(() => isMobile && !servingRequest);
  useEffect(() => {
    if (!tabExcluded) return;
    const id = setTimeout(() => setTabExcluded(false), 0);
    return () => clearTimeout(id);
  }, [tabExcluded]);

  // The token this component has already served. A mount serving a pending request seeds one
  // behind the current token, so the effect below still runs once for it; an ordinary mount
  // seeds even with it, so nothing runs until the next request actually arrives.
  const handledFocusToken = useRef(servingRequest ? focusToken - 1 : focusToken);

  // A request from outside the input (the "/" shortcut, or the collapsed rail's icon button):
  // `SearchSidebarBridge` (always mounted) opens the sidebar/sheet; once this component is on
  // screen because of that — a fresh mount serving the request above, or a request arriving
  // while already mounted, on desktop or an already-open mobile sheet — focus the field.
  useEffect(() => {
    if (focusToken === handledFocusToken.current) return;
    handledFocusToken.current = focusToken;
    consumePendingFocus();
    focusSoon(() => inputRef.current);
  }, [focusToken]);

  const clear = () => {
    searchActions.clear();
    inputRef.current?.focus();
  };

  // The query at the moment of a keydown, read through a ref so the window listener below (only
  // ever registered once) always sees the latest value without re-subscribing on every
  // keystroke.
  const queryRef = useRef(query);
  queryRef.current = query;

  /**
   * Escape while the input is focused, on the desktop's persistent sidebar: the FIRST press
   * clears a non-empty query, staying in the field; the SECOND (query already empty) moves focus
   * to the Workspace row. Inside the mobile sheet there is no "Workspace row" to fall back to —
   * the field's own container IS the dismissable layer — so the second press instead leaves the
   * key alone and lets Radix's `DismissableLayer` close the sheet itself, exactly as it would if
   * this listener were not here.
   *
   * Radix's `useEscapeKeydown` also listens for Escape, on `document` in the capture phase, and
   * would otherwise close the sheet on the FIRST press too — unless `event.defaultPrevented` is
   * already true by the time it runs (`onEscapeKeydown`, `@radix-ui/react-dismissable-layer`). A
   * `window` listener always runs first in the capture phase (capture goes outside-in: window
   * before document), so calling `preventDefault` here reaches Radix in time for the clear-only
   * first press — on every platform, not only the ones with a sheet, which is also why this is
   * not just a branch of `onKeyDown` below (a bubble-phase React handler on the input itself
   * would run too late to pre-empt Radix).
   */
  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.activeElement !== inputRef.current) return;
      if (queryRef.current !== "") {
        event.preventDefault();
        searchActions.clear();
        inputRef.current?.focus();
        return;
      }
      if (isMobile) return;
      event.preventDefault();
      inputRef.current?.blur();
      focusSoon(() => treeRowElement(""), workspaceElement);
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [isMobile]);

  /**
   * ArrowDown / Enter while a query is filtering: jump straight to the top result — the tree
   * below has already done the matching and ordering, this just reads the DOM row it rendered
   * first, so there is no second copy of that logic here.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isFiltering(query) && (event.key === "ArrowDown" || event.key === "Enter")) {
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
              itself — the sidebar's own ink tokens under-contrast on it in the light theme.
              `no-canvas-ink-in-sidebar` does not know about this nested `bg-background` island
              (it flags any canvas ink structurally inside a Sidebar* element), so it is
              disabled on the two lines below, not worked around with the wrong token. */}
          <Search
            aria-hidden="true"
            // eslint-disable-next-line sidebar-a11y/no-canvas-ink-in-sidebar -- on SidebarInput's own bg-background surface, not bg-sidebar.
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
            spellCheck={false}
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
              tabIndex={tabExcluded ? -1 : undefined}
              // `size-6` (24px), the WCAG 2.2 AA 2.5.8 minimum hit target.
              // eslint-disable-next-line sidebar-a11y/no-canvas-ink-in-sidebar -- on SidebarInput's own bg-background surface, not bg-sidebar.
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
