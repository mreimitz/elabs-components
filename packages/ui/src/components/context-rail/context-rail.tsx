"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";
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

export interface ContextRailProps extends Omit<
  ComponentProps<typeof Sidebar>,
  // `onSelect` is the native div text-selection event on `ComponentProps<typeof
  // Sidebar>` — omitted so it can't collide with this component's own
  // `onSelect`-shaped internals (`ContextRailBranchProps`) when `props` is
  // spread onto `ContextRailWide`/`ContextRailNarrow` below.
  "side" | "collapsible" | "children" | "onSelect"
> {
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
              {section.count != null && (
                <span
                  data-slot="context-rail-count"
                  aria-hidden="true"
                  className={
                    orientation === "row"
                      ? "ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1 text-meta text-sidebar-accent-foreground tabular-nums group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-end-1 group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:px-0.5"
                      : "absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-accent px-0.5 text-meta text-sidebar-accent-foreground tabular-nums"
                  }
                >
                  {section.count}
                </span>
              )}
            </SidebarMenuButton>
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

const ContextRailWide = forwardRef<HTMLDivElement, ContextRailBranchProps>(function ContextRailWide(
  { sections, activeId, activeSection, onSelect, empty, hasSections, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="context-rail"
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      {...props}
    >
      <ContextRailSwitcher
        sections={sections}
        activeId={activeId}
        onSelect={onSelect}
        orientation="row"
      />
      {hasSections && activeSection ? (
        <>
          <div
            data-slot="context-rail-heading"
            className="border-b border-border-strong px-4 py-3 text-title group-data-[collapsible=icon]:hidden"
          >
            {activeSection.label}
          </div>
          <div
            data-slot="context-rail-body"
            className="min-h-0 flex-1 overflow-y-auto p-4 group-data-[collapsible=icon]:hidden"
          >
            {activeSection.content}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">{empty}</div>
      )}
    </div>
  );
});

const ContextRailNarrow = forwardRef<HTMLDivElement, ContextRailBranchProps>(
  function ContextRailNarrow(
    { sections, activeId, activeSection, onSelect, empty, hasSections, className, ...props },
    ref,
  ) {
    const { open, setOpen } = useSidebar();

    return (
      <>
        <div
          ref={ref}
          data-slot="context-rail"
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
        </div>
        {/* `modal={false}`: the 48px strip is a PERSISTENT sibling of this
            sheet, not part of it — Radix's default modal behaviour hides
            every body sibling from assistive tech and traps focus inside
            the dialog while open, which would make the always-visible
            switcher strip unreachable to a screen reader the moment the
            sheet opens. Non-modal keeps the strip operable throughout. */}
        <Sheet open={open} onOpenChange={setOpen} modal={false}>
          <SheetContent
            side="right"
            className="flex w-(--sidebar-width) flex-col bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{activeSection?.label ?? ""}</SheetTitle>
              <SheetDescription>
                Displays the context rail&rsquo;s expanded content.
              </SheetDescription>
            </SheetHeader>
            {hasSections && activeSection ? (
              <>
                <div
                  data-slot="context-rail-heading"
                  className="border-b border-border-strong px-4 py-3 text-title"
                >
                  {activeSection.label}
                </div>
                <div data-slot="context-rail-body" className="min-h-0 flex-1 overflow-y-auto p-4">
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
    variant = "sidebar",
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

  const emptyContent = empty ?? <StatePanel kind="empty" title={t("ui.contextRail.empty")} />;
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
          className={className}
          style={style}
          {...props}
        />
      ) : (
        <Sidebar side="right" collapsible="icon" variant={variant}>
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
