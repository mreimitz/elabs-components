/**
 * Terminal session — mid-turn (copy-owned block).
 *
 * A coding-agent console under way, assembled entirely from
 * @elabs-ai/components-terminal: a transcript with tool calls and a diff
 * hunk, a working line that owns the turn's single stop affordance, a pending
 * permission prompt, a busy composer that still accepts a follow-up, and a
 * status bar.
 * Set `outcome="error"` to render the turn as a settled failure instead — the
 * working line and the permission prompt drop out (nothing is still running
 * or pending once a turn has failed) and a transcript error row takes their
 * place. A parallel unit renders the same console inside an app shell as
 * `Patterns/Templates/Terminal Agent Session` — this block is the console
 * alone, full-bleed.
 */
"use client";

import { useLayoutEffect, useRef } from "react";
import {
  TerminalComposer,
  TerminalConsole,
  TerminalDiffHunk,
  TerminalPermission,
  TerminalStatusBar,
  TerminalSurface,
  TerminalToolCall,
  TerminalTranscriptRow,
  TerminalWorking,
} from "@elabs-ai/components-terminal";
import type { DiffLine } from "@elabs-ai/components-ui";

const PRICING_DIFF: DiffLine[] = [
  {
    type: "context",
    oldNumber: 12,
    newNumber: 12,
    text: "export function formatPrice(cents: number) {",
  },
  { type: "del", oldNumber: 13, text: "  return `$${(cents / 100).toFixed(2)}`;" },
  {
    type: "add",
    newNumber: 13,
    text: '  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);',
  },
  { type: "context", oldNumber: 14, newNumber: 14, text: "}" },
];

export interface TerminalSessionMidTurnProps {
  /** Renders the turn as a settled failure instead of one still in progress. */
  outcome?: "working" | "error";
}

export function TerminalSessionMidTurn({ outcome = "working" }: TerminalSessionMidTurnProps) {
  const failed = outcome === "error";

  // Demo-only stub — wire this to your session's real stop/cancel transport.
  const handleStop = () => {};

  /*
   * Pin the transcript to its newest line, the way a real console does. The
   * package owns no scroll container by contract, so the viewport AND its
   * scroll position belong to the app — this block shows how. `useLayoutEffect`
   * so it lands before paint and the console never flashes the top first.
   */
  const transcriptRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [failed]);

  // A `<main>`, not a bare `<div>`: this block is a standalone full-bleed page
  // — the same reason its heading is a top-level one — so it owns the page's
  // main landmark rather than leaving a screen-reader user with no landmark to
  // jump to. If you paste this into an app shell that already renders a
  // `<main>`, demote this one to a `<div>`: nested landmarks are worse than
  // none.
  return (
    <main className="mx-auto flex h-dvh w-full max-w-4xl flex-col bg-background p-4">
      {/*
       * The idle sibling block gets its top-level heading for free by promoting
       * its `TerminalBanner` title (`level={1}`). A mid-turn console has no
       * banner — the session is already under way — so without this the page
       * has no heading at all and heading navigation lands on nothing. Visually
       * hidden, because the console's own chrome already tells a sighted reader
       * where they are.
       */}
      <h1 className="sr-only">Console Agent session</h1>
      {/*
       * ADR 0033: the console is ONE frame. `TerminalConsole` draws the edge,
       * radius, ground and lift once; the transcript, working line, permission
       * prompt, composer and status bar sit inside it as flush regions separated by a single seam.
       * The outer element keeps the page's padding and ground — and carries no
       * `gap-*`, which would put a strip of page background between two regions
       * of the same window.
       */}
      <TerminalConsole className="min-h-0 flex-1">
        {/*
         * `mt-auto` on the first child bottom-anchors the transcript, so short
         * content sits just above the composer the way a real terminal's cursor
         * does — most visible on the `error` outcome, whose transcript is
         * shorter than the `working` one. Deliberately NOT `justify-end`: that
         * anchors identically but strands overflow at the START of a scroll
         * container (Chrome leaves `scrollHeight === clientHeight` and the
         * earliest rows become unreachable).
         */}
        <TerminalSurface
          ref={transcriptRef}
          aria-label="Transcript"
          className="min-h-0 flex-1 overflow-y-auto [&>*:first-child]:mt-auto"
        >
          <TerminalTranscriptRow kind="user">
            Fix the currency formatting bug in the pricing helper
          </TerminalTranscriptRow>
          <TerminalTranscriptRow kind="agent">Reading src/lib/pricing.ts</TerminalTranscriptRow>

          <TerminalToolCall
            toolName="Read"
            argument="src/lib/pricing.ts"
            status="success"
            summary="42 lines"
          />

          <TerminalDiffHunk
            file="src/lib/pricing.ts"
            summary="Use Intl.NumberFormat instead of manual string concatenation"
            lines={PRICING_DIFF}
          />

          <TerminalToolCall
            toolName="Bash"
            argument="pnpm test pricing"
            status={failed ? "error" : "pending"}
            summary={failed ? "formatPrice(1050) returned “$10.5” — 1 failing test" : undefined}
          />

          {failed ? (
            <TerminalTranscriptRow kind="error">Turn stopped: 1 failing test</TerminalTranscriptRow>
          ) : (
            <TerminalWorking
              label="Waiting for your approval to run the test suite…"
              elapsedMs={18000}
              tokens={2400}
              onStop={handleStop}
              stopShortcut="Esc"
            />
          )}
        </TerminalSurface>
        {failed ? null : <TerminalPermission preview="pnpm test pricing" />}
        {/*
         * ADR 0022 case 4: `busy` with no `onStop`. The `TerminalWorking` line above
         * owns cancellation, so the composer must not render a second control with
         * the same accessible name — it stays a Send that accepts a follow-up.
         */}
        <TerminalComposer busy={!failed} />
        <TerminalStatusBar
          branch="fix/currency-formatting"
          workspace="~/projects/acme-web"
          connections={{ connected: 2, total: 3, connecting: !failed }}
          context={{ used: "18K", limit: "200K" }}
          turn={{ current: 2, total: 4 }}
        />
      </TerminalConsole>
    </main>
  );
}
