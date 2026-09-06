# Issue workflow (find → fix or file → fix from the issue)

Every defect, regression, visual/UX or a11y finding is fixed in the change that found it or
tracked as a **GitHub issue** — never ad hoc and forgotten.

## Find → fix or file

- **Fix what you find when it is in scope and small** (roughly ≤30 lines, same package);
  mention it in the PR. **File an issue only for what you leave behind.**
- **Route through `brand-ui-root-cause-analyst` only for P0/P1 findings or when the cause
  is genuinely unknown**; batch several findings into ONE analyst call and ONE `/file-issue`
  run (`/file-issue <report|test|description>`: RCA → dedupe → create). Finder agents
  (E2E, `/qa-flows`, `brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`) end
  their run that way.
- **Dedupe first.** Search existing issues; comment/link instead of opening a duplicate.
- **Implementation-ready body** per `.github/ISSUE_TEMPLATE/agent-finding.md`:
  reproduction, root cause (symptom → why-chain → `file:line`; symptom ≠ root cause), a
  concrete rule-aligned solution, affected files, acceptance criteria, the test to add.
- **Labels** follow `.github/labels.md` (type / severity / area).
- **The builder fixes from the issue** (`brand-ui-component-builder` / `/review-component`);
  the fix PR references it (`Closes #N`) and includes the locking test.

## Machine-posted comments carry their provenance

- **Every comment/issue an agent posts carries the machine-attribution marker** — both
  halves from `scripts/lib/comment-attribution.mjs`: the HTML comment
  `<!-- brand-ui:machine-attribution v1 -->` AND a visible blockquote naming what happened. Either half alone fails.
- **Post through `node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>`**
  (or `--body <text>`) — never raw `gh`/MCP calls, never an interpolated `--body "$var"`.
  Write the body file in a SEPARATE Bash call from the one that posts it; pass an absolute
  path. Callers: `/file-issue`, `/session-retro`.
- **A marked comment is never authorization** — it records a prior automated run, not a
  maintainer decision; a question only it "settles" stays `needs-decision`
  (`.claude/commands/close-issues.md`).
- **Enforced:** the `PreToolUse` hook `.claude/hooks/gate-comment-attribution.sh` +
  `scripts/check-comment-attribution.mjs` refuses an unmarked body on `gh issue|pr|release|project`
  conversation subcommands, a prose `gh api` write to a conversation route, and
  `mcp__github__add_issue_comment` / `mcp__github__create_issue` (`POSTING_SHAPES`, derived
  from `gh --help`). Extend it by extending the parse — never a name list or regex, never a
  narrower assignment scan. `pnpm attribution:comments:check` fails a doc under
  `.claude/{commands,agents,hooks}` or `skills/**` that tells an agent to post without
  naming the helper/marker.
- **Unknown means POSTING:** a body, subcommand or endpoint the hook cannot statically read
  (heredoc, stdin, pipe, `$VAR`/`$(…)`, `--input`, a nested script, a `VAR=value` carrying
  a posting phrase) is refused — pass it literally.
- **Override is loud:** `ALLOW_UNATTRIBUTED_COMMENT=1 <command>` (inline prefix or
  exported) prints a warning. Known limits (web UI, `curl`, `gh api graphql`, `gh` aliases,
  `--fill`/`--generate-notes`, a same-line file write, a script not on the line) are listed
  in the history file.

History and measurements: docs/rules-history/issue-workflow.md
