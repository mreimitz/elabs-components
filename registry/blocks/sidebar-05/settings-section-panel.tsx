/**
 * The contextual second panel — the inner half of the dual rail.
 *
 * This one IS a `Sidebar`, and that is the whole point of splitting the two
 * rails: the panel is the half you put away, so it gets the library's
 * collapse-and-become-a-sheet behaviour for free (offcanvas column at `md` and
 * up, `Sheet` below it), while the icon rail beside it stays put at every
 * width. One `SidebarTrigger` in the top bar and the frame's own ⌘B therefore
 * drive exactly this panel, because the shell has exactly one
 * `SidebarProvider`.
 *
 * The panel is FLUSH, like every zone in this family — no `variant="inset"`
 * here and none on the shell's provider. The rounded floating card is an
 * alternative look, not the house style; turning it on means setting the
 * variant in BOTH places, since `SidebarInset` derives its margins from one
 * `gutter` value inside the library (ADR 0035 / #342) precisely so the two
 * selectors cannot race in the stylesheet.
 *
 * Ink is CHROME ink throughout (`text-sidebar-foreground` /
 * `text-sidebar-muted-foreground`), never canvas ink: `bg-sidebar` is a DARK
 * ground in the `light` reference theme, so canvas `text-muted-foreground` on
 * it is a real 1.4.3 failure, not a nuance. Same reason the empty state below
 * is written out instead of reaching for `StatePanel`, which is canvas-inked.
 */
"use client";

import type { ComponentProps } from "react";
import {
  cn,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@elabs-ai/components-ui";
import { sectionHref, type SettingsArea } from "./nav-items";

export interface SettingsSectionPanelProps extends Omit<
  ComponentProps<typeof Sidebar>,
  "collapsible" | "variant"
> {
  /** The area whose sections this panel lists. */
  area: SettingsArea;
  /** Route of the section currently open in the content pane, if any. */
  activePath: string;
  /** Fires with `{ areaId, sectionId }` when a row is chosen. */
  onSectionSelect: (areaId: string, sectionId: string) => void;
  /** No sections have arrived yet — render skeleton rows in their place. */
  loading?: boolean;
}

/**
 * The row's announced name, authored rather than accumulated. Left to the DOM
 * the name would be "<label><summary><count>" with no separators and no word
 * for what the number means — a name nobody chose (see
 * .claude/rules/accessibility.md). The count is IN the name on purpose: it is
 * the reason to open that section.
 */
function rowAccessibleName(label: string, summary: string, attention: number | undefined): string {
  const base = `${label}. ${summary}.`;
  if (!attention) return base;
  const noun = attention === 1 ? "setting" : "settings";
  return `${base} ${attention} ${noun} waiting on a decision.`;
}

export function SettingsSectionPanel({
  area,
  activePath,
  onSectionSelect,
  loading = false,
  className,
  ...props
}: SettingsSectionPanelProps) {
  return (
    <Sidebar collapsible="offcanvas" className={className} {...props}>
      <SidebarHeader className="gap-0.5 px-4 py-3">
        <span className="text-title text-sidebar-foreground">{area.label}</span>
        <span className="text-meta text-sidebar-muted-foreground">
          {area.sections.length} {area.sections.length === 1 ? "section" : "sections"}
        </span>
      </SidebarHeader>

      {/* `display: contents` keeps the landmark in the a11y tree without adding
          a layout box that would break `SidebarContent`'s flex/scroll sizing —
          the same trick the flagship `app-shell` block uses for its rail. */}
      <nav aria-label={`${area.label} settings`} className="contents">
        <SidebarContent className="min-h-0 overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {loading ? (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon={false} />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon={false} />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon={false} />
                    </SidebarMenuItem>
                  </>
                ) : area.sections.length === 0 ? (
                  <li className="px-2 py-6 text-body text-sidebar-muted-foreground">
                    Nothing to configure in {area.label} yet.
                  </li>
                ) : (
                  area.sections.map((section) => {
                    const href = sectionHref(area.id, section.id);
                    const isActive = href === activePath;
                    return (
                      <SidebarMenuItem key={section.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          // Two lines plus a badge do not fit the menu
                          // button's fixed `h-8` row, so the height and the
                          // stacking are overridden here rather than a second
                          // row primitive being invented.
                          className="h-auto flex-col items-start gap-0.5 px-2 py-2"
                        >
                          <a
                            href={href}
                            aria-current={isActive ? "page" : undefined}
                            aria-label={rowAccessibleName(
                              section.label,
                              section.summary,
                              section.attention,
                            )}
                            onClick={(event) => {
                              // The block owns no router. Swap this element for
                              // your `<Link>` and delete the handler.
                              event.preventDefault();
                              onSectionSelect(area.id, section.id);
                            }}
                          >
                            <span className="flex w-full items-center gap-2">
                              <span className="min-w-0 flex-1 truncate">{section.label}</span>
                              {section.attention ? (
                                // A COUNT, not a status mark. The status fill
                                // rung is guaranteed >=3:1 against the canvas
                                // surfaces only — never against `--sidebar`,
                                // which is dark chrome in `light` — so the
                                // coloured attention mark lives in the content
                                // pane and the chrome carries a neutral badge.
                                <span
                                  aria-hidden="true"
                                  className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-accent px-1 text-meta text-sidebar-accent-foreground tabular-nums"
                                >
                                  {section.attention}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={cn(
                                "line-clamp-1 w-full text-meta",
                                isActive
                                  ? "text-sidebar-accent-foreground"
                                  : "text-sidebar-muted-foreground",
                              )}
                            >
                              {section.summary}
                            </span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </nav>
    </Sidebar>
  );
}
