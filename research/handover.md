Continue executing research/00-MASTER-BUILD-ORDER.md (the self-driving Phase-1+ build).
Full self-driving: pick the next unblocked issue, implement, verify, PR, merge, repeat.
Stop ONLY at the §6 gates. Do NOT stop to ask which issue is next or whether to pause —
follow the plan. Use the repo's PRESCRIBED subagents/commands in sequence (DoD battery +
§8 tiering): design-system-architect for structural/API/token decisions → component-builder
or /new-component to build → /review-component + accessibility-reviewer + /visual-review
(six themes) for UI → root-cause-analyst→/file-issue for findings (finders report, builders
fix from the issue). My persistent memories capture the key corrections — heed them.

=== REPO STATE (read first) ===

- main is GREEN at 386298a (origin/main up to date). Sync: git fetch && git switch main &&
  git merge --ff-only origin/main. git/gh + cd + read-only shell utilities are PRE-AUTHORIZED
  in .claude/settings.json — you won't be prompted; force-push denied, `pnpm publish` gated.
- ⚠️ GIT IS BROKEN VIA THE SYSTEM BINARY: macOS reset the Xcode CLT license, so /usr/bin/git
  (and `gh`, which shells out to it, and VS Code's Source Control panel) error with "You have
  not agreed to the Xcode license." WORKAROUND: call /opt/homebrew/bin/git for all git ops;
  run gh as PATH="/opt/homebrew/bin:$PATH" gh ... and pass -R Qlik-CoE-EMEA/qlabs-components
  to `gh issue create`. PERMANENT FIX (needs the human's sudo): `sudo xcode-select --switch
/Library/Developer/CommandLineTools` then reload VS Code. (See memory xcode-git-broken-use-homebrew.)
- ⚠️ A concurrent "cowork" agent is editing the SHARED working tree: research/_,
  .claude/agents/repo-architect-_, .claude/commands/repo-architect-review.md,
  .claude/rules/architecture-review.md, .claude/scripts/arch-evidence-pack.mjs,
  docs/ADR/0009-repo-architecture-review.md, plus uncommitted edits to package.json
  (arch:evidence/arch:garden scripts) and .gitignore. NEVER `git add -A`/`.` — STAGE EVERY
  COMMIT BY NAME. For package.json specifically: its working tree mixes your changes with the
  cowork agent's arch:evidence lines — if you must add a script, do the remove-their-lines →
  stage-yours → restore-their-lines dance (verify `git diff --cached package.json` shows only
  yours). A check-git-add-all hook warns; the rule is real.
- Storybook usually runs at http://localhost:6006. The mcp**storybook**\* tools are FLAKY.
  Working fallbacks: CLI `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook <filter>` (interaction +
  axe, real chromium) and the visual-ux-reviewer agent driving the browser directly.

=== WHAT'S DONE (prior session, all on main) ===

- CH-01 epic #52 CLOSED — all 7 children done. This session shipped the last two:
  - #114 (PR #166): vendored bklit's 3 stat-card registry blocks + modernized MetricCard
    (forwardRef, `description` slot, delta aria-label) / ChartCard (forwardRef). A `ChartBacked`
    MetricCard story is the in-library six-theme-verifiable chart-in-card.
  - #115 (PR #167 harvest + PR #170): brand-ui skill "Charts" section harvested; #168 renamed
    colliding TooltipContent→ChartTooltipContent family; #169 wired the charts reuse-audit gate
    (scripts/check-charts-reuse.mjs + self-test + 2 CI steps + warn hook — NEW gate in the DoD).
- #147 (PR #171): blueprint grid no longer bleeds into Dialog/popover portals — systemic
  decoration.css fix ([role=dialog]/[role=alertdialog]/[data-vaul-drawer]/
  [data-radix-popper-content-wrapper] excluded). Verified by a six-theme visual sweep.

=== OPEN FINDINGS (finders report, builders fix FROM the issue) ===

- #78 (P1, partly triaged): six-theme AA work. acme-removal AC ALREADY DONE (no orphan block).
  Remaining: (a) **--border < 3:1 vs --card in 4/6 themes** (light 1.27 / dark 1.36 / qlik-bright
  1.35 / qlik-dark 1.40) — a measured WCAG 1.4.11 gap needing a design-system-architect token
  decision (global --border bump vs new --border-strong vs accept content-cue; ripples across all
  cards/inputs/tables/dividers → border-focused six-theme sweep). Recommend splitting into its own
  architect-routed issue. (b) committed rendered AA artifact sweep (brand-ui-audit skill). (c) flip
  axe to CI-blocking (WP-02 coordination; it already runs non-blocking).
- #164 (P1): blueprint charts must encode series by **combinable pattern fills** (hatch/dot/dash
  density+spacing), NOT hue/lightness — parent of #163; supersedes #163's lightness-ramp fix (user
  direction). Big, design-system-architect-level (pattern-ramp token taxonomy + chart render hook;
  @visx/pattern + chart-defs hoisting already exist).
- #162 (P0) blueprint delta success/destructive text indistinguishable; #163 (P0) blueprint
  sparkline series indistinguishable (resolve via #164's pattern system, NOT lightness widening).
- #165 (P2): bar corner-radius hardcoded (8px) ignores theme --radius — needs a useResolvedRadius
  hook (needs-run: confirm getComputedStyle("--radius") returns px not calc() under Tailwind v4).
- #148 (P2 batch): high-contrast/qlik-bright ring contrast on close-button/pressed-toggle; Toggle
  pressed-state visual weight; CardDescription text-wrap.
- #144 (P2): tokenize blueprint chart-4/5 hardcoded brush/gauge colors.
- #145 (P2): SVG charts AT alt (partly addressed by ChartFrame flip-to-table — pass `data`).

=== NEXT UNBLOCKED WORK (pick per §4 priority) ===
Highest-value: the #78 **--border** token decision via design-system-architect (then fix +
border-focused six-theme sweep). Then theming findings #164 / #162 / #163 (blueprint chart legibility
— #164 is the systemic parent), #144, #165, #148. Phase-2 feature lanes (parallelizable per §4):
WP-05 #62, WP-06 #63, WP-13 #70, WP-09 #66, WP-15 #72, WP-07 #64. Phase-1 remainder: WP-12 #96,
WP-03 #79/#80-84/#87, WP-04 #61 (DTCG). Plugin VP-01..04 (#54-57) + WP-14 capstone (#71) after features.

=== CONSTRAINTS / GOTCHAS ===

- DoD battery (run BEFORE merge): full-repo typecheck+lint+test+build + format:check + manifest:check
  - components:check + docs:check + ai:types-only + lucide:check + **charts:reuse:check** (new) +
    registry:validate. Token/theme touch → themes-contrast + charts-contrast + a **six-theme
    visual-ux-reviewer sweep on REAL scenarios-\* screens** (Meta #161 — required for theme-VALUE edits;
    contrast tests prove ratios, not that recolored surfaces read well).
- manifest:check REVERTS its own regen (git checkout) — after `pnpm manifest`, STAGE
  brand-ui.manifest.json by name so `git diff` (working vs index) is empty → it passes.
- Registry blocks live OUTSIDE the package graph (registry/), so their @qlik-coe-emea/qlabs-components-\*/visx/lucide imports
  can't be bundled in the library Storybook without risky global aliases — don't try; verify blocks
  via registry:validate + 1:1-port; their six-theme render is consumption-time (consistent with the
  8 existing blocks, none in the library Storybook).
- Report HONESTLY: lead with what you did NOT verify. "Theme-safe"/"a11y verified" only if OBSERVED
  on the real rendered surface (story in browser / test-storybook / real screen), never inferred from
  "uses tokens" or a mock.
- Work on branches off main; squash-merge PRs (--delete-branch); after merge, advance local main with
  `git branch -f main origin/main` (the squash makes a new SHA, so ff-merge can fail — branch -f is the
  clean non-destructive sync that preserves the cowork agent's uncommitted work).
- After a larger building session: /visual-review + accessibility-reviewer on changed work, then
  /session-retro (runs in a SEPARATE session — skip it inline).
