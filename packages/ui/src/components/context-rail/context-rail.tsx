"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";

import { cn } from "../../lib/cn";
import { mergeRefs } from "../../lib/merge-refs";
import { useIsMobile } from "../../lib/use-mobile";
import { useLocale } from "../locale-provider/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../sheet";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "../sidebar";
import { StatePanel } from "../state-panel";

/** One switchable section of a `ContextRail`. */
export interface ContextRailSection {
  /** Stable identifier — the switcher's `SidebarMenuButton` key and the
   * value reported to `activeSectionId`/`onActiveSectionChange`. */
  id: string;
  /** Visible label. Feeds the switcher entry's accessible name and the
   * body's heading — never rendered as visible text in the switcher
   * itself, which stays icon-only in every state. */
  label: string;
  /** Icon shown in the switcher, in both the expanded and collapsed
   * (48px icon strip) presentations. Decorative — wrapped `aria-hidden`. */
  icon: ReactNode;
  /** Optional count badge. Visible in BOTH states (unlike
   * `SidebarMenuBadge`, which hides under `collapsible="icon"`) and folded
   * into the switcher entry's accessible name, e.g. "Sources 3 items". */
  count?: number;
  /** Rendered only while this section is active — the rail mounts exactly
   * one section's content at a time. */
  content: ReactNode;
  /** Disables the switcher entry; clicking it is a no-op. */
  disabled?: boolean;
}

// #382: this surface is DECLARED, not derived from `Sidebar`
// (`Omit<ComponentProps<typeof Sidebar>, …>`), on purpose. `ContextRail` has
// two rendering branches and only the wide one mounts a real `Sidebar` — the
// narrow branch (`ContextRailNarrow`, below `overlayBreakpoint`) renders a
// `Sheet` instead and has no `Sidebar` to forward a `Sidebar`-only prop to.
// Deriving the type from `Sidebar` previously let `variant` leak into the
// public API and stay silently inert in the narrow branch (no `data-variant`,
// no layout change) — see #382. Re-deriving from `Sidebar` reintroduces that
// bug; add members here explicitly instead.
//
// `onSelect` (the native div text-selection event) is omitted so it can't
// collide with this component's own `onSelect`-shaped internals
// (`ContextRailBranchProps`) when `props` is spread onto
// `ContextRailWide`/`ContextRailNarrow` below.
export interface ContextRailProps extends Omit<ComponentProps<"div">, "onSelect"> {
  /** The sections the switcher can pick between. An empty array renders
   * the `empty` slot instead of a switcher. */
  sections: ContextRailSection[];
  /** Controlled active section id. */
  activeSectionId?: string;
  /** Initial active section id (uncontrolled). Defaults to `sections[0]`. */
  defaultActiveSectionId?: string;
  /** Fires with the clicked section's id — including a re-click of the
   * already-active section (open/close is a separate concern, see `open`). */
  onActiveSectionChange?: (sectionId: string) => void;
  /** Controlled expanded/collapsed state. Clicking the ACTIVE switcher
   * entry toggles this; clicking an INACTIVE entry sets it `true`. */
  open?: boolean;
  /** Initial expanded/collapsed state (uncontrolled). Defaults to `true`. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Expanded width, published as `--sidebar-width`. @default "20rem" */
  width?: string;
  /** Replaces the default localized empty state when `sections` is empty. */
  empty?: ReactNode;
  /**
   * Below this viewport width the rail renders its own 48px strip plus a
   * `Sheet` for the expanded body instead of mounting `Sidebar` — dev-only
   * warns if set below 768. @default 768
   */
  overlayBreakpoint?: number;
}

const DEFAULT_WIDTH = "20rem";
const DEFAULT_OVERLAY_BREAKPOINT = 768;
// Mirrors sidebar.tsx's private `SIDEBAR_WIDTH_ICON` — the value the nested
// `SidebarProvider` actually publishes as `--sidebar-width-icon` (ContextRail
// never overrides that key in its own `style` prop). ADR 0035 §3: "The
// collapsed strip is 3rem (48px) … Retuning it is a fork, not a prop" — so
// this is a fixed constant, not something derived from a prop.
const NARROW_STRIP_WIDTH = "3rem";

