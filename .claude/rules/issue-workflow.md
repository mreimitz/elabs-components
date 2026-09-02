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
- **The hook PARSES the command line; it does not pattern-match it.** Three
  earlier rounds of this gate were defeated by ordinary shell grammar — first by
  `--body=value` (only `--body value` was recognized), then by `cd X && gh …`
  (only `gh` at token 0 was recognized), then by `bash -lc "gh …"` (only the
  exact token `-c` was recognized, so one extra letter in the flag cluster hid
  the whole script — and with it all 18 gated shapes). The guard now tokenises
  the command respecting quotes, escapes and line continuations, walks **every**
  simple command in it (across `&&`, `||`, `;`, `|`, newlines, subshells,
  command substitutions and `eval`), treats any command whose argv[0] basename
  is `gh` as a candidate regardless of position, path or leading `VAR=…`
  assignments, skips `gh`'s own `--repo`/`-R` global flags, and checks **every**
  body-carrying flag in **every** candidate — not the first one it finds.
  Extending it means extending the parse, never adding another regex.
- **A nested script is found by the interpreter's own OPTION GRAMMAR, not by a
  list of spellings.** The table lives above `SCRIPT_INTRODUCERS` in
  `scripts/lib/shell-command-parse.mjs` together with the usage output each row
  was derived from, so it can be re-derived rather than trusted: `-c` **anywhere
  in a short-flag cluster** for every POSIX shell (`bash -lc`, `-ec`, `-xc`,
  `-cx`, `-euxc`, `dash -ce`, `zsh -ic` … — POSIX Utility Syntax Guideline 5
  grouping, each verified to execute here), `env -S str` in all four spellings
  (`-S str`, attached `-S"str"`, clustered `-iS`, GNU `--split-string=`), and
  `ssh`'s flag-less operand list, which ssh(1) runs on the remote host as a
  shell command. The lookup is **position-independent**, so a wrapper in front
  of the interpreter (`nohup`, `timeout`, `xargs`, `command`, `env`, `nice`)
  hides nothing; and every option spelling **of a tool that has a row** is
  covered by a fail-closed superset — the whole operand list after that tool's
  name is re-parsed as one script, which is what also catches a `<<<`
  herestring. A literal producer piped into an interpreter
  (`echo "gh …" | bash`) is read the same way: the bytes are on the line, so a
  pipe is not a hiding place either.
