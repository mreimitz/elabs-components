import { forwardRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { SkipLink } from "../skip-link";
import { TopNav } from "../top-nav";

/** `topBar` slots — see `AppShellProps.topBar`. */
export interface AppShellTopBarSlots {
  /** Leading content, after the brand (when `brandPlacement="topbar"`). */
  start?: ReactNode;
  /** Centred content (e.g. a global search field) — see `TopNav`'s `center`. */
  center?: ReactNode;
  /** Trailing content (actions, account menu). */
  end?: ReactNode;
}

export interface AppShellProps {
  /**
   * Persistent left navigation (often a <Sidebar />). Not rendered when
   * `navigation="topbar"` — put the primary navigation in `topBar`/`topNav`
   * instead.
   */
  sidebar?: ReactNode;
  /**
   * Top bar (often a <TopNav />), a fully-formed node the caller already
   * brought. **Wins over `topBar` when both are passed** — this shell never
   * merges the two, so pass one or the other, never both. Use `topNav` when
   * you want to compose `TopNav` (or any other element) yourself; use
   * `topBar` for the common case where this shell should compose `TopNav`
   * for you from plain slots.
   */
  topNav?: ReactNode;
  /**
   * Slots this shell composes into a `TopNav` for you — the convenience path
   * for the common case (see `topNav` for precedence when both are set).
   * `center` renders through `TopNav`'s own `center` prop: a true 3-column
   * grid, so centred content (e.g. a global search field) stays centred
   * regardless of how wide `start`/`end` are.
   */
  topBar?: AppShellTopBarSlots;
  /**
   * Where the brand mark lives. `"sidebar"` (default) is today's behavior:
   * this shell renders no brand of its own — the caller's `sidebar` node
   * (e.g. a `SidebarHeader` / `TeamSwitcher`) owns it. `"topbar"` renders
   * `brand` as the leading element of the top bar, before `topBar.start`.
   * Has no effect without a `brand` node, and no effect when `topNav` is
   * passed instead of `topBar` (bring your own top bar, bring your own
   * brand placement inside it).
   * @default "sidebar"
   */
  brandPlacement?: "sidebar" | "topbar";
  /** Brand mark rendered in the top bar when `brandPlacement="topbar"`. */
  brand?: ReactNode;
  /**
   * Where the primary navigation lives. `"sidebar"` (default) renders
   * `sidebar` in the left column, unchanged. `"topbar"` renders no sidebar
   * column at all — compose the primary navigation into `topBar`/`topNav`
   * instead (e.g. a `NavigationMenu` in `topBar.center`).
   * @default "sidebar"
   */
  navigation?: "sidebar" | "topbar";
  /**
   * A second column beside the sidebar (e.g. a resource/filter panel) —
   * `w-(--shell-secondary-width)` (16rem by default, every theme), hidden
   * below `md` exactly like `sidebar`. Independent of `navigation`/`sidebar`:
   * renders whenever it is passed. Pure layout, like `sidebar` — bring your
   * own chrome (background, border) on the node itself.
   */
  secondaryPanel?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Class for the scrolling main content region. */
  mainClassName?: string;
  /**
   * The `<main>` region's id, and the skip link's target. Override it when a
   * page mounts more than one shell — two elements sharing `main-content`
   * would make the skip link ambiguous. @default "main-content"
   */
  mainId?: string;
}

/**
 * App-first layout: fixed-height viewport with an optional sidebar, a top bar,
 * and a scrollable main region. Pure layout — bring your own nav components.
 *
 * The `sidebar` slot is hidden below `md` with no fallback of its own: this
 * shell does not know whether `sidebar` already manages its own responsive
 * behavior. `<Sidebar>` (`../sidebar`) does — it renders as an offcanvas
 * `Sheet` below the mobile breakpoint entirely on its own, through a Radix
 * portal that is unaffected by this wrapper's `hidden md:flex` (a portal
 * mounts into `document.body`, not into this DOM subtree) — pair it with a
 * `<SidebarTrigger>` inside `topNav` for full mobile navigation. Wrapping an
 * arbitrary `sidebar` node in a SECOND, shell-owned `Sheet` here would look
 * like a fix but silently break that exact pattern: a Radix `Sheet`/`Dialog`
 * only mounts its content while open, so `<Sidebar>` would be unmounted
 * (not just hidden) whenever the shell's own drawer is closed — and with it,
 * the very trigger a caller uses to open ITS mobile view. A bare nav node
 * (no built-in responsive behavior of its own) has no such fallback; give it
 * one explicitly, e.g. by rendering a `<Sheet>` alongside `topNav` in the
 * consuming app.
 *
 * The `SidebarProvider` + `Sidebar` + `SidebarTrigger` composition above is
 * regression-locked in `app-shell.test.tsx` at a mobile viewport width: no
 * AppShell code change is needed to reach navigation below `md`, because
 * `SidebarProvider` is a plain React context and is never blocked by this
 * component's internal wrapper `<div>`.
 *
 * `brandPlacement`, `topBar`, `navigation` and `secondaryPanel` are all
 * optional, off by default: with none of them passed this renders exactly
 * what it always has (a `sidebar` column, `topNav` verbatim, `<main>`). They
 * generalise the shape `Layout/App Shell/Flagship` already hand-builds —
 * brand in the top bar, a centred search field, horizontal primary
 * navigation, a second resource column — into props any consumer can reach
 * for without hand-rolling the layout again.
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  {
    sidebar,
    topNav,
    topBar,
    brandPlacement = "sidebar",
    brand,
    navigation = "sidebar",
    secondaryPanel,
    children,
    className,
    mainClassName,
    mainId = "main-content",
  },
  ref,
) {
  const showSidebar = navigation !== "topbar" && !!sidebar;
  const showBrandInTopBar = brandPlacement === "topbar" && !!brand;

  // `topNav` is a fully-formed node the caller already brought, so it always
  // wins over `topBar` — the shell's own compose-from-slots convenience path.
  // See the `topNav`/`topBar` JSDoc for the full precedence note.
  const composedTopBar =
    topBar || showBrandInTopBar ? (
      <TopNav
        start={
          showBrandInTopBar ? (
            <>
              <div data-slot="app-shell-brand" className="flex items-center">
                {brand}
              </div>
              {topBar?.start}
            </>
          ) : (
            topBar?.start
          )
        }
        center={topBar?.center}
        end={topBar?.end}
      />
    ) : null;
  const resolvedTopBar = topNav ?? composedTopBar;

  return (
    <div
      ref={ref}
      className={cn("flex h-dvh w-full overflow-hidden bg-background text-foreground", className)}
    >
      {/* The first focusable element of the shell, so a keyboard user can pass
          the nav rail instead of tabbing through it on every route (WCAG 2.4.1).
          All four registry app-shell blocks ship one; the primitive they sit
          beside must not be the exception, and it is the surface with the widest
          reach — it is imported, not copy-owned. */}
      <SkipLink targetId={mainId} />
      {showSidebar ? <div className="hidden md:flex">{sidebar}</div> : null}
      {secondaryPanel ? (
        <div
          data-slot="app-shell-secondary-panel"
          className="hidden w-(--shell-secondary-width) shrink-0 md:flex"
        >
          {secondaryPanel}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {resolvedTopBar}
        {/* `<main>` IS the scroll port here (in the blocks the skip target and
            the scroll port are separate elements), so it takes `tabIndex={0}`
            rather than `{-1}`: a region that scrolls has to be keyboard-operable
            even when the content inside it is not focusable (WCAG 2.1.1, axe
            `scrollable-region-focusable`). `focus-ring-inset`, not `focus-ring`
            — the root above carries `overflow-hidden`, which clips both layers
            of the plain rung. `overscroll-y-contain`: a scroll past main's top
            or bottom stays in main — chained to the document, macOS/iOS elastic
            overscroll rubber-bands the whole frame, top bar included. */}
        <main
          id={mainId}
          tabIndex={0}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-y-contain focus-ring-inset",
            mainClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
});
