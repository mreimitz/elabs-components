#!/usr/bin/env node
// check-comment-attribution.mjs — the comment-attribution gate + hook (#78).
//
// Rung 1 (hook / --body): does ONE given comment/issue body carry the
// machine-attribution marker (both halves — see scripts/lib/comment-attribution.mjs)?
// Wired as a PreToolUse hook (.claude/hooks/gate-comment-attribution.sh) on the
// Bash tool (matching `gh issue comment` / `gh issue close --comment` /
// `gh issue create` / `gh pr comment` / `gh pr review --body`) and on the two
// GitHub MCP posting tools (mcp__github__add_issue_comment,
// mcp__github__create_issue).
//
// Rung 2 (default CLI mode): a static, repo-wide scan — does any instruction
// in `.claude/commands`, `.claude/agents`, `.claude/hooks`, `skills/**` tell a
// coding agent to post a GitHub comment/issue WITHOUT also pointing it at the
// helper/marker/override? An instruction that never mentions the marker is an
// instruction a future agent will follow straight past the hook's intent
// (the hook binds the runtime call; this binds the *documentation* that
// produces that call).
//
// Known, accepted limit (state this plainly, do not treat it as a defect):
// nothing in this repo can stop a HUMAN from pasting an unmarked comment
// straight into the GitHub web UI. This gate binds the agent/CLI/MCP tool
// path inside a Claude Code session only.
//
// HOW RUNG 1 READS A BASH COMMAND (#78, fix round 3 — read this before editing).
//
// A shell command line is a small LANGUAGE, not a string. Two earlier rounds of
// this gate treated it as a string and were defeated the same way twice:
//   round 1 recognized only `--flag value`, so `gh issue close --comment="…"`
//           was "not a posting call" and posted unmarked;
//   round 2 fixed the flag grammar but still required `gh` at token[0], so ALL
//           five posting shapes walked through behind `cd /tmp && `, a newline,
//           `true; `, a subshell, `GH_HOST=x `, `/opt/homebrew/bin/gh`, an
//           earlier chained `gh` call, or `gh`'s own `--repo`/`-R` global flag —
//           and a repeated `--body`/`--body-file`, or a SECOND posting call in
//           the same line, was never examined at all.
// So the guard now PARSES:
//   1. `parseShellCommands()` (scripts/lib/shell-command-parse.mjs) tokenises
//      the line honouring single quotes, double quotes, backslash escapes, line
//      continuations and `#` comments, and splits it into simple commands
//      across `&&`, `||`, `;`, `|`, `&`, newlines, subshells, command
//      substitutions and process substitutions — recursing into `$( … )`,
//      backticks, `eval "…"`, and every INTERPRETER INVOCATION that hides a
//      whole script inside one word. Round 5 was defeated here: the nested
//      re-parse asked `word.value === "-c"`, so `bash -lc "gh issue comment
//      …"` — `-c` clustered with one ordinary flag — hid the script and with
//      it all 18 gated shapes. Membership is now decided by each tool's own
//      OPTION GRAMMAR, read out of that tool's usage output (the derivation is
//      recorded above SCRIPT_INTRODUCERS in shell-command-parse.mjs): `-c`
//      anywhere in a short-flag cluster for every POSIX shell, env's `-S` /
//      `-S"…"` / `-iS` / `--split-string=`, ssh's flag-less operand list, and
//      — as a fail-closed superset over the OPTION SPELLINGS OF A TOOL THAT
//      HAS A ROW — the whole operand list after that tool's name. The lookup
//      is position-independent, so a wrapper in front of the shell
//      (`nohup`/`timeout`/`xargs`/`env`/`command`) hides nothing either.
//      That superset is precision, not safety: round 6 shipped it and still
//      let `csh -c "gh issue comment …"` through all 18 gated shapes, because
//      a per-tool grammar cannot answer WHICH TOOLS EXIST and `csh` had no
//      row. So the row set is no longer what decides. See the inverted default
//      at nestedOperandCandidates below: an operand of an unrecognised command
//      word IS a candidate to be re-read as a script, whatever that command
//      word is — no interpreter name has to be known. UPDATED (#96, fix round
//      8): round 7's re-read was itself gated behind two operand-TEXT
//      prefilters (an expansion anywhere in the word; a regex match on the
//      literal `gh `), which reopened the very failure mode this section
//      exists to remove — a bare `$VAR` or a subshell/`&&` in the operand
//      skipped the re-read entirely. Both prefilters are gone: every
//      non-empty operand is re-parsed structurally (via `word.raw`, which
//      keeps an expansion's own syntax instead of dropping it). Rounds 8 and 9
//      also restricted that re-read to a COMMAND POSITION, to spare prose that
//      merely mentions the words; fix round 10 REVERTED that, because the only
//      way to make a position check see `nohup gh …` / `setsid gh …` was a
//      finite list of wrapper names — the same anti-pattern, one level down,
//      and it silently allowed all 18 shapes behind any wrapper the list
//      lacked. The nested arm is position-independent again, at the cost of
//      the prose refusal. See the block comment above `nestedOperandCandidates`
//      for the full account and DECLARED LIMITS below for what remains open.
//      The table still earns its keep — it resolves `bash -lc` precisely
//      instead of by re-reading every operand — but nothing depends on its
//      membership.
//   2. `findGhCandidates()` treats EVERY command whose argv[0] basename is `gh`
//      as a candidate, wherever it sits — after leading `VAR=…` assignments,
//      behind a wrapper (`xargs gh`, `then gh`), or spelled as an absolute path.
//   3. `analyzeGhCandidate()` skips `gh`'s pre-subcommand global flags, matches
//      the subcommand through `postingShapeFor()` — the canonical name, each
//      Cobra ALIAS declared in `gh <group> <sub> --help`'s ALIASES block
//      (`gh issue new` IS `gh issue create`), and, for anything else inside a
//      gated group, a fail-closed generic shape, so a subcommand `gh` grows
//      later is gated the day it ships — or `gh api`, below, and resolves
//      EVERY body-carrying flag occurrence — `gh` (pflag) uses the LAST
//      occurrence of a repeated string flag, so checking only the first let a
//      marked body be followed by an unmarked one.
//   4. `evaluateHookPayload()` examines every candidate in the line, not the
//      first, and refuses if ANY of them would post unmarked or uninspectable
//      text.
// `findFlagValues()` still covers every shape `gh` (Cobra/pflag) accepts for a
// value-taking flag — `--flag value` · `--flag=value` · `-f value` · `-f=value` ·
// `-fvalue` (attached) · `-xyfvalue` (boolean shorthands clustered ahead of the
// value shorthand) — verified against `gh 2.93.0 <subcommand> --help` for every
// gated subcommand. A cluster whose EARLIER character is a value-taking flag
// this catalog does not track stops the walk rather than guessing: no match,
// which is the safe direction.
//
// UNKNOWN MEANS POSTING. When the parser cannot statically determine what a
// `gh` call does — the subcommand is behind an expansion (`gh issue $SUB …`),
// or a WRITE's `gh api` endpoint is — the call is treated as posting and
// refused, not waved through. A guard whose unknown case is "allow" is
// defeated by making the command harder to read, which is the cheapest
// possible attack.
//
// DECLARED LIMITS (state these plainly; do not treat them as defects):
//   - Nothing in this repo can stop a HUMAN pasting an unmarked comment into
//     the GitHub web UI. This gate binds the agent/CLI/MCP tool path inside a
//     Claude Code session only.
//   - A posting channel that is neither `gh` nor one of the two gated MCP tools
//     is not seen: a raw `curl` to api.github.com, a `gh api graphql`
//     `addComment` mutation, any third-party client.
//   - A body computed at runtime (`--body "$MSG"`, a heredoc, stdin, a device)
//     cannot be read from the command line, so it is REFUSED rather than
//     inspected — never passed through.
//   - A SCRIPT THE COMMAND LINE DOES NOT CONTAIN AS TEXT is not seen. The
//     parser reads bytes that are present as words: `bash -lc "gh …"` is
//     readable, and so is `echo "gh …" | bash`, whose producer emits its own
//     operands; `bash deploy.sh` and `cat s.sh | sh` (the bytes are in a file)
//     and `bash -c "$SCRIPT"` (the bytes are in the environment) are not. Nor is an interpreter for another
//     LANGUAGE — `node -e '…execSync("gh …")…'`, `python -c`, `perl -e` —
//     whose argument is not shell source and cannot be parsed as any.
//     This is deliberately a DECLARED limit and not a refusal, and the
//     asymmetry with the body rule above is the point: there, the call is
//     already known to be a posting call and only its text is unreadable, so
//     refusing costs one retry; here nothing identifies the command as a
//     posting call at all, and refusing every shell script the line does not
//     spell out would refuse most ordinary work — a guard that does that is
//     disabled within a day and protects nobody.
//   - A posting call re-read out of an unrecognised command word's operand
//     must REACH FOR A BODY to be refused, so a body-less `gh issue comment 26`
//     hidden inside one is not caught. It is also not a posting call from a
//     hook's vantage point: with no body flag `gh` prompts interactively, and
//     with no TTY it answers `flags required when not running interactively`
//     and never reaches the API (verified, gh 2.93.0). At a command position
//     the body-less call is still refused — that path is unchanged. Requiring
//     a body here is what keeps a BARE mention with no body-shaped flag —
//     `git log --grep "gh issue comment"` — out of the net. It does NOT keep
//     out a message that also carries a body-shaped phrase (see the false
//     refusal below); the two earlier verdicts stated this claim more broadly
//     than the code supports.
//   - FIXED, fix round 8 (#96): the re-read used to be gated by TWO
//     operand-TEXT prefilters — `word.expanded` (skipped any operand
//     containing a shell expansion, so a bare `$VAR` turned the re-read off
//     entirely) and `NESTED_GH_RE = /(?:^|[\s/])gh\s/` (a literal text match a
//     subshell, a space-free `&&`, a quoted/escaped `gh`, or a known shell
//     nested one level inside the unknown one all slipped past unseen). Both
//     are GONE. Every non-empty operand of an unrecognised command word is now
//     unconditionally re-parsed — via `ShellWord.raw` (shell-command-parse.mjs),
//     which keeps an expansion's own syntax (`$VAR`, `$(…)`) visible at the
//     position it occupies instead of erasing it — and the STRUCTURAL result
//     (does the re-parse contain a `gh` word at a command position, carrying a
//     body-shaped flag or an inspectable body) decides, not a regex over the
//     original text. This closes both the accident path (a bare `$VAR`) and
//     the evasion paths (subshell, space-free `&&`, quoting/escaping `gh`,
//     nesting a known shell inside the unknown one) that fix round 7 declared
//     as open. It also widened the FALSE-REFUSAL surface by exactly one
//     measured shape — prose that quotes the word (`git commit -m "docs:
//     quote 'gh' issue comment --body in the guide"`), which merge-base
//     `main`'s text prefilter could not see and this parse can; that is the
//     price of closing the quoted/escaped evasion path, it costs a retry, and
//     the override is printed at the moment of refusal. The same round also
//     fixed a same-shaped, pre-existing false refusal one layer OUTSIDE this
//     widening — in
//     `parseShellCommands`'s own "assignment carries a whole command" pass
//     (shell-command-parse.mjs) — which used to scan every `VAR=value`-shaped
//     WORD in a line regardless of position, so `make deploy MSG="gh issue
//     comment --body ready"` re-parsed make's own operand as if it were a
//     shell assignment. That scan is now scoped to the leading assignment run
//     (plus the operands of a leading `export`/`declare`/`typeset`/`local`/
//     `readonly` builtin, which really are assignments).
//   - REVERTED, fix round 10 (#96): fix round 8 shipped a THIRD part beside
//     the two above — an `atCommandPositionOnly` option restricting the NESTED
//     re-read to argv[0] of each re-parsed simple command, to keep prose that
//     merely mentions a posting phrase from becoming a candidate. It was a
//     silent bypass in its own right: `nohup gh issue comment 26 --body '…'`
//     behind an unrecognised interpreter re-parsed as a command whose "command
//     position" was `nohup`, so the real invocation was skipped and every one
//     of the 18 gated shapes posted unmarked — something merge-base `main`
//     refuses, since its nested search never cared about position. Fix round 9
//     tried to repair that with a SEVEN-NAME wrapper allowlist
//     (`realCommandWordIndex`) and reproduced the bug one level down, exactly
//     as this module's own header warns: `setsid`, `nice -n 10`, `stdbuf -oL`,
//     `doas`, `watch`, `ionice` and any name invented next year were not on the
//     list, and a LISTED wrapper whose flag takes a separate value word
//     (`sudo -u root`, `timeout -s KILL 5`, `exec -a name`) had that value
//     consumed as the command position — 9 attack shapes ALLOWED that `main`
//     REFUSES, measured by an independent differential probe.
//
//     Round 10 removes the restriction instead of extending the list. The rule
//     the two prior rounds broke is the one stated at the top of this file:
//     which tools pass execution through is NOT a list, and the recognised half
//     must be the narrow, ARGUABLE one. Applied honestly to a wrapper, that
//     recognised half is EMPTY — nothing can be proved not to be a wrapper — so
//     every leading word is a possible wrapper, every index is a possible
//     command position, and the restriction dissolves into the
//     position-independent search the top level has always run. A structure
//     that cannot go stale is the point; a shorter list is not.
//
//     WHAT THAT COSTS, stated plainly rather than left implicit: the precision
//     round 8 bought is given back, so two prose lines are REFUSED again
//     exactly as `main` refuses them — `git commit -m "fix(hooks): the gh issue
//     comment gate now blocks --body=text"` and `git commit -m "docs: quote
//     'gh' issue comment --body in the guide"` (the second one is `main`'s
//     behaviour plus Part A's widening; see the round-8 clause above). A false
//     refusal is loud, costs one retry, and prints its own override; the
//     alternative was a silent post. `pnpm attribution:comments:check:test`
//     locks both directions — the never-listed wrappers as REFUSALS and these
//     two lines as the declared cost.
//   - Fix round 11 (#96): the SAME anti-pattern, in the other mechanism —
//     round 8's assignment-run scoping (the clause above) was a POSITIONAL
//     window, and two ordinary shapes sit outside it. An assignment placed
//     AFTER a command word (`env CMD="gh issue comment 26 --body …" sh -c
//     '$CMD'`) is never reached, because the leading run ends at index 0; and
//     an assignment builtin carrying an OPTION (`declare -x CMD="…"; $CMD`)
//     stops the operand walk on `-x`, before the assignment. Both really run
//     the post — verified by execution, not by reading — and merge-base
//     `main` refuses both, so the branch that removed the `make deploy MSG=…`
//     false refusal had traded it for a family of real bypasses. Three rounds
//     of review missed it because every test in the suite pinned the
//     assignment to the LEADING position.
//
//     The repair does NOT name the commands that consume a following
//     assignment (`env`/`sudo`/`nohup`/…). That list is the round-9/round-10
//     mistake one mechanism over, and the missing name is silent. It keys on
//     shell VARIABLE SYNTAX alone: a `VAR=value` word is re-read wherever it
//     sits, but only when the same line also EXPANDS `$VAR` / `${VAR}`. An
//     assignment nothing on the line expands cannot make that line post,
//     whoever the command word is — which is why `make deploy MSG=…`,
//     `docker run -e CMD=… alpine true`, `terraform apply -var …` and a bare
//     `declare -x CMD=…` all stay ALLOWED without any command appearing in
//     the rule.
//
//     WHAT THAT COSTS: it is a NAME match, so a line that carries a
//     `gh`-shaped `MSG=` word and separately expands `$MSG` for an unrelated
//     reason is refused — `make deploy MSG="gh issue comment --body ready" &&
//     echo "$MSG"` REFUSES (as `main` does), while the same line expanding
//     `$OTHER` is allowed. Measured over a 20-command ordinary-work corpus:
//     zero new false refusals vs merge-base `main` and zero vs the pre-round
//     branch tip. WHAT IT STILL CANNOT SEE, unchanged from `main`: an
//     assignment made in an EARLIER Bash tool call and expanded in a later
//     one — those bytes are not on this line at all.
//   - What is STILL a declared limit after fix rounds 10 and 11, unchanged: a
//     `… | tee f | sh` pipeline (the sink-detection only recognises a sink
//     that takes no non-flag operand, and `tee`'s filename argument defeats
//     that), `gh api graphql`'s `addComment` mutation, and a body-less nested
//     call (a hidden `gh issue comment 26` with no body flag is still not
//     caught — see the body-reach bullet above). All three are pre-existing,
//     not reopened or newly closed by this round.
//   - A PRODUCER PIPED THROUGH AN INTERMEDIATE STAGE INTO A SHELL escapes the
//     pipeline arm of this same inversion: `sinkExecutesStdin` (below)
//     requires the FINAL sink to take no non-flag operand, so
//     `printf '%s' "gh issue comment 26 --body '…'" | tee /tmp/p.sh | sh` is
//     ALLOWED (18/18 gated shapes) even though `echo "gh …" | bash` — one
//     stage shorter — is refused. Pre-existing (not a round-7 regression) and
//     previously undeclared; someone has to be constructing the extra stage
//     on purpose — an EVASION path.
//   - `gh api` gating takes THREE conditions together, and the declaration
//     below is the behaviour, checked against it (fix-round-3 verdict,
//     Finding 2 was a mismatch between the two):
//       · a WRITE — a POST/PATCH/PUT method, or field/input flags with no
//         method. A read is untouched whatever its route.
//       · to a CONVERSATION ROUTE — see apiEndpointPostsProse. A write to
//         `…/lock`, `…/labels`, `…/reactions`, `…/assignees` is untouched.
//       · CARRYING PROSE — a `body=`/`message=`/`commit_message=` field. A
//         write with none of those posts no prose and is untouched:
//         `-X PATCH …/issues/26 -f state=closed`,
//         `-X POST …/pulls -f title=T -f head=x -f base=main`. This mirrors
//         the CLI side, where a `requireBody` shape with no body flag is
//         likewise not a posting call. The field names are enumerated against
//         GitHub's schema for these routes, the same way the routes are; a
//         field outside that schema does nothing when the API receives it.
//     A payload the gate cannot READ is a different matter and still refuses:
//     `--input`, a `body=@file` it cannot read, a field the shell would
//     expand, or a write whose endpoint is hidden by an expansion.
//     `gh api graphql` remains out of scope (below).
//   - A USER-DEFINED `gh` alias (`gh alias set cmt 'issue comment'`, then
//     `gh cmt 26 --body …`) resolves inside `gh`, from a config file this gate
//     does not read, so the subcommand match cannot see it. Reading
//     `gh alias list` would mean shelling out on every Bash call; the honest
//     answer is that aliases are out of scope.
//   - A `--body-file` (or `--notes-file`) is read AS IT STANDS WHEN THE HOOK
//     RUNS, which is BEFORE the command executes. If the same command line
//     writes that file first — `printf … > body.md && gh issue comment 26
//     --body-file body.md` — the gate judges the OLD bytes, so a file that
//     was marked a moment ago passes even though the text actually posted is
//     the new, unmarked content. Nothing at this layer can fix it: the final
//     content does not exist yet. What to do about it: write the body in a
//     SEPARATE Bash call from the one that posts it (then the hook sees the
//     real bytes on the posting call), or post through
//     scripts/post-issue-comment.mjs, which renders the marker itself.
//   - `gh pr create --fill` / `--fill-first` / `--fill-verbose` and
//     `gh release create --generate-notes` compute the body inside `gh` or on
//     GitHub's side, so there is no body on the command line to read or mark.
//     They are not gated. Blocking them would block this repo's own release
//     flow (docs/RELEASING.md), and a guard that blocks the release is a guard
//     that gets routed around.
//   - A RELATIVE `--body-file` path is resolved against the hook's working
//     directory, not against a `cd` earlier in the same line. When that lookup
//     fails the call is REFUSED (uninspectable), never allowed — so this costs
//     a false refusal, not a bypass. Pass an absolute path, or post through
//     scripts/post-issue-comment.mjs, which always does.
//   - A NESTING-DEPTH CEILING. `NESTED_OPERAND_MAX_DEPTH = 3` (below) stops the
//     nested re-read after three unknown-interpreter levels, so a gated `gh`
//     call sitting behind FOUR STACKED unrecognised shells (`csh -c "csh -c
//     '…'"` nested one level deeper again) is ALLOWED — the fourth level is
//     never re-parsed. This constant is IDENTICAL on merge-base `main` — it is
//     not a regression, and `main` is strictly worse (it already fails at
//     depth 2 for an unknown shell). Declared here so this block does not read
//     as more complete than it is.
//   - THE OVERRIDE IS HONOURED IN ONE NESTED POSITION AND NOT ANOTHER. A
//     correctly-spelled `ALLOW_UNATTRIBUTED_COMMENT=1` prefix on the `gh` call,
//     placed inside an UNRECOGNISED interpreter's operand (`csh -c
//     "ALLOW_UNATTRIBUTED_COMMENT=1 gh issue comment 26 --body '…'"`), now
//     ALLOWS — where `main` REFUSES, because `main`'s nested re-read never
//     reaches that operand at all. This is a CONSISTENCY gap, not a safety
//     one: the allow is `override: true`, so the hook still prints its loud
//     OVERRIDDEN warning; the same override at the TOP level already allows on
//     both trees, so nothing is granted here that `main` withholds; and the
//     identical override placed behind a RECOGNISED shell (`bash -lc
//     "ALLOW_UNATTRIBUTED_COMMENT=1 gh …"`) still BLOCKS on this tree. The
//     honest statement is that the override reaches one nested position and
//     not its sibling — not that it grants a new capability.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BLOCKQUOTE_PHRASE, MARKER, hasMarker, render } from "./lib/comment-attribution.mjs";
import {
  basename,
  commandWordIndex,
  leadingAssignments,
  parseShellCommands,
} from "./lib/shell-command-parse.mjs";