- **Which tools are interpreters is NOT a list — the default is inverted.** The
  bullet above is about option spellings; it cannot answer _"which tools are
  there?"_, and that gap is what let `csh -c "gh issue comment …"` — a shell in
  `/bin` with no row — walk all 18 gated shapes through fix round 6. So an
  operand of an **unrecognised command word** is a CANDIDATE to be re-read as a
  script, whatever the command word is (`nestedOperandCandidates` in
  `scripts/check-comment-attribution.mjs`); `csh`, `tcsh`, `pwsh`, `fish` and a
  name invented next year are all the same case, because none of them has to be
  known. The recognised half is instead a short, arguable set of commands that
  can only PRINT their operand (`echo`, `printf`, `grep`, `rg`) — a name missing
  from THAT costs a false refusal, which is loud and overridable, where a name
  missing from an interpreter list cost a silent bypass. **Every non-empty
  operand is now unconditionally re-read (#96, fix round 8) — there is no
  operand-text prefilter left to skip one; the next bullet states what
  changed and what is still not caught.** **Residual, stated plainly:** a
  nested call must also reach for a **body** to be refused, so a body-less
  `gh issue comment 26` hidden in an operand is not caught — with no body
  flag `gh` prompts interactively and, with no TTY, answers `flags required
when not running interactively` without reaching the API. At a command
  position a body-less call is still refused.
- **Fix round 8 (#96) closed most of the fix-round-7 residual — declared here,
  not just fixed in the code.** Round 7's inversion (the bullet above) was
  itself gated behind two operand-TEXT prefilters in `nestedOperandCandidates`
  (`scripts/check-comment-attribution.mjs`): `word.expanded` skipped any
  operand containing a shell expansion outright, and
  `NESTED_GH_RE = /(?:^|[\s/])gh\s/` was a literal-text match that a subshell,
  a space-free `&&`, a quoted/escaped `gh`, or a known shell nested one level
  inside the unknown one all slipped past unseen. **Both prefilters are gone.**
  Every non-empty operand is now re-parsed via `ShellWord.raw`
  (`scripts/lib/shell-command-parse.mjs`) — which keeps an expansion's own
  syntax (`$VAR`, `$(…)`) visible at the position it occupies instead of
  erasing it — and the STRUCTURAL result decides, not a regex over the
  original text.
  **What this closes, restated against the exact fix-round-7 reproductions:**
  `csh -c "gh issue comment $N --body 'text by $USER'"` now REFUSES (the body
  re-parses as an expanded word, uninspectable — the accident path round 7
  called its largest residual gap); `csh -c "(gh issue comment 26 --body
'…')"` and `csh -c "true&&gh issue comment 26 --body '…'"` now REFUSE (no
  text-match prefilter left to slip past); quoting or escaping the `gh` word
  (`'gh'`, `"gh"`, `\gh`) no longer helps, because there is no text match to
  defeat; and a known shell nested inside the unknown one
  (`csh -c "sh -c 'gh issue comment …'"`) is caught, because the re-parse
  recurses through the same `SCRIPT_INTRODUCERS` handling the top level uses.
  **What it COSTS, in the same breath:** reading through the quotes also means
  reading through them in prose, so
  `git commit -m "docs: quote 'gh' issue comment --body in the guide"` — ALLOWED
  before this round — is now REFUSED. Measured against merge-base `main` over a
  52-command corpus of ordinary work, that is the ONLY new false refusal, and
  the same round removes one. The fix-round-7 false refusal
  (`git commit -m "fix(hooks): the gh issue comment gate now blocks
--body=text"`) is **NOT** fixed — round 8 did fix it, with a command-position
  restriction fix round 10 had to revert; see the round-10 bullet below for why
  and for what that costs. A same-shaped, pre-existing false refusal ONE LAYER
  OUTSIDE this widening closed in the same round:
  `make deploy MSG="gh issue comment --body ready"` used to re-parse make's
  own positional argument as if it were a shell assignment (a SEPARATE
  mechanism — `parseShellCommands`'s own "assignment carries a whole command"
  pass used to scan every `VAR=value`-shaped word in a line regardless of
  position); that scan was scoped to the leading assignment run, plus the
  operands of a leading `export`/`declare`/`typeset`/`local`/`readonly`
  builtin, which really are assignments. **This scoping is SUPERSEDED by fix
  round 12 below** — two further rounds (11, then the `${!NAME}` bypass that
  defeated it) established that no version of "is this assignment actually
  used?" holds up, and round 12 reverts this scan to unconditional again,
  reopening `make deploy MSG=…` as a deliberate, named, accepted false
  refusal. **What is still open, unchanged by
  this round** — narrower now that the text-match evasions are gone: (1) a
  producer piped through an intermediate stage into a shell
  (`printf '%s' "gh issue comment 26 --body '…'" | tee /tmp/p.sh | sh`) still
  escapes the pipeline arm of this inversion — the sink-detection only
  recognises a sink with no non-flag operand, and `tee`'s filename argument
  defeats that; pre-existing, not newly opened or closed. (2)
  `gh api graphql`'s `addComment` mutation — already declared below as an
  unseen posting channel; parsing GraphQL documents is not a reasonable ask of
  a command-line gate. (3) a body-less nested call (a hidden
  `gh issue comment 26` with no body flag) is still not caught, unchanged from
  round 7 — see the body-reach bullet above. **The seven declared limits below
  this bullet are unaffected.** **The honest summary, updated:** against an
  agent that is not trying to evade this gate, it stops every ordinary spelling
  of an unmarked post, including the `$VAR` that used to walk straight through;
  against one that is trying, the remaining gaps are the pipeline relay and the
  GraphQL mutation, both of which need a deliberate extra stage to reach, not a
  stray character. The gate is **more likely to false-refuse** a commit message
  about itself than it was before round 7 — that is a deliberate trade, not an
  oversight, and the override is printed at the moment of refusal.
- **Fix round 10 (#96) REVERTED the command-position restriction rounds 8 and 9
  shipped — the wrapper allowlist was the same anti-pattern one level down.**
  Round 8's Part C restricted the nested re-read to argv[0] of each re-parsed
  simple command, to spare prose that merely mentions a posting phrase. Read
  literally, that made a leading wrapper the command word: `csh -c "nohup gh
issue comment 26 --body '…'"` re-parsed as a command whose position was
  `nohup`, the real invocation was skipped, and all 18 gated shapes posted
  unmarked behind `nohup`/`sudo`/`timeout`/`xargs`/`command`/`exec`/`time` and
  behind a `{ … ; }` brace group — **a bypass merge-base `main` does not have**,
  since `main`'s nested search never restricted by position. Round 9 repaired
  that by teaching the position walk a **seven-name wrapper allowlist**
  (`realCommandWordIndex`) and **reproduced the bug one level down**: `setsid`,
  `nice -n 10`, `stdbuf -oL`, `doas`, `watch`, `ionice` and any name invented
  next year were not on the list, and a LISTED wrapper whose flag takes a
  separate value word (`sudo -u root`, `timeout -s KILL 5`, `exec -a name`) had
  that value consumed as the command position — nine attack shapes ALLOWED that
  `main` REFUSES, found by an independent differential probe, with the code's
  own doc comment asserting the case was "never a missed invocation".
  **The rule both rounds broke is the one stated two bullets up:** which tools
  pass execution through is NOT a list, the default is inverted, and extending
  it means extending the parse — never adding another name. Applied honestly to
  "does this word pass execution through to the next one?", the recognised half
  is **empty** — nothing can be proved not to be a wrapper — so every leading
  word is a possible wrapper, every index is a possible command position, and
  the restriction dissolves into the position-independent search the top level
  has always run. Round 10 therefore deletes `WRAPPER_COMMANDS`,
  `realCommandWordIndex()` and the `atCommandPositionOnly` option outright: the
  nested arm is position-independent again, identical to `main`, and there is no
  list left to go stale.
  **What that costs, stated plainly:** the precision round 8 bought is given
  back. Two prose lines are REFUSED again exactly as `main` refuses them —
  `git commit -m "fix(hooks): the gh issue comment gate now blocks
--body=text"` and `git commit -m "docs: quote 'gh' issue comment --body in the
  guide"` (the second is `main`'s behaviour plus round 8's widening). A false
  refusal is loud, costs one retry, and prints its own override
  (`ALLOW_UNATTRIBUTED_COMMENT=1 <command>`); the alternative on the table was a
  silent post, so the ambiguous position stays a candidate. This refusal lands
  **hardest on the people maintaining this gate itself**, since a commit
  message describing a change to the gate is the likeliest text anyone will
  write that carries both a posting phrase and a body-shaped flag — the two
  named examples above are exactly that shape. `make deploy
MSG="gh issue comment --body ready"` stays FIXED — that was a different
  mechanism (the assignment-run scoping), untouched here.
  **Evidence, not reasoning:** a differential probe ran the same corpus against
  merge-base `main` and this tree — **2,394 attack cases** (18 gated shapes ×
  31 wrapper/grouping spellings × literal and `$VAR` bodies × two
  unknown-interpreter rows, plus top-level, `bash -lc`, `env -S`, `ssh`,
  pipe-into-shell and shell-in-shell rows) with **zero** cases ALLOWED here that
  `main` REFUSES, and 1,080 that `main` ALLOWS now refused. Locked in
  `scripts/check-comment-attribution.test.mjs` by a wrapper sweep whose list is
  deliberately **the names no allowlist ever contained**, and by an end-to-end
  test through the real shell hook; the two prose refusals are asserted there
  too, so the cost is recorded in the suite rather than only in prose.
  **That "zero" was corpus-limited and is corrected by the round-11 bullet
  below.** It varied the interpreter/wrapper axis while pinning every
  assignment-carrying case to the LEADING position, so the 26 assignment-position
  bypasses round 11 closed were outside what it measured. A differential zero is
  a statement about the axes the corpus varied, never about the gate. **Round
  11's own "0 remain" claim went on to suffer the identical fate** — see the
  round-12 bullet below, which is the same lesson landing a second time on an
  axis (dereference form) neither this corpus nor round 11's varied.
- **Fix round 11 (#96) — SUPERSEDED BY FIX ROUND 12 BELOW.** This bullet is
  **history** — what round 11 did and why it failed, not a description of what
  the gate does today; the round-12 bullet below is what runs now. Round 11
  closed the ASSIGNMENT-POSITION bypasses round 8's scoping opened — list-free,
  keyed on `$VAR` syntax. Round 8 had fixed the
  `make deploy MSG="gh issue comment --body ready"` false refusal by scoping
  the "assignment carries a whole command" re-read (`parseShellCommands` in
  `scripts/lib/shell-command-parse.mjs`) to the LEADING assignment run plus an
  assignment builtin's `VAR=value`-shaped operands. That window was positional,
  and two ordinary shapes sat outside it — both of which merge-base `main`
  refused, and both of which really executed the post:
  `env CMD="gh issue comment 26 --body …" sh -c '$CMD'` (the assignment was
  AFTER a command word, so the leading run ended at index 0 and the scan never
  ran) and `declare -x CMD="…"; $CMD` (the builtin's `-x` operand was not
  `VAR=value`-shaped, so the operand walk broke before the assignment).
  **Three rounds of review missed this because every test in the suite pinned
  the assignment to the leading position** — the suite was green with the
  bypass present.
  **The repair named no command.** Deciding that `env`'s post-command
  assignment is executable while `make`'s is inert requires knowing which
  commands consume assignments — the round-9/round-10 anti-pattern one
  mechanism over, where the missing name would have been silent. Round 11
  keyed on shell VARIABLE SYNTAX instead: a `VAR=value` word was re-read
  wherever it sat, but only when the same line also EXPANDED `$VAR` / `${VAR}`.
  An assignment nothing on the line expands could not make that line post,
  whoever the command word was, so `make deploy MSG=…`,
  `docker run -e CMD=… alpine true`, `terraform apply -var …`,
  `kubectl set env …` and a bare `declare -x CMD=…` all stayed ALLOWED —
  round 8's false-refusal fix was kept, without a list.
  **What it COST:** the match was on the variable NAME, so a line that
  carried a `gh`-shaped `MSG=` word and separately expanded `$MSG` for an
  unrelated reason was refused —
  `make deploy MSG="gh issue comment --body ready" && echo "$MSG"` REFUSED
  (exactly as `main` refuses it), while the same line expanding `$OTHER` was
  allowed. Over a 20-command ordinary-work corpus that was **zero new false
  refusals** against merge-base `main` and zero against the pre-round branch
  tip. **What it still could not see, unchanged from `main`:** an assignment
  made in an EARLIER Bash tool call and expanded in a later one — those bytes
  were not on this line at all.
  **Evidence:** a 35-case attack corpus that varied the ASSIGNMENT-POSITION
  axis explicitly (leading · after a command word · after a wrapped command
  word · assignment builtin with an option · assignment builtin without one ·
  one nesting level down) plus 8 inert and 20 ordinary-work cases, each driven
  through the real `PreToolUse` hook AND the pure decision path on both trees:
  **26 shapes that `main` refuses and the pre-round tip allowed then refused, 0
  remained**, hook and function agreed on every cell. Locked in
  `scripts/check-comment-attribution.test.mjs` by four tests — the bypass sweep
  (pure), the same sweep through the real shell hook, an INERT sweep asserting
  a later round cannot "fix" this by refusing every `VAR=value` again, and a
  name-keying test pinning the over-approximation above. **That "0 remain"
  claim did not survive** — it had not varied DEREFERENCE FORM, and round 12
  below found the axis that defeats name-keying. Reverting the source change
  with the tests kept reds three of the four.
- **Fix round 12 (#96) — the maintainer decision: stop trading breadth for
  precision, restore `main`'s unconditional scan.** Round 11 above is
  SUPERSEDED. It closed the assignment-POSITION axis by keying the re-read on
  whether the SAME variable NAME is literally referenced elsewhere on the line
  (`$VAR`/`${VAR}`) — and was defeated by bash's `${!NAME}` INDIRECT
  EXPANSION, where the variable that actually gets posted is never named
  literally anywhere on the line
  (`NAME=CMD bash -c 'eval ${!NAME}'` expands to `eval $CMD`, and the literal
  text `$CMD` never appears). Confirmed EXECUTING on this machine's real bash
  (not just parse-classified) for three shapes: `${!NAME}` with `eval`, a bare
  `${!NAME}`, and the two-step `x="${!NAME}"; eval "$x"`. A fourth, bash-nameref
  shape (`declare -n ref=CMD; eval "$ref"`) is the same two-hop dereference
  pattern but needs bash ≥ 4.3; this machine's own dev bash is 3.2, so it is
  locked at the PARSE layer only and labelled parse-verified — never claimed as
  an execution proof this repo does not have.

  Four measured rounds now form a pattern, not a string of bad luck: round
  9/10 closed the wrapper-name axis and reopened the assignment-POSITION axis;
  round 11 closed the assignment-position axis and reopened the
  DEREFERENCE-FORM axis. Each fix bought precision on the axis it targeted and
  gave up safety on an axis nobody had varied yet — "is this assignment
  actually used?" is undecidable at a text-parsing layer without a real shell
  behind it, and three rounds proved that empirically rather than by argument.
  **The decision is to stop asking that question.** The assignment scan
  reverts to exactly `main`'s rule: unconditional, position-independent, with
  **no expansion-gating condition of any kind** — a `VAR=value` word is
  re-read as a nested command whenever its value carries a gated posting
  phrase, wherever it sits, whoever consumes it, whatever dereferences it.

  **What this deliberately reintroduces, named and accepted:**
  `declare -x CMD="<posting phrase>"` with nothing on the line ever executing
  it, `env CMD="<posting phrase>" true`,
  `make deploy MSG="gh issue comment --body ready"`, a container/orchestration
  `-e`/`--set-string`/`-var`/`-e` value carrying a posting-shaped string
  (`docker run`/`helm`/`terraform`/`ansible-playbook` and siblings), and an
  ordinary commit message ABOUT the gate that happens to quote a gated phrase
  — all REFUSE now, even though nothing on those lines can ever post. Each is
  loud (exit 2, printed reason, printed override), costs one retry, and the
  override (`ALLOW_UNATTRIBUTED_COMMENT=1 <command>`) is printed at the moment
  of refusal. These are not bugs for a future round to "fix" — narrowing this
  scan again reopens exactly the bypass class four rounds have now closed and
  reopened in turn. Precision here needs a REAL shell behind the check
  (execute the line in a sandboxed subshell and observe what actually runs),
  not a sharper text-parsing condition — that is the lesson four rounds paid
  for.

  **What this KEEPS from rounds 9/10 (unaffected — a different mechanism):**
  the nested-operand re-read (an operand of an unrecognised command word is a
  candidate to be re-parsed as a script) and its position independence — the
  round-8/round-10 bullets above stand as written; only the
  assignment-carries-a-command scan changed.

  **The honest residual, unchanged from `main` and unclosed by any round:** an
  assignment made in an EARLIER Bash tool call and expanded in a LATER one is
  still unseen — those bytes are not on the later line at all, and no amount
  of tightening this file reaches across two tool calls.

  **Evidence:** an independent 80-case differential corpus (assignment
  position × variable naming × dereference form, including `${!NAME}` and a
  bash-nameref shape × interpreter nesting × every gated posting shape, plus 8
  inert cells and 28 ordinary-work commands — deliberately NOT the round-9/10
  or round-11 corpora reused) driven through both the real `PreToolUse` hook
  and the pure decision path on `main` and this tree: **0 regressions vs
  `main`, including every inert cell** (round 11's "harmless" inert cases now
  refuse, matching `main`), **5 tightenings** (the nested-operand widening
  rounds 8-10 still hold that `main` never had: a bare `$VAR`, a subshell, a
  space-free `&&`, a quoted `gh` word, and a known shell nested inside an
  unrecognised one, each inside a `csh`/`tcsh` operand), hook and pure function
  agree on every one of the 80 cells on both trees. 2 refusals surfaced on the
  ordinary-work slice: an unmarked `--body-file` pointing at a file that
  genuinely lacks the marker (correct, not a false refusal) and the
  fix-round-7 commit-message false refusal, reproduced fresh (accepted, named
  above).

  **Correcting the record, again:** round 10's "zero regressions over 2,394
  cases" line was already flagged corpus-limited by round 11 for not varying
  assignment position; round 11's own "26 shapes closed, 0 remain" claim was
  itself corpus-limited in exactly the same way — it did not vary DEREFERENCE
  FORM, the axis that defeated it. **A differential zero is a statement about
  the axes a corpus varied, never about the gate** — restated here because it
  has now been true, and then falsified by an unvaried axis, three times
  running.

  Locked in `scripts/check-comment-attribution.test.mjs`: the round-8
  false-refusal-fix test and its real-hook counterpart are INVERTED (not
  deleted) to assert the refusal is back, named as a deliberate
  maintainer-approved reintroduction; the round-11 name-keying test and its
  "nothing expands it stays allowed" companion are likewise inverted; new
  tests lock the three executing `${!NAME}` shapes (pure and real-hook), the
  bash-nameref shape at the parse layer only, and position-independence
  explicitly (the same assignment leading, after a command word, and after a
  wrapped command word all refuse alike). Reverting only the source change
  (`scripts/lib/shell-command-parse.mjs`) with the tests kept every one of the
  new/inverted tests red; restoring it returned the suite to green. **The new
  state, stated honestly: at least as strong as `main` everywhere measured,
  plus the nested-operand class `main` never had — not "complete".**

- **A fifth bypass axis, undeclared until now: ASSIGNMENT SYNTAX the scan's
  `ASSIGNMENT_RE` (`/^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/`) does not
  recognise.** Only a plain `NAME=value` word is re-read; four other shell
  assignment shapes carrying the identical payload are not: append
  (`CMD+="gh issue comment 26 --body …"`), an indexed element
  (`CMD[0]="…"`), an array literal (`A=("…")`) and an associative array
  (`declare -A M; M[k]="…"`) — each paired with a matching dereference
  (`eval "$CMD"`, `eval "${CMD[0]}"`, `eval "${A[@]}"`, `eval "${M[k]}"`)
  really executes the post, confirmed on this repo's dev bash and zsh.
  PRE-EXISTING on merge-base `main`, byte-for-byte — round 12 neither opened
  nor closed it, since the assignment scan it restored is the same
  unconditional regex `main` has always run. It sits alongside the
  wrapper-name, assignment-position and dereference-form axes rounds 8-11
  chased, and it needs a matching dereference on the same line to actually
  execute — the payload alone in an unread variable does nothing. Not yet
  closed by any round.
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
  then read that subcommand's FLAGS block for the exact pflag grammar — **and
  its ALIASES block**, since `new` is a real Cobra alias of `create` in three
  gated groups, so `gh issue new --body …` is `gh issue create --body …`. Both
  criteria are load-bearing: (a) alone would gate `gh secret set --body`, where
  `--body` is the secret's VALUE; (b) alone would gate a repo description. The
  same two criteria pick the `gh api` routes: drop trailing id segments from
  the endpoint and gate it when the remaining tail names a conversation
  resource, which is why `PATCH …/issues/26` and `PATCH …/issues/comments/999`
  are gated while `PUT …/issues/26/lock` and `POST …/issues/26/labels` are not.
  The rung-2 doc scan's regex is **generated from that same table**, so the doc
  scan and the runtime gate cannot describe different surfaces. Reading the
  aliases is precision; what makes the group **decidable** is the same inverted
  default one level down — an unrecognised subcommand of a gated group
  (`gh issue frobnicate --body …`) is assumed to post, so a subcommand `gh`
  grows later is gated the day it ships rather than the day someone notices.
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
  (3b) By the same token it cannot see a SCRIPT the command line does not
  contain as text: `bash deploy.sh` or `cat s.sh | sh` (the bytes are in a
  file), `bash -c "$SCRIPT"` (the bytes are in the environment), or an
  interpreter for another **language** (`node -e`, `python -c`, `perl -e`),
  whose argument is not shell source and cannot be parsed as any. Where the
  bytes ARE on the line the gate reads them, flag or no flag — `echo "gh …" |
bash` and `bash <<< "gh …"` are both parsed. Unlike (3) this is declared rather than refused, and the
  difference is deliberate: in (3) the call is already known to be a posting
  call and only its text is unreadable, so a refusal costs one retry; here
  nothing marks the command as posting at all, and refusing every script the
  line does not spell out would refuse most ordinary work.
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
