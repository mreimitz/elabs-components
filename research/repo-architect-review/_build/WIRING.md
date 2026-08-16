# Discovery wiring — small edits to apply after `install.sh`

The agents, command, rule and ADR self-register by living in `.claude/` and `docs/ADR/`.
These four edits make the capability **discoverable** (the repo's "register everywhere"
discipline, `quality-gates.md`) and keep run artifacts out of git. Apply, then commit.

## 1. `.gitignore` — keep run artifacts out of git (append)

```gitignore
# repo-architect-review run artifacts (promote a scorecard.md to baseline when you want to track it)
research/repo-architect-review/runs/
```

## 2. `package.json` — a script alias for the evidence/garden pass (add to `"scripts"`)

```json
"arch:evidence": "node .claude/scripts/arch-evidence-pack.mjs",
"arch:garden": "node .claude/scripts/arch-evidence-pack.mjs --depth quick"
```

## 3. `AGENTS.md` — add to the "Common tasks" list

```markdown
- Repo-tier architecture audit → `.claude/commands/repo-architect-review.md` →
  four `repo-architect-*` auditors + `repo-architect-synthesizer`. Advisory + gated;
  finders report. Deterministic pass: `pnpm arch:garden`. See ADR
  `docs/ADR/0009-repo-architecture-review.md`.
```

## 4. `CLAUDE.md` — one line in the review/issue area (optional but recommended)

```markdown
**Repo-tier audit:** `/repo-architect-review` runs the holistic architecture review
(nine dimensions → scorecard + findings register vs. the enterprise-gap baseline,
gated, routed to `/file-issue`). Rubric: `.claude/rules/architecture-review.md`.
```

> Note: do **not** add `architecture-review.md` to CLAUDE.md's `@import` block — it is
> loaded on demand by the command/agents, not every session.
