"use client";

import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { TerminalRow, type TerminalRowProps } from "./terminal-row";

/**
 * TerminalTranscriptRow — one line of an agent transcript, on top of
 * `TerminalRow` (#117 T2).
 *
 * A reader scanning a session must be able to tell, at a glance, WHO spoke
 * (`user` vs `agent`), what plain output the agent produced (`output`), and
 * whether something failed (`error`) — and a screen-reader user must get the
 * same three facts. `kind` is the closed axis that carries that meaning; it
 * is expressed as a glyph, an `sr-only` label (via `TerminalRow`'s
 * `gutterLabel`) and, redundantly, a colour — never colour alone
 * (`.claude/rules/accessibility.md` § "Colour is never the only channel").
 *
 * Ground truth (verified against real captures, 2026-09-01): `⏺` is the
 * agent's status marker and `⎿` is the result/continuation branch marker.
 * We take the GRAMMAR, never the palette — every colour here comes from the
 * `--terminal-ansi-*` group, not a vendor's hardcoded hex.
 *
 * `error` is the state-grid's turn-error rung: `role="alert"`, fired only for
 * a SETTLED, terminal failure. This component has no `isStreaming` of its
 * own — it renders whatever `kind` the caller passes, so suppressing an error
 * while a turn is still arriving is the caller's job (render an `output`/
 * `agent` row until the turn settles, then swap to `error`), exactly as
 * `.claude/rules/loading-states.md` asks.
 */

/** The closed set of transcript-line roles. */
export type TerminalTranscriptRowKind = "user" | "agent" | "output" | "error";

export const TERMINAL_TRANSCRIPT_ROW_KINDS: readonly TerminalTranscriptRowKind[] = [
  "user",
  "agent",
  "output",
  "error",
];

/**
 * The gutter glyph per kind. Decorative on its own (`TerminalRow` hides a
 * bare glyph from assistive tech) — `gutterLabel` below is what actually
 * carries the meaning to a screen reader.
 */
const GUTTER_GLYPH: Record<TerminalTranscriptRowKind, string> = {
  user: ">",
  agent: "⏺",
  output: "⎿",
  // A distinct glyph from `output`'s `⎿` — `error` must never share a glyph
  // with a non-error rung, or the greyscale reader loses the distinction.
  error: "✗",
};

/** `messages.ts` keys for each kind's announced label. */
const GUTTER_LABEL_KEY: Record<TerminalTranscriptRowKind, string> = {
  user: "terminal.transcriptRow.user",
  agent: "terminal.transcriptRow.agent",
  output: "terminal.transcriptRow.output",
  error: "terminal.transcriptRow.error",
};

export const terminalTranscriptRowVariants = cva("", {
  variants: {
    kind: {
      user: "",
      agent: "",
      // Plain program output reads a rung dimmer than agent prose, matching
      // the console's own `ansi-bright-black`/`muted` chrome convention.
      output: "text-terminal-muted",
      // The colour is a REDUNDANT cue — the distinct glyph plus the
      // `gutterLabel` word already carry the meaning in greyscale.
      error: "text-terminal-ansi-red",
    },
  },
  defaultVariants: {
    kind: "user",
  },
});

export interface TerminalTranscriptRowProps
  extends
    Omit<TerminalRowProps, "gutter" | "gutterLabel">,
    VariantProps<typeof terminalTranscriptRowVariants> {
  /**
   * The process exit code for a settled `output`/`error` line. Modelled as
   * data — the component formats the affordance ("exit 1") — never a
   * caller-formatted string. Ignored on `user`/`agent` kinds, which have no
   * exit status of their own.
   */
  exitCode?: number;
}

export const TerminalTranscriptRow = forwardRef<HTMLDivElement, TerminalTranscriptRowProps>(
  function TerminalTranscriptRow({ kind, exitCode, role, className, children, ...props }, ref) {
    const { t } = useLocale();
    const resolvedKind = kind ?? "user";
    const showExitCode =
      exitCode !== undefined && (resolvedKind === "output" || resolvedKind === "error");

    return (
      <TerminalRow
        ref={ref}
        data-slot="terminal-transcript-row"
        data-kind={resolvedKind}
        gutter={GUTTER_GLYPH[resolvedKind]}
        gutterLabel={t(GUTTER_LABEL_KEY[resolvedKind])}
        // A settled, terminal failure only — never while a turn is streaming.
        // The caller decides WHEN to render `kind="error"`; this is the
        // resulting semantic once they do.
        role={role ?? (resolvedKind === "error" ? "alert" : undefined)}
        className={cn(terminalTranscriptRowVariants({ kind: resolvedKind }), className)}
        {...props}
      >
        {children}
        {showExitCode ? (
          <div data-slot="terminal-transcript-row-exit-code" className="mt-0.5 text-terminal-muted">
            {t("terminal.transcriptRow.exitCode", { code: exitCode })}
          </div>
        ) : null}
      </TerminalRow>
    );
  },
);

TerminalTranscriptRow.displayName = "TerminalTranscriptRow";
