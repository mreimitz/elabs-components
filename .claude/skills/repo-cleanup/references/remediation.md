# Remediation — plan, fix, verify

Load in `plan`, `fix` and `verify` modes. `safety-model.md` is the binding constraint; this file is
the procedure.

## `plan <ID>` — writes only the plan

Read the finding from the last report. **Re-run its evidence first.** A finding whose numbers no
longer reproduce is stale: say so and stop. Planning from a remembered measurement is how a fix
lands on a problem that was already solved.

Write `.repo-cleanup/plans/<ID>.md`:

```markdown
# <ID> — <title>

## Evidence, re-confirmed

<what was re-run, what it returned now, whether it matches the report>

## Change

<the smallest change that resolves the finding, file by file>

## Files likely to change

<paths, with a note where a path is protected>

## Expected impact

<the metric that should move, its current value, and by how much — labelled estimate or measured>

## Risks

<what could break, and the earliest signal that it has>

## Validation

<the exact command(s), and what output proves success>

## Rollback

<the exact command(s)>

## Dependencies

<other findings that must land first, or that this one blocks>

## Automatable?

<yes/no + why. "No" is a fine answer and the common one for anything touching source.>
```

A plan that cannot name its validation is not a plan. Say the finding needs a measurement first and
route it back to a `measurement-gap`.

## `fix <ID>` — one finding, guarded

Refuse to start unless **all** hold:

1. **A single finding id.** No "fix all", no severity filters, no "and while I'm here". If the user
   asks for several, do them one invocation at a time and say why.
2. **Clean working tree** when `remediation.require_clean_git` is true (default). `git status
--porcelain` empty. This is what makes `git checkout -- .` a complete rollback.
3. **Evidence re-confirmed** — as in `plan`.
4. **No protected path** in scope: `protected_paths` from config, plus anything the host repo's own
   rules declare sacred. Cite the rule when refusing; the refusal is a correct outcome, not a
   failure.

Then:

- Make **the smallest change** that resolves the finding. Nothing adjacent, no formatting sweep, no
  renaming on the way past.
- Run `stack.json#gate.effective`. **Gate red ⇒ stop, restore, report.** Do not fix forward into a
  second change; the rollback guarantee only holds for one change at a time.
- Re-run the analyzer that produced the finding and record the new metric.
- Report: files changed, diffstat, gate output, metric before/after, and **what was not verified**.

Never delete anything under `remediation.allow_automatic_deletion: false` (the default). Turning it
on removes one confirmation prompt; it does not lower any bar in `safety-model.md`'s deletion policy.

### Settings changes go through `update-config`

`CFG-` fixes touch `settings.json`. That file's merge semantics — user < project < local, arrays
that replace rather than append — belong to the bundled **`update-config`** skill. Use it. A
hand-merged settings file that drops an existing hook is a fix that costs more than the finding.

## `verify [<ID>]` — did it work?

Re-measure and compare against `.repo-cleanup/baseline.json` via `baseline.mjs#compare`. Four
verdicts, and the last two matter most:

| Verdict          | Meaning                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **improved**     | At least one metric moved the right way past its noise floor, and none regressed.                                          |
| **regressed**    | Any metric moved the wrong way. A mixed result is a regression **until the trade-off is stated** — do not average it away. |
| **no-effect**    | Every delta is inside the recorded spread. This is a real, common, and usually unwelcome answer. Report it plainly.        |
| **unmeasurable** | No baseline, or the metric cannot be taken now. Not "no effect".                                                           |

Rules:

- **A delta smaller than the spread is not an improvement.** `compare()` enforces this; do not
  narrate around it.
- Metrics marked `exact: false` are estimates. A change visible only in an estimated metric is
  weaker evidence than one visible in an exact metric — say which you have.
- `new` and `missing` metrics mean the measurement set changed. That invalidates a like-for-like
  comparison for those keys; call it out rather than presenting a partial table as complete.

Timing metrics carry a `spread` from `measure-command.mjs`. If `stability` says `UNSTABLE`, the
useful verification is not a smaller delta — it is more repetitions, or a quieter machine.

## Order of operations across findings

1. `measurement-gap` findings first when a later finding's severity depends on them. Measuring is
   cheap; guessing propagates.
2. Then `quick-win`s — they are also the cheapest rollback if the process itself turns out wrong.
3. `engineering` work with a plan each.
4. `risky` changes last, one at a time, each with its own verify.
5. `cosmetic` only when nothing above is open.

**Re-baseline after a batch lands**, not after every fix. A baseline rewritten between two fixes
makes the second fix unverifiable against the state before the first.

## Reporting a fix

Lead with what was **not** verified. Then: the finding, the change, the gate result, the
before/after metric with its verdict, and the rollback command. If the verdict is `no-effect`, say
so in the first line — a fix that did not measurably help is information the owner needs, and
burying it is how a cleanup turns into churn.