function resolveActiveId(
  sections: ContextRailSection[],
  candidate: string | undefined,
): string | undefined {
  if (candidate != null && sections.some((section) => section.id === candidate)) {
    return candidate;
  }
  return sections[0]?.id;
}

interface ContextRailSwitcherProps {
  sections: ContextRailSection[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  orientation: "row" | "column";
}

// The count badge's own positioning, kept out of the JSX because it differs on
// two axes (orientation × collapsed) and is the whole subject of the fix below.
//
// It is rendered as a SIBLING of `SidebarMenuButton`, not a child.
// `sidebarMenuButtonVariants`' base class string carries `overflow-hidden`
// (sidebar.tsx), so a child at a negative offset (`-end-1 -top-1`) is clipped
// by its own parent — which contradicted `ContextRailSection.count`'s promise
// that the count stays visible in the collapsed 48px strip, the state the badge
// exists for. `SidebarMenuItem` is already `relative` and does not clip, so the
// same offsets resolve against the item box instead and paint in full.
const COUNT_BADGE_BASE =
  "pointer-events-none absolute inline-flex items-center justify-center rounded-full bg-sidebar-accent text-meta text-sidebar-accent-foreground tabular-nums";
// Row orientation, expanded: the badge sits at the end of the full-width row,
// vertically centred — visually where `ms-auto` used to place it inside the
// button, without depending on the button's own box.
//
// Collapsed, the badge hugs the item's own END EDGE (`end-0`) rather than
// overhanging it (`-end-1`), which is the ordinary corner-badge convention.
// The reason is this rail's POSITION, not its look: `ContextRail` is the
// outermost column of a flush shell, so its end edge IS the viewport edge —
// a 4px overhang lands past `window.innerWidth` and the count is clipped in
// half by the browser, measured at 1440px on the dashboard shell. The
// vertical `-top-1` overhang is kept: nothing clips it.
const COUNT_BADGE_ROW =
  "end-2 top-1/2 h-5 min-w-5 -translate-y-1/2 px-1 group-data-[collapsible=icon]:end-auto group-data-[collapsible=icon]:top-auto group-data-[collapsible=icon]:end-0 group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:translate-y-0 group-data-[collapsible=icon]:px-0.5";
// Column orientation (the narrow strip) is always the icon-sized corner badge.
const COUNT_BADGE_COLUMN = "end-0 -top-1 h-4 min-w-4 px-0.5";

function ContextRailSwitcher({
  sections,
  activeId,
  onSelect,
  orientation,
}: ContextRailSwitcherProps) {
  const { open, setOpen } = useSidebar();
  const { t } = useLocale();

  const handleClick = (section: ContextRailSection) => {
    const isActive = section.id === activeId;
    if (isActive) {
      setOpen(!open);
      return;
    }
    onSelect(section.id);
    if (!open) setOpen(true);
  };

  return (
    <SidebarMenu
      data-slot="context-rail-switcher"
      className={
        orientation === "row" ? "flex-row group-data-[collapsible=icon]:flex-col" : "flex-col"
      }
    >
      {sections.map((section) => {
        const isActive = section.id === activeId;
        const countPhrase =
          section.count != null
            ? t("ui.contextRail.sectionCount", { count: section.count })
            : undefined;
        // The count is deliberately part of the accessible name (one
        // sr-only span authors the whole string) — a screen-reader user
        // switching sections should hear "Sources 3 items", not just
        // "Sources", since the count is the reason to pick that section.
        const accessibleName = countPhrase ? `${section.label} ${countPhrase}` : section.label;

        return (
          <SidebarMenuItem key={section.id}>
            <SidebarMenuButton
              data-slot="context-rail-switcher-item"
              tooltip={section.label}
              isActive={isActive}
              aria-current={isActive ? "true" : undefined}
              disabled={section.disabled}
              onClick={() => handleClick(section)}
            >
              <span
                aria-hidden="true"
                className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
              >
                {section.icon}
              </span>
              <span className="sr-only">{accessibleName}</span>
            </SidebarMenuButton>
            {section.count != null && (
              <span
                data-slot="context-rail-count"
                aria-hidden="true"
                className={cn(
                  COUNT_BADGE_BASE,
                  orientation === "row" ? COUNT_BADGE_ROW : COUNT_BADGE_COLUMN,
                )}
              >
                {section.count}
              </span>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

interface ContextRailBranchProps extends Omit<ComponentProps<"div">, "onSelect"> {
  sections: ContextRailSection[];
  activeId: string | undefined;
  activeSection: ContextRailSection | undefined;
  onSelect: (id: string) => void;
  empty: ReactNode;
  hasSections: boolean;
}

interface ContextRailNarrowProps extends ContextRailBranchProps {
  /**
   * The rail's expanded width (`ContextRailProps.width`), forwarded here
   * because the Sheet's content is portalled to `document.body` and is
   * therefore NOT a DOM descendant of the nested `SidebarProvider` that
   * declares `--sidebar-width` on its own element — custom properties
   * inherit down the real DOM tree, not the React tree, so a portal never
   * sees an ancestor's declaration. Redeclared inline on `SheetContent`
   * itself, mirroring the library's own precedent for the same problem
   * (`sidebar.tsx`'s mobile `Sheet`, `style={{ "--sidebar-width":
   * SIDEBAR_WIDTH_MOBILE }}`).
   */
  width: string;
}

const ContextRailWide = forwardRef<HTMLDivElement, ContextRailBranchProps>(function ContextRailWide(
  { sections, activeId, activeSection, onSelect, empty, hasSections, className, ...props },
  ref,
) {
  const { t } = useLocale();
  const headingId = useId();
  const hasHeading = hasSections && activeSection != null;

  return (
    // A landmark, not a bare `<div>`: this is the THIRD region of a three-region
    // shell and it sits OUTSIDE `<main>`, so without one its content belongs to
    // no region a screen-reader user can navigate to. Same shape and same
    // reasoning as `SideDock`'s own root (`side-dock.tsx`, `<aside
    // aria-labelledby={titleId}>`) and as the blocks' list columns
    // (`app-list-column.tsx`, `mail-list-column.tsx`). Named by the section
    // heading below, so the name tracks the section actually on screen; with no
    // sections there is no heading to point at, so the localized empty-state
    // string names it instead — a landmark with no name is barely better than
    // no landmark.
    <aside
      // Runtime-safe: the ref target is a real element either way; only the TS
      // element type differs, and `ContextRailProps` keeps the `HTMLDivElement`
      // ref it has always published rather than making this a breaking change.
      ref={ref as Ref<HTMLElement>}
      data-slot="context-rail"
      aria-labelledby={hasHeading ? headingId : undefined}
      aria-label={hasHeading ? undefined : t("ui.contextRail.empty")}
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      {...props}
    >
      <ContextRailSwitcher
        sections={sections}
        activeId={activeId}
        onSelect={onSelect}
        orientation="row"
      />
      {hasHeading ? (
        <>
          {/* A real heading, not a `text-title` div: the body content sits under
              it, so heading navigation has to be able to reach it (WCAG 1.3.1).
              `h2` is the rung under the host page's own `h1`. */}
          <h2
            id={headingId}
            data-slot="context-rail-heading"
            className="border-b border-border-strong px-4 py-3 text-title group-data-[collapsible=icon]:hidden"
          >
            {activeSection.label}
          </h2>
          <div
            data-slot="context-rail-body"
            // Focusable because it scrolls; `focus-ring-inset` because
            // `Sidebar`'s own frame clips anything drawn outside this box, and
            // both layers of the plain rung are drawn outside it. The content
            // this rail mounts is caller-supplied and routinely has no
            // focusable descendant at all, so without a tab stop there is no
            // keyboard route into the region once it overflows (WCAG 2.1.1,
            // axe `scrollable-region-focusable`).
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto p-4 focus-ring-inset group-data-[collapsible=icon]:hidden"
          >
            {activeSection.content}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">{empty}</div>
      )}
    </aside>
  );
});

const ContextRailNarrow = forwardRef<HTMLDivElement, ContextRailNarrowProps>(
  function ContextRailNarrow(
    { sections, activeId, activeSection, onSelect, empty, hasSections, width, className, ...props },
    ref,
  ) {
    const { open, setOpen } = useSidebar();
    // The strip is the sheet's own persistent companion control (ADR 0035
    // §3), not something genuinely "outside" it — but it IS a DOM sibling
    // outside the Sheet's portalled content, so Radix's DismissableLayer
    // (active even with `modal={false}`; see the comment on `<Sheet>` below)
    // treats a pointerdown on the strip as an outside interaction and calls
    // `onOpenChange(false)` on POINTERDOWN, before this component's own
    // `onClick` runs. MEASURED (fix round 1, task-9b-fix-1.md): that race
    // flips `open` to `false` a tick before `ContextRailSwitcher`'s
    // `handleClick` reads it, so clicking the ACTIVE entry (meant to CLOSE
    // the sheet via `setOpen(!open)`) instead read `open` as already-false
    // and REOPENED it — the sheet never actually closed. `onPointerDownOutside`
    // is the sanctioned Radix escape hatch for exactly this: suppress the
    // auto-dismiss for pointerdowns that land on the strip, and let this
    // component's own click handler keep owning open/close for it — a
    // genuine outside click (the canvas, anywhere else) still dismisses.
    const stripRef = useRef<HTMLDivElement>(null);
    const mergedStripRef = useMemo(() => mergeRefs<HTMLDivElement>(ref, stripRef), [ref]);
    const { t } = useLocale();

    return (
      <>
        {/* The same landmark the wide branch gets, for the same reason — but
            named with `aria-label`, not `aria-labelledby`. The heading here
            lives inside the Sheet, which is PORTALLED to `document.body` and
            unmounted while the sheet is closed, so an id reference would point
            at nothing in the rail's resting state. The computed name is
            identical either way. */}
        <aside
          // Runtime-safe cast; see the wide branch for why the published ref
          // type stays `HTMLDivElement`.
          ref={mergedStripRef as Ref<HTMLElement>}
          data-slot="context-rail"
          aria-label={activeSection?.label ?? t("ui.contextRail.empty")}
          className={cn(
            "flex h-full w-(--sidebar-width-icon) flex-col bg-sidebar text-sidebar-foreground",
            className,
          )}
          {...props}
        >
          <ContextRailSwitcher
            sections={sections}
            activeId={activeId}
            onSelect={onSelect}
            orientation="column"
          />
        </aside>
        {/* `modal={false}`: the 48px strip is a PERSISTENT sibling of this
            sheet, not part of it — Radix's default modal behaviour hides
            every body sibling from assistive tech and traps focus inside
            the dialog while open, which would make the always-visible
            switcher strip unreachable to a screen reader the moment the
            sheet opens. Non-modal keeps the strip operable throughout (and,
            per Radix, means DialogOverlay renders nothing — the panel itself
            is the only thing that can be occluding the strip). */}
        <Sheet open={open} onOpenChange={setOpen} modal={false}>
          <SheetContent
            side="right"
            onPointerDownOutside={(event) => {
              if (event.target instanceof Node && stripRef.current?.contains(event.target)) {
                event.preventDefault();
              }
            }}
            // The strip is a REAL, non-portalled DOM descendant of the nested
            // provider, so `right-0`/`w-3/4`/`max-w-sm` from `sheetVariants`
            // would seat this portalled panel directly on top of it (both
            // anchored to the same right edge, panel wider than the strip).
            // Inset by exactly the strip width so both stay hittable — never
            // hide the strip, never move the switcher into the sheet (ADR
            // 0035 §3: "The collapsed icon strip survives at every viewport
            // width"). MEASURED (fix round 1, task-9b-fix-1.md): this repo's
            // pinned `tailwind-merge@^2.6.0` predates Tailwind v4's `(--var)`
            // parens shorthand and does not recognize it as an arbitrary
            // value for the `right`/`w` groups — `right-(--sidebar-width-icon)`
            // and `w-(--sidebar-width)` were silently left UN-deduped against
            // `sheetVariants`' own `right-0`/`w-3/4` (both ended up in the
            // merged class list, letting the ORIGINAL literal win the
            // cascade — the exact bug this fix exists to close). The bracket
            // form with an explicit `var()` call — already proven to merge
            // correctly two tokens later in this same string, where
            // `max-w-[calc(100vw-var(--sidebar-width-icon))]` DOES dedupe
            // against `max-w-sm` — is what tailwind-merge v2 actually
            // recognizes, so `right`/`w` use that form too.
            className="right-[var(--sidebar-width-icon)] flex w-[var(--sidebar-width)] max-w-[calc(100vw-var(--sidebar-width-icon))] flex-col bg-sidebar p-0 text-sidebar-foreground"
            style={
              {
                // Redeclared here, not inherited — see `ContextRailNarrowProps.width`'s
                // doc comment above for why a portal needs its own copy.
                "--sidebar-width": width,
                "--sidebar-width-icon": NARROW_STRIP_WIDTH,
              } as CSSProperties
            }
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{activeSection?.label ?? ""}</SheetTitle>
              <SheetDescription>
                Displays the context rail&rsquo;s expanded content.
              </SheetDescription>
            </SheetHeader>
            {hasSections && activeSection ? (
              <>
                {/* A real heading for the same reason as the wide branch. The
                    Sheet's own name comes from the `sr-only` `SheetTitle`
                    above; this is the visible heading the body sits under. */}
                <h2
                  data-slot="context-rail-heading"
                  className="border-b border-border-strong px-4 py-3 text-title"
                >
                  {activeSection.label}
                </h2>
                <div
                  data-slot="context-rail-body"
                  // Focusable because it scrolls; `focus-ring-inset` because the
                  // Sheet panel clips anything drawn outside this box. See the
                  // wide branch for the full rationale.
                  tabIndex={0}
                  className="min-h-0 flex-1 overflow-y-auto p-4 focus-ring-inset"
                >
                  {activeSection.content}
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1">{empty}</div>
            )}
          </SheetContent>
        </Sheet>
      </>
    );
  },
);

/**
 * A right-hand rail whose collapsed state is a 48px icon strip that doubles
 * as its own section switcher. Built on `Sidebar`/`SidebarProvider`
 * (`frame="nested"`, ADR 0035 §4) as an implementation detail — the public
 * seam is `sections` + `activeSectionId`/`onActiveSectionChange` (which
 * section) and `open`/`onOpenChange` (expanded or collapsed), both
 * controlled/uncontrolled. Below `overlayBreakpoint` it renders its own
 * strip plus a `Sheet` instead of mounting `Sidebar`. See
 * `docs/ADR/0035-context-rail-and-side-dock.md` §3.
 *
 * Known constraint (task-11f-brief.md Finding 5): below `overlayBreakpoint`
 * the expanded body is a `Sheet`, which always spans the full browser
 * viewport, while the persistent 48px strip is bounded by whatever container
 * the host gives the rail. In a host container shorter than the viewport
 * (any app shell with a toolbar above the rail), the strip stops mid-screen
 * while the sheet keeps going — the two read as unrelated surfaces. Give
 * `ContextRail` a full-viewport-height host container below the breakpoint
 * to avoid this seam.
 */
export const ContextRail = forwardRef<HTMLDivElement, ContextRailProps>(function ContextRail(
  {
    sections,
    activeSectionId,
    defaultActiveSectionId,
    onActiveSectionChange,
    open,
    defaultOpen,
    onOpenChange,
    width = DEFAULT_WIDTH,
    empty,
    overlayBreakpoint = DEFAULT_OVERLAY_BREAKPOINT,
    className,
    style,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const isControlled = activeSectionId !== undefined;
  const [internalActiveId, setInternalActiveId] = useState<string | undefined>(
    () => defaultActiveSectionId ?? sections[0]?.id,
  );
  const activeId = resolveActiveId(sections, isControlled ? activeSectionId : internalActiveId);
  const activeSection = sections.find((section) => section.id === activeId);
  const hasSections = sections.length > 0;

  const handleSelect = useCallback(
    (id: string) => {
      if (!isControlled) setInternalActiveId(id);
      onActiveSectionChange?.(id);
    },
    [isControlled, onActiveSectionChange],
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && overlayBreakpoint < 768) {
      // oxlint-disable-next-line no-console
      console.warn(
        `ContextRail: "overlayBreakpoint" (${overlayBreakpoint}) is below 768px. The rail's ` +
          "overlay/Sheet presentation is meant for viewports narrower than the app shell's own " +
          "mobile breakpoint — a lower value can flip the rail to its overlay presentation " +
          "before the rest of the app shell does.",
      );
    }
  }, [overlayBreakpoint]);

  const isNarrow = useIsMobile(overlayBreakpoint);

  // Finding 4 (task-11f-brief.md): `StatePanel`'s `empty` variant paints
  // `bg-surface` — a CONTENT-canvas token — which is correct for every other
  // consumer but wrong here: this slot sits inside `--sidebar` CHROME, and in
  // the `light` reference theme `--surface` reads as a near-white rectangle
  // against the rail's own dark ground. Fixed at this call site only (never
  // in `state-panel.tsx`, which stays canvas-tuned for its other consumers):
  // `bg-sidebar-accent` moves the panel onto a sidebar-family surface (no new
  // token minted), and the `--foreground` / `--muted-foreground` custom-
  // property retarget makes `StatePanel`'s own (unexported)
  // `text-foreground`/`text-muted-foreground` title and description ink
  // resolve against the RAIL's ink instead of the page's — in `light`,
  // `--foreground` and `--sidebar` are the same colour, so without this the
  // title would render at ~1.3:1 against its own background. Same idiom as
  // `focus-ring [--focus-ring-color:…]` elsewhere in this package: retarget
  // the variable the shared component already reads, don't fork the
  // component.
  //
  // Fix round 1 (task-11f-fix-1.md, Moderate M1): this block used to also add
  // `border-sidebar-border`. Measured against the `bg-sidebar-accent` fill
  // above, that border read at 1.09:1 (light) / 1.07:1 (dark) — effectively
  // invisible, and a pairing no other Sidebar-family surface uses (every
  // other use of `--sidebar-border` sits on the ambient `--sidebar` chrome,
  // not on this fill).
  //
  // Fix round 2 (task-11f-fix-2.md, Finding B): dropping the colour class
  // wasn't enough — `StatePanel`'s OWN `border border-dashed` still rendered,
  // falling through to the base `--border` token instead of a sidebar one.
  // Measured: 7.56:1 (light) — a canvas-tuned border drawing inside sidebar
  // chrome, a semantic mismatch — and 1.15:1 (dark) — still effectively
  // invisible, M1's original problem reached through a different token. Fixed
  // by removing the border ELEMENT itself, not just its colour: `border-0`
  // here (call-site `className`, merged last by `cn()`) beats `StatePanel`'s
  // own `border border-dashed` with no edit to the shared component and no
  // effect on any other consumer. The fill (`bg-sidebar-accent`) plus the
  // title/description ink retargets are left exactly as they were — verified
  // by eye in both `layout-context-rail--empty` theme slugs that the panel
  // still reads as a bounded region on fill and title alone.
  const emptyContent = empty ?? (
    <StatePanel
      kind="empty"
      title={t("ui.contextRail.empty")}
      className="border-0 bg-sidebar-accent [--foreground:var(--sidebar-foreground)] [--muted-foreground:var(--sidebar-muted-foreground)]"
    />
  );
  const emptySlot = <div data-slot="context-rail-empty">{emptyContent}</div>;

  return (
    <SidebarProvider
      frame="nested"
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      style={{ "--sidebar-width": width } as CSSProperties}
    >
      {isNarrow ? (
        <ContextRailNarrow
          ref={ref}
          sections={sections}
          activeId={activeId}
          activeSection={activeSection}
          onSelect={handleSelect}
          empty={emptySlot}
          hasSections={hasSections}
          width={width}
          className={className}
          style={style}
          {...props}
        />
      ) : (
        // `variant` is hardcoded, not a public prop (#382) — see the doc
        // comment on `ContextRailProps` above.
        <Sidebar side="right" collapsible="icon" variant="sidebar">
          <ContextRailWide
            ref={ref}
            sections={sections}
            activeId={activeId}
            activeSection={activeSection}
            onSelect={handleSelect}
            empty={emptySlot}
            hasSections={hasSections}
            className={className}
            style={style}
            {...props}
          />
        </Sidebar>
      )}
    </SidebarProvider>
  );
});
