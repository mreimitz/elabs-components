---
TYPE: epic (tracking issue)
TITLE: "[tokens] WP-04 — DTCG token source of truth + Style Dictionary build"
LABELS: type:tech-debt, severity:P1, area:tokens, area:ai, needs-triage
---

## Summary

brand-ui's tokens exist only as CSS variables in `themes.css` (139 semantic tokens × 6 themes, OKLCH).
They're semantic and well-disciplined, but they are **not a structured, tool-interoperable source of
truth**: there's no DTCG (W3C Design Tokens) JSON, no per-token `$description`, and no round-trip to
design tools. The DTCG spec reached its **first stable version (2025.10)** and is now supported by
Style Dictionary v4+, Tokens Studio, and Figma — it's the interchange standard. A DTCG layer makes
theming a machine-readable contract for both **agents** (read intent + description to pick the right
token) and **design tools** (Figma Variables round-trip), bridging both worlds at once.

## Why P1 (bridges both worlds)

- _Enterprise:_ enables a Figma-Variables round-trip and a real multi-brand/white-label pipeline
  (generate a brand pack from a DTCG file) — doc 01, dims 2/3/7.
- _Agent:_ a typed, **described** token graph lets an agent reason about _when_ to use a token, not
  just its value — doc 02, lever 5. The strongest practitioner guidance is "every token carries a
  one-line description," which DTCG's `$description` is exactly for.

## Issues (split when filing)

### issue-01 — DTCG source of truth + build to themes.css _(P1)_

- **What:** Introduce DTCG JSON token files (`tokens/*.tokens.json`, `$value`/`$type`/`$description`)
  as the source of truth, and a **Style Dictionary v4+** build that emits today's `themes.css` CSS
  variables (so nothing downstream changes; the CSS stays the build _output_). Add a one-line
  `$description` to every semantic token (intent-named: when to use it).
- **Why:** single structured source; no drift; agent- and design-tool-readable.
- **Files:** `tokens/*.tokens.json` (new), `style-dictionary.config.*` (new),
  `packages/tokens/src/themes.css` (becomes generated — guard it), `packages/tokens/package.json`
  (build script), CI freshness check (WP-01).
- **Acceptance:** the generated `themes.css` is byte-stable vs the current hand-authored one (or
  diffs are reviewed + intentional); every theme still overrides every token; `pnpm build` regenerates;
  CI fails if `themes.css` is stale vs the DTCG source; no paid deps (Style Dictionary is OSS).
- **needs-run:** confirm the generated CSS matches current rendering in all six themes (re-audit per
  WP-02 issue-03) before replacing the hand-authored file.
- **Risk:** OKLCH + `@theme inline` mapping must survive the build — validate the Tailwind v4 pipeline
  still resolves `bg-*`/`text-*` utilities. Keep `themes.css` hand-authored until the generated output
  is proven identical, then switch.

### issue-02 (optional) — Expose tokens to agents via `brand-ui tokens` + manifest _(P2)_

- **What:** Surface the DTCG tokens (name, value-per-theme, description) through `brand-ui tokens`
  and the manifest so agents query the theming contract directly (complements WP-03).
- **Acceptance:** `brand-ui tokens` lists tokens with descriptions and per-theme values.

## Definition of done

- DTCG JSON is the token source of truth; `themes.css` is generated and CI-guarded; every semantic
  token has a description. Closes **E2, B3**.

## Dependencies

Depends on **WP-01** (CI freshness check). Independent of WP-03 (can run in parallel). Best done
after **WP-02 issue-03** so the six-theme AA baseline exists to diff against.
