#!/usr/bin/env node
/**
 * check-story-descriptions.mjs — the story-description ratchet (RM-016, #152).
 *
 * `docs/STORYBOOK_GUIDELINES.md` asks every story page to carry a
 * `parameters.docs.description.component`, and the signpost-duplicates rule
 * DEPENDS on it: the way a reader learns that `Layout/Resizable` and
 * `Layout/SplitPanel` are two different answers to one question is the sentence
 * at the top of each page naming the other. `Docs/Choosing between similar
 * components` (RM-009) is the index of those pairs; the per-page sentence is
 * what makes the index reachable from where the reader actually is.
 *
 * That was a comment-enforced convention and it did not hold: 188 of 294 indexed
 * story files carried no description at all when this gate was written
 * (2026-09-03), including both halves of several genuinely ambiguous pairs.
 *
 * ## Why a SIBLING script rather than a rung on `check-storybook-groups.mjs`
 *
 * That gate's own header records the boundary it keeps — it checks the sidebar
 * TAXONOMY (which group a title lands in, how segments are named, that the doc
 * list agrees), and deliberately not title uniqueness. A description is a
 * different concern living in a different part of the meta object, and a second
 * concern under a name that says "groups" is exactly the drift these gates
 * exist to close. So this is a sibling that IMPORTS that module's seams —
 * `listStoryFiles()`, `maskNonCode()`, `findMetaObjectRange()`, `lineOf()`,
 * `matchBracket()` — rather than re-deriving them. There is one story-file
 * scanner in this repo, and it lives there.
 *
 * ## Two rungs
 *
 *   1. MISSING — an indexed `*.stories.ts(x)` whose default-exported meta has no
 *      `parameters.docs.description.component` string. Reported with the
 *      `file:line` of the meta object.
 *   2. VACUOUS — a description that IS present but says nothing: shorter than
 *      {@link MIN_DESCRIPTION_CHARS} characters once markdown/link noise is
 *      discounted. Without this rung the cheapest way to leave the baseline is
 *      `component: "A sidebar."`, which costs a reader more than no description
 *      at all. Vacuous is NOT baselineable — a file either has a real sentence
 *      or it stays in the todo list.
 *
 * ## Ratchet, not a sweep
 *
 * `scripts/story-description-baseline.json` is a sorted list of the repo-relative
 * story files that have no description yet — the todo list. A file may only ever
 * LEAVE it. Adding a story file without a description fails; `--update` refuses
 * to grow the list unless `--force` is passed. The intent is that this burns
 * down, so `--update` also prunes files that have since gained one.
 *
 * ## What this gate deliberately does NOT check
 *
 * WHETHER A DESCRIPTION NAMES ITS SIBLING. "Is this component ambiguous with
 * that one, and does this sentence say so" is a judgment about meaning; no
 * string check decides it, and a keyword heuristic ("must contain the word
 * `Choosing`") would be satisfied by pasting a link onto a page nobody is
 * confused about. Rungs 1 and 2 make the SLOT exist and be non-empty; what goes
 * in it belongs to `/review-component` and to the RM-009 page's own "when the
 * rule does not decide it" clause.
 *
 * MDX PAGES. `apps/docs/stories/**\/*.mdx` is prose already — a docs page has no
 * meta object to hang a component description on.
 *
 *   pnpm story-descriptions:check
 *   pnpm story-descriptions:check -- --list     # every file and its state
 *   pnpm story-descriptions:check -- --update   # ratchet the baseline DOWN
 *
 * Flags:
 *   --root <dir>   scan a different tree (used by the self-test's fixtures)
 *   --baseline <f> read/write a different baseline (same)
 *   --list         print every discovered file and its state, exit 0
 *   --update       rewrite the baseline from the current tree (ratchet down)
 *   --force        allow --update to GROW the baseline (justify it in the PR)
 *   --warn         never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; ESM; cwd-independent (paths resolve from this file).
 * Self-tested: `node --test scripts/check-story-descriptions.test.mjs`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findMetaObjectRange,
  lineOf,
  listStoryFiles,
  maskNonCode,
  matchBracket,
} from "./check-storybook-groups.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

/** The todo list. Repo-root relative. */
export const BASELINE_REL = "scripts/story-description-baseline.json";
export const BASELINE_PATH = join(REPO_ROOT, BASELINE_REL);

