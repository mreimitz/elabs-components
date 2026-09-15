# Agent workflow

How a coding agent (Claude Code or otherwise) should work in this repo.

## Orientation

1. Read `CLAUDE.md` (and `AGENTS.md` for non-Claude agents).
2. Skim the relevant `.claude/rules/*` for the task: `conventions.md` (component API,
   tokens, theming, accessibility), `decisions.md`, and the path-scoped package rules
   (`ai.md`, `charts.md`, `data.md`, `flow-maps-editor.md`, `registry.md`).
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
  manifest entry, run `pnpm check --rule registry-validate`.
- **Review (component, a11y, visual/UX):** `/review-component <path>` — a finder; it
  reports, it doesn't fix.
- **Release:** `/release` (`/release --check` validates without publishing).
- **New app or screen:** the `brand-ui-new-app` skill.
- **File a finding:** `/file-issue <report|test|description>` — fixes what is small,
  files the rest as an implementation-ready GitHub issue. See `docs/ISSUE_WORKFLOW.md`.

## Issue workflow (find → fix or file → fix from the issue)

Findings (tests, reviews, feedback) are fixed in the change that found them or become
GitHub issues. `/file-issue` triages and dedupes → `brand-ui-component-builder`
implements from the issue and adds the locking test. Full detail: `docs/ISSUE_WORKFLOW.md`.

## Subagents

Delegate to the specialized agents in `.claude/agents/` when useful:
`brand-ui-component-builder` (implementation), `brand-ui-reviewer` (component, a11y,
visual/UX and root-cause review), `brand-ui-docs-writer` (docs), `brand-ui-release`
(release).

## Validating changes

- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` (Turbo runs them
  across affected packages; scope with `--filter @elabs-ai/components-<pkg>`).
- `pnpm check --rule registry-validate` for registry changes.
- Hooks run automatically: formatting on edit, danger-blocking on Bash, boundary
  warnings on edit.

## Guardrails

- Never hardcode colors outside `themes.css`.
- Never import another package via relative paths — use `@elabs-ai/components-*`.
- Keep app vs. marketing concerns in their packages.
- No paid dependencies, secrets, or machine-specific absolute paths.
