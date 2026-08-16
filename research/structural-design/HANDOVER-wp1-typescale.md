# Handover — Agentic AI Workspace redesign · WP-1 (the systemic backbone + @qlik-coe-emea/qlabs-components-ui leaves)

## What this is

WP-1 of the structural redesign (epic #186): the **type scale** (#187) and the four
**@qlik-coe-emea/qlabs-components-ui leaves** (#188 Text/Heading+prose, #189 StatusBadge, #190 useCollapsiblePanel +
Timeline move). The research is COMPLETE and architect-reviewed; build FROM the issues.
**The foundation that was blocking WP-1 is now fixed (PR #198) — read "Starting state" first.**

## Starting state (CORRECTED — the previous handover's premise was wrong; verify, don't trust)

The prior handover said the foundation was clean / a branch was "not merged." Ground truth on
investigation was the opposite, so a regression was found, filed, and fixed:

- **PR #198** (`fix/196-duplicate-theme-blocks`, **Closes #196 + #197**) — OPEN, awaiting human
  review/merge. It removes stale **duplicate** `[data-theme="qlik-bright"]`/`qlik-dark` blocks
  that the `7f5ead8` "backup/pre-ci-removal" merge had appended; the later copy won the CSS
  cascade at runtime and silently reverted the #187 recess, the neutral accent, the blue-grey
  `--chat-user`, and the **#148 WCAG ring** in the DEFAULT theme — while every gate stayed green
  (the DTCG assembler / theme-parity / contrast test are all **first-match**, so the duplicate was
  invisible to tooling but shipped + rendered). It also reconciled the DTCG json so `tokens:check`
  (which was **RED on main**) is green, preserved the 8px qlik corners via `--radius-base`, and
  shipped a **new `tokens:dup-blocks:check` gate** (+ self-test, CI-wired) so it can't recur.
- **#187 was blocked by this** (it edits those exact tokens — a maintained-block edit would have
  been overridden). **WP-1 must branch off a CLEAN main, i.e. AFTER #198 merges.**

### FIRST decisions (settle before building)

1. **Merge #198.** Confirm it's merged to `main` (`gh pr view 198`), then branch off the updated
   main. Do NOT start #187 on top of the unmerged fix branch or on the still-broken main.
2. **Pixel-capture is UNAVAILABLE in this environment** (the `brand-ui-visual-ux-reviewer`'s
   agent-browser/screenshot skill was unreachable both passes — see memory
   `env-no-pixel-screenshot-capture`). #187 is **render-gate-heavy** (06 items 8–14: body
   line-height 1.25 vs 1.57; `CardTitle` rung; `--chat-user` "perceptible-but-calm") and Meta-#161
   requires an **observed render** for any `themes.css`/token-VALUE edit. Confirm agent-browser is
   reachable (or arrange an env where it is) before trusting those perceptual calls — otherwise
   **defer + explicitly flag** them; do not headline them "verified." Component a11y/interaction
   (#188–#190) can still be verified via `mcp__storybook__run-story-tests` (real headless browser +
   axe — does NOT need screenshots); only PERCEPTUAL eyeballing is blocked. (Verify run-story-tests
   works this session — it wasn't exercised in the prior one.)
3. **Radius (#197) is an open brand call.** #198 PRESERVED qlik at 8px (`--radius-base: 0.5rem` on
   block A). Archaeology showed 0.5rem only ever lived in the stale-block lineage; every maintained
   theme inherits `:root`'s `--radius-base: 0.25rem` (4px). If the maintainer wants qlik at 4px for
   system consistency, flip the one `--radius-base` line. Don't re-litigate silently.

## Design authority (read in this order; do NOT re-derive)

- `research/structural-design/README.md` → verdict + layer map.
- `research/structural-design/06-phased-plan.md` → THE build plan (Phase 0→4 DAG, gate inventory).
- `research/structural-design/07-type-system-integration.md` → the type scale (this WP).
- `research/structural-design/08-separation-surface-system.md` → surface/elevation; **§H recess is
  already landed (in #198)** — don't redo it.
- `research/structural-design/10-execution-trace-grammar.md` → StatusBadge (#189) + Timeline (#190).
- `research/structural-design/09-context-panel-integration.md` → useCollapsiblePanel (#190).
  Each is `file:line`-cited and architect-reviewed. Memory: `structural-design-redesign`.

## The build (dependency order: #187 → then #188 / #189 / #190 in parallel)

### #187 — type scale + surface convention (Phase-0 keystone). What REMAINS after #198:

- **0.1 Type scale (07):** 8 role tokens `display/title/subtitle/body/caption/meta/kpi/code` via a
  **plain `@theme {}` block** (theme-invariant — like the easing-curve `@theme {}` at
  `themes.css` ~L1247) + native companion keys `--text-<role>--{line-height,font-weight,letter-spacing}`.
  `--text-body == text-sm` (identity → zero render shift). **NO `@utility`.**
  - ⚠️ **RE-VERIFY the load-bearing compile fact FIRST (07 §B.1):** does the _installed_ Tailwind v4
    (range `^4.0.0` — check `pnpm-lock.yaml` for the resolved version) emit ONE composable
    `text-<role>` utility from those companion keys? The doc verified it on 4.3.0; confirm with a
    one-line compile test before relying on the "no `@utility`" simplification, and pin/guard the
    version. If it does NOT emit composably, the whole mechanism choice changes — escalate to the
    architect.
  - The `@theme {}` type block is **hand-authored STRUCTURE**, NOT a DTCG color value → it does NOT
    go in `*.tokens.json`, and it won't trip `tokens:check` (in-scope = oklch/var only),
    `theme-parity` (only scans `:root{}`/`[data-theme]{}`, not `@theme{}`), or the new dup-block
    gate (not a color decl). Verified.
- **0.2 Fonts:** add `--font-mono` (real mono stack) + `--font-display: var(--font-sans)` to `:root`
  (identity defaults; 07 §E.5). `font-` is already in the parity ROOT_ONLY allowlist → exempt. Bridge
  `--font-display` → a `font-display` utility (`@theme inline`) so `Heading` can apply it.
- **0.3 `--chat-user` revalue → EDIT THE JSON, not themes.css.** qlik-bright → `oklch(0.94 0.035 252)`,
  qlik-dark → `oklch(0.34 0.05 252)` (08 §B.4). **These are DTCG-generated VALUES**: edit
  `packages/tokens/tokens/themes/qlik-bright.tokens.json` + `qlik-dark.tokens.json` (`chat-user.$value`),
  then run `pnpm --filter @qlik-coe-emea/qlabs-components-tokens tokens:build`, then `pnpm tokens:check` (must stay green).
  **Hand-editing themes.css for a color value is the #196 trap — it gets reverted on rebuild.**
  RENDER-GATED (needs the six-theme sweep → pixel-blocked, see FIRST decision 2). Confirm
  `--chat-user-foreground` clears AA via `themes-contrast`.
- **0.4 Surface convention (08):** ZERO new tokens — document the `bg-<status>/10` wash, `border-s-<role>`
  rail, the surface→elevated ladder in `.claude/rules/styling-and-tokens.md`. (The §H recess is done.)
- **0.5 Gates:** `scripts/check-text-scale.mjs` (ratchet: baseline the ~326 raw `text-sm`/`text-xs`
  count, fail on increase, hard-block new raw `text-*` under `packages/ui/src/components/`, warn in
  `registry/`) + self-test; `scripts/check-separation.mjs` (flag same-`className` `border` + non-default
  fill; warn-only ratchet) + self-test. \*\*Mirror the just-shipped `scripts/check-duplicate-theme-blocks.mjs`
  - `.test.mjs`\*\* (clean sibling pattern: pure exported fn + CLI `--warn` + `node --test`). Wire
    `pnpm <x>:check[:test]` aliases in root `package.json` + steps in `.github/workflows/ci.yml`
    (beside the other token gates ~L94-117). Add the `styling-and-tokens.md` Typography rule + the
    PostToolUse nudge hook (07 §F).

### #188 / #189 / #190 — @qlik-coe-emea/qlabs-components-ui leaves (architect-gated; story + smoke test + a fork gate each)

Per the issues + 06 §"extract a leaf to @qlik-coe-emea/qlabs-components-ui" (×4). All are mostly @qlik-coe-emea/qlabs-components-ui (NOT themes.css),
so a11y/interaction verifies via `run-story-tests`; perceptual six-theme is the only pixel-blocked
part. Honor the resolved decisions: native `--text-*` not `@utility`; StatusBadge 7-state hybrid on
the existing `Badge` cva (`pending|running|complete|awaiting-approval|denied|failed|skipped`; `/10`
wash incl. `complete`, solid fill only for `awaiting-approval`+`failed`; typed `fromToolState`/
`fromTimelineStatus`; fixes the #182 `tool.tsx:54-60` raw-`text-yellow-600` bug); extract
`useCollapsiblePanel` + re-point Sidebar **byte-identically**; MOVE `Timeline` editor→ui
byte-identical (editor `markdown/index.ts` re-exports) + a fork gate each
(`check-collapse-fork.mjs`, `check-timeline-fork.mjs`).

## How the tokens layer ACTUALLY works (learned the hard way — saves hours)

- `packages/tokens/src/themes.css` token **VALUES are GENERATED** from DTCG json
  (`packages/tokens/tokens/themes/<theme>.tokens.json`) by `scripts/build-themes-css.mjs`
  (`tokens:build`); the file **STRUCTURE** (comments, `@theme`/`@theme inline` blocks, the
  per-theme block skeleton) is hand-authored. **Edit color VALUES in the json; edit STRUCTURE in
  themes.css.** `pnpm tokens:check` enforces sync (it computes what the build WOULD produce and
  diffs — its printed "committed/expected" labels are SWAPPED, read the actual oklch).
- The assembler/parity/contrast tools use **first-match** block extraction
  (`packages/tokens/scripts/lib/themes-io.mjs:66 locateBlock`). A token is "in scope" for the DTCG
  sync iff its value is `oklch(...)` or `var(--…)` and it's not machinery (`isInScope`, L53-57).
  blueprint LEGITIMATELY has two `[data-theme="blueprint"]` blocks (color + font mechanism) and there
  are two `:root` blocks (the 2nd carries `--expo-out`) — the new dup-block gate allows machinery-only
  secondaries and only flags duplicate COLOR blocks.
- After ANY token-value edit: `tokens:build` → `tokens:check` → `theme-parity:check` →
  `tokens:dup-blocks:check` → `pnpm --filter @qlik-coe-emea/qlabs-components-tokens test` (165 contrast assertions).

## Gates / workflow (non-negotiable — from .claude/rules/quality-gates.md)

- Branch off `main`; never commit to main. PRs reference issues (`Closes #N`) + add the issue's
  "Test to add." Use the PRESCRIBED agents in sequence (don't improvise Workflow scripts):
  `brand-ui-design-system-architect` (every structural/token-taxonomy item: type scale, Text/Heading
  - prose promotion, Timeline move, useCollapsiblePanel, StatusBadge) → `brand-ui-component-builder`
    /`/new-component` → `/review-component` + `brand-ui-accessibility-reviewer` → `brand-ui-visual-ux-reviewer`
    six-theme sweep. Findings → `/file-issue` (RCA → dedupe → create). Memory:
    `use-prescribed-subagents-in-sequence`.
- **Any themes.css/token-VALUE edit ⇒ a `brand-ui-visual-ux-reviewer` six-theme sweep on a REAL
  `scenarios-*` screen before merge** (Meta #161). ⚠️ Pixel-capture is currently unavailable here —
  see FIRST decision 2; do not claim "verified across six themes" from source analysis alone.
- Each new gate ships a `node --test` self-test wired in CI. Run `pnpm typecheck && lint && test &&
build` on touched packages before "done."
- Honest reporting: lead with what you did NOT verify (memory `honest-completion-reporting`).

## Gotchas (cost real time last session — heed them)

- **Edit color values in the `.tokens.json`, not themes.css** (the #196 trap; hand-edits get reverted
  by `tokens:build`). The recess regression existed precisely because someone hand-edited themes.css.
- **`gh` works directly** (account `mreimitz`); the GitHub **MCP `create_issue` is NOT available to the
  main thread** — file with `gh issue create --title … --body-file <tmpfile>` (use a body file to dodge
  shell-escaping) and **verify** (`gh issue view N`). The `brand-ui-root-cause-analyst` has read-scoped
  `mcp__github__search/list/get` for dedupe.
- **Shell:** foreground `sleep`-loops are BLOCKED (use `Bash run_in_background` or single checks);
  **`curl` to localhost may be DENIED** — read the dev-server log via the Read tool instead. `| tail`
  MASKS exit codes (`PIPESTATUS`/`$?` then read the pipe, not the command) — use `set +e` and read the
  gate's ✔/✖ text, or check exit without a trailing pipe.
- **`pnpm --filter <pkg> build typecheck test lint` is WRONG** — only the first script runs; the rest
  become ARGS to it (you'll see a bogus `cp … "lint"`). Use
  `pnpm exec turbo run typecheck test lint --filter=@qlik-coe-emea/qlabs-components-<pkg>`.
- **Storybook:** `pnpm --filter @qlik-coe-emea/qlabs-components-docs dev` (port 6006, reads package SOURCE live via HMR — no
  rebuild needed); the `mcp__storybook__*` tools are available to SUBAGENTS while it runs. Stop it when
  done. The Storybook log lives wherever you redirect it; poll readiness for "Storybook ready".
- **Pre-existing, out of scope:** `@qlik-coe-emea/qlabs-components-e2e` lint fails on `no-undef` (`console`/`process`) in
  `apps/e2e/reports/screenshots-wp05/capture.mjs` + a type-import warning — unrelated; file its own
  issue, don't fold it into WP-1. Repo-wide `format:check` also has pre-existing drift (`.claude/`,
  `research/`, some stories) — not yours.
- Tables in research `.md`: avoid a literal `|` inside a cell (breaks the row). MDX needs `{/* */}`
  comment markers, not HTML comments.

## Start by

1. Confirm **#198 is merged**; `git switch main && git pull --ff-only`; branch `feat/187-type-scale`.
2. **Re-verify the Tailwind companion-key compile fact** (07 §B.1) on the resolved version — this
   gates the whole mechanism. Then build #187: type-scale `@theme` block (identity) + `--font-mono`/
   `--font-display` in `:root` + the two gates. Edit `--chat-user` IN THE JSON. Architect-gate it.
3. Confirm agent-browser/pixel-capture availability; run the six-theme sweep for the `--chat-user`
   value + the render-gated calls (body leading, `CardTitle` rung) — or defer + flag them honestly.
4. Then #188 / #189 / #190 (parallelizable), each architect-gated + story + smoke test + fork gate.

Memory keys: `structural-design-redesign`, `env-no-pixel-screenshot-capture`,
`use-prescribed-subagents-in-sequence`, `no-stop-to-ask-in-self-driving`, `honest-completion-reporting`.
