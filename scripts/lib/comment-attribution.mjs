// comment-attribution.mjs — the machine-attribution marker (#78).
//
// Every GitHub comment/issue this repo's automation posts is posted under the
// repo owner's own `gh` identity (there is no separate bot account), so a
// human reading it later has NO signal that it was machine-drafted unless the
// BODY says so. #78's incident: a later automated run cited an EARLIER
// machine-drafted comment as if it were the maintainer's own ruling and used
// it to justify closing an issue — a circular-authority failure.
//
// Two independently-checkable halves, both required:
//  1. A versioned HTML comment (invisible when rendered, machine-detectable,
//     version-pinned so prose changes don't silently break consumers).
//  2. A visible Markdown blockquote a human actually reads, naming what
//     happened and pointing at the issue that explains why this exists.
export const MARKER = "<!-- brand-ui:machine-attribution v1 -->";
export const BLOCKQUOTE_PHRASE = "**Machine-generated**";
export const DEFAULT_ISSUE = 78;
export const DEFAULT_COMMAND = "close-issues";

/**
 * Render a complete attribution banner for a given posting command + issue.
 * @param {string} [command] - the command/script that is posting (e.g. "close-issues").
 * @param {number|string} [issueNumber] - the issue this banner's rationale lives in.
 */
export function render(command = DEFAULT_COMMAND, issueNumber = DEFAULT_ISSUE) {
  const cmd = command && String(command).trim() ? String(command).trim() : DEFAULT_COMMAND;
  const parsedIssue = Number(issueNumber);
  const issue = Number.isFinite(parsedIssue) ? parsedIssue : DEFAULT_ISSUE;
  return [
    MARKER,
    `> 🤖 ${BLOCKQUOTE_PHRASE} — drafted by an automated \`${cmd}\` run and posted under this`,
    "> repo's `gh` CLI identity (`@mreimitz`, the repo owner). **This is not a maintainer",
    `> ruling**; no human has signed off on it. See #${issue} for why this banner exists.`,
  ].join("\n");
}

/**
 * Does a comment/issue body carry BOTH attribution halves? Either half alone
 * fails: the HTML comment alone is invisible to a human reader, the
 * blockquote alone gives nothing machine-checkable to grep for.
 * @param {unknown} body
 * @returns {boolean}
 */
export function hasMarker(body) {
  const text = typeof body === "string" ? body : "";
  if (!text) return false;
  return text.includes(MARKER) && text.includes(BLOCKQUOTE_PHRASE);
}
