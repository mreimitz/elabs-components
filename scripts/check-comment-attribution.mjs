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
// Bash flag-parsing shapes (#78 fix round 1 — a validator found the original
// matcher only recognized `--flag value`, so `gh issue close --comment="…"`
// sailed through with exit 0). `findFlagValues()` now recognizes every shape
// `gh` (Cobra/pflag) itself accepts, verified against `gh --version 2.93.0
// <subcommand> --help` output for all five gated subcommands:
//   HANDLED: `--flag value` · `--flag=value` · `-f value` · `-f=value` ·
//   `-fvalue` (attached, no separator) · `-xyfvalue`/`-xyf=value`/`-xyf value`
//   (boolean shorthands x,y clustered ahead of value shorthand f in one
//   token — pflag gives f the rest of the token) · quoted and unquoted
//   values · flags in any position relative to the issue/PR number
//   (positional-order independent) · a `--body-file`/`-F` pointing at a file
//   whose CONTENT is checked, in every one of the above forms.
//   NOT HANDLED (by design, not oversight — see findFlagValues doc comment):
//   a cluster where an EARLIER character is a value-taking flag this file
//   doesn't track for that subcommand (e.g. `-ab"x"` on `gh issue create`,
//   where `-a/--assignee` swallows the rest per real pflag semantics, so
//   `-b` was never actually reached) — the walk stops at the first
//   unrecognized character rather than guessing, which is the safe
//   direction (no false clearance) even though it can't attribute that
//   specific text either. `gh`'s own boolean-shorthand set per subcommand is
//   a small, closed catalog (POSTING_SHAPES' `boolShorthands`) sourced from
//   `--help`; it needs a matching update only if `gh` adds a new short flag
//   to one of these five subcommands.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hasMarker } from "./lib/comment-attribution.mjs";

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
  const hits = [];
  const shortMap = new Map();
  for (const spec of flagSpecs) {
    if (spec.short) shortMap.set(spec.short.slice(1), spec.long);
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (typeof token !== "string" || !token.startsWith("-")) continue;

    // Long form: --flag value | --flag=value
    const longSpec = flagSpecs.find((s) => token === s.long || token.startsWith(`${s.long}=`));
    if (longSpec) {
      if (token === longSpec.long) {
        if (tokens[i + 1] !== undefined) hits.push({ value: tokens[i + 1] });
      } else {
        hits.push({ value: token.slice(longSpec.long.length + 1) });
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
        const value = rest !== "" ? rest : tokens[i + 1];
        if (value !== undefined) hits.push({ value });
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

/**
 * @param {string[]} tokens
 * @returns {typeof POSTING_SHAPES[number]|null}
 */
function findPostingShapeEntry(tokens) {
  if (!Array.isArray(tokens) || tokens.length < 3) return null;
  for (const shape of POSTING_SHAPES) {
    if (shape.path.every((t, i) => tokens[i] === t)) {
      if (shape.requireBody) {
        const hasBody =
          findFlagValues(tokens, shape.bodyFlags, shape.boolShorthands).length > 0 ||
          findFlagValues(tokens, shape.fileFlags, shape.boolShorthands).length > 0;
        if (!hasBody) return null;
      }
      return shape;
    }
  }
  return null;
}

/**
 * @param {string[]} tokens
 * @returns {string|null} the matched shape name, or null if this isn't a
 *   recognized GitHub-posting call shape.
 */
export function matchBashPostingShape(tokens) {
  const entry = findPostingShapeEntry(tokens);
  return entry ? entry.name : null;
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
 * @param {string} command
 * @param {{readFileSync?: typeof readFileSync}} [deps]
 * @returns {{uninspectable: boolean, body: string|null, shape: string|null}}
 */
export function resolveBashBody(command, deps = {}) {
  const read = deps.readFileSync || readFileSync;
  const text = typeof command === "string" ? command : "";
  if (isUninspectableBashCommand(text)) {
    return { uninspectable: true, body: null, shape: null };
  }
  const tokens = shellSplit(text);
  const entry = findPostingShapeEntry(tokens);
  if (!entry) return { uninspectable: false, body: null, shape: null };
  const shape = entry.name;

  const fileHits = findFlagValues(tokens, entry.fileFlags, entry.boolShorthands);
  if (fileHits.length > 0) {
    const value = fileHits[0].value;
    if (value === "-") return { uninspectable: true, body: null, shape };
    try {
      return { uninspectable: false, body: read(value, "utf8"), shape };
    } catch {
      return { uninspectable: true, body: null, shape };
    }
  }

  const bodyHits = findFlagValues(tokens, entry.bodyFlags, entry.boolShorthands);
  if (bodyHits.length > 0) {
    return { uninspectable: false, body: bodyHits[0].value, shape };
  }
  return { uninspectable: false, body: null, shape };
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

/**
 * The pure decision the hook wraps: given a PreToolUse payload, allow or
 * block — and why.
 * @param {{tool_name?: string, tool_input?: Record<string, unknown>}} payload
 * @param {{readFileSync?: typeof readFileSync}} [deps]
 * @returns {{verdict: "allow"|"block", reason?: string}}
 */
export function evaluateHookPayload(payload, deps = {}) {
  const toolName = payload && payload.tool_name;
  const toolInput = (payload && payload.tool_input) || {};

  if (toolName === "Bash") {
    const command = toolInput.command;
    if (typeof command !== "string" || !command.trim()) return { verdict: "allow" };
    const resolved = resolveBashBody(command, deps);
    if (resolved.uninspectable) {
      return {
        verdict: "block",
        reason:
          "This command's comment/issue body cannot be inspected for the machine-attribution " +
          "marker (#78) — stdin redirects (`-F -`), heredocs and piped-in bodies are refused, " +
          "not silently passed through, because the gate cannot prove what they contain. Write " +
          "the body to a file and pass `--body-file <path>`, or post via " +
          "`node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>` " +
          "(it writes the file and adds the marker for you).",
      };
    }
    if (!resolved.shape) return { verdict: "allow" };
    if (hasMarker(resolved.body)) return { verdict: "allow" };
    return {
      verdict: "block",
      reason:
        `\`${resolved.shape}\` is missing the machine-attribution marker (#78) — this repo has ` +
        "no separate bot identity, so an unmarked comment is indistinguishable from the " +
        "maintainer's own words. Post via " +
        "`node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>` " +
        "(it adds the marker automatically). A human typing their own ruling through the CLI " +
        "may override with ALLOW_UNATTRIBUTED_COMMENT=1.",
    };
  }

  if (MCP_POSTING_TOOLS.has(toolName)) {
    const resolved = resolveMcpBody(toolInput);
    if (hasMarker(resolved.body)) return { verdict: "allow" };
    return {
      verdict: "block",
      reason:
        `${toolName} body is missing the machine-attribution marker (#78) — this repo has no ` +
        "separate bot identity, so an unmarked comment is indistinguishable from the " +
        "maintainer's own words. Prepend the banner from `render()` in " +
        "scripts/lib/comment-attribution.mjs to the body before posting. A human posting their " +
        "own text through this tool may override with ALLOW_UNATTRIBUTED_COMMENT=1.",
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