// ── Rung 1 — Bash command parsing ────────────────────────────────────────────

/**
 * A tiny shell tokenizer: enough to split `gh issue comment 26 --body "hi"`
 * into argv-shaped tokens (honoring single/double quotes). It does NOT
 * attempt full shell semantics ($()/backticks/globbing) — commands using
 * those are caught by isUninspectableBashCommand() before we ever tokenize.
 * @param {string} command
 * @returns {string[]}
 */
export function shellSplit(command) {
  const text = typeof command === "string" ? command : "";
  const tokens = [];
  let current = "";
  let quote = null;
  let hasCurrent = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasCurrent = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasCurrent || current) {
        tokens.push(current);
        current = "";
        hasCurrent = false;
      }
      continue;
    }
    current += ch;
    hasCurrent = true;
  }
  if (hasCurrent || current) tokens.push(current);
  return tokens;
}

// ── Flag resolution (pflag/Cobra-aware — see findFlagValues doc) ────────────
//
// `gh` parses flags with Cobra/pflag, which accepts FOUR shapes for a
// value-taking flag, not just "--flag value":
//   --flag value | --flag=value | -f value | -f=value | -fvalue (attached,
//   no separator) | -xyfvalue (boolean shorthands x,y clustered ahead of the
//   value shorthand f in ONE token — pflag gives the REST of the token to f).
// The original matcher only recognized the first shape via exact-token
// equality, so `gh issue close 26 --comment="…"` and `gh pr review 12
// --body="…"` (idiomatic bash, not an adversarial trick) matched no flag at
// all and were silently treated as non-posting calls (#78 fix-round-1).

