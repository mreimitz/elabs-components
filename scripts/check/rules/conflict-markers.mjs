/**
 * conflict-markers — no file may contain an unresolved Git merge-conflict marker (#379).
 * Ported from scripts/check-conflict-markers.mjs (full-tree mode). PR #375 landed
 * `<<<<<<<`/`=======`/`>>>>>>>` in six files, including the manifest (invalid JSON)
 * and a gate script (a syntax error), and nothing caught it.
 *
 * Detection is pure and dependency-free ON PURPOSE: scripts/check-conflict-markers.mjs
 * imports `findConflictMarkers` from here for the pre-commit `--staged` path and the
 * CI pre-install step, both of which run before `pnpm install`. Do not import
 * anything from this file.
 */

/** Exactly 7 repeats of the marker char, at line start, then whitespace or EOL. */
export const MARKER_RE = /^(<{7}|={7}|>{7})(\s|$)/;

/**
 * `[{ line, text }]` (1-based, ascending). A bare `=======` counts only after a
 * `<<<<<<<` earlier in the same file — otherwise it is a Markdown setext underline.
 */
export function findConflictMarkers(content) {
  const hits = [];
  let sawOpen = false;
  const lines = String(content).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(MARKER_RE);
    if (!m) continue;
    const ch = m[1][0];
    if (ch === "<") sawOpen = true;
    if (ch !== "=" || sawOpen) hits.push({ line: i + 1, text: lines[i].slice(0, 80) });
  }
  return hits;
}

/** A NUL in the first 8000 characters: binary, never scanned as text. */
export const looksBinary = (text) => String(text).slice(0, 8000).includes("\0");

// Fixture markers are assembled so this file never contains one at a line start.
const [OPEN, MID, CLOSE] = ["<", "=", ">"].map((c) => c.repeat(7));
const file = (lines, rel = "broken.json") => ({ files: { [rel]: lines.join("\n") } });

export default {
  id: "conflict-markers",
  scope: "repo",
  doc: "Resolve every Git merge conflict before committing: no line may start with a `<<<<<<<` / `=======` / `>>>>>>>` marker.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const rel of ctx.gitFiles()) {
      let text;
      try {
        text = ctx.readFile(rel);
      } catch {
        continue;
      }
      if (looksBinary(text)) continue;
      for (const hit of findConflictMarkers(text))
        out.push({ file: rel, line: hit.line, msg: `unresolved conflict marker: ${hit.text}` });
    }
    return out;
  },
  fixtures: {
    pass: [
      file(["Title", MID, "", "Some prose."], "clean.md"),
      file([`const sep = "${CLOSE}";`, `  // ${OPEN} not at line start`, `prefix${OPEN}`], "a.mjs"),
      file([`${OPEN}<`, `${MID}=`, `${CLOSE}>`], "eight.txt"),
      file([""], "empty.txt"),
      { files: { "font.woff2": `\0${OPEN}\n` } },
    ],
    fail: [
      file(["{", `${OPEN} HEAD`, '  "a": 1', MID, '  "a": 2', `${CLOSE} feature`, "}"]),
      file([OPEN], "bare-open.txt"),
      file(["x", `${CLOSE} origin/main`], "close-only.txt"),
    ],
  },
};
