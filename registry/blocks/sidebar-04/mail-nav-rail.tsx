/**
 * Zone 1 of three — the icon rail. A collapsible-icon `Sidebar` wired to the
 * router-agnostic `NAV_GROUPS`/`isPathActive` in `nav-items.ts`.
 *
 * This is the SAME rail the flagship (`app-shell`) and dashboard (`sidebar-02`)
 * shells use, deliberately: a mail client is not a different kind of product, it
 * is the classic left-sidebar shell with a second column between the nav and the
 * content. Copying the rail rather than inventing a mail-specific one is what
 * makes the three shells feel like one system.
 */
"use client";

import type { ComponentProps } from "react";
import { PenSquare } from "lucide-react";
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  NavUser,
} from "@elabs-ai/components-ui";
import { AppIcon } from "@elabs-ai/components-icons";
import { isPathActive, NAV_GROUPS } from "./nav-items";

export interface MailNavRailProps extends Omit<ComponentProps<typeof Sidebar>, "collapsible"> {
  /** Current route, for the active-state indicator (router-agnostic — see `nav-items.ts`). */
  activePath: string;
  /** Mailbox owner — the signed-in user in the footer account menu. */
  accountName?: string;
  /** Address under the owner's name in the footer account menu. */
  accountEmail?: string;
  /** Product name — the wordmark half of the brand lockup. @default "Northwind Mail" */
  productName?: string;
  /** Starts a new message. Wire it to your own composer. */
  onCompose?: () => void;
}

export function MailNavRail({
  activePath,
  accountName = "Ada Okonkwo",
  accountEmail = "ada@northwind.example",
  productName = "Northwind Mail",
  onCompose,
  className,
  ...props
}: MailNavRailProps) {
  return (
    <Sidebar collapsible="icon" className={className} {...props}>
      <SidebarHeader>
        <div className="flex min-w-0 flex-col gap-2 px-1 py-1">
          {/* The product mark, above the compose action. `AppIcon` is the
              library's own brand component — theme-correct on its own, and
              `morph="auto"` folds the lockup down to the glyph when this rail
              collapses. Re-brand by re-pointing the brand tokens. */}
          <div className="flex items-center group-data-[collapsible=icon]:justify-center">
            <AppIcon morph="auto" title={productName} height={22} />
          </div>
          {/* The one action a mail client must never hide. It keeps its icon in
              the collapsed rail (the label folds away with the rest of the
              rail's text) and stays a real, named control either way — the
              `sr-only` label is what carries the name once the word is gone. */}
          <Button
            size="sm"
            onClick={onCompose}
            className="w-full justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          >
            <PenSquare aria-hidden="true" />
            <span className="group-data-[collapsible=icon]:sr-only">Compose</span>
          </Button>
        </div>
      </SidebarHeader>

      {/* `display: contents` keeps the landmark in the a11y tree without adding a
          layout box that would break `SidebarContent`'s own flex/scroll sizing. */}
      <nav aria-label="Mailboxes" className="contents">
        <SidebarContent className="min-h-0 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const unread = item.unread ?? 0;
                    return (
                      // NEVER pass a `data-slot` of your own to `SidebarMenuItem`
                      // (or any library component that declares one): it spreads
                      // `...props` LAST, so yours would DELETE the library's
                      // `sidebar-menu-item` on this instance.
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isPathActive(item.href, activePath)}
                          tooltip={item.label}
                        >
                          {/* The count is folded into the link's accessible name
                              ON PURPOSE — "Inbox, 4 unread" — and it is AUTHORED
                              with `aria-label` rather than assembled out of an
                              `sr-only` sibling. Two reasons, both measured:
                              the visible badge below is
                              `group-data-[collapsible=icon]:hidden` inside the
                              library, so in the collapsed rail the number would
                              otherwise reach nobody at all; and a hidden span
                              concatenated into the name computes as
                              "Inbox , 4 unread" (name computation inserts a
                              separator at the element boundary), i.e. a name
                              nobody chose. WCAG 2.5.3 still holds — the visible
                              word is a prefix of the authored name. */}
                          <a
                            href={item.href}
                            aria-label={unread > 0 ? `${item.label}, ${unread} unread` : undefined}
                          >
                            <Icon />
                            <span>{item.label}</span>
                          </a>
                        </SidebarMenuButton>
                        {unread > 0 ? (
                          // `aria-hidden` because the same fact already reaches
                          // assistive tech through the link's name above;
                          // announcing it twice is noise.
                          <SidebarMenuBadge aria-hidden="true">{unread}</SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </nav>

      {/* The standard footer for every app shell: the signed-in user, which
          opens the account menu (Settings, Sign out). Settings lives in that
          menu, never as a loose row here. */}
      <SidebarFooter>
        <NavUser user={{ name: accountName, email: accountEmail }} settingsHref="/settings" />
      </SidebarFooter>
    </Sidebar>
  );
}
