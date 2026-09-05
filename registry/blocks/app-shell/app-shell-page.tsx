/**
 * The flagship app shell — four zones (nav rail, optional list column, content,
 * context rail) driven by one metrics module. See `shell-metrics.ts` for the
 * width/offset pattern and `nav-items.ts` for the router-agnostic nav data.
 *
 * Three sibling `SidebarProvider`s, one per collapsible zone — a single shared
 * provider would collapse them together, since it holds exactly one `open` flag.
 * Only the content zone's provider uses `frame="app"` (the ADR 0035 default); the
 * nav and list zones use `frame="nested"` so they don't ALSO register the global
 * ⌘B/Ctrl+B listener or write the `sidebar_state` cookie — a second `frame="app"`
 * provider anywhere in the document is an unguarded collision (ADR 0035 §4
 * "Watch for"), so this shell keeps exactly one.
 *
 * This task (13) wires the nav rail; the list column and context rail are real
 * zones in the metrics/state model but ship their content in later tasks — for
 * now they're inert placeholders sized off the same `--shell-*-w` custom
 * properties so the geometry is real and testable today.
 */
"use client";

import { useState } from "react";
import { SidebarInset, SidebarProvider, SkipLink } from "@elabs-ai/components-ui";
// This file installs at `app/(app)/page.tsx` (see the `fileOverrides` entry in
// registry.items.json) — outside `components/app-shell/`, so a relative import to a
// sibling in this source folder wouldn't resolve in the install tree. Use the
// consumer-side alias instead (see .claude/rules/registry.md "One copy of shared code").
import { AppNavRail } from "@/components/app-shell/app-nav-rail";
import { shellStyle, type ShellState } from "@/components/app-shell/shell-metrics";

export interface AppShellPageProps {
  /** Current route, forwarded to the nav rail for the active-state indicator. */
  activePath?: string;
}

export default function AppShellPage({ activePath = "/" }: AppShellPageProps) {
  const [navOpen, setNavOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);

  const state: ShellState = { nav: navOpen, list: listOpen, context: contextOpen };

  return (
    <div
      data-nav={navOpen ? "expanded" : "collapsed"}
      data-list={listOpen ? "expanded" : "collapsed"}
      data-context={contextOpen ? "expanded" : "collapsed"}
      style={shellStyle(state)}
      className="flex h-svh w-full bg-sidebar text-foreground"
    >
      <SkipLink />

      <SidebarProvider open={navOpen} onOpenChange={setNavOpen} frame="nested">
        <AppNavRail activePath={activePath} />
      </SidebarProvider>

      <SidebarProvider open={listOpen} onOpenChange={setListOpen} frame="nested">
        {listOpen ? (
          // Placeholder — Task 14's `app-list-column.tsx` renders the real list here.
          <div
            aria-hidden="true"
            className="hidden w-(--shell-list-w) shrink-0 border-e border-border md:block"
          />
        ) : null}
      </SidebarProvider>

      <SidebarProvider open={contextOpen} onOpenChange={setContextOpen} frame="app" variant="inset">
        <SidebarInset id="main-content" tabIndex={-1} gutter={{ start: true, bottom: true }}>
          <div className="p-6 text-body text-muted-foreground">
            Replace this with your page content.
          </div>
        </SidebarInset>
        {/* Placeholder — Task 14/15's ContextRail zone mounts here. */}
      </SidebarProvider>
    </div>
  );
}