/**
 * Every value-carrying occurrence of `flagSpecs` in `tokens`, resolving every
 * shape `gh` (Cobra/pflag) accepts for a value-taking flag. `boolShorthands`
 * is the CLOSED set of single-char flags that are boolean on this specific
 * `gh` subcommand (sourced from `gh <cmd> --help`) — needed only to walk past
 * them inside a clustered short-flag token; passing `[]` still correctly
 * handles the non-clustered shapes.
 *
 * Deliberately NOT modelled: a cluster where an EARLIER character is itself a
 * value-taking flag this catalog doesn't track (e.g. `-ab"x"` on
 * `gh issue create`, where `-a/--assignee` actually swallows the rest per
 * real pflag semantics). The walk stops at the first character it doesn't
 * recognize as either a tracked bool or a tracked value flag, so it neither
 * mis-attributes that text to our flag (a false negative would be unsafe)
 * nor guesses past a flag it doesn't know (safe direction: no match, not a
 * false block on an unrelated flag's value).
 * @param {string[]} tokens
 * @param {{long: string, short?: string}[]} flagSpecs
 * @param {string[]} [boolShorthands]
 * @returns {{value: string}[]} in token order
 */
export function findFlagValues(tokens, flagSpecs, boolShorthands = []) {
  return findFlagWords(tokens, flagSpecs, boolShorthands).map(({ value }) => ({ value }));
}

/**
 * Normalize a plain `string[]` token list into `ShellWord[]`.
 * @param {string[]|import("./lib/shell-command-parse.mjs").ShellWord[]} tokens
 */
export function toWords(tokens) {
  return (tokens || []).map((t) => (typeof t === "string" ? { value: t, expanded: false } : t));
}

/**
 * As `findFlagValues`, but preserving each hit's `expanded` bit — a value the
 * shell would have expanded at runtime (`$VAR`, `$(…)`, a backtick) is one the
 * gate must refuse rather than pretend to know.
 * @param {string[]|import("./lib/shell-command-parse.mjs").ShellWord[]} tokens
 * @param {{long: string, short?: string}[]} flagSpecs
 * @param {string[]} [boolShorthands]
 * @returns {{value: string, expanded: boolean}[]} in token order
 */
export function findFlagWords(tokens, flagSpecs, boolShorthands = []) {
  const words = toWords(tokens);
  const hits = [];
  const shortMap = new Map();
  for (const spec of flagSpecs) {
    if (spec.short) shortMap.set(spec.short.slice(1), spec.long);
  }
  for (let i = 0; i < words.length; i++) {
    const token = words[i].value;
    if (typeof token !== "string" || !token.startsWith("-")) continue;

    // Long form: --flag value | --flag=value
    const longSpec = flagSpecs.find((s) => token === s.long || token.startsWith(`${s.long}=`));
    if (longSpec) {
      if (token === longSpec.long) {
        const next = words[i + 1];
        if (next !== undefined) hits.push({ value: next.value, expanded: next.expanded });
      } else {
        hits.push({
          value: token.slice(longSpec.long.length + 1),
          expanded: words[i].expanded,
        });
      }
      continue;
    }
    if (token.startsWith("--")) continue;

    // Short form: walk the cluster (bool shorthands, then one value shorthand).
    const body = token.slice(1);
    let j = 0;
    while (j < body.length) {
      const ch = body[j];
      if (boolShorthands.includes(ch)) {
        j++;
        continue;
      }
      if (shortMap.has(ch)) {
        let rest = body.slice(j + 1);
        if (rest.startsWith("=")) rest = rest.slice(1);
        if (rest !== "") {
          hits.push({ value: rest, expanded: words[i].expanded });
        } else if (words[i + 1] !== undefined) {
          hits.push({ value: words[i + 1].value, expanded: words[i + 1].expanded });
        }
        break;
      }
      break; // unrecognized char — stop, don't guess (see doc above).
    }
  }
  return hits;
}

