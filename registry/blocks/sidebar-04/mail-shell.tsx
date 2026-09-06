/**
 * The mail app shell — a three-zone VARIATION on the classic left-sidebar
 * dashboard, not a different idea. Zone 1 is the same collapsible icon rail
 * every shell in this registry uses; zones 2 and 3 split the content surface
 * into a message list and a reading pane.
 *
 * Reach for it when a screen's job is "pick one of many, then read the whole of
 * it" — mail, a review queue, an alert inbox, a document tray. When there is
 * nothing to pick between, `sidebar-02` (one nav, one content surface) is the
 * smaller shell. When the screen needs a panel on the RIGHT instead of a list on
 * the left, the flagship `app-shell` carries a summoned assistant dock and
 * `sidebar-02` carries a permanent details rail.
 *
 * ONE `SidebarProvider`. The rail is the only collapsible `Sidebar` here, so a
 * single provider owns the state — which is what makes `SidebarTrigger` in the
 * top bar and the frame's ⌘B/Ctrl+B shortcut the same control instead of two
 * things that can disagree.
 *
 * The content surface is FLUSH, like every shell in this family: no
 * `variant="inset"` on the provider or the rail. The rounded floating card is an
 * alternative look, not the house style — turning it on is a one-prop change on
 * both, and `SidebarInset` derives its margins from one `gutter` value inside
 * the library (sidebar.tsx, `SidebarInsetGutter`) so the two selectors cannot
 * race in the stylesheet.
 *
 * There is deliberately NO `shell-metrics.ts` here, unlike the flagship. That
 * file exists to publish widths as custom properties because the flagship's
 * zones live in SEPARATE provider subtrees and have to agree on an offset
 * neither one owns. Both zones here are siblings in one flex row, so the row
 * itself is the agreement and a width utility on the list column is the whole
 * story.
 */
"use client";

import { useState } from "react";
import { SidebarInset, SidebarProvider, SkipLink } from "@elabs-ai/components-ui";
import { MailListColumn } from "./mail-list-column";
import { MailNavRail } from "./mail-nav-rail";
import { MailReadingPane } from "./mail-reading-pane";
import { MailTopBar } from "./mail-top-bar";
import { DEMO_MESSAGES, messageHref, type MailMessage } from "./messages";

export interface MailShellProps {
  /** Current mailbox route, forwarded to the rail and the breadcrumb trail. */
  activePath?: string;
  /** Message open on first render. Omit for the no-selection state. */
  defaultSelectedId?: string;
  /** Render the chrome with an EMPTY content slot — the frame, nothing in it. */
  emptyContent?: boolean;
  /** Nav rail starts expanded. @default true */
  defaultSidebarOpen?: boolean;
  /** No renderable data yet — both zones show their own layout-shaped skeleton. */
  loading?: boolean;
  /** Heading over the list column — the mailbox being shown. @default "Inbox" */
  heading?: string;
  /**
   * The messages to list. A copy-own block takes data in and renders chrome
   * out; this defaults to the demo fixture beside it, so the block renders
   * believably before you have wired anything up. @default DEMO_MESSAGES
   */
  messages?: MailMessage[];
}

export default function MailShell({
  activePath = "/inbox",
  defaultSelectedId,
  emptyContent = false,
  defaultSidebarOpen = true,
  loading = false,
  heading = "Inbox",
  messages = DEMO_MESSAGES,
}: MailShellProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelectedId);
  const selected = messages.find((message) => message.id === selectedId);

  return (
    // `h-svh` pins the frame to the viewport so the scroll ports below own the
    // overflow instead of the page.
    // No `data-slot` of the shell's own here. `SidebarProvider` declares
    // `data-slot="sidebar-wrapper"` and spreads `...props` LAST, so passing one
    // in would DELETE the library's slot on this instance — and a copy-own
    // block is the thing people copy, so it must not teach that.
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="h-svh">
      <SkipLink />

      <MailNavRail activePath={activePath} />

      {/* `SidebarInset` renders the `<main>`, so the shell's one landmark and
          the skip link's target are the same element. `tabIndex={-1}` is what
          makes the skip actually move focus rather than only the scroll
          position. BOTH panes live inside it on purpose: the mobile drill-down
          hides one of the two, and hiding a zone that sat outside `<main>`
          would leave the phone layout with a landmark holding nothing. */}
      <SidebarInset id="main-content" tabIndex={-1} className="min-w-0 overflow-hidden">
        <MailTopBar
          activePath={activePath}
          trailing={
            selected ? { href: messageHref(selected.id), label: selected.subject } : undefined
          }
          onBack={() => setSelectedId(undefined)}
        />

        <div
          data-slot="mail-shell-panes"
          // The drill-down switch. Both zones read this ONE attribute through
          // `group-data-[reading=…]/mail:` variants, so "which zone owns the
          // phone screen" is a single source of truth rather than two class
          // lists that can disagree.
          data-reading={selected ? "open" : "closed"}
          className="group/mail flex min-h-0 flex-1"
        >
          {emptyContent ? null : (
            <>
              <MailListColumn
                messages={messages}
                selectedId={selectedId}
                onSelect={setSelectedId}
                loading={loading}
                heading={heading}
              />
              <MailReadingPane message={selected} loading={loading && Boolean(selected)} />
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
