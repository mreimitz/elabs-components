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
//      backticks, `eval "…"` and `sh -c "…"`, which each hide a whole script
//      inside one word.
//   2. `findGhCandidates()` treats EVERY command whose argv[0] basename is `gh`
//      as a candidate, wherever it sits — after leading `VAR=…` assignments,
//      behind a wrapper (`xargs gh`, `then gh`), or spelled as an absolute path.
//   3. `analyzeGhCandidate()` skips `gh`'s pre-subcommand global flags, matches
//      the subcommand against POSTING_SHAPES (or `gh api`, below), and resolves
//      EVERY body-carrying flag occurrence — `gh` (pflag) uses the LAST
//      occurrence of a repeated string flag, so checking only the first let a
//      marked body be followed by an unmarked one.
//   4. `evaluateHookPayload()` examines every candidate in the line, not the
//      first, and refuses if ANY of them would post unmarked or uninspectable
//      text.
// `findFlagValues()` still covers every shape `gh` (Cobra/pflag) accepts for a
// value-taking flag — `--flag value` · `--flag=value` · `-f value` · `-f=value` ·
// `-fvalue` (attached) · `-xyfvalue` (boolean shorthands clustered ahead of the
// value shorthand) — verified against `gh 2.93.0 <subcommand> --help` for all
// five gated subcommands. A cluster whose EARLIER character is a value-taking
// flag this catalog does not track stops the walk rather than guessing: no
// match, which is the safe direction.
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
//   - `gh api` gating is scoped to a POST/PATCH/PUT whose endpoint ends in
//     `comments`/`issues`/`reviews`/`pulls`. Read-only `gh api` calls and
//     non-text writes (`…/issues/26/lock`) stay untouched, per this gate's
//     acceptance criteria.
//   - A USER-DEFINED `gh` alias (`gh alias set cmt 'issue comment'`, then
//     `gh cmt 26 --body …`) resolves inside `gh`, from a config file this gate
//     does not read, so the subcommand match cannot see it. Reading
//     `gh alias list` would mean shelling out on every Bash call; the honest
//     answer is that aliases are out of scope.
//   - A RELATIVE `--body-file` path is resolved against the hook's working
//     directory, not against a `cd` earlier in the same line. When that lookup
//     fails the call is REFUSED (uninspectable), never allowed — so this costs
//     a false refusal, not a bypass. Pass an absolute path, or post through
//     scripts/post-issue-comment.mjs, which always does.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BLOCKQUOTE_PHRASE, MARKER, hasMarker, render } from "./lib/comment-attribution.mjs";
import { basename, leadingAssignments, parseShellCommands } from "./lib/shell-command-parse.mjs";

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

