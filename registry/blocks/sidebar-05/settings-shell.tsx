/**
 * The dual-rail settings shell — a permanent icon rail, a contextual second
 * panel, a content pane, and a summoned right-hand `SideDock`.
 *
 * ONE `SidebarProvider` (`frame="app"`, ADR 0035 §4) owns the whole frame, so
 * ⌘B, the `sidebar_state` cookie and the top bar's `SidebarTrigger` all drive
 * exactly one thing: the SECTION PANEL. The icon rail is not a `Sidebar` at all
 * (see `settings-icon-rail.tsx` for why) — it is a plain 56px flex column
 * rendered INSIDE that provider so its `SidebarMenuButton`s can reach
 * `useSidebar()` and the provider's `TooltipProvider`.
 *
 * ## The one piece of geometry you must not delete
 *
 * A desktop `Sidebar`'s visible half is `position: fixed; left: 0`, with an
 * in-flow SPACER holding the width open beside it (`useCollapsiblePanel`). That
 * is correct for a classic left rail and wrong the moment something sits to its
 * left: the fixed container would be painted straight over the 56px icon rail.
 * The panel therefore carries
 *
 *     ms-14 group-data-[collapsible=offcanvas]:ms-0
 *
 * — expanded, `left: 0` + `margin-inline-start: 3.5rem` puts the container at
 * 56…312px, exactly matching the 56 + 256 the flow reserves; collapsed, the
 * container slides to `left: -256px` and the margin must go back to 0 or 56px
 * of panel would still cover the rail. The two `ms-*` utilities are the same
 * property, so the outcome is decided by SPECIFICITY, not source order: the
 * `group-data-[…]` variant compiles to `.group[data-collapsible="offcanvas"] .x`
 * (0,2,0) and beats the bare `.ms-14` (0,1,0). The panel also widens its
 * `transition-[…]` list to include `margin-inline-start`, so the margin tweens
 * with the slide instead of snapping mid-animation.
 *
 * `sidebar-05.stories.tsx` measures both states in a real browser. If you
 * re-tune the rail width, re-measure — do not reason about it.
 *
 * ## Ink
 *
 * Chrome (`bg-sidebar`) is DARK in the `light` reference theme, so the rail and
 * the panel use `text-sidebar-*` ink. `SidebarInset` paints the canvas
 * (`bg-background`) and `SideDock` grounds on `bg-card`, so both of those take
 * ordinary canvas ink. Mixing the two is a real 1.4.3 failure, not a nuance.
 */
"use client";

import { useState, type ComponentProps } from "react";
import { SidebarInset, SidebarProvider, SideDock, SkipLink, cn } from "@elabs-ai/components-ui";
import { ChangeHistory } from "./change-history";
import {
  SETTINGS_AREAS,
  findArea,
  parseSettingsPath,
  sectionHref,
  type SettingsArea,
} from "./nav-items";
import { SettingsIconRail } from "./settings-icon-rail";
import { SettingsScreen } from "./settings-screen";
import { SettingsSectionPanel } from "./settings-section-panel";
import { SettingsTopBar } from "./settings-top-bar";

export interface SettingsShellProps extends Omit<ComponentProps<"div">, "onSelect"> {
  /**
   * The route the shell opens on, `/settings/<area>/<section>`. Both state
   * atoms below are derived from it, so a consumer wiring this to a router
   * hands over a route rather than two ids.
   */
  activePath?: string;
  /** Areas the rail lists. @default SETTINGS_AREAS */
  areas?: SettingsArea[];
  /** Whether the section panel starts open. @default true */
  defaultPanelOpen?: boolean;
  /** Whether the change-history dock starts open. @default false */
  defaultHistoryOpen?: boolean;
  /**
   * Starting dock width in px. @default 400
   *
   * Held in this block's state below so the layout and the persistence hook
   * read one number — see `onWidthCommit`.
   */
  defaultDockWidth?: number;
  /** Nothing has arrived yet — the panel and the screen render skeletons. */
  loading?: boolean;
  /**
   * Viewport width below which the dock becomes an overlay sheet. Exposed only
   * so a story can drive it; leave it alone in an app (`SideDock`'s own 1100
   * default is tuned so a 400px dock never squeezes the content below ~480px).
   */
  dockOverlayBreakpoint?: number;
  /**
   * Notified on every frame of a dock resize gesture, beside this block's own
   * live width.
   *
   * `SideDock` exposes the live stream and the end-of-gesture commit as TWO
   * callbacks, and the block wires both to one setter — which makes them
   * indistinguishable from the outside: with `width` controlled, deleting the
   * commit changes nothing anyone can observe, because the live callback has
   * already pushed the same number through. Surfacing both seams is what lets
   * a consumer (or the story) tell them apart, and it is also how a real app
   * drives layout from the live stream while persisting only the commit.
   */
  onDockWidthChange?: (width: number) => void;
  /**
   * Notified ONCE when a resize gesture ends — the persistence seam described
   * on `onWidthCommit` below, surfaced so it can be observed rather than only
   * documented. See `onDockWidthChange`.
   */
  onDockWidthCommit?: (width: number) => void;
}

