/**
 * Terminal session — idle (copy-owned block).
 *
 * A settled coding-agent console, assembled entirely from
 * @elabs-ai/components-terminal: a launch banner, a transcript (short by
 * default — pass an empty `initialTranscript` for the empty-session state), a
 * composer with a mode and an effort indicator, and a status bar. Nothing is
 * running; this is the "you just opened it" moment. A parallel unit renders
 * the same console inside an app shell as
 * `Patterns/Templates/Terminal Agent Session` — this block is the console
 * alone, full-bleed.
 *
 * `modes`/`effortLevels` and every string below are entirely app-supplied —
 * edit them to match your own product's vocabulary.
 */
"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  TerminalBanner,
  TerminalComposer,
  TerminalConsole,
  TerminalStatusBar,
  TerminalSurface,
  TerminalTranscriptRow,
  type TerminalTranscriptRowKind,
} from "@elabs-ai/components-terminal";
import { BookOpenIcon, SearchIcon, TerminalSquareIcon } from "lucide-react";

interface TranscriptEntry {
  id: string;
  kind: TerminalTranscriptRowKind;
  text: string;
}

const MODES = [
  { id: "auto", label: "Auto", description: "Acts on its own judgment.", keyHint: "⇧Tab" },
  { id: "plan", label: "Plan first", description: "Proposes a plan before acting." },
];

const EFFORT_LEVELS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const DEFAULT_TRANSCRIPT: TranscriptEntry[] = [
  { id: "1", kind: "user", text: "Summarize the open pull requests" },
  { id: "2", kind: "agent", text: "There are no open pull requests right now." },
];

export interface TerminalSessionIdleProps {
  /** Seed transcript. Pass an empty array to render the empty-session state. */
  initialTranscript?: TranscriptEntry[];
}

export function TerminalSessionIdle({
  initialTranscript = DEFAULT_TRANSCRIPT,
}: TerminalSessionIdleProps) {
  const [transcript, setTranscript] = useState(initialTranscript);

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
  }, [transcript]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-4xl flex-col bg-background p-4">
      {/*
       * ADR 0033: the console is ONE frame. `TerminalConsole` draws the edge,
       * radius, ground and lift once; the banner, transcript, composer and
       * status bar sit inside it as flush regions separated by a single seam.
       * The outer element keeps the page's padding and ground — and carries no
       * `gap-*`, which would put a strip of page background between two regions
       * of the same window.
       */}
      <TerminalConsole className="min-h-0 flex-1">
        <TerminalBanner
          // This block is a standalone full-bleed page (no surrounding app
          // shell owns an `<h1>` of its own here), so the banner's title is
          // promoted to the page's one top-level heading.
          level={1}
          title="Console Agent"
          model="gpt-5.1-codex"
          version="v2.4.0"
          workspace="~/projects/acme-web"
          logo={
            <TerminalSquareIcon
              aria-hidden="true"
              className="size-5 text-terminal-ansi-bright-green"
            />
          }
          capabilities={[
            {
              label: "Read and edit files",
              description: "Across the whole workspace",
              icon: <BookOpenIcon />,
            },
            { label: "Web search", icon: <SearchIcon /> },
          ]}
          quickActions={[
            { label: "New session", keyHint: "⌘N", onSelect: () => setTranscript([]) },
          ]}
        />
        {/*
         * `mt-auto` on the first child bottom-anchors the transcript, so short
         * content sits just above the composer the way a real terminal's cursor
         * does. Deliberately NOT `justify-end`: that anchors identically but
         * strands overflow at the START of a scroll container (Chrome leaves
         * `scrollHeight === clientHeight` and the earliest rows become
         * unreachable).
         */}
        <TerminalSurface
          ref={transcriptRef}
          aria-label="Transcript"
          className="min-h-0 flex-1 overflow-y-auto [&>*:first-child]:mt-auto"
        >
          {transcript.length === 0 ? (
            <p className="text-terminal-muted">No messages yet — type a prompt to begin.</p>
          ) : (
            transcript.map((entry) => (
              <TerminalTranscriptRow key={entry.id} kind={entry.kind}>
                {entry.text}
              </TerminalTranscriptRow>
            ))
          )}
        </TerminalSurface>
        <TerminalComposer
          modes={MODES}
          effortLevels={EFFORT_LEVELS}
          effortLabel="Reasoning effort"
          onSubmit={(value) =>
            setTranscript((current) => [
              ...current,
              { id: crypto.randomUUID(), kind: "user", text: value },
            ])
          }
        />
        <TerminalStatusBar
          branch="main"
          workspace="~/projects/acme-web"
          connections={{ connected: 2, total: 2 }}
          context={{ used: "4K", limit: "200K" }}
        />
      </TerminalConsole>
    </div>
  );
}
