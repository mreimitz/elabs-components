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
  `scripts/check-comment-attribution.mjs`) blocks any Bash call that publishes
  prose into a GitHub conversation with no marker: `gh issue`
  `comment`/`create`/`edit --body`/`close --comment`/`reopen --comment`,
  `gh pr` `comment`/`create`/`edit`/`close`/`reopen`/`revert`/`review`/
  `merge` with a body flag, `gh release create|edit --notes`,
  `gh project item-create|item-edit --body`, a `gh api` POST/PATCH/PUT to a
  conversation route (see below), or `mcp__github__add_issue_comment` /
  `mcp__github__create_issue`. A body the hook
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
- **Unknown means POSTING.** When the parser cannot statically tell what a `gh`
  call does — the subcommand is behind an expansion (`gh issue $SUB 26 --body
…`), or a write's `gh api` endpoint is — the call is **refused**, not waved
  through. A guard whose unknown case is "allow" is defeated by making the
  command harder to read, which is the cheapest possible attack. Pass the
  subcommand literally, or override deliberately.
- **The gated list is DERIVED from `gh`'s own help, not hand-kept.** The recipe
  is written above `POSTING_SHAPES` in `scripts/check-comment-attribution.mjs`
  so you can re-run it rather than trust it: walk every `gh` group and
  subcommand from `gh --help`, keep the ones that satisfy BOTH criteria —
  (a) it publishes into a **conversation** about the work (issue, pull request,
  review, release), and (b) the flag carries **free-form prose the marker can
  live in** (`--body`/`--body-file`/`--comment`/`--notes`/`--notes-file`) —
  then read that subcommand's FLAGS block for the exact pflag grammar. Both
  criteria are load-bearing: (a) alone would gate `gh secret set --body`, where
  `--body` is the secret's VALUE; (b) alone would gate a repo description. The
  same two criteria pick the `gh api` routes: drop trailing id segments from
  the endpoint and gate it when the remaining tail names a conversation
  resource, which is why `PATCH …/issues/26` and `PATCH …/issues/comments/999`
  are gated while `PUT …/issues/26/lock` and `POST …/issues/26/labels` are not.
  The rung-2 doc scan's regex is **generated from that same table**, so the doc
  scan and the runtime gate cannot describe different surfaces.
- **A `gh api` call is gated only when all THREE hold**: it is a **write**
  (POST/PATCH/PUT, or fields with no method), to a **conversation route**, and
  it **carries prose** (a `body=`/`message=`/`commit_message=` field). A read
  is untouched whatever its route; a write to `…/lock`/`…/labels`/`…/reactions`
  is untouched; and a prose-free write such as
  `gh api -X PATCH repos/o/r/issues/26 -f state=closed` is untouched too — it
  posts nothing to mark, exactly as `gh issue edit 26 --add-label x` does not.
  A payload the gate cannot **read** is a different matter and still refuses:
  `--input`, an unreadable `body=@file`, a field the shell would expand, or a
  write whose endpoint is hidden by an expansion.
- **`--help`/`-h` is judged by POSITION, not by presence.** pflag consumes the
  word after a value-taking flag even when it starts with `-`, so
  `gh issue create --title -h --body "…"` really does post — `-h` is the
  title. The gate walks the flags the way pflag does and honours a help word
  only where it is genuinely a flag; `gh issue comment --help` still passes.
  Where the walk cannot tell whether a flag takes a value it assumes it does,
  which costs a refusal on a contrived line rather than a bypass.
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
  absolute path. (6) A `--body-file`/`--notes-file` is read **as it stands when
  the hook runs**, which is before the command executes: if the same command
  line writes that file first (`printf … > body.md && gh issue comment 26
--body-file body.md`), the gate judges the OLD bytes, so a file that was
  marked a moment ago passes even though the text actually posted is the new,
  unmarked content. Nothing at this layer can fix it — the final content does
  not exist yet. **What to do:** write the body in a SEPARATE Bash call from
  the one that posts it, so the hook sees the real bytes on the posting call,
  or post through `scripts/post-issue-comment.mjs`, which renders the marker
  itself. (7) `gh pr create --fill` and `gh release create --generate-notes`
  build the body inside `gh` or on GitHub's side, so there is no body on the
  command line to read or mark; they are not gated. These are intentional
  boundaries of "inspect the tool call", not gaps to close by widening a regex.