// ── The gated `gh` posting surface ───────────────────────────────────────────
//
// HOW THIS LIST WAS DERIVED (check it, don't trust it — re-run the recipe):
//   1. Enumerate every `gh` command group and subcommand from `gh`'s own help,
//      not from memory: parse the `COMMANDS` blocks of `gh --help`, then of
//      `gh <group> --help`, then read `gh <group> <sub> --help`. Against
//      gh 2.93.0 that is 33 groups; 32 subcommands declare a flag whose name
//      suggests free text (`--body|--body-file|--comment|--notes|--notes-file|
//      --desc|--description|--message|--title|--subject|--text|--note|--reason`).
//   2. Keep a subcommand when BOTH criteria hold. They are conjunctive on
//      purpose — either one alone gives an obviously wrong answer:
//        (a) SURFACE — it publishes into a GitHub *conversation* about the
//            work: an issue, a pull request, a review, or a release. This is
//            what #78 is about: text a later automated run can read back and
//            cite as a maintainer's own words.
//        (b) BODY FLAG — the flag carries free-form, multi-line prose that the
//            attribution banner can actually live in (`--body`, `--body-file`,
//            `--comment`, `--notes`, `--notes-file`). A one-line metadata flag
//            cannot hold a 4-line banner, so gating it would only ever produce
//            a refusal nobody can satisfy except by overriding.
//   2.5 Read that subcommand's ALIASES block in the SAME pass — Cobra prints
//      one for every command that declares aliases, and an alias is a real,
//      typeable spelling of the same call. Against gh 2.93.0 exactly three of
//      the gated subcommands declare one (`gh issue new`, `gh pr new`,
//      `gh release new` — the `create` trio; nothing else in the gated set has
//      an ALIASES block at all, and neither do the four gated groups). Fix
//      round 6 shipped without this step and `gh issue new --body "…"` — three
//      characters, no shell, an ordinary thing to type — posted unmarked.
//      Re-run it with:
//        for p in "issue create" "pr create" "release create" …; do
//          eval gh $p --help 2>&1 | awk '/^ALIASES/{f=1;next} f&&/^$/{exit} f'
//        done
//   3. Read that subcommand's FLAGS block for the exact pflag grammar — which
//      short flags are BOOLEAN (so a cluster like `-sb "text"` parses) and
//      which take a value. Those are the `boolShorthands` below. They differ
//      per subcommand and cannot be shared: `-c` is a value-taking
//      `--comment` on `gh issue close`, and a BOOLEAN review-type selector on
//      `gh pr review`.
//
// DELIBERATELY EXCLUDED, with the criterion each one fails:
//   - `gh secret set --body`, `gh variable set --body` — fail (a). `--body`
//     here is the secret/variable VALUE, not prose. Gating them would block
//     ordinary configuration and demand an attribution banner inside a secret.
//     This pair is why criterion (a) exists: a flag-name-only rule gates them.
//   - `gh repo create|edit --description`, `gh label create|edit --description`,
//     `gh project create|copy|edit --title|--description`,
//     `gh gpg-key add --title`, `gh ssh-key add --title` — fail (a) and (b):
//     one-line metadata on an object, not commentary in a conversation.
//   - `gh gist create|edit --desc` — fails (a) and (b). A gist's substance is
//     its FILE content, which this gate cannot mark without corrupting the
//     file; its `--desc` is a one-line label. Gating only the label would be
//     incoherent. Named here because a reviewer flagged it: the exclusion is a
//     judgment call, and this is where to argue with it.
//   - `gh issue lock --reason`, `gh pr lock --reason`, `gh issue close --reason`
//     — fail (b): a fixed enum (`off-topic`/`spam`/`completed`/…), not prose.
//   - `--title` / `--subject` / `--text` on otherwise-gated subcommands — fail
//     (b). The banner is multi-line; a title is not a place it can go. Where a
//     subcommand has both, the BODY is what is gated.
//
// `requireBody: true` means the subcommand is not itself a posting call
// (`gh issue close 26` closes silently, `gh pr review 12 --approve` carries no
// text) — only when it also carries a body flag does it post prose.
const POSTING_SHAPES = [
  {
    path: ["gh", "issue", "comment"],
    name: "gh issue comment",
    // -e/--editor, -w/--web are the only OTHER short boolean flags.
    boolShorthands: ["e", "w"],
    boolLongs: ["--create-if-none", "--delete-last", "--edit-last", "--editor", "--web", "--yes"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
  },
  {
    path: ["gh", "issue", "close"],
    name: "gh issue close --comment",
    // -c/--comment is the only body-carrying flag. -r/--reason and
    // --duplicate-of take values but are not prose; this subcommand has no
    // short BOOLEAN flags at all.
    boolShorthands: [],
    boolLongs: [],
    bodyFlags: [{ long: "--comment", short: "-c" }],
    fileFlags: [],
    requireBody: true,
  },
  {
    path: ["gh", "issue", "create"],
    // Cobra ALIASES block of `gh issue create --help` (gh 2.93.0).
    aliases: ["new"],
    name: "gh issue create",
    // -e/--editor and -w/--web are the OTHER short BOOLEAN flags. -a/-l/-m/-p
    // are OTHER VALUE flags (assignee/label/milestone/project) — an earlier one
    // in a cluster swallows the rest per real pflag, so they are deliberately
    // NOT listed as bools; hitting one stops our walk with no match, which is
    // the safe outcome (see findFlagValues doc).
    boolShorthands: ["e", "w"],
    boolLongs: ["--editor", "--web"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
  },
  {
    path: ["gh", "issue", "edit"],
    name: "gh issue edit --body",
    // --remove-milestone is the only boolean and it has no shorthand.
    // REPLACING an issue body is an ordinary way to publish agent prose — and
    // it can also strip a marker a previous run put there.
    boolShorthands: [],
    boolLongs: ["--remove-milestone"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "issue", "reopen"],
    name: "gh issue reopen --comment",
    boolShorthands: [],
    boolLongs: [],
    bodyFlags: [{ long: "--comment", short: "-c" }],
    fileFlags: [],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "comment"],
    name: "gh pr comment",
    boolShorthands: ["e", "w"],
    boolLongs: ["--create-if-none", "--delete-last", "--edit-last", "--editor", "--web", "--yes"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
  },
  {
    path: ["gh", "pr", "create"],
    // Cobra ALIASES block of `gh pr create --help` (gh 2.93.0).
    aliases: ["new"],
    name: "gh pr create --body",
    // -d/--draft, -e/--editor, -f/--fill, -w/--web are the short booleans.
    // requireBody is TRUE here where `gh issue create`'s is FALSE, and the
    // asymmetry is deliberate: `gh pr create --fill` computes the body from
    // commit messages INSIDE gh, so there is no body on the command line to
    // read or mark. Gating unconditionally would block `gh pr create --fill`,
    // a documented step of this repo's own release flow (docs/RELEASING.md
    // § 3), and a guard that blocks the release gets routed around. The cost
    // is a declared limit, recorded in the header.
    boolShorthands: ["d", "e", "f", "w"],
    boolLongs: [
      "--draft",
      "--dry-run",
      "--editor",
      "--fill",
      "--fill-first",
      "--fill-verbose",
      "--no-maintainer-edit",
      "--web",
    ],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "close"],
    name: "gh pr close --comment",
    // -d/--delete-branch is the only short boolean.
    boolShorthands: ["d"],
    boolLongs: ["--delete-branch"],
    bodyFlags: [{ long: "--comment", short: "-c" }],
    fileFlags: [],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "edit"],
    name: "gh pr edit --body",
    boolShorthands: [],
    boolLongs: ["--remove-milestone"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "merge"],
    name: "gh pr merge --body",
    // -d/--delete-branch, -m/--merge, -r/--rebase, -s/--squash are the
    // short booleans. -t is --subject here (a one-line commit subject), NOT a
    // body.
    boolShorthands: ["d", "m", "r", "s"],
    boolLongs: [
      "--admin",
      "--auto",
      "--delete-branch",
      "--disable-auto",
      "--merge",
      "--rebase",
      "--squash",
    ],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "reopen"],
    name: "gh pr reopen --comment",
    boolShorthands: [],
    boolLongs: [],
    bodyFlags: [{ long: "--comment", short: "-c" }],
    fileFlags: [],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "revert"],
    name: "gh pr revert --body",
    // -d/--draft is the only short boolean.
    boolShorthands: ["d"],
    boolLongs: ["--draft"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "pr", "review"],
    name: "gh pr review --body",
    // -a/--approve, -c/--comment (a BOOLEAN review-type selector on THIS
    // subcommand only — distinct from issue close's value-taking -c), and
    // -r/--request-changes are the OTHER short boolean flags.
    boolShorthands: ["a", "c", "r"],
    boolLongs: ["--approve", "--comment", "--request-changes"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "release", "create"],
    // Cobra ALIASES block of `gh release create --help` (gh 2.93.0).
    aliases: ["new"],
    name: "gh release create --notes",
    // -d/--draft, -p/--prerelease and the long-only --generate-notes/--latest/
    // --notes-from-tag/--verify-tag/--fail-on-no-commits are booleans.
    // --generate-notes asks GitHub to write the notes, so nothing of ours is
    // posted and nothing is gated — the same reasoning as `pr create --fill`.
    boolShorthands: ["d", "p"],
    boolLongs: [
      "--draft",
      "--fail-on-no-commits",
      "--generate-notes",
      "--latest",
      "--notes-from-tag",
      "--prerelease",
      "--verify-tag",
    ],
    bodyFlags: [{ long: "--notes", short: "-n" }],
    fileFlags: [{ long: "--notes-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "release", "edit"],
    name: "gh release edit --notes",
    boolShorthands: [],
    boolLongs: ["--draft", "--latest", "--prerelease", "--verify-tag"],
    bodyFlags: [{ long: "--notes", short: "-n" }],
    fileFlags: [{ long: "--notes-file", short: "-F" }],
    requireBody: true,
  },
  {
    path: ["gh", "project", "item-create"],
    name: "gh project item-create --body",
    // Creates a DRAFT ISSUE inside a project — issue prose by another route.
    // --body has no shorthand here.
    boolShorthands: [],
    boolLongs: [],
    bodyFlags: [{ long: "--body" }],
    fileFlags: [],
    requireBody: true,
  },
  {
    path: ["gh", "project", "item-edit"],
    name: "gh project item-edit --body",
    // --text is a project FIELD value, not the draft issue's prose, so only
    // --body is gated.
    boolShorthands: [],
    boolLongs: ["--clear"],
    bodyFlags: [{ long: "--body" }],
    fileFlags: [],
    requireBody: true,
  },
];

// `gh api` is a posting channel too: `gh api -X POST repos/o/r/issues/N/comments
// -f body=…` puts text on an issue under the same identity as `gh issue
// comment`. Read-only `gh api` calls (no write method, no fields) stay
// untouched, which is what acceptance criterion 2 asks for.
const API_VALUE_FLAGS = new Set([
  "-X",
  "--method",
  "-f",
  "--raw-field",
  "-F",
  "--field",
  "-H",
  "--header",
  "--input",
  "-q",
  "--jq",
  "-t",
  "--template",
  "--cache",
  "--hostname",
  "-p",
  "--preview",
]);
const API_METHOD_FLAGS = [{ long: "--method", short: "-X" }];
const API_FIELD_FLAGS = [
  { long: "--raw-field", short: "-f" },
  { long: "--field", short: "-F" },
];
const API_INPUT_FLAGS = [{ long: "--input" }];
// Which `gh api` routes publish PROSE. DERIVED from GitHub's REST surface,
// not from the routes a reviewer happened to demonstrate. Every route below
// takes an authored-prose field on a write:
//   …/issues · …/issues/{n} · …/issues/comments/{id}
//   …/pulls · …/pulls/{n} · …/pulls/comments/{id}
//   …/comments · …/comments/{id} · …/comments/{id}/replies
//   …/reviews · …/reviews/{id} · …/reviews/{id}/events
//   …/reviews/{id}/dismissals · …/pulls/{n}/merge
//   …/releases · …/releases/{id}
//   …/discussions[/{n}[/comments[/{id}]]]
// One rule generates all of them: drop trailing ID-shaped segments, then ask
// whether the segment that remains NAMES a conversation resource. That is why
// `…/issues/26/lock` and `…/issues/26/labels` stay UNGATED — their tail is
// `lock`/`labels`, not a conversation resource — while `PATCH …/issues/26` is
// gated (drop `26`, the tail is `issues`). The previous end-anchored regex
// only ever matched COLLECTION routes, so every item-level edit
// (`PATCH …/issues/comments/999`) fell outside it.
const API_PROSE_SEGMENTS = new Set([
  "issues",
  "pulls",
  "comments",
  "reviews",
  "releases",
  "discussions",
  "replies",
  "events",
  "dismissals",
  "merge",
]);
const API_ID_SEGMENT_RE = /^(?:\d+|\{[^}]*\}|:[A-Za-z_][\w-]*|[0-9a-f]{7,40})$/;
// The payload fields those routes carry prose in. `body` covers issue/PR/
// comment/review/release text; `message` is a review dismissal; the merge
// commit message is `commit_message` (the same text `gh pr merge --body`
// posts, so gating one channel and not the other would be incoherent).
const API_PROSE_FIELD_RE = /^(?:body|message|commit_message)=/;

/**
 * Does this `gh api` endpoint address a surface where a write publishes prose?
 * @param {string} endpoint
 */
export function apiEndpointPostsProse(endpoint) {
  const route = String(endpoint || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/)[0];
  const segments = route.split("/").filter(Boolean);
  let i = segments.length - 1;
  while (i >= 0 && API_ID_SEGMENT_RE.test(segments[i])) i -= 1;
  return i >= 0 && API_PROSE_SEGMENTS.has(segments[i].toLowerCase());
}

/**
 * Walk `argv` the way pflag does and report whether a `--help`/`-h` word is
 * reached in a FLAG position — that is, was NOT consumed as some other flag's
 * VALUE.
 *
 * This is the fix for the fix-round-3 verdict's Finding 1. The previous check
 * asked whether `--help` appeared ANYWHERE in argv, which is not a question
 * about the command's grammar at all: pflag consumes the word after a
 * value-taking flag even when that word starts with `-`, so
 * `gh issue create --title -h --body "…"` really does post, while a
 * "contains -h" test read it as `gh` printing help and posting nothing. Same
 * failure class as rounds 1-3 — an odd spelling read as "not a posting call" —
 * and unlike the expansion case this is not even an unknown: the gate can see
 * exactly which flag consumed the token.
 *
 * `consumesNext` decides, per flag token, whether it swallows the following
 * word. Its DEFAULT differs by call site on purpose. For a posting shape the
 * catalog lists only the flags this gate tracks, so an unrecognized long flag
 * is ASSUMED to take a value: guessing "consumes" costs a refusal on a
 * contrived line, guessing "boolean" costs a bypass. For `gh api` the value
 * flags are enumerated in full, so anything outside that set really is a
 * boolean.
 *
 * @param {ShellWord[]} argv
 * @param {(token: string) => boolean} consumesNext
 * @returns {boolean}
 */
