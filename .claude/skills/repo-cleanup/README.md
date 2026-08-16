# repo-cleanup

An evidence-driven auditor for a repository **and its Claude Code setup**: where the tokens go,
where the time goes, and what is dead weight. Read-only by default. Every finding carries evidence,
a confidence level, and what was not verified.

Zero dependencies. Node ≥ 22. Portable — no assumption about language, package manager or layout
beyond what `scripts/detect-stack.mjs` reports.

## Why it exists

Static inspection of `CLAUDE.md`, skills and MCP config tells you the **floor**. It cannot tell you
what a session actually cost, and it is structurally blind to subagents. In the repo this was
built in, subagent sidecars were **81 % of all cache-read tokens** — invisible to every static
audit, and only findable by reading the transcripts.

So this does both: the static footprint _and_ the usage forensics, and it insists on the difference
between a measurement and an estimate everywhere.

## Workflows

```
/repo-cleanup                # full audit, read-only
/repo-cleanup context        # always-loaded footprint + settings levers
/repo-cleanup tokens         # usage forensics: sessions, subagents, growth curve
/repo-cleanup docs           # instruction hygiene: duplication, staleness, misplacement
/repo-cleanup repo           # dead files, unused deps, disabled tests, git churn
/repo-cleanup plan <ID>      # remediation plan for one finding (writes only the plan)
/repo-cleanup fix <ID>       # one finding, guarded
/repo-cleanup verify [<ID>]  # re-measure against the baseline
```

Output goes to `.repo-cleanup/` at the repo root: `report.md`, `baseline.json`, `evidence/`,
`plans/`.

## Safety model

- **Read-only by default.** `audit`, `plan` and `verify` write nothing outside `.repo-cleanup/` —
  not `.gitignore`, not source, not settings. `git status --porcelain` is asserted unchanged.
- **`fix` takes one finding**, needs a clean tree, makes the smallest change, re-runs the detected
  gate, and stops on failure. There is no "fix everything" verb.
- **Nothing is ever deleted automatically.** Deletion candidates carry the searches run, the
  searches **not** run, and the dynamic-loading risk. High-risk categories (migrations, fixtures,
  deploy, locales, served assets, `.d.ts`) can never exceed `low` confidence.
- **No secret reaches a report.** Everything written passes `redact()`. Credential files are
  detected by filename and never opened. Transcripts are read for counts only — no message text,
  tool arguments or results, ever, locked by a sentinel test.
- **Nothing leaves the machine.** No uploads, no telemetry, no network without explicit approval.

## Install

Copy two paths into the target repo:

```
.claude/skills/repo-cleanup/
.claude/commands/repo-cleanup.md
```

Then validate:

```bash
node .claude/skills/repo-cleanup/scripts/validate-installation.mjs
```

13 checks; exit 0 means the skill works in this repo. It also enforces the skill's own 6 KB
`SKILL.md` cap — a skill that grows domain detail into its always-listed entry is the anti-pattern
this tool exists to find.

Optional: add `.repo-cleanup/` to `.gitignore`. Do this as a deliberate step; the audit will not do
it for you.

### Uninstall

Delete those two paths and `.repo-cleanup/`. Nothing else is touched, and nothing was installed
globally.

## Configuration

`.repo-cleanup.yml` (or `.json`) at the repo root. Every key is optional; defaults are safe.

```yaml
version: 1
exclude: [node_modules, .git, dist, build, out, coverage, vendor]
protected_paths: [] # fix mode refuses to touch these, whatever a finding says
gate: auto # or an explicit command string
limits: { command_timeout_seconds: 300, max_command_output_kb: 512, max_file_size_mb: 10 }
audit: { context: true, tokens: true, docs: true, repo: true, git: true }
performance: { repetitions: 3, warmup_runs: 1 }
privacy: { redact_secrets: true, allow_network: false, include_source_snippets: false }
remediation: { require_clean_git: true, allow_automatic_deletion: false }
pricing: { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 } # USD per MILLION tokens
```

**`pricing` is absent by default on purpose.** Guessing a price list would make the most quotable
number in the report the least defensible one. Set it and the cost estimate appears, labelled an
estimate.

