/**
 * terminal-working.test.tsx — smoke + accessibility lock for the in-turn
 * footer row (#117 T3).
 *
 * The load-bearing assertion in this file is `announces the label through
 * exactly one live region, not the ticking stats` — it targets a real
 * accessibility contract (loading-states.md's "announce the state once at
 * the region, never per box/tick"), not merely that two class strings
 * differ. Verified non-vacuous by hand while authoring it: deleting the live
 * region from the implementation fails the "exactly one role=status" half,
 * and changing it to announce the elapsed string instead of `label` fails
 * the "announces the WORDS" half — see the session notes for the two runs.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  TERMINAL_WORKING_ACTIVE_GLYPH,
  TERMINAL_WORKING_SPINNER_FRAMES,
  TerminalWorking,
} from "./terminal-working";

describe("TerminalWorking", () => {
  it("renders the shared default label when none is given", () => {
    render(<TerminalWorking />);
    expect(screen.getAllByText("Waiting for response…").length).toBeGreaterThan(0);
  });

  it("renders a caller-supplied label instead of the default", () => {
    render(<TerminalWorking label="Refactoring the parser…" />);
    expect(screen.getAllByText("Refactoring the parser…").length).toBeGreaterThan(0);
    expect(screen.queryByText("Waiting for response…")).not.toBeInTheDocument();
  });

  describe("the live-region discipline", () => {
    it("announces the label through exactly one live region, not the ticking stats", () => {
      const { container } = render(
        <TerminalWorking elapsedMs={5000} label="Compiling…" tokens={1200} />,
      );

      // Exactly one announcement for the whole row — one per box (or one for
      // the elapsed counter) would flood assistive tech on every re-render.
      const live = container.querySelectorAll("[role='status']");
      expect(live).toHaveLength(1);
      expect(live[0]).toHaveAttribute("aria-live", "polite");
      // It carries the WORDS the row is doing, not the ticking elapsed value.
      expect(live[0]).toHaveTextContent("Compiling…");
      expect(live[0]).not.toHaveTextContent("5.0s");
    });

    it("keeps the elapsed and token counters out of the live region entirely", () => {
      const { container } = render(<TerminalWorking elapsedMs={5000} tokens={1200} />);
      expect(container.querySelector("[data-slot='terminal-working-elapsed']")).not.toHaveAttribute(
        "aria-live",
      );
      expect(container.querySelector("[data-slot='terminal-working-tokens']")).not.toHaveAttribute(
        "aria-live",
      );
    });
  });

  it("formats elapsed time via the shared formatElapsed, not a second formatter", () => {
    // formatElapsed(5000) === "5.0s" (packages/ui/src/lib/format-duration.ts).
    render(<TerminalWorking elapsedMs={5000} />);
    expect(screen.getByText("5.0s")).toBeInTheDocument();
  });

  it("omits the elapsed slot entirely when elapsedMs is not given", () => {
    const { container } = render(<TerminalWorking />);
    expect(container.querySelector("[data-slot='terminal-working-elapsed']")).toBeNull();
  });

  it("renders the token count with the download-token marker, through useLocale().formatNumber", () => {
    render(<TerminalWorking tokens={1200} />);
    // Intl.NumberFormat's compact notation renders 1200 as "1.2K" in en-US.
    expect(screen.getByText(/⇣\s*1\.2K/)).toBeInTheDocument();
  });

  describe("the stop control", () => {
    it("renders no stop control when onStop is not given", () => {
      render(<TerminalWorking />);
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    });

    it("renders a focusable stop control that fires onStop", async () => {
      const onStop = vi.fn();
      render(<TerminalWorking onStop={onStop} />);
      const button = screen.getByRole("button", { name: "Stop" });
      button.click();
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it("renders the caller-supplied shortcut hint beside the stop control, never inventing one", () => {
      const { rerender } = render(<TerminalWorking onStop={() => {}} stopShortcut="Esc" />);
      expect(screen.getByText("Esc")).toBeInTheDocument();

      rerender(<TerminalWorking onStop={() => {}} />);
      expect(screen.queryByText("Esc")).not.toBeInTheDocument();
    });
  });

  describe("scroll to bottom", () => {
    it("renders no scroll-to-bottom control by default", () => {
      render(<TerminalWorking />);
      expect(screen.queryByRole("button", { name: "Scroll to bottom" })).not.toBeInTheDocument();
    });

    it("renders a focusable scroll-to-bottom control that fires its handler", () => {
      const onScrollToBottom = vi.fn();
      render(<TerminalWorking onScrollToBottom={onScrollToBottom} showScrollToBottom />);
      const button = screen.getByRole("button", { name: "Scroll to bottom" });
      button.click();
      expect(onScrollToBottom).toHaveBeenCalledTimes(1);
    });
  });

  describe("isStreaming — spinner vs. active-tool glyph", () => {
    it("shows every spinner frame, hidden from assistive tech, while waiting (the default)", () => {
      const { container } = render(<TerminalWorking />);
      const gutter = container.querySelector("[data-slot='terminal-row-gutter']");
      for (const frame of TERMINAL_WORKING_SPINNER_FRAMES) {
        expect(gutter).toHaveTextContent(frame);
      }
      expect(gutter).not.toHaveTextContent(TERMINAL_WORKING_ACTIVE_GLYPH);
      // The whole gutter cell is aria-hidden by TerminalRow — the glyph is
      // decorative, and the live region above carries the real announcement.
      expect(gutter?.querySelector("[aria-hidden='true']")).not.toBeNull();
    });

    it("substitutes the solid diamond once content is actively streaming", () => {
      const { container } = render(<TerminalWorking isStreaming />);
      const gutter = container.querySelector("[data-slot='terminal-row-gutter']");
      expect(gutter).toHaveTextContent(TERMINAL_WORKING_ACTIVE_GLYPH);
      for (const frame of TERMINAL_WORKING_SPINNER_FRAMES) {
        expect(gutter).not.toHaveTextContent(frame);
      }
    });
  });

  it("freezes the spinner animation under reduced motion via a motion-reduce: utility, never a raw duration", () => {
    const { container } = render(<TerminalWorking />);
    const frames = container.querySelector("[data-slot='terminal-working-spinner'] > span");
    expect(frames?.className).toContain("motion-reduce:animate-none");
  });

  it("lets a row render legibly with no surrounding TerminalSurface", () => {
    render(<TerminalWorking />);
    expect(
      screen.getAllByText("Waiting for response…")[0]?.closest("[data-slot='terminal-working']"),
    ).toHaveAttribute("data-variant", "marker");
  });

  it("wraps long labels instead of overflowing the row", () => {
    // Inherited from TerminalRow's grid — locked here too so a future edit
    // that swaps the content wrapper can't silently drop it.
    const { container } = render(<TerminalWorking />);
    expect(container.querySelector("[data-slot='terminal-row-content']")?.className).toContain(
      "min-w-0",
    );
  });
});
/**
 * The spinner's frame-cycle is a real stylesheet rule, not an
 * `animate-[…900ms…]` arbitrary utility, and these tests are why.
 *
 * This repo has TWO reduced-motion channels (`themes.css` § MOTION GATE):
 * the OS `prefers-reduced-motion` media query, and the in-product
 * `data-motion-pref="reduced"` attribute `ThemeProvider` writes when someone
 * picks reduced motion with a NEUTRAL OS setting. Tailwind's `motion-reduce:`
 * variant compiles to the media query alone, so it reaches the first channel
 * and is blind to the second — a raw duration baked into a utility keeps
 * spinning right through an in-product preference.
 *
 * jsdom evaluates neither a media query nor a descendant selector against a
 * stylesheet it was never handed, so these assert the DECLARATIONS. That is a
 * weaker rung than an observed render and it is stated rather than implied:
 * they prove the rules exist and name the right selector, not that a browser
 * stopped the animation.
 */
