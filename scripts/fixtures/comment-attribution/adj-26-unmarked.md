Adjudicated post-merge. **Staying open, folded into #33 as already decided on both threads** — recording the evidence so the branch that exists does not get merged by accident.

A local branch `agents/form-primitives` (`c749e00`, not an ancestor of `main`) implements the optional-peer split. Recommendation: **do not merge it standalone.**

1. **It inverts this issue's own scope.** The body asks for a headless field layer and states "Zero breaking change for current users"; the optional-peer split is the parenthetical "*Ideally*". The headless half was already satisfied before the branch by `packages/ui/src/components/field-row/field-row.tsx`, which imports no form-runtime code — and the branch does not modify that file at all (only its stories, +39 lines). Everything it does serves the parenthetical, at the cost of the headline promise.

2. **The subpath does not clear the gate** in `.claude/rules/component-api.md` § "Subpath exports". Condition 1 (lighter/different dep tree) passes only literally — the `./form` leaf is *heavier*. Condition 2 (a real consumer needs the leaf without the trunk) **fails**: every `Form` user also reaches for `Input`/`Button` from the barrel; the real need is the inverse, the trunk without the leaf, which the rule has no clause for. The branch is *subtractive* — `packages/ui/src/index.ts:105-115` removes `export * from "./components/form"` — which is not the additive pattern the rule sanctions, and `docs/ADR/0006-subpath-exports.md` is amended only to list the new subpath, not to record the decision.

3. **The mechanism is sound, the sequencing is not.** The barrel-preserving optional-peer pattern used by `packages/viewer/package.json:59-81` (seven optional peers, no subpath) works because those engines sit behind a lazy `import()`; `useFormContext` is a synchronous hook, so it genuinely does not transfer. That is an argument for amending the gate first, via `brand-ui-design-system-architect` — not for landing a `!`-breaking split ahead of it.

Since #33 is the same dependency → optional-peer decision, already tagged breaking/XL/needs-an-ADR, shipping this now would cost two lockstep majors for one policy question. One ADR, one major, covering both.

The branch is preserved locally as `agents/form-primitives` if any of it is wanted later.
