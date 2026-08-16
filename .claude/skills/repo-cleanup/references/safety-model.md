# Safety model

Load this in every mode. It defines what the skill is allowed to touch.

## Read-only is the default and it is checkable

`audit`, `plan` and `verify` write **nothing** outside `.repo-cleanup/`. Not `.gitignore`, not
source, not settings, not the ledger. The proof is mechanical: `git status --porcelain` before and
after an audit must be byte-identical (`validate-installation.mjs` asserts exactly this).

`.gitignore` gets its `.repo-cleanup/` line **only** in an explicitly approved install step. A
read-only audit that edits `.gitignore` is not read-only, however convenient.

## Command classes

Every command the skill runs is classified before it runs.

| Class                     | Examples                                                                      | Policy                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **safe read-only**        | `git log`, `git status`, `git ls-files`, reading files, `node scripts/*.mjs`  | Run freely                                                                                                                        |
| **potentially expensive** | the detected gate, `pnpm build`, a test suite, `git log -p` over full history | Announce first, bound with a timeout from `limits.command_timeout_seconds`, cap captured output at `limits.max_command_output_kb` |
| **mutating**              | any write outside `.repo-cleanup/`, `pnpm install`, formatters                | Explicit approval, and only in `fix` mode                                                                                         |
| **network**               | package registry queries, anything fetching                                   | Blocked unless `privacy.allow_network: true` AND the user approves in-turn                                                        |
| **destructive**           | `rm`, `git reset --hard`, `git clean`, history rewrites, dependency removal   | Never automatic. Ever.                                                                                                            |

Anything that could hang gets a timeout. A command that fails does not abort the audit — it becomes
a **measurement gap** with the exit code and the shortest decisive line of output.

**Never execute a script from the repo just to see what it does.** A SessionStart hook's output is
reported as unmeasured rather than measured by running it.

## Privacy

- **Never read `.env` or any credential file to prove it is one.** Detection is by filename and
  shape (`redact.mjs#isSecretBearingPath`). Presence is reportable; contents are not.
- **Every writer passes through `redact()`.** No exceptions, no "this one is just paths".
- **Transcripts are aggregate-only.** `usage-forensics.mjs` may emit counts, token totals, turn
  counts and timings. It may never emit message text, tool arguments, file contents, or any
  substring of a conversation. This is locked by a test, not by care.
- Nothing leaves the machine. No uploads, no telemetry, no external analysis without explicit
  in-turn approval.
- `privacy.include_source_snippets` is `false` by default: findings cite `file:line`, not code.

## Protected paths

`fix` mode refuses to touch:

1. Anything matching `protected_paths` in `.repo-cleanup.yml`.
2. Anything the **host repo's own rules** declare sacred. The skill reads the host `CLAUDE.md` and
   `.claude/rules/**` and treats what it finds as binding — it does not carry a hardcoded list,
   because every repo's sacred zone is different. When the host names a byte-identity seam, a
   single-writer invariant, a security boundary or a generated/vendored tree, those paths are
   protected and the refusal cites the rule.
3. Anything under a detected vendor, generated, or build root.
4. Lockfiles, migrations, and anything the deletion policy below calls high-risk.

A finding may still _name_ a protected path. `fix` will refuse and hand it to the user with the
citation. That is the correct outcome, not a failure.

## `fix` mode contract

- **One finding per invocation.** There is no verb that fixes everything, and adding one is a
  design regression.
- Requires a clean working tree when `remediation.require_clean_git` is `true` (default), so
  `git checkout -- .` is always a complete rollback.
- Re-reads the evidence first. A finding whose evidence no longer reproduces is **stale**: report
  it and stop, do not fix from a remembered number.
- Smallest change that resolves the finding. No adjacent cleanup, no drive-by formatting, no
  "while I was in there".
- Runs the detected gate (`stack.json#gate.effective`) afterwards. **Gate red ⇒ stop and report**,
  never "fix forward" into a second change.
- Reports exactly what changed: files, diffstat, gate output, and what was NOT verified.

## Deletion policy

The skill identifies **deletion candidates**. It never calls one safe.

Every candidate reports: why it appears unused · which searches were run · **which searches were
not run** · git history for the path · references found · potential dynamic-loading side effects ·
confidence · and the validation to run before deleting.

Treat as **high risk regardless of how unused they look** — these are the categories where static
search is structurally blind:

migrations · database scripts · deployment and infrastructure files · anything reached by dynamic
import, reflection, or a plugin registry · runtime-loaded templates · localisation files · public
API surface · backward-compatibility shims · generated API clients · files referenced from outside
the repo (CI, another repo, a deploy script) · fixtures loaded by name at runtime.

`remediation.allow_automatic_deletion` defaults to `false` and turning it on does not lower any of
the above bars — it only removes one confirmation prompt.

## Honest reporting

- Lead every report with **what was not verified**. Not a footnote.
- "Green" means what was actually run. A gate that was not run is "not run", never "assumed green".
- An owner-gated or externally-blocked item is surfaced, never ticked.
- Estimates are labelled as estimates every time they appear, including in the summary.
- If the skill's own analysis was wrong in a previous run, say so plainly and move on.
