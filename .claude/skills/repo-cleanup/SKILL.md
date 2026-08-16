---
name: repo-cleanup
description: Audit a repository and its Claude Code setup for wasted tokens, wasted time, and dead weight — then plan and apply fixes under evidence. Use when the user asks why sessions are slow or expensive, wants CLAUDE.md / .claude / skills / agents / MCP trimmed or optimized, wants dead code, unused dependencies, disabled tests or repo bloat found, asks where the tokens went, or says "repo-cleanup", "/repo-cleanup", "audit this repo", "clean up my .claude folder", "reduce context cost". Read-only by default; every finding carries evidence, a confidence level, and what was not verified.
metadata:
  version: "1.0.0"
---

# repo-cleanup — evidence-driven repo & Claude-setup auditor

Portable: assumes nothing about language, package manager or layout beyond what `detect-stack.mjs`
reports. Zero dependencies; every script is `node >= 22`.

**You are the interpreter, not the measurer.** Scripts produce numbers; you turn numbers into
findings with a severity, a confidence and a recommendation. Never assert a number you did not get
from a script or a command you ran.

## Non-negotiables

1. **Read-only by default.** `audit`, `plan`, `verify` write nothing outside `.repo-cleanup/`.
   Never `.gitignore`, never source, never settings. Check `git status --porcelain` before and
   after, and report that it is unchanged.
2. **Evidence or it is a suspicion.** `confidence: confirmed` needs a measurement taken now or a
   static proof over the full file set. An estimate is never confirmed, and the word _estimate_
   appears next to every estimated number.
3. **Lead with what was NOT verified.** Before findings, not in a footnote.
4. **The host repo's rules bind you.** Read its `CLAUDE.md` and `.claude/rules/**` first; treat what
   they protect as protected.
5. **No secret reaches a report.** Everything written passes `redact()`. Credential files are
   detected by name, never opened.
6. **One finding per fix.** There is no "fix everything" verb; do not improvise one.

## Modes

Argument after `/repo-cleanup`; default `audit`.

| Mode              | Reference to load                    | Script                       |
| ----------------- | ------------------------------------ | ---------------------------- |
| `context`         | `context-budget.md`                  | `context-footprint.mjs`      |
| `tokens`          | `token-forensics.md`                 | `usage-forensics.mjs`        |
| `docs`            | `doc-hygiene.md`                     | `doc-hygiene.mjs`            |
| `repo`            | `repo-hygiene.md`                    | `repo-inventory.mjs`         |
| `audit` (default) | all four                             | all four                     |
| `plan <ID>`       | `remediation.md`                     | —                            |
| `fix <ID>`        | `remediation.md` + `safety-model.md` | detected gate                |
| `verify [<ID>]`   | `remediation.md`                     | re-run the relevant analyzer |

`stack-adapters.md` only when the stack is unsupported or you are adding an adapter.

## Workflow

### 0. Orient — always

```
node .claude/skills/repo-cleanup/scripts/detect-stack.mjs
```

Emits `stack.json`. A repo with no manifest and no git is valid input: degrade, do not fail.
Read the host `CLAUDE.md` + `.claude/rules/**`. Load `finding-model.md` and `safety-model.md`.

### 1. Measure

Run the invoked mode's script(s); load only that mode's reference. Scripts print JSON to stdout.
Announce anything _potentially expensive_ before running it and bound it with a timeout.

Save each result: `writeEvidence(root, name, data)` from `scripts/report.mjs`.

### 2. Interpret

Turn `observations[]` into findings via `makeFinding()` in `scripts/findings.mjs` — it **enforces**
the schema and will throw on an empty `limitations` or an estimate claiming `confirmed`. That is
the guard working; fix the finding, do not bypass it.

Impact needs volume. Without `tokens` data, a footprint finding's impact is `unquantified` and its
confidence is at most `medium`. Say so rather than inventing a multiplier.

Drop observations that do not support a finding. An observation is not a finding.

### 3. Report

```js
writeReport({ root, mode, ranAt, stack, findings, summary, notVerified, ran });
```

Ranking, grouping and section order are deterministic — do not hand-format the report. Record a
baseline with `writeBaseline()` so `verify` has something to compare against.

In chat: the top three findings and the single first action. Link `.repo-cleanup/report.md`; do not
paste it.

### 4. `plan` / `fix` / `verify`

Follow `remediation.md`. `fix` requires one finding id, a clean tree, re-confirmed evidence, no
protected path, the smallest change, and the detected gate green afterwards. Gate red ⇒ stop and
restore. Settings changes route through the bundled **`update-config`** skill.

### 5. Self-audit — every run

If `SKILL.md` exceeds its 6 KB cap, or a reference has grown detail belonging in a script, raise it
as a `DOC-` finding against this skill. It is not exempt from its own rules.

## Do not rebuild what exists

- `settings.json` edits → **`update-config`**.
- Permission-prompt reduction → **`fewer-permission-prompts`**.
- Logic review → `/code-review`, `/simplify`, `/security-review`. This skill finds _dead_ and
  _duplicated_ code; it does not review correctness.

## Install elsewhere

Copy `.claude/skills/repo-cleanup/` and `.claude/commands/repo-cleanup.md` into the target repo,
then `node .claude/skills/repo-cleanup/scripts/validate-installation.mjs`. Optional
`.repo-cleanup.yml` at the repo root (documented subset — see `scripts/config.mjs`). **Never write
into another repository on the user's behalf**; hand them the steps.

Tests: `node --test ".claude/skills/repo-cleanup/tests/*.test.mjs"`.
