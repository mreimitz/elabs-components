# Quality gates

"Done" only when ALL hold:

- **Reuse audit FIRST** - grep the `@elabs-ai/components-*` barrels + `registry/` for the capability AND shared helpers (`cn`, hooks, copy buttons, menus) by name and concept; reuse/extend first.
- **Types exported**; barrel export (`src/index.ts`); no paid dependencies; agent-legible API (predictable props).
- **Composable** - `className`, `...props`, `forwardRef` where a DOM ref is meaningful; variants via `cva` above one visual axis.
- **Semantic tokens** (`styling-and-tokens.md`); accessible (`accessibility.md`); motion-tokened (`docs/MOTION_GUIDELINES.md`: gated `duration-*`/`ease-*`/`--t-*`, never raw; `motion-reduce:` on movement).
- **Theme-safe** - OBSERVED in both themes, never inferred from tokens; cite the slug. A theme/system-wide change: a real, unmodified app screen (`scenarios-*` story), never only a self-authored demo. A `themes.css`/token-VALUE edit: `brand-ui-visual-ux-reviewer` cross-theme sweep before merge; contrast tests do not suffice. CI measures `light` only: run the dark sweep by hand (`storybook-mcp.md`) before claiming cross-cutting theme-safety. An in-place `data-theme` flip proves it took: `el.closest("[data-theme]")`, assert the attribute AND a differing resolved ink. An anti-vacuity guard picks a token pair that differs in EVERY theme.
- **Story** - a Default story with `tags: ["autodocs"]`, `run-story-tests` green, `preview-stories` in both themes (else `pnpm --filter @elabs-ai/components-docs test-storybook`); a smoke test (render + key behavior) where practical.
- **Separation of concerns** - the D3 package; a missing primitive goes DOWN into its base package, never sideways between layer-2 leaves, never into `process` (ADR 0034).
- **Green checks** - `pnpm --filter <pkg> typecheck && pnpm --filter <pkg> lint && pnpm --filter <pkg> test` (three separate invocations — pnpm chains only the first). Audit: `/review-component <path>`.

## Definition of done

Locally: SCOPED checks - `pnpm check:changed` (typecheck+lint+test for the packages changed vs `origin/main`) and `pnpm gates` (the per-change gate set CI runs; parallel, continue-on-failure, ~30 s; `pnpm gates:all` adds the slow format/consumer checks). The FULL battery (typecheck+lint+test+build+gates+self-tests) is CI's job on the PR: run it locally at most ONCE before opening a PR - never per commit or work unit, never after a merge (CI on `main` does that).

| Change        | Before "done" / merge              |
| ------------- | ---------------------------------- |
| Component/UI  | `/review-component`                |
| UI a11y       | `brand-ui-accessibility-reviewer`  |
| Security/net  | `/security-review`                 |
| API/subpath   | `brand-ui-design-system-architect` |
| Merge/publish | `/prepare-release` + rows above    |

Review precedes integration (upstream#45): never merge to `main`, push the default branch or claim "done" before every applicable row ran; checks -> fix -> THEN commit/merge/push. `pre-merge-review-gate.sh` warns (never blocks) on merge/checkout/push to `main`.

## New package / subpath export

- `pnpm gen` (`pnpm gen:check`); purpose in `packages/cli/lib/render-docs.mjs` `PKG_PURPOSE`/`INFRA_PKGS`; hand-edit only outside `<!-- brand-ui:gen:* -->`.
- Dependency line, identical in `CLAUDE.md`, `design-system.md`, `architecture-review.md` D1, `.claude/agents/repo-architect-structure-auditor.md`; `ALLOWED` in `scripts/check-dep-direction.mjs`.
- `.claude/commands/new-component.md`; `skills/brand-ui/SKILL.md` + `skills/brand-ui-component/SKILL.md` (+ `description` lists); `apps/docs/.storybook/preview.tsx` `storySort.order` = `docs/STORYBOOK_GUIDELINES.md` list.
- `@source` in `apps/docs/.storybook/preview.css` + every `@source` CSS (`fixtures/consumer-smoke/src/index.css`) if it ships Tailwind classes (`pnpm tailwind-sources:check`, `EXEMPT_PACKAGES`).
- `pnpm manifest`; keep this list: the pre-commit generator cascade misses CI-only clones, `--no-verify`, new packages.
- Subpath export = structural API change, never a test dodge: `brand-ui-design-system-architect` (`component-api.md`); `exports` + `publishConfig.exports` + `tsup.config.ts`; `pnpm manifest` + surfaces above; `check-package-registered` hook warns.

## Reporting completion honestly

"Done"/"validated" = what you RAN, for all work:

- "Validated" only if the primary path executed; otherwise name the unexercised path.
- Never "done/verified" unless the PRIMARY validation surface (Theme-safe) was exercised; else "candidate - not yet validated on a real screen". `gate-completion-claims.sh` (`Stop`) nudges bare claims.
- State what you did NOT verify in `Problems`, one plain line: mandatory, never the opening.
- Verify every cited path/link resolves.
- A11y/visual claims cite the REAL rendered surface (story ID + theme slug, or the real screen), never a `vi.mock` stand-in (upstream#34/upstream#46).

## Editing discipline

- Read before Edit, batched; re-`Read` after a `PostToolUse` formatter rewrites a file.
- A lint/format/type-affecting artifact is never "cosmetic": fix it first time.
- In a git worktree, `Read` the WORKTREE path before editing it.
- A script's "changed"/"broken" is a hypothesis: confirm with `git diff`; `git diff --quiet <path>` (exit 1 = changed), never `git status` exit code; paths from the file's own dir; quote/realpath filenames.

## Enforcement over reminders

- A convention ships with its enforcement in the SAME change (generator and/or gate/hook); prose-only is incomplete.
- "Must always hold" -> a check: CI gate (`scripts/*.mjs` + `pnpm <x>:check`) > `PostToolUse` hook > manual step; every gate self-tests (`*.test.mjs` via `pnpm <x>:check:test`: a planted bad fixture must fail).
- Nothing is published from a commit the battery has not passed; a failing OR pending blocking check blocks a merge. Catalogue: `docs/GATES.md`.

## Session cadence

`/visual-review`, `brand-ui-accessibility-reviewer`, `/review-component` and `/session-retro` (`brand-ui-session-reviewer`) suit a larger session; findings go through `/file-issue`, never silent patches.
Not mandatory per session; `session-cadence-nudge.sh` (`Stop`) nudges once at >=5 changed product files with no reviewer dispatched.

## Governance budget

Always-on governance (CLAUDE.md + every cross-cutting rule) is capped at 72 KB total and 8 KB per rule, enforced by pnpm rules:scoping:check. New text is paid for by deleting text first; incident narratives go to docs/rules-history/, never into a rule.

History and measurements: docs/rules-history/quality-gates.md