export function helpFlagIsFree(argv, consumesNext) {
  for (let i = 0; i < (argv || []).length; i += 1) {
    const value = argv[i].value;
    if (value === "--help" || value === "-h") return true;
    // `--` ends flag parsing; everything after it is a positional, so a
    // `--help` there is an argument, not a request for help.
    if (value === "--") return false;
    if (value === "-" || !value.startsWith("-")) continue;
    // `--flag=value` / `-f=value` carry their value inline and swallow nothing.
    if (value.includes("=")) continue;
    if (consumesNext(value)) i += 1;
  }
  return false;
}

/**
 * `consumesNext` for a POSTING_SHAPES entry: a flag swallows the next word
 * unless this gate knows it is boolean. Short flags are clustered
 * (`-ew`), and a cluster is boolean only if EVERY character is.
 * @param {{boolShorthands?: string[], boolLongs?: string[]}} entry
 */
function shapeConsumesNext(entry) {
  const shorts = new Set(entry.boolShorthands || []);
  const longs = new Set(entry.boolLongs || []);
  return (token) => {
    if (token.startsWith("--")) return !longs.has(token);
    const chars = token.slice(1).split("");
    return !chars.every((char) => shorts.has(char));
  };
}

/** The `gh` command groups that own at least one gated posting subcommand. */
const GATED_GROUPS = new Set(POSTING_SHAPES.map((s) => s.path[1]));

// The LONG prose flags, as a set independent of any one subcommand's row.
// Long-only on purpose: `--body`/`--comment`/`--notes` mean the same thing
// everywhere in `gh`, while a SHORT letter does not (`-c` is a value-taking
// `--comment` on `gh issue close` and a boolean review selector on
// `gh pr review`; `-b` is `--base` on `gh issue develop`). Guessing a short
// letter's meaning on a subcommand this gate has never read would refuse
// ordinary work; the long spelling cannot be mistaken.
const PROSE_LONG_BODY_FLAGS = [{ long: "--body" }, { long: "--comment" }, { long: "--notes" }];
const PROSE_LONG_FILE_FLAGS = [{ long: "--body-file" }, { long: "--notes-file" }];

/**
 * The posting shape a `gh <group> <sub>` names — by canonical name, by Cobra
 * ALIAS, or, for a subcommand this gate has never read, by the INVERTED
 * DEFAULT (fix round 7).
 *
 * Fix round 6 matched `path[2]` literally, so `gh issue new` — a real Cobra
 * alias of `create`, three characters, no shell — posted unmarked. Two things
 * changed, and only the second one closes the class:
 *   · the derivation now reads each subcommand's ALIASES block (step 2.5 of
 *     the recipe above), which is PRECISION: an alias resolves to the real
 *     row, so `gh issue new -b "…"` is read with `issue create`'s full short-
 *     flag grammar;
 *   · and an UNKNOWN subcommand inside a GATED GROUP that carries a long
 *     prose flag is treated as posting anyway. That is what makes the alias
 *     question decidable rather than enumerable: `gh issue <anything>
 *     --body "…"` is gated whether or not this table has heard of
 *     `<anything>`, today or after the next `gh` release.
 * A missing name therefore costs PRECISION (a shape reported by its literal
 * spelling, short flags unread), never a bypass.
 *
 * @param {string|null} group
 * @param {string|null} sub
 * @returns {object|null}
 */
export function postingShapeFor(group, sub) {
  if (!group || !sub) return null;
  const exact = POSTING_SHAPES.find((s) => s.path[1] === group && s.path[2] === sub);
  if (exact) return exact;
  const alias = POSTING_SHAPES.find((s) => s.path[1] === group && (s.aliases || []).includes(sub));
  if (alias) return { ...alias, name: `${alias.name} (as \`gh ${group} ${sub}\`)` };
  if (!GATED_GROUPS.has(group) || sub.startsWith("-")) return null;
  return {
    path: ["gh", group, sub],
    name: `gh ${group} ${sub}`,
    boolShorthands: [],
    boolLongs: [],
    bodyFlags: PROSE_LONG_BODY_FLAGS,
    fileFlags: PROSE_LONG_FILE_FLAGS,
    // Only a long prose flag makes an unread subcommand a posting call — with
    // none, `gh issue view 26 --json comments` and every other ordinary read
    // in a gated group stays untouched.
    requireBody: true,
  };
}

/**
 * The verdict for a `gh` call whose subcommand the gate cannot read. Reported
 * as a posting candidate with an uninspectable body, so it refuses.
 * @param {Record<string, string>} env
 * @returns {PostingCandidate}
 */
function expandedSubcommandCandidate(env) {
  return {
    shape: "gh <subcommand hidden by expansion>",
    uninspectable: true,
    bodies: [],
    env,
  };
}

/** `gh`'s own flags that may legally precede the subcommand. */
const GH_GLOBAL_VALUE_FLAGS = new Set(["--repo", "-R"]);

/**
 * A body value the gate must not pretend to know: stdin, a device/FIFO, or a
 * path the shell would have expanded at runtime.
 * @param {string} value
 */
function isUnreadablePath(value) {
  return value === "-" || value.startsWith("/dev/") || value.startsWith("/proc/");
}

/**
 * Walk past `gh`'s pre-subcommand global flags (`--repo o/r`, `-R o/r`,
 * `--help`, …) to the subcommand words.
 * @param {ShellWord[]} argv the words AFTER the `gh` word itself
 * @returns {number} index of the first subcommand word
 */
function skipGhGlobalFlags(argv) {
  let k = 0;
  while (k < argv.length && argv[k].value.startsWith("-")) {
    k += GH_GLOBAL_VALUE_FLAGS.has(argv[k].value) ? 2 : 1;
  }
  return k;
}

/**
 * Do these words read as a gated `gh` subcommand? Used to recognize an
 * invocation whose command word the gate cannot read.
 * @param {ShellWord[]} argv
 */
function looksLikeGhSubcommand(argv) {
  const start = skipGhGlobalFlags(argv);
  const first = argv[start] ? argv[start].value : null;
  if (first === "api") return true;
  const second = argv[start + 1] ? argv[start + 1].value : null;
  return Boolean(postingShapeFor(first, second));
}

/**
 * Every `gh` invocation in a parsed command line — at ANY position, behind any
 * number of `&&`/`;`/`|`/newline separators, subshells, wrappers (`xargs gh`,
 * `then gh`), leading variable assignments, or an absolute path to the binary.
 *
 * This is the fix for the fix-round-2 verdict's Finding 1: the previous matcher
 * required `gh` at token[0], so `cd /tmp && gh issue comment …` was simply not
 * a posting call as far as the gate was concerned.
 *
 * THE SEARCH IS POSITION-INDEPENDENT EVERYWHERE, the nested re-read included
 * (#96, fix round 10 — the `nestedOperandCandidates` block comment below has
 * the full account). Fix round 8 added an `atCommandPositionOnly` option that
 * restricted the NESTED arm to argv[0] of each re-parsed simple command, to buy
 * back precision on prose; fix round 9 then had to teach that option a 7-name
 * wrapper allowlist so a wrapped call was still seen. Both were the SAME
 * anti-pattern this module's header rejects for interpreters — a finite list of
 * command names whose membership decides whether something is inspected — and
 * both shipped a silent bypass: an unlisted wrapper (`setsid`, `nice -n 10`,
 * `doas`, `stdbuf -oL`, or a name invented next year) and a listed wrapper
 * whose flag takes a separate value word (`sudo -u root …`) walked all 18
 * gated shapes. Inverting that default is what removes the list — and the
 * honest inversion has an EMPTY recognised half here: this gate cannot prove of
 * ANY word that it does not pass execution through to the next one, so every
 * leading word is a possible wrapper, every index is a possible command
 * position, and the restriction dissolves into the position-independent search
 * this function already performs. Deliberate, and fail-closed in the direction
 * the brief for this round names: an ambiguous position stays a candidate,
 * which costs a false refusal (loud, printed together with its override) rather
 * than a silent post.
 *
 * @param {SimpleCommand[]} commands
 * @returns {{argv: ShellWord[], env: Record<string, string>}[]}
 */
export function findGhCandidates(commands) {
  const candidates = [];
  for (const command of commands || []) {
    const words = (command && command.words) || [];
    const env = leadingAssignments(words);
    const heredoc = Boolean(command && command.heredoc);
    for (let i = 0; i < words.length; i++) {
      const isGh = basename(words[i].value) === "gh";
      // A command word the shell would expand (`$(echo gh)`, `$GH_BIN`) has no
      // readable name, so fall back to the SHAPE of what follows it: an
      // unknown command word followed by `issue comment …` is a candidate.
      const isOpaqueGh = !isGh && words[i].expanded && looksLikeGhSubcommand(words.slice(i + 1));
      if (!isGh && !isOpaqueGh) continue;
      candidates.push({ argv: words.slice(i + 1), env, heredoc });
    }
  }
  return candidates;
}

/**
 * @typedef {{shape: string, uninspectable: boolean, bodies: string[],
 *            env: Record<string, string>}} PostingCandidate
 */

/**
 * Decide whether ONE `gh` invocation posts text, and resolve every body it
 * would post.
 *
 * Two deliberate strictness choices, both from the fix-round-2 verdict:
 *  - EVERY body-carrying flag occurrence is resolved and checked, not just the
 *    first. `gh` (pflag) uses the LAST occurrence of a repeated string flag, so
 *    reading `[0]` let `--body <marked> --body <unmarked>` post the unmarked one
 *    (Finding 2). Checking all of them is a superset of last-wins and cannot be
 *    gamed by ordering.
 *  - A body the gate cannot READ — stdin, a device, a `$VAR`/`$(…)` the shell
 *    would expand, an unreadable file — is refused, never passed through.
 *
 * @param {{argv: ShellWord[], env: Record<string, string>}} candidate
 * @param {{heredoc?: boolean, readFileSync?: typeof readFileSync}} [ctx]
 * @returns {PostingCandidate|null} null when this `gh` call posts no text
 */
