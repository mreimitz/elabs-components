---
TYPE: issue
TITLE: "[governance] Theme-token-parity gate + new-token propagation — themes always serve every component"
LABELS: type:tech-debt, severity:P1, area:tokens, area:governance, area:test, needs-triage
WP: WP-10
---

## Summary

When a new component or chart introduces a token (e.g. CH-01's `--chart-*`/`--legend-*`, DP-01's
`--card-detail-size`), **every theme must define it** — or it silently falls back to `:root` and renders
wrong in the other five themes (the exact failure the theming rule warns about). Make this **enforced,
not a reminder**: (1) a **token-parity gate** that fails when any theme omits a token other themes
define, and (2) a **propagation step** so new tokens land in all themes by construction. This is the
"update logic that enhances existing themes accordingly / checks they serve all we need."

## Source

Maintainer question (2026-06-06): "with the new components and charts, do we have update logic that
enhances the existing themes accordingly, or checks they serve all we need?" Grounded answer below.

## Current state (grounded — verified in the repo)

- `packages/tokens/src/themes.css` has six theme blocks (`:root`=light, `dark`, `qlik-bright`,
  `qlik-dark`, `blueprint`, `high-contrast`). The per-block token counts **already differ** — there is no
  guarantee of key parity.
- There **is** a six-theme **contrast** test (`packages/tokens/src/themes-contrast.test.ts` +
  `color-contrast.ts`) and the `brand-ui-audit` skill — but they check **contrast**, not **token-key
  presence**. Nothing fails when a token exists in some themes and is missing from others.
- The theming rule (`.claude/rules/theming.md`) says "**every theme overrides every token**" — but it's
  a **reminder**, not a gate. New tokens are added to all blocks **by hand** (CH-01 issue-03, DP-01
  issue-01 both do this manually).
- So today: **no parity gate, no auto-enhance.** A missing token is caught only if someone happens to
  look at the affected theme.

## Proposed solution

1. **Parity gate (lands NOW — no DTCG dependency):** a check (script/test in `@qlik-coe-emea/qlabs-components-tokens`, run in CI +
   a `PostToolUse` hook on `themes.css`) that parses the token-key set of each theme block and **fails**
   if any block is missing a key present in another (or has an extra one), with an actionable message
   ("`--card-detail-size` missing from `[data-theme="blueprint"]`"). Maintain a small **allowlist for
   intentionally `:root`-only tokens** (motion timing `--duration-*`/`--ease-*`/`--t-*`/`--motion-*`,
   which `themes.css` declares once in `:root` by design) so the gate doesn't false-positive on them.
2. **New-token propagation (happy path):** `/new-component`, `/new-theme`, and the token-touching flows
   (charts, the Card detail panel) **scaffold any new `--token` into all six theme blocks** (and, once
   WP-04 lands, into the DTCG source) — so the gate passes by construction, not by remembering.
3. **Contrast re-audit on new tokens:** new/changed tokens run through `brand-ui-audit` + the six-theme
   AA artifact (WP-02 issue-03), so a token is not just _present_ in every theme but _legible_ in each.
4. **Structural endgame (WP-04):** when **WP-04** makes `themes.css` generated from a DTCG source,
   parity becomes guaranteed by generation; this gate stays as the cheap always-valid backstop and the
   pre-WP-04 mechanism.

## Affected files

- [ ] `packages/tokens/` — the parity check (script + `*.test.ts`) + the `:root`-only allowlist
- [ ] `.github/workflows/ci.yml` (run the gate) — coordinate with WP-01
- [ ] `.claude/hooks/` + `settings.json` — a `PostToolUse` check when `themes.css` changes
- [ ] `.claude/commands/new-component.md`, `new-theme.md` — scaffold new tokens into all themes
- [ ] cross-ref: CH-01 issue-03 (chart tokens), DP-01 issue-01 (`--card-detail-size`), WP-04 (DTCG)

## Acceptance criteria

- [ ] The gate **fails** when a token is present in some theme blocks but missing from others (outside
      the `:root`-only allowlist), with a clear fix message; **green on the current repo** after any
      existing gaps are reconciled.
- [ ] Adding a component/chart token via the scaffolding flows propagates it to **all six themes**.
- [ ] New/changed tokens pass the six-theme contrast audit (WP-02 issue-03 / `brand-ui-audit`).
- [ ] The theming rule references the gate (reminder → enforced).

## Test to add

Fixture: a token added to one theme block only **fails** the parity gate; added to all blocks (or in the
allowlist) **passes**. A drift fixture for the `:root`-only allowlist.

## Risks / ripple effects

- **`:root` holds base + inherited + motion tokens** — the gate must compare the _semantic per-theme_
  set and allow legitimately-root-only tokens; get the allowlist right or it false-positives.
- Don't block on pre-existing gaps — reconcile current `themes.css` to parity first (may surface real
  missing tokens), then turn the gate on.

## References

- `packages/tokens/src/themes.css`, `theme-types.ts`, `themes-contrast.test.ts`;
  `.claude/rules/theming.md` ("every theme overrides every token"); `brand-ui-audit`; **WP-04** (DTCG,
  structural parity), **WP-02 issue-03** (six-theme AA); consumers CH-01 issue-03, DP-01 issue-01.
