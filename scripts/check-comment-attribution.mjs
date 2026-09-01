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

// Every shape below is a GitHub-posting call. `requireAnyFlag`, when present,
// means the bare subcommand is NOT itself a posting call (`gh issue close 26`
// closes silently) — only when it also carries one of these flags does it
// post a body.
const POSTING_SHAPES = [
  { path: ["gh", "issue", "comment"], name: "gh issue comment" },
  {
    path: ["gh", "issue", "close"],
    name: "gh issue close --comment",
    requireAnyFlag: ["--comment", "-c"],
  },
  { path: ["gh", "issue", "create"], name: "gh issue create" },
  { path: ["gh", "pr", "comment"], name: "gh pr comment" },
  {
    path: ["gh", "pr", "review"],
    name: "gh pr review --body",
    requireAnyFlag: ["--body"],
  },
];

/**
 * @param {string[]} tokens
 * @returns {string|null} the matched shape name, or null if this isn't a
 *   recognized GitHub-posting call shape.
 */
export function matchBashPostingShape(tokens) {
  if (!Array.isArray(tokens) || tokens.length < 3) return null;
  for (const shape of POSTING_SHAPES) {
    if (shape.path.every((t, i) => tokens[i] === t)) {
      if (shape.requireAnyFlag && !shape.requireAnyFlag.some((f) => tokens.includes(f))) {
        return null;
      }
      return shape.name;
    }
  }
  return null;
}

// Rung-2 doc-scan regex — deliberately requires the QUALIFYING flag for the
// two shapes that have one (close/review), so a doc merely mentioning
// `gh issue close <n>` (which does not post a body) isn't flagged.
export const POSTING_RE = new RegExp(
  [
    String.raw`\bgh\s+issue\s+comment\b`,
    String.raw`\bgh\s+issue\s+close\b[^\n]*(?:--comment|-c)\b`,
    String.raw`\bgh\s+issue\s+create\b`,
    String.raw`\bgh\s+pr\s+comment\b`,
    String.raw`\bgh\s+pr\s+review\b[^\n]*--body\b`,
    String.raw`\bmcp__github__add_issue_comment\b`,
    String.raw`\bmcp__github__create_issue\b`,
  ].join("|"),
  "i",
);

const HEREDOC_RE = /<<-?\s*['"]?\w+/;
const PIPED_GH_RE = /\|\s*gh\s+(?:issue|pr)\b/;
const STDIN_FLAG_RE = /(?:^|\s)(?:-F|--body-file)\s+-(?:\s|$)/;

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

const FILE_VALUE_FLAGS = ["--body-file", "-F"];
const INLINE_VALUE_FLAGS = ["--body", "-b", "--comment", "-c"];

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
  const shape = matchBashPostingShape(tokens);
  if (!shape) return { uninspectable: false, body: null, shape: null };

  for (let i = 0; i < tokens.length; i++) {
    if (FILE_VALUE_FLAGS.includes(tokens[i]) && tokens[i + 1] !== undefined) {
      const value = tokens[i + 1];
      if (value === "-") return { uninspectable: true, body: null, shape };
      try {
        return { uninspectable: false, body: read(value, "utf8"), shape };
      } catch {
        return { uninspectable: true, body: null, shape };
      }
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (INLINE_VALUE_FLAGS.includes(tokens[i]) && tokens[i + 1] !== undefined) {
      return { uninspectable: false, body: tokens[i + 1], shape };
    }
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