export function analyzeGhCandidate(candidate, ctx = {}) {
  const read = ctx.readFileSync || readFileSync;
  const argv = (candidate && candidate.argv) || [];
  const env = (candidate && candidate.env) || {};
  const start = skipGhGlobalFlags(argv);
  const sub1Word = argv[start] || null;
  // FAIL CLOSED on a subcommand this gate cannot read. `gh issue $SUB 26
  // --body …` used to fall through to "posts nothing", which made the cheapest
  // possible attack — hiding the subcommand behind an expansion — also the
  // most effective one. Unknown now means POSTING: the candidate is reported
  // as uninspectable, which refuses with the same message as an unreadable
  // body. Pass the subcommand literally, or override deliberately.
  if (sub1Word && sub1Word.expanded) return expandedSubcommandCandidate(env);
  const sub1 = sub1Word ? sub1Word.value : null;
  if (!sub1) return null;

  if (sub1 === "api") return analyzeGhApi(argv.slice(start + 1), env, read);

  const sub2Word = argv[start + 1] || null;
  // Only an expansion sitting where a GATED group's subcommand belongs is
  // unknowable in the way that matters: no value of `$X` in `gh browse $X`
  // can turn it into a posting call, so blocking that would be noise.
  if (GATED_GROUPS.has(sub1) && sub2Word && sub2Word.expanded) {
    return expandedSubcommandCandidate(env);
  }
  const sub2 = sub2Word ? sub2Word.value : null;
  const entry = postingShapeFor(sub1, sub2);
  if (!entry) return null;

  // `--help`/`-h` in a real FLAG position makes gh print help and exit without
  // contacting GitHub, so the call posts nothing. In a VALUE position it is
  // just this flag's value and the call posts normally — see helpFlagIsFree.
  if (helpFlagIsFree(argv, shapeConsumesNext(entry))) return null;

  const fileHits = findFlagWords(argv, entry.fileFlags, entry.boolShorthands);
  const bodyHits = findFlagWords(argv, entry.bodyFlags, entry.boolShorthands);
  if (entry.requireBody && fileHits.length === 0 && bodyHits.length === 0) return null;

  const result = { shape: entry.name, uninspectable: false, bodies: [], env };
  if (candidate.heredoc || ctx.heredoc) result.uninspectable = true;

  for (const hit of fileHits) {
    if (hit.expanded || isUnreadablePath(hit.value)) {
      result.uninspectable = true;
      continue;
    }
    try {
      if (!statSync(hit.value).isFile()) {
        result.uninspectable = true;
        continue;
      }
      result.bodies.push(read(hit.value, "utf8"));
    } catch {
      result.uninspectable = true;
    }
  }
  for (const hit of bodyHits) {
    if (hit.expanded) {
      result.uninspectable = true;
      continue;
    }
    result.bodies.push(hit.value);
  }
  return result;
}

/**
 * @param {ShellWord[]} argv the words after `gh api`
 * @param {Record<string, string>} env
 * @param {typeof readFileSync} read
 * @returns {PostingCandidate|null}
 */
function analyzeGhApi(argv, env, read) {
  let endpointWord = null;
  for (let k = 0; k < argv.length; ) {
    const token = argv[k].value;
    if (token.startsWith("-")) {
      k += API_VALUE_FLAGS.has(token) ? 2 : 1;
      continue;
    }
    endpointWord = argv[k];
    break;
  }

  // Decide WRITE first, route second. A read posts nothing whatever its route,
  // so an unreadable endpoint on a GET (`gh api "$EP"`) must not be refused —
  // that would be noise. An unreadable endpoint on a WRITE is the fail-open
  // case and is refused, the same inversion applied to a hidden subcommand.
  const methods = findFlagWords(argv, API_METHOD_FLAGS, []);
  const fields = findFlagWords(argv, API_FIELD_FLAGS, []);
  const inputs = findFlagWords(argv, API_INPUT_FLAGS, []);
  const method = methods.length ? methods[methods.length - 1].value.toUpperCase() : null;
  const isWrite = method
    ? ["POST", "PATCH", "PUT"].includes(method)
    : fields.length > 0 || inputs.length > 0;
  if (!isWrite) return null;
  if (endpointWord && endpointWord.expanded) {
    return {
      shape: "gh api <endpoint hidden by expansion>",
      uninspectable: true,
      bodies: [],
      env,
    };
  }
  const endpoint = endpointWord ? endpointWord.value : null;
  if (!endpoint || !apiEndpointPostsProse(endpoint)) return null;
  // A FREE `--help` prints help and posts nothing. One consumed as a value
  // (`-H --help`, a header whose value happens to spell it) does not, which is
  // why this is the same positional walk and not a `.some()`.
  if (helpFlagIsFree(argv, (token) => API_VALUE_FLAGS.has(token))) return null;

  const result = {
    shape: `gh api ${method || "POST"} ${endpoint}`,
    uninspectable: false,
    bodies: [],
    env,
  };
  if (inputs.length > 0) result.uninspectable = true;
  for (const field of fields) {
    if (!API_PROSE_FIELD_RE.test(field.value)) continue;
    if (field.expanded) {
      result.uninspectable = true;
      continue;
    }
    const value = field.value.slice(field.value.indexOf("=") + 1);
    if (value.startsWith("@")) {
      const file = value.slice(1);
      if (isUnreadablePath(file)) {
        result.uninspectable = true;
        continue;
      }
      try {
        result.bodies.push(read(file, "utf8"));
      } catch {
        result.uninspectable = true;
      }
      continue;
    }
    result.bodies.push(value);
  }
  // A write to a conversation route that carries NO prose — every field was
  // readable and none of them is a prose field — posts no prose, so there is
  // nothing to mark: `-X PATCH …/issues/26 -f state=closed`,
  // `-X POST …/pulls -f title=T -f head=x -f base=main`. Refusing those was
  // the fix-round-3 verdict's Finding 2: 11 ordinary calls blocked, with a
  // refusal message about `gh` opening an editor that `gh api` never does, and
  // an internal inconsistency with the CLI side, where a `requireBody` shape
  // with no body flag (`gh issue edit 26 --add-label x`) is likewise allowed.
  // This is NOT the fail-open case the header forbids: the field list is
  // enumerated against GitHub's own schema for these routes exactly as the
  // route list is, and a field name outside that schema does nothing when the
  // API receives it. The genuinely unknown payloads — `--input`, `body=@file`
  // that cannot be read, a field the shell would expand — set `uninspectable`
  // above and still refuse.
  if (result.bodies.length === 0 && !result.uninspectable) return null;
  return result;
}

// ── The inverted default for an UNRECOGNISED command word (fix round 7) ──────
//
// Rounds 1-6 all died the same death: a real posting command spelled so the
// gate read it as harmless. Round 6 fixed the last instance of that (`bash
// -lc`) by deriving each interpreter's option GRAMMAR from its own usage
// output — correctly, and it holds. But it left the other half of the
// membership question answered from memory: WHICH TOOLS ARE INTERPRETERS. A
// name absent from `SCRIPT_INTRODUCERS` was not an interpreter, so `csh -c "gh
// issue comment 26 --body …"` — a shell in `/bin` on this very machine — walked
// through all 18 gated shapes with one word. A per-tool grammar cannot answer
// "which tools are there?", and a longer table would only postpone the next
// `tcsh`/`fish`/`pwsh`/whatever-ships-next.
//
// So the DEFAULT is inverted on the COMMAND WORD: an operand of a command
// word this gate does not recognise is a candidate for re-reading, whatever
// that command word is. `csh`, `tcsh`, `pwsh`, `fish`, `busybox`, or a name
// invented next year are all the same case, because none of them has to be
// known.
//
// UPDATED (#96, fix round 8). Round 7 shipped that inversion gated behind two
// operand-TEXT prefilters — `word.expanded` and a `NESTED_GH_RE` literal-text
// match on `gh ` — and both were themselves enumerations of spelling, the
// exact failure mode this section exists to remove: `csh -c "gh issue comment
// $N --body '…'"` skipped the whole operand the moment it contained a `$VAR`
// (17 of 18 gated shapes), and `csh -c "(gh issue comment …)"` /
// `csh -c "true&&gh issue comment …"` slipped past the regex on ordinary shell
// punctuation. Both prefilters are now GONE. Every non-empty operand of an
// unrecognised command word is re-parsed — via `word.raw` (see
// `ShellWord.raw` in shell-command-parse.mjs), which is built exactly like
// `word.value` EXCEPT an expansion contributes its own verbatim syntax
// (`$VAR`, `${VAR}`, `$(…)`, a backtick command) instead of nothing — and the
// STRUCTURAL parse (`findGhCandidates`/`analyzeGhCandidate`) decides whether
// it posts, the same way the top-level parse always has. A `$VAR` in the body
// is no longer invisible: it re-parses as an expanded word, which
// `analyzeGhCandidate` already treats as uninspectable and refuses — the same
// verdict the top level has always reached for `--body "$MSG"`.
//
// Widening the re-parse to EVERY operand (not just ones that already look
// like they contain `gh `) does widen the FALSE-REFUSAL surface: an ordinary
// line like `git commit -m "docs: quote 'gh' issue comment --body in the
// guide"` re-parses into a simple command that legitimately contains the words
// `gh`, `issue`, `comment`, `--body`, just not adjacent as an invocation, and
// the parse sees through the quotes the old text prefilter could not. Measured
// against merge-base `main` on a 52-command corpus of ordinary work, that is
// exactly ONE new refusal — and one refusal REMOVED (`make deploy MSG="…"`,
// see the assignment-run scoping in shell-command-parse.mjs). It is the price
// of closing the quoted/escaped evasion path, it costs a retry, and the
// override is printed at the moment of refusal.
//
// FIX ROUND 10 (#96) — WHY THERE IS NO COMMAND-POSITION RESTRICTION HERE.
// Round 8 paid for that widening with a third change: an
// `atCommandPositionOnly` option restricting this arm to argv[0] of each
// re-parsed simple command. It bought precision on prose and shipped a silent
// bypass — `nohup gh issue comment 26 --body '…'` read as a command whose
// position was `nohup`, so all 18 gated shapes posted unmarked behind any
// wrapper, something `main` refuses. Round 9 repaired it with a seven-name
// wrapper allowlist and reproduced the bug one level down (`setsid`, `nice -n
// 10`, `doas`, `stdbuf -oL`, a name invented next year; and `sudo -u root`,
// whose flag value the walk consumed as the command position). Round 10
// removes the restriction rather than lengthening the list, because the rule
// this file states for interpreters is the same rule here: membership of a
// finite name list must not decide whether something is inspected, and the
// recognised half must be the narrow, arguable one. For "does this word pass
// execution through to the next?" that recognised half is EMPTY — so every
// leading word is a possible wrapper and the arm is position-independent
// again, identical to `main` and to the top level. The cost is the precision:
// prose carrying both a posting phrase and a body-shaped flag is REFUSED, the
// same false refusal `main` has always had. Loud beats silent; see DECLARED
// LIMITS above, which states both lines explicitly.
//
// What is now closed that fix round 7 left open, restated against the same
// reproductions: `csh -c "gh issue comment $N --body '…'"` REFUSES (the body
// is uninspectable, not skipped); `csh -c "(gh issue comment 26 --body …)"`
// and `csh -c "true&&gh issue comment 26 --body …"` REFUSE (no text-match
// prefilter to slip past); quoting/escaping the `gh` word (`'gh'`, `"gh"`,
// `\gh`) no longer helps, because there is no text match to defeat — the
// re-parse reads the real token; and a KNOWN shell nested inside the unknown
// one (`csh -c "sh -c 'gh issue comment …'"`) is caught because the re-parse
// recurses through `parseShellCommands`' own SCRIPT_INTRODUCERS handling the
// same way the top level does.
//
// What is still a DECLARED LIMIT, not closed by this round: a nested call
// still needs a resolvable or uninspectable BODY to be counted (a bare mention
// with no body-shaped flag stays out of the net, unchanged from round 7); the
// pipeline-through-an-intermediate-stage evasion (`… | tee /tmp/p.sh | sh`);
// and `gh api graphql`'s `addComment` mutation. See DECLARED LIMITS above and
// `.claude/rules/issue-workflow.md`.
//
// The recognised text-only set below is unchanged by this round: commands
// that cannot execute an operand at all, they only print or match text. A
// name missing from THIS list costs a false refusal (loud, overridable, one
// retry), where a name missing from an interpreter list cost a silent bypass.
// `TEXT_ONLY_COMMANDS` is deliberately short: add a name only if it genuinely
// cannot run its argument (which is why `awk` and `sed` are absent — GNU
// `sed`'s `e` and awk's `system()` both can, and `xargs`/`nohup`/`env`
// obviously do).
const TEXT_ONLY_COMMANDS = ["echo", "printf", "grep", "egrep", "fgrep", "rg"];