The YAML reader is a hand-rolled **documented subset** (scalars, inline and block sequences/maps,
comments). It throws on anything else — anchors, aliases, multi-line scalars, tabs, sequences of
maps — rather than half-parsing. A `.repo-cleanup.json` file takes precedence and avoids the
question entirely.

## Stack support

| Stack                | Detection                                                   | Gate candidates                                                            |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node / TypeScript    | `package.json`, `tsconfig.json`, lockfiles                  | `scripts.{typecheck,test,lint,build,e2e}`                                  |
| Python               | `pyproject.toml`, `requirements.txt`, `setup.py`, `Pipfile` | `pytest`, `ruff check .`, `mypy .`                                         |
| Go                   | `go.mod`                                                    | `go test ./...`                                                            |
| Rust                 | `Cargo.toml`                                                | `cargo test`                                                               |
| Docker / Java / Ruby | manifests                                                   | detected, no gate — reported so the report can say what was _not_ measured |
| Anything else        | —                                                           | degrades to the generic adapter; `unsupported` explains why                |

`context`, `docs` and `tokens` modes need **no** stack at all. A repo with no manifest and no git
is valid input.

Adding an adapter: `references/stack-adapters.md`.

## Known limitations

These are structural, not bugs. Every finding restates the ones that apply to it.

- **Import extraction is regex, not a parser.** Computed specifiers, reflection, plugin registries
  and runtime-built paths are invisible. Anything reported as unreachable may simply be reached in a
  way this cannot see — which is why nothing is ever `confirmed` dead.
- **Token counts from file sizes are `chars / 4` estimates.** Only transcript `usage` figures are
  exact. The two are never mixed without labels.
- **MCP tool-schema cost is not measured.** Knowing it means connecting to each server; a read-only
  audit does not connect. Reported as a declared gap, never as zero.
- **SessionStart hook output size is not measured.** Running a hook to size it is a mutating act.
- **Contradictions between rules are not detected.** Only overlapping headings are flagged, as
  places to look.
- **Duplication detection is lexical.** Two rules saying the same thing in different words are not
  found.
- **Transcripts cannot attribute cost to a specific skill, rule file or MCP server.** They record
  what the client sent and received. Any such attribution is inference and is labelled as such.
- **No authorship or bus-factor analysis.** Deliberate: a single-commit signal is a bad basis for a
  claim about a person.
- **`git status` is the rollback guarantee.** In a repo with no git, `fix` mode has no safety net
  and says so.

## Privacy and telemetry

There is no telemetry. Nothing is uploaded. `privacy.allow_network` is `false` by default and any
network access requires in-turn approval. Evidence stays under `.repo-cleanup/` on the local
machine.

Transcript analysis emits counts, token totals, timestamps and **tool names** only. Tool names are
the one deliberate exception — API metadata with a fixed vocabulary, and the most actionable signal
in the material mix. Everything else about a tool call stays in the transcript.

## Tests

```bash
node --test ".claude/skills/repo-cleanup/tests/*.test.mjs"
```

128 tests over fixture repos containing deliberate defects: orphan files, a migration that looks
dead, a config-referenced file the import graph cannot see, a `.only` test, an oversized
instruction file, duplicated prose, a stale citation, a repo with no manifest, a repo with no git,
and paths containing spaces. Sentinel strings assert that no conversation content and no
secret-shaped value ever reaches a report.

They are intentionally **not** part of the host repo's own quality gate — this is tooling, not the
app, and diluting the app's suite would be a regression.

## Troubleshooting

| Symptom                                             | Cause                                                                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolved: false` from `tokens` mode                | The transcript path is derived from the repo path. A repo opened via a symlink or a different absolute path has a different slug. Pass `--transcript-dir`. |
| Everything looks unused                             | Check `entryPoints` in `repo-inventory.mjs` output first. An unusual entry convention produces false candidates wholesale.                                 |
| Dozens of stale citations                           | Check whether the docs cite another repository. Those resolve nowhere by design; the observation already separates `likelyIntentional`.                    |
| A finding was refused by `makeFinding()`            | That is the guard. Empty `limitations`, or an estimate claiming `confirmed`. Fix the finding.                                                              |
| `validate-installation` fails on the `SKILL.md` cap | Move detail into `references/`. The cap is the point.                                                                                                      |
