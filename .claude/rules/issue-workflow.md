# Issue workflow (find → diagnose → file → fix)

Every defect, regression, visual/UX problem or accessibility violation — whether
found by an agent during testing or entered by a person as feedback — is tracked
as a **GitHub issue**. Nothing is fixed ad hoc and forgotten.

## Separation of duties

1. **Finders report, they do not fix.** The E2E suite, `/qa-flows`,
   `brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`, and human feedback only
   _surface_ problems. They never edit product code.
2. **The analyst diagnoses.** Every finding goes through the
   `brand-ui-root-cause-analyst` agent (via `/file-issue`), which performs deep root-cause
   analysis and designs the solution. No issue is filed without this.
3. **The builder fixes — from the issue.** `brand-ui-component-builder` /
   `/review-component` implement the fix described in the issue and add the
   "Test to add" so the bug can't return.

## Rules

- **No fix without an issue.** If you find something while doing other work, file
  it with `/file-issue` rather than silently patching it (unless it's the task
  you were explicitly asked to do).
- **Deep RCA is mandatory** before filing: symptom → why-chain → true root cause
  (with `file:line`), then a concrete, rule-aligned solution. Symptom ≠ root cause.
- **Dedupe first.** Search existing issues; comment/link instead of opening a
  duplicate.
- **Implementation-ready.** The body must follow the canonical structure (see
  `.github/ISSUE_TEMPLATE/agent-finding.md`) and be detailed enough that a coding
  agent can implement it without re-investigating: reproduction, root cause,
  proposed solution, affected files, acceptance criteria, the test to add.
- **Labels** follow `.github/labels.md` (type / severity / area).
- **The fix PR references the issue** (`Closes #N`) and includes the locking test.

## Entry points

- `/file-issue <report|test|description>` — the pipeline (RCA → dedupe → create).
- Finder agents end their run by routing each finding through `/file-issue`.

## Machine-posted comments carry their provenance (#78)

This repo's automation has **no separate bot identity** — every comment or issue
it posts (via `gh`, or the GitHub MCP tools) goes up under the maintainer's own
`gh` account. Read cold, later, a machine-drafted comment is indistinguishable
from something the maintainer actually typed. The failure this closes: a
`/close-issues` run cited an EARLIER machine-drafted comment as if it were a
maintainer's ruling and used it to justify closing an issue — a circular
authority loop where automation authorizes itself.

- **Every comment/issue an agent posts must carry the machine-attribution
  marker** — two independently-checkable halves defined in
  `scripts/lib/comment-attribution.mjs` (`render()`/`hasMarker()`): a versioned
  HTML comment (`<!-- brand-ui:machine-attribution v1 -->`, invisible when
  rendered but machine-detectable) and a visible Markdown blockquote naming what
  happened. Either half alone fails.
- **Post through the shared helper, not raw `gh`/MCP calls.**
  `node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>`
  (or `--body <text>`) builds the marker in and always posts with
  `--body-file`, never an interpolated `--body "$var"`. `/file-issue` and
  `/session-retro` are the reference call sites.
- **A comment carrying the marker is never authorization.** It records what a
  PRIOR AUTOMATED RUN concluded — not a maintainer decision. A question a later
  run can only "settle" by pointing at a machine-marked comment is still
  `needs-decision`; see `.claude/commands/close-issues.md`.
- **Enforced, not just documented.** A `PreToolUse` hook
  (`.claude/hooks/gate-comment-attribution.sh` +
  `scripts/check-comment-attribution.mjs`) blocks a `gh issue comment` /
  `gh issue close --comment` / `gh issue create` / `gh pr comment` /
  `gh pr review --body` Bash call, a `gh api` POST/PATCH/PUT to a
  comment/issue/review endpoint, or `mcp__github__add_issue_comment` /
  `mcp__github__create_issue`, whose body is missing the marker. A body the hook
  cannot statically inspect (stdin redirect, heredoc, piped input, a device, or
  a `$VAR`/`$(…)` the shell would expand) is **refused outright**, not passed
  through. `pnpm attribution:comments:check` separately scans
  `.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/hooks/*.sh` and
  `skills/**` so a doc that tells an agent to post a comment must also point it
  at the helper/marker.
- **The hook PARSES the command line; it does not pattern-match it.** Two
  earlier rounds of this gate were defeated by ordinary shell grammar — first by
  `--body=value` (only `--body value` was recognized), then by `cd X && gh …`
  (only `gh` at token 0 was recognized). The guard now tokenises the command
  respecting quotes, escapes and line continuations, walks **every** simple
  command in it (across `&&`, `||`, `;`, `|`, newlines, subshells, command
  substitutions, `eval` and `sh -c`), treats any command whose argv[0] basename
  is `gh` as a candidate regardless of position, path or leading `VAR=…`
  assignments, skips `gh`'s own `--repo`/`-R` global flags, and checks **every**
  body-carrying flag in **every** candidate — not the first one it finds.
  Extending it means extending the parse, never adding another regex.
- **Overriding it — both forms work, and both are loud.** A human typing their
  own ruling through the CLI may use either
  `ALLOW_UNATTRIBUTED_COMMENT=1 gh issue comment …` (an inline prefix, which the
  hook reads out of the parsed command) or `export ALLOW_UNATTRIBUTED_COMMENT=1`
  (the session environment). Either way the hook prints a warning naming the
  override to stderr; a silent escape hatch would not be the "loud, logged" one
  this rule promises.
- **Known, accepted limits — these are declared, not undiscovered.** (1) Nothing
  here can stop a human from pasting an unmarked comment straight into the
  GitHub web UI; this gate binds the agent/CLI/MCP tool path inside a Claude
  Code session, not GitHub itself. (2) A posting channel that is not `gh` and
  not one of the two gated MCP tools — a raw `curl` against `api.github.com`, a
  `gh api graphql` `addComment` mutation, a third-party client — is not seen.
  (3) The gate reads the bytes the command line contains; a body a script
  computes at runtime cannot be read, so it is refused rather than inspected.
  (4) A user-defined `gh` alias (`gh cmt 26 --body …`) is expanded inside `gh`
  from a config file this gate does not read, so the subcommand match cannot see
  it. (5) A relative `--body-file` path is resolved against the hook's working
  directory, not a `cd` earlier in the line; when that fails the call is
  **refused**, so it costs a false refusal rather than a bypass — pass an
  absolute path. These are intentional boundaries of "inspect the tool call",
  not gaps to close by widening a regex.