// A script arriving on stdin is executed by a sink that takes no operand of its
// own (`… | csh`, `… | bash -s`, `… | ./run.sh`). One WITH an operand is doing
// something to that operand instead (`… | grep body`, `… | tee /tmp/x`), which
// is why the pipeline arm of the inversion is narrower than the operand arm.
const NESTED_OPERAND_MAX_DEPTH = 3;

/** @param {import("./lib/shell-command-parse.mjs").ShellWord[]} words */
function isTextOnlyCommand(words) {
  const idx = commandWordIndex(words);
  return idx < words.length && TEXT_ONLY_COMMANDS.includes(basename(words[idx].value));
}

/** @param {{words: import("./lib/shell-command-parse.mjs").ShellWord[]}} [next] */
function sinkExecutesStdin(next) {
  const words = (next && next.words) || [];
  const idx = commandWordIndex(words);
  if (idx >= words.length) return false;
  if (TEXT_ONLY_COMMANDS.includes(basename(words[idx].value))) return false;
  for (let i = idx + 1; i < words.length; i++) {
    if (!words[i].value.startsWith("-")) return false;
  }
  return true;
}

/**
 * Posting calls hidden inside an operand of a command word this gate does not
 * recognise — the fix-round-7 inversion described above, WIDENED in fix round
 * 8 (#96): every non-empty operand is now re-parsed structurally (via
 * `word.raw`), not just ones that first pass a text-match prefilter.
 *
 * TWO guards keep the widening honest — precision, not a blanket refusal of
 * any expansion. (A third, a command-position restriction, was tried in fix
 * rounds 8 and 9 and REMOVED in round 10: it could only be made to see a
 * wrapped call by consulting a finite list of wrapper names, and a stale list
 * is a silent bypass. See the block comment above.)
 *  - a text-only command word (`echo "gh issue comment …"`) is skipped, unless
 *    it pipes into a sink that would execute what it prints;
 *  - a nested candidate counts only when it actually REACHES FOR A BODY (a
 *    resolvable one, or one this gate refuses to read). Prose that merely
 *    contains the phrase with no body-shaped flag — `git log --grep "gh issue
 *    comment"` — names a posting shape with no body and is not a posting
 *    call. This is the one place the inversion is not fully closed, and the
 *    residual is narrow BY GH'S OWN BEHAVIOUR rather than by assumption: a
 *    body-less posting call prompts interactively, and with no TTY `gh`
 *    refuses it outright — verified on gh 2.93.0, which answers `flags
 *    required when not running interactively` and never reaches the API. A
 *    top-level body-less call is still refused (that path is unchanged); only
 *    the nested re-read requires a body.
 *
 * @param {import("./lib/shell-command-parse.mjs").SimpleCommand[]} commands
 * @param {{readFileSync?: typeof readFileSync}} ctx
 * @param {number} depth
 * @returns {PostingCandidate[]}
 */
function nestedOperandCandidates(commands, ctx, depth) {
  /** @type {PostingCandidate[]} */
  const found = [];
  if (depth >= NESTED_OPERAND_MAX_DEPTH) return found;
  const list = commands || [];
  for (let ci = 0; ci < list.length; ci++) {
    const command = list[ci];
    const words = (command && command.words) || [];
    if (!words.length) continue;
    const pipedIntoExecutor = Boolean(command.pipedNext) && sinkExecutesStdin(list[ci + 1]);
    if (isTextOnlyCommand(words) && !pipedIntoExecutor) continue;
    const env = leadingAssignments(words);
    for (let i = commandWordIndex(words) + 1; i < words.length; i++) {
      const word = words[i];
      // No operand-TEXT prefilter (#96, Part A) — every non-empty operand is
      // re-parsed and left to the structural match below to decide. `raw`
      // (not `value`) so an expansion inside the operand (`$MSG`) survives
      // into the re-parse as an expanded word instead of vanishing — see
      // `ShellWord.raw` in shell-command-parse.mjs.
      if (!word.raw || !word.raw.trim()) continue;
      const inner = parseShellCommands(word.raw);
      // The re-parsed operand gets the SAME position-independent search the top
      // level runs (#96, fix round 10) — no command-position restriction, so no
      // list of wrapper names can go stale and let a wrapped call through.
      for (const candidate of findGhCandidates(inner.commands)) {
        const analyzed = analyzeGhCandidate(candidate, ctx);
        if (!analyzed) continue;
        if (!analyzed.bodies.length && !analyzed.uninspectable) continue;
        found.push({ ...analyzed, env: { ...env, ...analyzed.env } });
      }
      found.push(...nestedOperandCandidates(inner.commands, ctx, depth + 1));
    }
  }
  return found;
}

/**
 * Every posting call a Bash command line would make.
 * @param {string} command
 * @param {{readFileSync?: typeof readFileSync}} [deps]
 * @returns {PostingCandidate[]}
 */
export function analyzeBashCommand(command, deps = {}) {
  const text = typeof command === "string" ? command : "";
  if (!text.trim()) return [];
  const { commands } = parseShellCommands(text);
  // NOTE heredoc-ness is carried per COMMAND (see findGhCandidates), not for the
  // whole line: a script that writes a body with `cat > body.md <<EOF` and THEN
  // posts `--body-file body.md` is perfectly inspectable, and blocking it would
  // be exactly the kind of false refusal that gets a gate routed around.
  const ctx = { readFileSync: deps.readFileSync };
  const posting = [];
  // Deduped on the WHOLE candidate, env included: a recognised interpreter's
  // script is parsed by both routes and would otherwise be reported twice,
  // while two calls that differ only in an inline override must stay two.
  const seen = new Set();
  const add = (candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    posting.push(candidate);
  };
  for (const candidate of findGhCandidates(commands)) {
    const analyzed = analyzeGhCandidate(candidate, ctx);
    if (analyzed) add(analyzed);
  }
  for (const candidate of nestedOperandCandidates(commands, ctx, 0)) add(candidate);
  return posting;
}

/**
 * @param {string[]|ShellWord[]} tokens
 * @returns {string|null} the matched shape name, or null if this isn't a
 *   recognized GitHub-posting call shape. Position-independent: `gh` may sit
 *   anywhere in the token list.
 */
export function matchBashPostingShape(tokens) {
  if (!Array.isArray(tokens)) return null;
  const words = toWords(tokens);
  for (const candidate of findGhCandidates([{ words }])) {
    const analyzed = analyzeGhCandidate(candidate, { readFileSync: () => "" });
    if (analyzed) return analyzed.shape;
  }
  return null;
}

/** The literal bytes a blocked caller has to add (fix-round-2 verdict, Finding 7). */
export function markerHelp() {
  return [
    "",
    "The marker — BOTH halves are required; append them to the body verbatim:",
    "",
    render(),
    "",
    "Or let the helper add it for you (it writes the file and posts with --body-file):",
    "  node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>",
    "",
    "Override, for a human typing their OWN ruling through the CLI — either form works:",
    "  ALLOW_UNATTRIBUTED_COMMENT=1 gh issue comment …      (inline prefix)",
    "  export ALLOW_UNATTRIBUTED_COMMENT=1                  (session environment)",
  ].join("\n");
}

/** @param {string} shape */
export function MISSING_MARKER_REASON(shape) {
  return (
    `\`${shape}\` is missing the machine-attribution marker (#78) — this repo has no ` +
    "separate bot identity, so an unmarked comment is indistinguishable from the " +
    "maintainer's own words, and a later automated run can cite it back as a maintainer " +
    "ruling.\n" +
    markerHelp()
  );
}

/** @param {string} shape */
export function UNINSPECTABLE_REASON(shape) {
  return (
    `\`${shape}\`'s body cannot be inspected for the machine-attribution marker (#78) — ` +
    "stdin redirects (`-F -`), heredocs, piped-in bodies, devices and shell-expanded " +
    "values (`$VAR`, `$(…)`) are refused, not silently passed through, because the gate " +
    "cannot prove what they contain. Write the body to a real file and pass " +
    "`--body-file <path>`.\n" +
    markerHelp()
  );
}

/** @param {string} shape */
export function NO_BODY_REASON(shape) {
  return (
    `\`${shape}\` carries no inspectable body (#78) — with no \`--body\`/\`--body-file\`, ` +
    "`gh` opens an editor or the browser and posts text this gate never sees.\n" +
    markerHelp()
  );
}

/**
 * Is this resolved candidate a problem — and why?
 * @param {PostingCandidate} candidate
 * @returns {string|null} the refusal reason, or null when it is fine
 */
export function candidateProblem(candidate) {
  if (candidate.uninspectable) return UNINSPECTABLE_REASON(candidate.shape);
  if (candidate.bodies.length === 0) return NO_BODY_REASON(candidate.shape);
  // EVERY body is checked, not just the one `gh`'s last-wins would pick — the
  // fix-round-2 verdict's Finding 2 posted an unmarked body by appending a
  // second `--body` after a marked one.
  if (candidate.bodies.some((body) => !hasMarker(body))) {
    return MISSING_MARKER_REASON(candidate.shape);
  }
  return null;
}