// Every shape below is a GitHub-posting call, sourced verbatim from
// `gh <subcommand> --help` (gh 2.93.0). `requireBody: true` means the bare
// subcommand is NOT itself a posting call (`gh issue close 26` closes
// silently, `gh pr review 12 --approve` carries no text) — only when it also
// carries a body/comment/body-file flag does it post text.
const POSTING_SHAPES = [
  {
    path: ["gh", "issue", "comment"],
    name: "gh issue comment",
    // -e/--editor, -w/--web are the only OTHER short boolean flags.
    boolShorthands: ["e", "w"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
  },
  {
    path: ["gh", "issue", "close"],
    name: "gh issue close --comment",
    // -c/--comment is the only body-carrying flag; this subcommand has no
    // --body-file and no other short boolean flags.
    boolShorthands: [],
    bodyFlags: [{ long: "--comment", short: "-c" }],
    fileFlags: [],
    requireBody: true,
  },
  {
    path: ["gh", "issue", "create"],
    name: "gh issue create",
    // -e/--editor is the only OTHER short BOOLEAN flag. -a/-l/-m/-p are
    // OTHER VALUE flags (assignee/label/milestone/project) — an earlier one
    // in a cluster swallows the rest per real pflag, so they are
    // deliberately NOT listed as bools; hitting one stops our walk with no
    // match, which is the safe outcome (see findFlagValues doc).
    boolShorthands: ["e"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
  },
  {
    path: ["gh", "pr", "comment"],
    name: "gh pr comment",
    boolShorthands: ["e", "w"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
  },
  {
    path: ["gh", "pr", "review"],
    name: "gh pr review --body",
    // -a/--approve, -c/--comment (a BOOLEAN review-type selector on THIS
    // subcommand only — distinct from issue close's value-taking -c), and
    // -r/--request-changes are the OTHER short boolean flags.
    boolShorthands: ["a", "c", "r"],
    bodyFlags: [{ long: "--body", short: "-b" }],
    fileFlags: [{ long: "--body-file", short: "-F" }],
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
// Endpoints whose POST/PATCH/PUT body is PROSE published under our identity.
// `…/issues/26/lock` or `…/issues/26/labels` are writes but not text, so they
// are deliberately not gated.
const API_TEXT_ENDPOINT_RE = /(?:^|\/)(comments|issues|reviews|pulls)\/?(?:\?.*)?$/;

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
  return POSTING_SHAPES.some((s) => s.path[1] === first && s.path[2] === second);
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
  const sub1 = argv[start] ? argv[start].value : null;
  if (!sub1) return null;

  if (sub1 === "api") return analyzeGhApi(argv.slice(start + 1), env, read);

  const sub2 = argv[start + 1] ? argv[start + 1].value : null;
  const entry = POSTING_SHAPES.find((s) => s.path[1] === sub1 && s.path[2] === sub2);
  if (!entry) return null;

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
  let endpoint = null;
  for (let k = 0; k < argv.length; ) {
    const token = argv[k].value;
    if (token.startsWith("-")) {
      k += API_VALUE_FLAGS.has(token) ? 2 : 1;
      continue;
    }
    endpoint = token;
    break;
  }
  if (!endpoint || !API_TEXT_ENDPOINT_RE.test(endpoint)) return null;

  const methods = findFlagWords(argv, API_METHOD_FLAGS, []);
  const fields = findFlagWords(argv, API_FIELD_FLAGS, []);
  const inputs = findFlagWords(argv, API_INPUT_FLAGS, []);
  const method = methods.length ? methods[methods.length - 1].value.toUpperCase() : null;
  const isWrite = method
    ? ["POST", "PATCH", "PUT"].includes(method)
    : fields.length > 0 || inputs.length > 0;
  if (!isWrite) return null;

  const result = {
    shape: `gh api ${method || "POST"} ${endpoint}`,
    uninspectable: false,
    bodies: [],
    env,
  };
  if (inputs.length > 0) result.uninspectable = true;
  for (const field of fields) {
    if (!/^body=/.test(field.value)) continue;
    if (field.expanded) {
      result.uninspectable = true;
      continue;
    }
    const value = field.value.slice("body=".length);
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
  return result;
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
  for (const candidate of findGhCandidates(commands)) {
    const analyzed = analyzeGhCandidate(candidate, ctx);
    if (analyzed) posting.push(analyzed);
  }
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

// Rung-2 doc-scan regex — deliberately requires the QUALIFYING flag for the
// two shapes that have one (close/review), so a doc merely mentioning
// `gh issue close <n>` (which does not post a body) isn't flagged. `\b`
// after a bare flag name (e.g. `-c\b`) already matches an immediately
// following `=` or `-` (both non-word chars), so this also catches the
// `=`-form and `--body-file` (which contains `--body` as a prefix) — verified
// empirically, not just by inspection, before relying on it here.
export const POSTING_RE = new RegExp(
  [
    String.raw`\bgh\s+issue\s+comment\b`,
    String.raw`\bgh\s+issue\s+close\b[^\n]*(?:--comment|-c)\b`,
    String.raw`\bgh\s+issue\s+create\b`,
    String.raw`\bgh\s+pr\s+comment\b`,
    String.raw`\bgh\s+pr\s+review\b[^\n]*(?:--body|-b|--body-file|-F)\b`,
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
