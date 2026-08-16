# Deprecation, breaking changes & support

The policy behind something the repo already **practises** but never wrote down
(#64): how an export is retired, when it actually disappears, what a consumer is
handed when it does, and which versions get fixes.

Versioning is **lockstep** — every distributable package ships the same version,
cut on demand by the maintainer (see [`RELEASING.md`](./RELEASING.md) and
[ADR 0016](./ADR/0016-distribution-via-github-packages.md)). So "the next major"
below means the next major of the whole system, not of one package.

## 1. How a deprecation is marked

Three things, together — the JSDoc alone is invisible to anyone reading rendered
docs, and a CHANGELOG line alone is invisible in an editor.

1. **`@deprecated` JSDoc on the export**, naming the replacement and the reason.
   This is what a consumer's editor and TypeScript surface at the call site.
2. **A note in the Storybook autodocs** for anything with a story, so the
   deprecation is visible to someone browsing the component, not only to someone
   who hovers the symbol.
3. **A CHANGELOG `### Deprecated` bullet** in the release that introduces it.

Live examples, all shipped:

| Where                                                     | Shape                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/ui/src/components/error-state/error-state.tsx`  | a whole component superseded by `StatePanel kind="error"`             |
| `packages/ui/src/components/empty-state/empty-state.tsx`  | the same, superseded by `StatePanel kind="empty"`                     |
| `packages/charts/src/gantt/gantt.tsx` (`Status`)          | a **type alias** renamed to `GanttStatus` to stop a barrel collision  |
| `packages/ai/src/tool.tsx` (`ToolOutput` element payload) | one **usage path** of a prop deprecated while the prop itself remains |

Note the range: a deprecation can be a component, a type, a prop, or one _way of
using_ a prop. All four get the same treatment.

## 2. Timeline — deprecate in a minor, remove in a major

- A deprecation may land in **any minor**. The deprecated path keeps working,
  unchanged, for the rest of that major.
- Removal happens **only in the next major**. Nothing is removed in a patch or a
  minor, and nothing is removed in the same release that deprecates it.
- A deprecation with no announced replacement is not a deprecation — name the
  thing to use instead, or don't mark it.

## 3. Breaking changes

Every major ships a **migration section in `CHANGELOG.md`** with numbered
consumer steps. The 2.0.0 entry (the `@brand/*` → `@elabs-ai/components-*`
rename) is the template: what changed, _why_ it was not cosmetic, then the exact
steps a consuming repo runs.

Where the change is a **mechanical rename**, the CLI ships a codemod planner:

```bash
brand-ui codemod <map.json>
```

It is **read-only by design** (`packages/cli/bin/brand-ui.mjs` — "Plan AST
codemods [--dry-run|--apply] — read-only until VP-03"): it reports what would
change and where, and you apply it. It does not rewrite your source behind your
back, and it is not a substitute for reading the migration steps.

Consumer-facing migration guidance lives in
[`CONSUMING.md`](./CONSUMING.md) § 8 "Migrate an existing project".

## 4. Support

- **The current major gets fixes.** Bugs are fixed forward on `main` and shipped
  in the next release.
- **The previous major gets nothing but its published versions**, which are
  immutable on GitHub Packages and stay installable. There is no back-porting:
  this is an internal library with a small, reachable consumer set, and the
  honest position is "upgrade, and tell us if the migration hurts" rather than a
  maintenance promise nobody staffs.
- **A bad published version is deprecated and patched forward, never unpublished**
  — the procedure is [`RELEASING.md` § 7 Rollback](./RELEASING.md#7-rollback).
- **Escalation is a GitHub issue.** An internal consumer who hits a regression, a
  broken migration, or a removal they cannot absorb files one — see
  `.claude/rules/issue-workflow.md`. That is the supported channel; a Slack
  message is not a record.

## 5. Checklist for the person doing the deprecating

- [ ] `@deprecated` JSDoc on the export, naming the replacement
- [ ] The replacement actually exists and is exported
- [ ] A Storybook note where the symbol has a story
- [ ] A `### Deprecated` bullet in `CHANGELOG.md` under `## Unreleased`
- [ ] The old path still works and is still tested (it ships until the next major)
- [ ] If this is a removal: it is landing in a **major**, and the CHANGELOG entry
      carries numbered migration steps
