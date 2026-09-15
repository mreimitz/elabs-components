/**
 * machine-paths — no committed machine-specific absolute home paths (#203).
 * Ported from scripts/check-machine-paths.mjs. `/Users/<name>/…` (macOS) and
 * `/home/<name>/…` (Linux) break on every other machine and leak local layout;
 * scratch capture scripts shipped exactly that until #203. Binary files are
 * skipped by a NUL sniff.
 */

/** A machine-specific absolute home path: /Users/<name>/… or /home/<name>/… */
export const MACHINE_PATH_RE = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//;

/** Files that legitimately carry a home-path STRING as test data. */
const IGNORE = [
  // sanitizeType's determinism tests (#79) feed it sample import() paths to assert they get STRIPPED.
  "packages/cli/test/docgen.test.mjs",
];

/** 1-based line numbers containing a machine path. */
export function findMachinePathLines(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) if (MACHINE_PATH_RE.test(lines[i])) hits.push(i + 1);
  return hits;
}

export const looksBinary = (text) => text.slice(0, 8192).includes("\0");

// Fixture paths are assembled so this file never contains a literal home path.
const mac = ["", "Users", "someone", "Documents", "repo", ""].join("/");
const linux = ["", "home", "manuel", "dev", "repo", ""].join("/");
const file = (body) => ({ files: { "apps/e2e/reports/capture.mjs": body } });

export default {
  id: "machine-paths",
  scope: "repo",
  doc: "Never commit a machine-specific absolute home path (`/Users/<name>/…`, `/home/<name>/…`); write it relative to the repo root.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const rel of ctx.gitFiles()) {
      if (IGNORE.includes(rel)) continue;
      let text;
      try {
        text = ctx.readFile(rel);
      } catch {
        continue; // vanished between listing and reading
      }
      if (looksBinary(text)) continue;
      for (const line of findMachinePathLines(text))
        out.push({
          file: rel,
          line,
          msg: "machine-specific absolute home path — rewrite it relative to the repo root",
        });
    }
    return out;
  },
  fixtures: {
    pass: [
      file(
        [
          "All screenshots at `apps/e2e/reports/screenshots/`:",
          "see https://example.com/Users/profile page",
          'const tmp = "/tmp/scratch";',
          'const ci = "/opt/hostedtoolcache/node";',
          "# /Users/ alone (no user segment) is not a machine path",
        ].join("\n"),
      ),
      { files: { "packages/cli/test/docgen.test.mjs": `import("${mac}x.ts")` } },
      { files: { "public/logo.png": `\0PNG${mac}` } },
    ],
    fail: [
      file(`import { chromium } from "${mac}node_modules/playwright/index.mjs";`),
      file(`const p = "${linux}out";`),
    ],
  },
};
