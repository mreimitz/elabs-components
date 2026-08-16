# Agent workflow

How a coding agent (Claude Code or otherwise) should work in this repo.

## Orientation

1. Read `CLAUDE.md` (and `AGENTS.md` for non-Claude agents).
2. Skim the relevant `.claude/rules/*` for the task (component API, tokens,
   theming, accessibility, registry, data/ai/flow).
3. Check existing siblings before writing new code — match patterns.

## Common tasks

- **New component:** run `/new-component <pkg> <Name> [purpose]`, or follow
  `docs/COMPONENT_GUIDELINES.md`. Create `tsx/index/stories/test`, use semantic
  tokens, wire the barrel export, typecheck + test.
- **New theme:** `/new-theme <name>` — add a `src/themes/<name>.css` block +
  `BUILT_IN_THEMES`/`BUILT_IN_THEME_META` + the `exports` keys, verify contrast
  in every theme. (Only for a theme that SHIPS from the package — a consumer
  registers their own with `defineTheme` + `<ThemeProvider themes={…}>`.)
- **New registry item:** `/new-registry-item <name> <type>` — add source +
  manifest entry, run `pnpm registry:validate`.
- **Review:** `/review-component <path>` against the quality gates.
- **Release check:** `/prepare-release` — runs all gates; lists publish commands.
- **Browser QA / visual review:** `/qa-flows`, `/visual-review` (finders — they
  report, they don't fix).
- **File a finding:** `/file-issue <report|test|description>` — deep root-cause
  analysis + an implementation-ready GitHub issue. See `docs/ISSUE_WORKFLOW.md`.

## Issue workflow (find → diagnose → file → fix)

Findings (tests, finder agents, feedback) become GitHub issues; nobody fixes ad
hoc. Finders report → `brand-ui-root-cause-analyst` does deep RCA + designs the fix →
`/file-issue` dedupes and opens the issue → `brand-ui-component-builder` implements from it
and adds the locking test. Full detail: `docs/ISSUE_WORKFLOW.md` and
`.claude/rules/issue-workflow.md`.

## Subagents

Delegate to the specialized agents in `.claude/agents/` when useful:
`brand-ui-design-system-architect` (structure/tokens), `brand-ui-component-builder` (implementation),
`brand-ui-scaffold-builder` (app-spec → running app, via `brand-ui scaffold --write`),
`brand-ui-accessibility-reviewer` (a11y audit), `brand-ui-visual-ux-reviewer` (visual/UX),
`brand-ui-root-cause-analyst` (deep RCA → issue spec), `brand-ui-registry-curator` (registry),
`brand-ui-docs-writer` (docs).

## Validating changes

- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` (Turbo runs them
  across affected packages; scope with `--filter @elabs-ai/components-<pkg>`).
- `pnpm registry:validate` for registry changes.
- Hooks run automatically: formatting on edit, danger-blocking on Bash, boundary
  warnings on edit.

## Guardrails

- Never hardcode colors outside `themes.css`.
- Never import another package via relative paths — use `@elabs-ai/components-*`.
- Keep app vs. marketing concerns in their packages.
- No paid dependencies, secrets, or machine-specific absolute paths.