/**
 * The floor for rung 2, in characters of the description AFTER markdown link
 * targets are discounted (a bare link to the RM-009 page is ~90 characters of
 * URL and says nothing on its own).
 *
 * 60 is calibrated, not picked: the shortest description already shipping in
 * this repo when the gate landed measured 96 discounted characters, so the
 * floor cannot fail an existing honest page, and it is comfortably above the
 * "A sidebar." class of non-answer.
 */
export const MIN_DESCRIPTION_CHARS = 60;

// ───────────────────────────── the extractor ──────────────────────────────────

/**
 * Index of `key` at `depth` inside the object literal `[open, close]`, scanning
 * the MASKED source so a key-shaped run inside a string or a comment can never
 * match. Depth 1 is the literal's own top level.
 *
 * Guards both ends of the identifier: `subtitle:` must not match `title`, and
 * `docsTitle:` must not match `title` either — the same two mistakes
 * `extractStoryTitle` guards against, for the same reason.
 *
 * @param {string} masked
 * @param {number} open index of the `{`
 * @param {number} close index of its matching `}`
 * @param {string} key bare identifier, e.g. `parameters`
 * @returns {number} index of the first byte of the key, or -1
 */
export function findKeyIndex(masked, open, close, key) {
  const re = new RegExp(`^(?:${key}|"${key}"|'${key}')\\s*:`);
  let depth = 0;
  for (let i = open; i < close; i++) {
    const c = masked[i];
    if (c === "{" || c === "[" || c === "(") {
      depth++;
      continue;
    }
    if (c === "}" || c === "]" || c === ")") {
      depth--;
      continue;
    }
    if (depth !== 1) continue;
    if (!/[A-Za-z_$"']/.test(c)) continue;
    if (i > 0 && /[A-Za-z0-9_$]/.test(masked[i - 1])) continue;
    if (re.test(masked.slice(i, i + key.length + 4))) return i;
    // Skip the rest of this identifier so a longer name can never partially match.
    while (i < close && /[A-Za-z0-9_$]/.test(masked[i])) i++;
  }
  return -1;
}

/**
 * The `{ … }` an object-valued key opens, or null when the key is absent or its
 * value is not a literal object (`parameters: sharedParams` — a shape this gate
 * cannot follow, and therefore refuses to guess about).
 *
 * @returns {{ open: number, close: number } | "not-a-literal" | null}
 */
export function objectValueOf(masked, open, close, key) {
  const at = findKeyIndex(masked, open, close, key);
  if (at < 0) return null;
  const colon = masked.indexOf(":", at);
  if (colon < 0) return "not-a-literal";
  let i = colon + 1;
  while (i < close && /\s/.test(masked[i])) i++;
  if (masked[i] !== "{") return "not-a-literal";
  const end = matchBracket(masked, i);
  if (end < 0) return "not-a-literal";
  return { open: i, close: end };
}

/**
 * Read one story module's component description.
 *
 * @param {string} src raw module source
 * @returns {{ state: "ok", text: string, line: number }
 *          | { state: "missing", line: number }
 *          | { state: "unreadable", line: number | null, why: string }}
 *   `unreadable` is a FAILURE, never a skip: a scanner that silently drops the
 *   files it does not understand measures nothing (the stance
 *   `check-storybook-groups.mjs` takes for titles, for the same reason).
 */
export function extractComponentDescription(src) {
  const masked = maskNonCode(src);
  const meta = findMetaObjectRange(masked);
  if (!meta) {
    return {
      state: "unreadable",
      line: null,
      why:
        "no readable default-exported meta object. Declare a literal " +
        "`export default meta` whose object is written inline",
    };
  }
  const metaLine = lineOf(src, meta.open);

  const params = objectValueOf(masked, meta.open, meta.close, "parameters");
  if (params === null) return { state: "missing", line: metaLine };
  if (params === "not-a-literal") {
    return {
      state: "unreadable",
      line: metaLine,
      why: "`parameters` is not an inline object literal, so its `docs.description` cannot be read",
    };
  }

  const docs = objectValueOf(masked, params.open, params.close, "docs");
  if (docs === null) return { state: "missing", line: metaLine };
  if (docs === "not-a-literal") {
    return {
      state: "unreadable",
      line: metaLine,
      why: "`parameters.docs` is not an object literal",
    };
  }

  const desc = objectValueOf(masked, docs.open, docs.close, "description");
  if (desc === null) return { state: "missing", line: metaLine };
  if (desc === "not-a-literal") {
    return {
      state: "unreadable",
      line: metaLine,
      why: "`parameters.docs.description` is not an object literal",
    };
  }

  const at = findKeyIndex(masked, desc.open, desc.close, "component");
  if (at < 0) return { state: "missing", line: metaLine };

  // The value: one or more string literals, possibly `+`-concatenated across
  // lines (the house style for a long description). Read from the ORIGINAL
  // source so the text is the real text; the masked view only located the key.
  const colon = src.indexOf(":", at);
  const end = desc.close;
  const text = concatenatedStringValue(src, colon + 1, end);
  if (text === null) {
    return {
      state: "unreadable",
      line: lineOf(src, at),
      why: "`description.component` is not a string literal (or a `+` concatenation of them)",
    };
  }
  return { state: "ok", text, line: lineOf(src, at) };
}

/**
 * Join a run of `"…" + "…" + \`…\`` string literals starting at `from`, OR an
 * ARRAY literal of such runs (`component: ["para", "", "para"].join("\n")` — the
 * shape a long multi-paragraph description already uses in this repo; see
 * `packages/charts/src/gantt/gantt.stories.tsx`). Array elements are joined with
 * a newline, which is what every `.join()` call site here does and is in any
 * case irrelevant to the only thing rung 2 measures: how much text there is.
 *
 * Returns null the moment it meets something that is not a string literal, a
 * `+`, an array of those, or whitespace — a template with `${}` interpolation
 * included, since its runtime text is not on the page.
 *
 * @param {string} src
 * @param {number} from
 * @param {number} limit
 * @returns {string | null}
 */
export function concatenatedStringValue(src, from, limit) {
  {
    let k = from;
    while (k < limit && /\s/.test(src[k])) k++;
    if (src[k] === "[") {
      const end = matchBracket(maskNonCode(src), k);
      if (end < 0 || end > limit) return null;
      const parts = [];
      let i = k + 1;
      for (;;) {
        while (i < end && /[\s,]/.test(src[i])) i++;
        if (i >= end) break;
        const before = i;
        const piece = concatenatedStringValue(src, i, end);
        if (piece === null) return null;
        parts.push(piece);
        // Advance past the run we just read: to the next top-level comma.
        let depth = 0;
        let j = before;
        for (; j < end; j++) {
          const c = src[j];
          if (c === '"' || c === "'" || c === "`") {
            const q = c;
            j++;
            for (; j < end; j++) {
              if (src[j] === "\\") {
                j++;
                continue;
              }
              if (src[j] === q) break;
            }
            continue;
          }
          if (c === "[" || c === "{" || c === "(") depth++;
          else if (c === "]" || c === "}" || c === ")") depth--;
          else if (c === "," && depth === 0) break;
        }
        if (j <= before) return null;
        i = j + 1;
      }
      if (parts.length === 0) return null;
      return parts.join("\n");
    }
  }
  let i = from;
  let out = "";
  let sawOne = false;
  for (;;) {
    while (i < limit && /\s/.test(src[i])) i++;
    if (i >= limit) break;
    const q = src[i];
    if (q !== '"' && q !== "'" && q !== "`") break;
    let j = i + 1;
    let body = "";
    for (; j < limit; j++) {
      if (src[j] === "\\") {
        body += src[j + 1] ?? "";
        j++;
        continue;
      }
      if (src[j] === q) break;
      body += src[j];
    }
    if (j >= limit) return null; // unterminated
    if (q === "`" && body.includes("${")) return null; // runtime text, not page text
    out += body;
    sawOne = true;
    i = j + 1;
    while (i < limit && /\s/.test(src[i])) i++;
    if (src[i] === "+") {
      // A `+` PROMISES another string literal. If the next token is anything
      // else (an identifier, a call, a number) the value is an expression whose
      // final text is not on the page — refuse it rather than report the half
      // that happens to be readable.
      i++;
      while (i < limit && /\s/.test(src[i])) i++;
      if (src[i] !== '"' && src[i] !== "'" && src[i] !== "`") return null;
      continue;
    }
    break;
  }
  if (!sawOne) return null;
  // Whatever follows must be the end of the value — a comma, the closing brace,
  // or the next key. A `.join(…)` on an array is handled by the array branch
  // above; anything else means an expression this reader only partly understood.
  while (i < limit && /[\s,]/.test(src[i])) i++;
  if (i < limit && !/[A-Za-z_$"'}]/.test(src[i])) return null;
  return out;
}

/**
 * Rung 2's measure: characters that actually reach a reader. Markdown link
 * TARGETS are discounted (`[label](url)` counts as `label`), backticks and
 * markdown emphasis are dropped, and whitespace is collapsed.
 *
 * @param {string} text
 * @returns {number}
 */
export function meaningfulLength(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

// ───────────────────────────── the baseline ───────────────────────────────────

/** Repo-relative, POSIX-separated path — the baseline's key shape. */
export function relKey(root, absolute) {
  return relative(root, absolute).split(sep).join("/");
}

/**
 * Structural validation of the baseline document. Generated files that drift
 * out of sorted order stop being reviewable diffs, so shape is gated too.
 *
 * @param {unknown} baseline
 * @returns {string[]} human-readable violations (empty === clean)
 */
export function findBaselineViolations(baseline) {
  if (!Array.isArray(baseline)) {
    return [`${BASELINE_REL}: expected a JSON array of repo-relative story-file paths.`];
  }
  const out = [];
  if (baseline.some((e) => typeof e !== "string")) {
    out.push(`${BASELINE_REL}: every entry must be a string path.`);
    return out;
  }
  const sorted = [...baseline].sort();
  if (baseline.some((e, i) => e !== sorted[i])) {
    out.push(
      `${BASELINE_REL}: entries are not sorted — the file is generated, run ` +
        `\`pnpm story-descriptions:check -- --update\`.`,
    );
  }
  if (new Set(baseline).size !== baseline.length) {
    out.push(`${BASELINE_REL}: contains duplicate entries.`);
  }
  for (const e of baseline) {
    if (!/\.stories\.tsx?$/.test(e)) {
      out.push(`${BASELINE_REL}: "${e}" is not a story file path.`);
    }
  }
  return out;
}

// ───────────────────────────── the whole check ────────────────────────────────

/**
 * Scan a tree. Pure enough to drive from the self-test with a fixture root.
 *
 * @param {string} root
 * @param {string[]} baseline repo-relative paths permitted to have no description
 * @returns {{ findings: {file: string, line: number|null, rung: string, message: string}[],
 *             files: {file: string, state: string, chars: number}[],
 *             missing: string[], stale: string[] }}
 */
export function checkStoryDescriptions(root = REPO_ROOT, baseline = []) {
  const allowed = new Set(baseline);
  const findings = [];
  const files = [];
  const missing = [];

  for (const { path, mdx } of listStoryFiles(root)) {
    if (mdx) continue; // a docs page IS prose; it has no meta to describe a component on
    const file = relKey(root, path);
    const src = readFileSync(path, "utf8");
    const result = extractComponentDescription(src);

    if (result.state === "unreadable") {
      files.push({ file, state: "unreadable", chars: 0 });
      findings.push({
        file,
        line: result.line,
        rung: "unreadable",
        message:
          `${result.why}. A description this gate cannot READ is a failure, not a skip — ` +
          "a scanner that silently drops the files it does not understand measures nothing",
      });
      continue;
    }

    if (result.state === "missing") {
      missing.push(file);
      files.push({ file, state: "missing", chars: 0 });
      if (!allowed.has(file)) {
        findings.push({
          file,
          line: result.line,
          rung: "missing",
          message:
            "no `parameters.docs.description.component`. Every story page owes the reader one " +
            "sentence saying what this is — and, when a sibling component answers a nearby " +
            "question, a second naming it and linking " +
            "`Docs/Choosing between similar components`",
        });
      }
      continue;
    }

    const chars = meaningfulLength(result.text);
    files.push({ file, state: "ok", chars });
    if (chars < MIN_DESCRIPTION_CHARS) {
      // Deliberately NOT baselineable: a stub is worse than an empty slot,
      // because it stops the reader looking any further.
      findings.push({
        file,
        line: result.line,
        rung: "vacuous",
        message:
          `\`description.component\` is ${chars} meaningful character(s), below the ` +
          `${MIN_DESCRIPTION_CHARS}-character floor — a description that says nothing costs a ` +
          "reader more than no description at all. Say what the component is FOR, and name the " +
          "sibling it is confusable with",
      });
    }
  }

  const present = new Set(missing);
  const stale = baseline.filter((f) => !present.has(f));

  return { findings, files, missing, stale };
}

// ──────────────────────────────── CLI ─────────────────────────────────────────

function readBaseline(path) {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const update = args.includes("--update");
  const force = args.includes("--force");
  const rootIdx = args.indexOf("--root");
  const root = rootIdx >= 0 ? args[rootIdx + 1] : REPO_ROOT;
  const baseIdx = args.indexOf("--baseline");
  const baselinePath = baseIdx >= 0 ? args[baseIdx + 1] : BASELINE_PATH;

  let baseline;
  try {
    baseline = readBaseline(baselinePath);
  } catch (err) {
    console.error(`\n✖ story-descriptions gate FAILED: cannot read the baseline (${err.message})`);
    return warnOnly ? 0 : 1;
  }

  const shape = findBaselineViolations(baseline);
  if (shape.length > 0 && !update) {
    console.error(`\n✖ story-descriptions gate FAILED (${shape.length}):`);
    for (const v of shape) console.error(`  ${v}`);
    return warnOnly ? 0 : 1;
  }

  const { findings, files, missing, stale } = checkStoryDescriptions(
    root,
    Array.isArray(baseline) ? baseline : [],
  );

  if (args.includes("--list")) {
    for (const f of files.sort((a, b) => a.file.localeCompare(b.file))) {
      console.log(
        `${f.state === "ok" ? "✔" : f.state === "missing" ? "·" : "?"} ${f.file}\t${f.chars}`,
      );
    }
    const ok = files.filter((f) => f.state === "ok").length;
    console.log(`\n${ok}/${files.length} story file(s) describe their component.`);
    return 0;
  }

  if (update) {
    const next = [...new Set(missing)].sort();
    const added = next.filter((f) => !baseline.includes(f));
    if (added.length > 0 && !force) {
      console.error(
        `\n✖ story-descriptions --update would GROW the todo list by ${added.length} file(s):\n` +
          added.map((f) => `    ${f}`).join("\n") +
          "\n\n  The ratchet only goes down. Write the description, or re-run with --force and\n" +
          "  justify the growth in the PR.",
      );
      return 1;
    }
    const removed = baseline.filter((f) => !next.includes(f));
    writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(
      `✔ story-descriptions: baseline written — ${next.length} file(s) still to do ` +
        `(${removed.length} removed${added.length ? `, ${added.length} ADDED` : ""}).`,
    );
    return 0;
  }

  if (findings.length > 0) {
    const label = warnOnly ? "⚠ story-descriptions" : "✖ story-descriptions gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const f of findings) {
      const where = f.line == null ? f.file : `${f.file}:${f.line}`;
      console.error(`  ${where}  [${f.rung}] ${f.message}`);
    }
    console.error(
      "\n  Fix: add to the default-exported meta\n" +
        "\n    parameters: {\n" +
        "      docs: {\n" +
        "        description: {\n" +
        '          component: "What this is. The sibling it is confusable with is `Group/Other` — see " +\n' +
        '            "[Choosing between similar components]' +
        '(?path=/docs/docs-choosing-between-similar-components--docs).",\n' +
        "        },\n" +
        "      },\n" +
        "    },\n" +
        `\n  The todo list is \`${BASELINE_REL}\` and it only ratchets DOWN:\n` +
        "  `pnpm story-descriptions:check -- --update` after you have written one.",
    );
    if (!warnOnly) return 1;
    return 0;
  }

  const ok = files.filter((f) => f.state === "ok").length;
  const staleNote = stale.length
    ? ` ${stale.length} baselined file(s) now have one — ratchet down with ` +
      "`pnpm story-descriptions:check -- --update`."
    : "";
  console.log(
    `✔ story-descriptions: ${ok}/${files.length} story file(s) describe their component; ` +
      `${missing.length} still on the todo list.${staleNote}`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv));
}
