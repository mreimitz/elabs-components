#!/usr/bin/env node
// post-issue-comment.mjs — the shared, marked posting helper (#78).
//
// The one sanctioned way for this repo's automation to post a GitHub comment
// or issue: it ALWAYS prepends the machine-attribution marker (see
// scripts/lib/comment-attribution.mjs), and it ALWAYS writes the body to a
// temp file and posts with `--body-file`, never `--body "$interpolated"` —
// so there is no shell-injection/escaping risk and the comment-attribution
// hook can statically inspect the exact bytes that get posted.
//
// Usage:
//   node scripts/post-issue-comment.mjs <issue> --command <name> --body <text>
//   node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path>
//   node scripts/post-issue-comment.mjs <issue> --command <name> --body-file <path> --close
//
// `--close` posts the comment, then closes the issue as a SEPARATE `gh issue
// close <n>` call (no `--comment` on the close) so the marked body is what
// gets posted, not a second, unmarked copy folded into the close call.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "./lib/comment-attribution.mjs";

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--command") args.command = argv[++i];
    else if (a === "--body") args.body = argv[++i];
    else if (a === "--body-file") args.bodyFile = argv[++i];
    else if (a === "--close") args.close = true;
    else args._.push(a);
  }
  return args;
}

/**
 * @param {{draft: string, command?: string}} input
 * @returns {string}
 */
export function buildBody({ draft, command }) {
  // The banner's rationale issue (`render()`'s 2nd arg) is a FIXED marker
  // default (`DEFAULT_ISSUE`, #78 — where the provenance policy lives), not
  // the issue this comment is being posted TO. Never thread `issueNumber`
  // through here: posting to issue 43 must still say "See #78", not
  // "See #43" (#97 finding 4).
  const banner = render(command);
  const text = typeof draft === "string" ? draft.trim() : "";
  return text ? `${text}\n\n${banner}` : banner;
}

export function main(argv) {
  const args = parseArgs(argv);
  const issueNumber = args._[0];
  if (!issueNumber || !/^\d+$/.test(String(issueNumber))) {
    process.stderr.write(
      "Usage: post-issue-comment.mjs <issue> --command <name> (--body <text>|--body-file <path>) [--close]\n",
    );
    return 1;
  }
  if (args.body === undefined && args.bodyFile === undefined) {
    process.stderr.write("post-issue-comment.mjs: one of --body or --body-file is required.\n");
    return 1;
  }

  const draft = args.bodyFile !== undefined ? readFileSync(args.bodyFile, "utf8") : args.body;
  const body = buildBody({ draft, command: args.command });

  const tmpDir = mkdtempSync(path.join(tmpdir(), "post-issue-comment-"));
  const tmpFile = path.join(tmpDir, "body.md");
  try {
    writeFileSync(tmpFile, body, "utf8");
    execFileSync("gh", ["issue", "comment", String(issueNumber), "--body-file", tmpFile], {
      stdio: "inherit",
    });
    if (args.close) {
      // Deliberately a SEPARATE call, with no `--comment` — the marked body
      // above is the comment; closing must not fold in a second, unmarked one.
      execFileSync("gh", ["issue", "close", String(issueNumber)], { stdio: "inherit" });
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