describe("TerminalWorking reduced-motion channels", () => {
  const css = readFileSync(join(import.meta.dirname, "terminal-working.css"), "utf8");

  it("drives the frame cycle from a stylesheet class the element carries", () => {
    const { container } = render(<TerminalWorking />);
    const frames = container.querySelector("[data-slot='terminal-working-spinner'] > span");

    expect(frames?.className).toContain("terminal-working-spinner-frames");
    expect(css).toMatch(
      /\.terminal-working-spinner-frames\s*\{[^}]*animation:\s*terminal-working-spin/,
    );
  });

  it("stops the cycle for an in-product reduced-motion preference", () => {
    // The channel `motion-reduce:` cannot see. Without this rule the spinner
    // animates for anyone who chose reduced motion in the product itself.
    expect(css).toMatch(
      /\[data-motion-pref="reduced"\]\s+\.terminal-working-spinner-frames\s*\{[^}]*animation:\s*none/,
    );
  });

  it("stops the cycle for the OS preference from the stylesheet too", () => {
    // Restated in CSS so the rule survives the utility being dropped from the
    // element. `:not([data-motion-pref="full"])` mirrors the MOTION GATE truth
    // table: explicit in-product consent outranks the OS hint.
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(
      /:root:not\(\[data-motion-pref="full"\]\)\s+\.terminal-working-spinner-frames\s*\{[^}]*animation:\s*none/,
    );
  });

  it("never scales the cycle by --motion-factor", () => {
    // 900ms x 0.0001 is 0.09ms: ten frames per tick, a flicker rather than a
    // stop. Reduced motion means stop. This lock stops a well-meaning edit
    // from "tokenising" the duration back into the broken behaviour.
    expect(css).not.toMatch(/animation:[^;]*--motion-factor/);
  });
});