// Rung-2 doc-scan regex — GENERATED FROM POSTING_SHAPES so the doc scan and
// the runtime gate cannot describe different posting surfaces. (They used to
// be two hand-kept lists; widening one and forgetting the other is exactly the
// drift that let `gh issue edit --body` sit ungated.) A `requireBody` shape
// also requires its QUALIFYING flag, so a doc merely mentioning
// `gh issue close <n>` — which posts no body — isn't flagged. `\b` after a
// bare flag name (e.g. `-c\b`) already matches an immediately following `=`
// or `-` (both non-word chars), so this also catches the `=`-form and
// `--body-file` (which contains `--body` as a prefix) — verified empirically,
// not just by inspection, before relying on it here.
function postingShapeDocPattern(shape) {
  const [, group, sub] = shape.path;
  // Cobra ALIASES are part of the surface, so the doc scan names them too —
  // an instruction that says `gh issue new --body …` is exactly as unguarded
  // as one that says `gh issue create --body …`.
  const subs = [sub, ...(shape.aliases || [])].join("|");
  const base = String.raw`\bgh\s+${group}\s+(?:${subs})\b`;
  if (!shape.requireBody) return base;
  const flags = [...shape.bodyFlags, ...shape.fileFlags]
    .flatMap((flag) => [flag.long, flag.short])
    .filter(Boolean);
  return String.raw`${base}[^\n]*(?:${flags.join("|")})\b`;
}

export const POSTING_RE = new RegExp(
  [
    ...POSTING_SHAPES.map(postingShapeDocPattern),
    String.raw`\bmcp__github__add_issue_comment\b`,
    String.raw`\bmcp__github__create_issue\b`,
  ].join("|"),
  "i",
);

const HEREDOC_RE = /<<-?\s*['"]?\w+/;
const PIPED_GH_RE = /\|\s*gh\s+(?:issue|pr)\b/;
// Matches `-F -` / `--body-file -` (space form) AND `-F=-` / `--body-file=-`
// (equals form) — the equals form is ALSO caught independently inside
// resolveBashBody's `value === "-"` check below; this regex is defense in
// depth in isUninspectableBashCommand, not the only guard.
const STDIN_FLAG_RE = /(?:^|\s)(?:-F|--body-file)(?:\s+|=)-(?:\s|$)/;

/**
 * A body a hook cannot statically inspect (stdin redirect, heredoc, piped
 * input) must be REFUSED outright — never silently passed through — because
 * the gate cannot prove what it contains. See .claude/rules/quality-gates.md
 * "Enforcement over reminders": a check that can be routed around by
 * construction is not a check.
 * @param {string} command
 * @returns {boolean}
 */
export function isUninspectableBashCommand(command) {
  const text = typeof command === "string" ? command : "";
  if (!text) return false;
  if (!POSTING_RE.test(text) && !PIPED_GH_RE.test(text)) return false;
  return HEREDOC_RE.test(text) || PIPED_GH_RE.test(text) || STDIN_FLAG_RE.test(text);
}

/**
 * Resolve the comment/issue body a Bash `gh` invocation would post.
 *
 * Compatibility surface over `analyzeBashCommand()`: it reports the FIRST
 * candidate that would be refused (so a marked call followed by an unmarked one
 * reports the unmarked one), falling back to the first candidate when nothing
 * is wrong. Use `analyzeBashCommand()` directly when you need every call.
 * @param {string} command
 * @param {{readFileSync?: typeof readFileSync}} [deps]
 * @returns {{uninspectable: boolean, body: string|null, shape: string|null}}
 */
export function resolveBashBody(command, deps = {}) {
  const candidates = analyzeBashCommand(command, deps);
  if (candidates.length === 0) return { uninspectable: false, body: null, shape: null };
  const problem = candidates.find((c) => candidateProblem(c) !== null);
  const chosen = problem || candidates[0];
  if (chosen.uninspectable) return { uninspectable: true, body: null, shape: chosen.shape };
  const unmarked = chosen.bodies.find((body) => !hasMarker(body));
  const body = unmarked !== undefined ? unmarked : (chosen.bodies[0] ?? null);
  return { uninspectable: false, body, shape: chosen.shape };
}

/**
 * @param {Record<string, unknown>} toolInput
 * @returns {{uninspectable: boolean, body: string|null}}
 */
export function resolveMcpBody(toolInput) {
  const body = toolInput && typeof toolInput.body === "string" ? toolInput.body : null;
  return { uninspectable: false, body };
}

const MCP_POSTING_TOOLS = new Set(["mcp__github__add_issue_comment", "mcp__github__create_issue"]);

export const OVERRIDE_ENV = "ALLOW_UNATTRIBUTED_COMMENT";
export const OVERRIDE_WARNING =
  "⚠ comment-attribution gate OVERRIDDEN by ALLOW_UNATTRIBUTED_COMMENT=1 — posting without a " +
  "machine-attribution marker (#78).";

/**
 * The pure decision the hook wraps: given a PreToolUse payload, allow or
 * block — and why.
 *
 * EVERY posting call in the command line is examined, not just the first
 * (fix-round-2 verdict, Finding 3: `gh issue comment … <marked> ; gh issue
 * comment … <unmarked>` posted the unmarked one). A candidate carrying an
 * INLINE `ALLOW_UNATTRIBUTED_COMMENT=1` prefix is allowed but reported loudly —
 * that is the form the docs imply and the form a person actually types
 * (Finding 4: it lands in the command's environment, never the hook's, so the
 * hook-env branch alone could never see it).
 *
 * @param {{tool_name?: string, tool_input?: Record<string, unknown>}} payload
 * @param {{readFileSync?: typeof readFileSync}} [deps]
 * @returns {{verdict: "allow"|"block", reason?: string, override?: boolean}}
 */
export function evaluateHookPayload(payload, deps = {}) {
  const toolName = payload && payload.tool_name;
  const toolInput = (payload && payload.tool_input) || {};

  if (toolName === "Bash") {
    const command = toolInput.command;
    if (typeof command !== "string" || !command.trim()) return { verdict: "allow" };
    let overridden = false;
    for (const candidate of analyzeBashCommand(command, deps)) {
      const problem = candidateProblem(candidate);
      if (!problem) continue;
      if (candidate.env && candidate.env[OVERRIDE_ENV] === "1") {
        overridden = true;
        continue;
      }
      return { verdict: "block", reason: problem };
    }
    if (overridden) return { verdict: "allow", override: true, reason: OVERRIDE_WARNING };
    return { verdict: "allow" };
  }

  if (MCP_POSTING_TOOLS.has(toolName)) {
    const resolved = resolveMcpBody(toolInput);
    if (hasMarker(resolved.body)) return { verdict: "allow" };
    return {
      verdict: "block",
      reason:
        `${toolName} body is missing the machine-attribution marker (#78) — this repo has no ` +
        "separate bot identity, so an unmarked comment is indistinguishable from the " +
        "maintainer's own words.\n" +
        markerHelp(),
    };
  }

  return { verdict: "allow" };
}

// ── Rung 2 — repo-wide call-site coverage ────────────────────────────────────

// Any of these mean the surrounding text already points a reader at the
// helper / the marker / the documented override — i.e. it is NOT an
// unguarded posting instruction, even though it names a `gh`/MCP posting call.
export const HELPER_REFERENCE_RE =
  /post-issue-comment\.mjs|machine-attribution|ALLOW_UNATTRIBUTED_COMMENT|comment-attribution/i;

/**
 * @param {{file: string, content: string}[]} files
 * @returns {string[]} file paths that name a posting call with no helper/marker reference
 */
export function findUnguardedPostingSites(files) {
  const hits = [];
  for (const { file, content } of files || []) {
    if (POSTING_RE.test(content) && !HELPER_REFERENCE_RE.test(content)) {
      hits.push(file);
    }
  }
  return hits;
}

const SCAN_TARGETS = [
  { dir: ".claude/commands", ext: ".md" },
  { dir: ".claude/agents", ext: ".md" },
  { dir: ".claude/hooks", ext: ".sh" },
  { dir: "skills", ext: ".md" },
];

/**
 * @param {string} root repo root
 * @returns {{file: string, content: string}[]}
 */
export function scannedFilesRung2(root) {
  const files = [];
  for (const { dir, ext } of SCAN_TARGETS) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    let entries;
    try {
      entries = readdirSync(abs, { recursive: true, withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile || !entry.isFile()) continue;
      if (!entry.name.endsWith(ext)) continue;
      const parentDir = entry.parentPath || entry.path || abs;
      const absFile = path.join(parentDir, entry.name);
      files.push({ file: path.relative(root, absFile), content: readFileSync(absFile, "utf8") });
    }
  }
  return files;
}

// ── Wiring — the hook and its self-test must stay plugged in ────────────────

export const HOOK_REL = ".claude/hooks/gate-comment-attribution.sh";
export const SELF_TEST_STEP = "attribution:comments:check:test";

/**
 * @param {{settings: string, gatesYml: string}} sources
 * @returns {string[]}
 */
export function findWiringViolations({ settings, gatesYml }) {
  const violations = [];
  if (typeof settings !== "string" || !settings.includes(HOOK_REL)) {
    violations.push(`${HOOK_REL} is not registered as a PreToolUse hook in .claude/settings.json`);
  }
  if (typeof gatesYml !== "string" || !gatesYml.includes(SELF_TEST_STEP)) {
    violations.push(`pnpm ${SELF_TEST_STEP} is not wired into .github/workflows/gates.yml`);
  }
  return violations;
}

// ── CLI ───────────────────────────────────────────────────────────────────

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * @param {string[]} argv
 * @returns {number} process exit code
 */
export function main(argv) {
  const args = Array.isArray(argv) ? argv : [];

  if (args.includes("--hook")) {
    const raw = readStdin();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      // Not our contract to enforce — fail open on a payload shape we can't parse.
      return 0;
    }
    const verdict = evaluateHookPayload(payload);
    if (verdict.verdict === "block") {
      process.stderr.write(`${verdict.reason}\n`);
      return 1;
    }
    // An allowed-but-noteworthy verdict (the documented override) still has to
    // be SEEN — a silent escape hatch is not the "loud, logged" one the rule
    // promises (fix-round-2 verdict, Finding 4).
    if (verdict.reason) process.stderr.write(`${verdict.reason}\n`);
    return 0;
  }

  const bodyIndex = args.indexOf("--body");
  if (bodyIndex !== -1 && args[bodyIndex + 1]) {
    const file = args[bodyIndex + 1];
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch (err) {
      process.stderr.write(`Cannot read ${file}: ${err && err.message ? err.message : err}\n`);
      return 1;
    }
    if (hasMarker(content)) return 0;
    process.stderr.write(
      `${file} is missing the machine-attribution marker (#78). See render() in scripts/lib/comment-attribution.mjs.\n`,
    );
    return 1;
  }

  const root = process.cwd();
  const hits = findUnguardedPostingSites(scannedFilesRung2(root));
  if (hits.length > 0) {
    process.stderr.write(
      `attribution:comments:check: ${hits.length} file(s) instruct a GitHub-posting call with no reference ` +
        "to the comment-attribution helper/marker (#78):\n" +
        hits.map((f) => `  - ${f}`).join("\n") +
        "\n\nRoute the instruction through `node scripts/post-issue-comment.mjs`, or otherwise name the " +
        "machine-attribution marker/rule, so a coding agent following it doesn't bypass the gate.\n",
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