export default function SettingsShell({
  activePath = sectionHref("access", "sign-in"),
  areas = SETTINGS_AREAS,
  defaultPanelOpen = true,
  defaultHistoryOpen = false,
  defaultDockWidth = 400,
  loading = false,
  dockOverlayBreakpoint,
  onDockWidthChange,
  onDockWidthCommit,
  className,
  ...props
}: SettingsShellProps) {
  const initial = parseSettingsPath(activePath, areas);

  // The route is the single source of truth for what the screen shows; the
  // panel's area is separate state because the rail can re-point the panel
  // WITHOUT navigating (you browse an area before picking a section in it).
  const [path, setPath] = useState(activePath);
  const [panelAreaId, setPanelAreaId] = useState(initial.areaId ?? areas[0]?.id ?? "");
  const [panelOpen, setPanelOpen] = useState(defaultPanelOpen);
  const [historyOpen, setHistoryOpen] = useState(defaultHistoryOpen);
  const [dockWidth, setDockWidth] = useState(defaultDockWidth);

  // Every lookup goes through the `areas` PROP, never the module fixture — a
  // caller who passes their own areas must not have them silently replaced by
  // the fixture entry that happens to share an id.
  const panelArea = findArea(panelAreaId, areas);
  const current = parseSettingsPath(path, areas);
  const screenArea = current.areaId ? findArea(current.areaId, areas) : undefined;
  const screenSection = screenArea?.sections.find((section) => section.id === current.sectionId);

  function handleAreaSelect(areaId: string) {
    // Re-clicking the area the panel is already showing closes it — the
    // switcher semantics live here, in the one place that knows both halves,
    // rather than in the rail.
    if (areaId === panelAreaId) {
      setPanelOpen((open) => !open);
      return;
    }
    setPanelAreaId(areaId);
    setPanelOpen(true);
  }

  return (
    <SidebarProvider
      open={panelOpen}
      onOpenChange={setPanelOpen}
      // `h-svh overflow-hidden`: the shell is viewport-locked, which is what
      // makes the content pane's `min-h-0 flex-1 overflow-y-auto` scroll port
      // bounded. Without it the pane grows and the page scrolls instead.
      className={cn("h-svh overflow-hidden", className)}
      {...props}
    >
      <SkipLink />

      <SettingsIconRail
        areas={areas}
        currentAreaId={panelAreaId}
        panelOpen={panelOpen}
        onAreaSelect={handleAreaSelect}
      />

      {panelArea ? (
        <SettingsSectionPanel
          area={panelArea}
          activePath={path}
          loading={loading}
          onSectionSelect={(areaId, sectionId) => setPath(sectionHref(areaId, sectionId))}
          // See the file header — this is the whole dual-rail geometry, and
          // the story measures it.
          className="ms-14 transition-[left,right,width,margin-inline-start] group-data-[collapsible=offcanvas]:ms-0"
        />
      ) : null}

      <SidebarInset
        // The skip link's target. `tabIndex={-1}` is what makes focus actually
        // land here rather than fall through to the next tab stop.
        id="main-content"
        tabIndex={-1}
        className="min-w-0 overflow-hidden"
      >
        <SettingsTopBar
          activePath={path}
          historyOpen={historyOpen}
          onHistoryOpenChange={setHistoryOpen}
        />
        <SettingsScreen area={screenArea} section={screenSection} loading={loading} />
      </SidebarInset>

      <SideDock
        title="Change history"
        description="Every settings change in this workspace, newest first."
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        width={dockWidth}
        // Fires on every frame of a drag — drive layout from it.
        onWidthChange={(next) => {
          setDockWidth(next);
          onDockWidthChange?.(next);
        }}
        // Fires ONCE when a gesture ends. This is the persistence seam: a real
        // app writes the number here, e.g.
        //   onWidthCommit={(w) => localStorage.setItem("settings.dockWidth", String(w))}
        // and seeds `defaultDockWidth` from the same key on mount. The block
        // keeps it in state so it stays storage-free.
        onWidthCommit={(next) => {
          setDockWidth(next);
          onDockWidthCommit?.(next);
        }}
        overlayBreakpoint={dockOverlayBreakpoint}
      >
        <ChangeHistory />
      </SideDock>
    </SidebarProvider>
  );
}
