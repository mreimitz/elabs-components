/**
 * decoration-status-channel.test.ts — the blueprint `[data-status]` non-colour
 * channel (#391).
 *
 * `decoration.css`'s "Filled controls become DRAWN controls" rule collapses
 * `bg-primary`/`bg-secondary`/`bg-destructive`/`bg-success`/`bg-warning`/
 * `bg-info` to ONE identical declaration set at high decoration — deliberate
 * (drawn-not-filled is hue-independent), but it leaves status meaning with
 * nothing to ride. The sanctioned `bg-<status>/10` wash escapes that specific
 * override, but blueprint's status tokens are near-white and low-chroma,
 * separated by lightness only, so at 10% alpha two adjacent statuses measure
 * ΔE ≈0.012 there too — colour cannot carry status in blueprint on EITHER
 * idiom. `decoration.css` compensates with a `[data-status]`-keyed LINE-TYPE
 * channel instead (mirrors the existing `[data-polarity]` glyph pattern, #162).
 *
 * This test asserts every member of the canonical 7-state status vocabulary
 * (`packages/ui/src/components/status-badge/status-badge.tsx`'s `STATUSES`)
 * has a `[data-status="…"]` rule in `decoration.css`, and that the resulting
 * non-colour cues are pairwise DISTINCT — except `denied`/`skipped`, which are
 * documented as deliberately sharing one step (Timeline's own `NODE_STYLE`
 * already renders them identically).
 *
 * Browser-free: parses `decoration.css` directly (mirrors
 * `theme-decoration-parity.test.ts`'s "cannot be fooled by a mock" style).
 *
 * NOTE ON THE ONE-WAY DEPENDENCY GRAPH: `@qlik-coe-emea/qlabs-components-tokens`
 * is upstream of `@qlik-coe-emea/qlabs-components-ui` (`tokens` → `ui`, never the
 * reverse — `.claude/rules/design-system.md`), so this file does NOT import
 * `STATUSES` from `@qlik-coe-emea/qlabs-components-ui` (that package is not even
 * a dependency of `@qlik-coe-emea/qlabs-components-tokens`). The 7 values are
 * mirrored here as a literal instead — keep it in sync with `status-badge.tsx`'s
 * `STATUSES` by hand; both are small, closed, and rarely change.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "decoration.css"), "utf8");

/**
 * Mirrors `STATUSES` in
 * `packages/ui/src/components/status-badge/status-badge.tsx` — the canonical,
 * closed 7-state status enum. Duplicated here (not imported) to respect the
 * one-way `tokens` → `ui` dependency direction.
 */
const STATUSES = [
  "pending",
  "running",
  "complete",
  "awaiting-approval",
  "denied",
  "failed",
  "skipped",
] as const;

/** Statuses the issue explicitly sanctions sharing one visual step. */
const SHARED_STEP: ReadonlySet<string> = new Set(["denied", "skipped"]);

/** Strip CSS comments (preserving length) so a comment mentioning a status
 * value can't be mistaken for a real rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Split a stylesheet into top-level-ish `{ selector, body }` rules, entering
 * `@layer`/`@media` wrappers rather than treating them as rules. */
function ruleBlocks(source: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const walk = (start: number, end: number) => {
    let cursor = start;
    let selBegin = start;
    while (cursor < end) {
      const ch = source[cursor];
      if (ch === "{") {
        const selector = source.slice(selBegin, cursor);
        let depth = 0;
        let close = cursor;
        for (; close < end; close++) {
          if (source[close] === "{") depth++;
          else if (source[close] === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (selector.trim().startsWith("@")) walk(cursor + 1, close);
        else rules.push({ selector, body: source.slice(cursor + 1, close) });
        cursor = close + 1;
      } else if (ch === "}") {
        cursor++;
      } else {
        cursor++;
        continue;
      }
      selBegin = cursor;
    }
  };
  walk(0, source.length);
  return rules;
}

/** The (border-style, border-width, background-image) cue declared for a
 * status, or `undefined` if no rule targets it. Reads from a rule whose
 * selector contains a bare `[data-status="value"]` clause (the pattern every
 * rule in the new block uses). */
function cueFor(status: string): { style?: string; width?: string; hatch?: string } | undefined {
  const clean = stripComments(css);
  const needle = `[data-status="${status}"]`;
  const rule = ruleBlocks(clean).find((r) => r.selector.includes(needle));
  if (!rule) return undefined;
  const style = rule.body.match(/border-style\s*:\s*([a-z]+)\s*;/)?.[1];
  const width = rule.body.match(/border-width\s*:\s*([^;]+);/)?.[1]?.trim();
  const hatch = rule.body.match(/background-image\s*:\s*([^;]+);/)?.[1]?.trim();
  return { style, width, hatch };
}

describe("high-decoration status channel (decoration.css [data-status], #391)", () => {
  it.each(STATUSES)('`%s` has a [data-status="…"] rule in decoration.css', (status) => {
    expect(cueFor(status)).toBeDefined();
  });

  it.each(STATUSES)("`%s`'s rule declares at least a border-style", (status) => {
    expect(cueFor(status)?.style).toBeTruthy();
  });

  it("cues are pairwise distinct, except the documented denied/skipped sharing", () => {
    const tuples = STATUSES.map((status) => {
      const cue = cueFor(status);
      return {
        status,
        key: `${cue?.style ?? ""}|${cue?.width ?? "1px"}|${cue?.hatch ?? "var(--bp-hatch)"}`,
      };
    });

    for (const [i, a] of tuples.entries()) {
      for (const b of tuples.slice(i + 1)) {
        const bothShared = SHARED_STEP.has(a.status) && SHARED_STEP.has(b.status);
        if (bothShared) {
          // denied/skipped are explicitly allowed (expected) to share a tuple.
          continue;
        }
        expect(
          a.key,
          `\`${a.status}\` (${a.key}) and \`${b.status}\` (${b.key}) must not share the same (border-style, border-width, hatch) tuple — only denied/skipped may`,
        ).not.toBe(b.key);
      }
    }
  });

  it("denied and skipped DO share their tuple (the documented exception)", () => {
    expect(cueFor("denied")).toEqual(cueFor("skipped"));
  });

  it("complete and running are distinguishable by at least border-style (the concrete AC)", () => {
    expect(cueFor("complete")?.style).not.toBe(cueFor("running")?.style);
  });

  it("every [data-status] rule lives inside the high-decoration scope", () => {
    const clean = stripComments(css);
    for (const status of STATUSES) {
      const needle = `[data-status="${status}"]`;
      const rule = ruleBlocks(clean).find((r) => r.selector.includes(needle));
      // The dial is the scope that ships: 8/9/10 on ANY palette. (The selector
      // also carries a paused theme's own name — not asserted, so pausing or
      // un-pausing it can never redden this.)
      expect(rule?.selector).toMatch(/\[data-decoration="8"\]/);
      expect(rule?.selector).toMatch(/\[data-decoration="10"\]/);
    }
  });
});
