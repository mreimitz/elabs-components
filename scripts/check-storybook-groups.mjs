#!/usr/bin/env node
/**
 * check-storybook-groups.mjs — the Storybook sidebar taxonomy gate (RM-002, #151).
 *
 * `docs/STORYBOOK_GUIDELINES.md` says EVERY top-level story group must be listed
 * in `apps/docs/.storybook/preview.tsx`'s `options.storySort.order`; an unlisted
 * group sorts to the bottom of the sidebar in arbitrary story-import order. That
 * was a comment-enforced convention: the 2026-06-15 IA review found orphan groups,
 * they were fixed, and they drifted back within three months (RM-001 —
 * `Foundation/Toolbar` and `Typography/MatchHighlight`, two groups that exist
 * nowhere in the order array). A convention without teeth does not hold, so this
 * is the teeth.
 *
 * Four rungs, all deterministic and dependency-free:
 *
 *   1. ORPHAN GROUP — every story title's FIRST segment must appear in
 *      `storySort.order`. Fails with the `file:line` of each offending title.
 *   2. SEGMENT NAMING — no segment after the group may contain a space
 *      ("The component segment is PascalCase with no spaces"), except the
 *      sanctioned prose surfaces in `NAMING_EXEMPTIONS` below. This is what
 *      stops RM-005's renames from regressing.
 *   3. DOC PARITY — the numbered group list in `docs/STORYBOOK_GUIDELINES.md`
 *      must name the same groups in the same order as `storySort.order`. A
 *      hand-kept list beside a machine-readable one is the same drift class this
 *      gate exists to close; the two had already diverged (the array carried
 *      Terminal/Viewer/Maps while the list stopped at 20 entries).
 *   4. STALE GROUP — the reverse of rung 1: a group listed in `storySort.order`
 *      that no story uses any more. RM-004 folded the standalone `Providers`
 *      group into Foundations; had the array entry been left behind, nothing
 *      would have noticed, and the next reader would have taken a dead name for
 *      a real tier.
 *
 * ## Why the order array is PARSED out of `preview.tsx` rather than imported
 *
 * Storybook generates the sidebar order in `index.json` by STATICALLY parsing
 * that file (`getStorySortParameter`, storybook/internal/csf-tools). Its
 * `parseValue` walks literals only and throws
 *
 *     Unexpected '<name>'. Parameter 'options.storySort' should be defined inline
 *
 * on ANY identifier — an imported const, a local const in the same file, and a
 * spread element all fail `build-storybook` (probed directly against that parser,
 * 2026-09-03). So the array cannot be extracted to a module that both
 * `preview.tsx` and this gate import; the gate has to read the literal in place.
 * `parseStorySortOrder()` does what `preview.tsx`'s own comment prescribes:
 * take the LAST `order:` key (prose above a literal is the classic way a naive
 * first-match parser reads the wrong bytes), bracket-match, strip line comments,
 * drop trailing commas, `JSON.parse`.
 *
 * ## Fail-closed
 *
 * A story file whose title this gate cannot READ is a FAILURE, not a skip — a
 * scanner that silently drops the files it does not understand measures nothing.
 * Same for an unparseable order array or a guidelines list it cannot find.
 *
 * Verified against ground truth on 2026-09-03: the 300 distinct titles this
 * scanner resolves are byte-identical to the titles in Storybook's own
 * `storybook-static/index.json` after a full `build-storybook`.
 *
 * ## What this gate deliberately does NOT check
 *
 * TITLE UNIQUENESS. Two story files sharing one title merge into one sidebar
 * page, and in this repo that is on purpose twice over: `Core/MetricCard`
 * (RM-005 folded the sparkline demo onto the canonical page) and
 * `Forms/MentionInput` (`mention-input-mirror.stories.tsx` is a separate FILE
 * because its regression lock only holds in isolation — see ADR 0023 §6 — but
 * the same PAGE). A uniqueness rung would fail both. Don't add one.
 *
 *   pnpm storybook-groups:check
 *   node scripts/check-storybook-groups.mjs --list   # dump every title it sees
 *
 * Flags:
 *   --root <dir>   scan a different tree (used by the self-test's fixtures)
 *   --list         print every discovered title and exit 0 (diagnostic)
 *   --warn         never exit non-zero (dev-hook mode); still prints findings
 *
 * Dependency-free; ESM; cwd-independent (paths resolve from this file).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

/** Where the sidebar order literal lives. Repo-root relative. */
export const PREVIEW_REL = "apps/docs/.storybook/preview.tsx";
/** Where the human-facing numbered group list lives. Repo-root relative. */
export const GUIDELINES_REL = "docs/STORYBOOK_GUIDELINES.md";

/**
 * Titles whose non-group segments may carry spaces (rung 2). Every entry is a
 * PREFIX of the title, matched on segment boundaries, or an exact title.
 *
 * These are the prose surfaces of the sidebar, verified against the built index
 * by RM-005 — they are page names a reader reads, not component names:
 *
 *   - `Docs`                — the doc pages ("Getting Started", "brand-ui MCP Server", …).
 *   - `Patterns/Templates`  — whole-screen demos ("Data App", "Enterprise Admin Console").
 *   - `Patterns/Scenarios`  — multi-screen journeys.
 *   - `Patterns/Blocks`     — copy-own building blocks ("AI Chat Shell").
 *   - `Layout/App Shell`    — a sub-family node whose own name is two words.
 *   - `Foundations/Spacing & Radius` — one token page, exact match only.
 *
 * Keep this list SHORT and argued. A new entry means a new prose surface, which
 * is a taxonomy decision — not a way to land a `Core/My Component` title.
 */
export const NAMING_EXEMPTIONS = [
  "Docs",
  "Patterns/Templates",
  "Patterns/Scenarios",
  "Patterns/Blocks",
  "Layout/App Shell",
  "Foundations/Spacing & Radius",
];

// ───────────────────────── source masking (comments + strings) ────────────────

/**
 * One pass over the source producing TWO same-length views of it:
 *
 *   - `masked`          — comment bodies AND string/template bodies replaced by
 *                         spaces. Structure only: brackets, keys, operators. Used
 *                         for bracket matching and key finding, so a `{` inside a
 *                         string or a `//` inside a URL can never move the parse.
 *   - `withoutComments` — comments (delimiters included) replaced by spaces, with
 *                         string CONTENT intact. Used to lift a literal out for
 *                         `JSON.parse`.
 *
 * Both preserve every newline and every byte offset, so an index found in one
 * view addresses the same byte in the other and in the original.
 *
 * Deliberately does NOT model regex literals: a `/…/` whose body carries an odd
 * quote or brace is vanishingly rare in a story file's module scope, and the
 * consequence is a failed extraction — which this gate reports loudly (see
 * "Fail-closed" above) rather than passing over.
 *
 * @param {string} src
 * @returns {{ masked: string, withoutComments: string }}
 */
export function scanSource(src) {
  const masked = src.split("");
  const noComments = src.split("");
  const blank = (arr, i) => {
    if (arr[i] !== "\n") arr[i] = " ";
  };
  const blankBoth = (i) => {
    blank(masked, i);
    blank(noComments, i);
  };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      blankBoth(i);
      blankBoth(i + 1);
      i += 2;
      while (i < n && src[i] !== "\n") blankBoth(i++);
      continue;
    }
    if (c === "/" && next === "*") {
      blankBoth(i);
      blankBoth(i + 1);
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) blankBoth(i++);
      if (i < n) {
        blankBoth(i);
        blankBoth(i + 1);
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      // A `"`/`'` literal cannot span a raw newline in JavaScript, so a quote
      // with no unescaped partner before the end of the line is NOT a string
      // opener — it is an apostrophe in JSX text (`don't`, `the user's file`)
      // or a stray quote in prose. Treating one as a string opener swallowed
      // everything up to the next apostrophe in the file, which is exactly how
      // an early `don't` used to hide a meta object 30 lines below it.
      // Template literals legitimately span lines, so `` ` `` is exempt.
      const quote = c;
      let end = -1;
      for (let j = i + 1; j < n; j++) {
        if (src[j] === "\\") {
          j += 1;
          continue;
        }
        if (src[j] === quote) {
          end = j;
          break;
        }
        if (quote !== "`" && src[j] === "\n") break;
      }
      if (end < 0) {
        i += 1; // not a string literal — an ordinary character
        continue;
      }
      for (let j = i + 1; j < end; j++) blank(masked, j);
      i = end + 1; // both delimiters stay visible in both views
      continue;
    }
    i += 1;
  }
  return { masked: masked.join(""), withoutComments: noComments.join("") };
}

/**
 * Structural view of the source: comments and string bodies blanked.
 * Thin alias over {@link scanSource} for the call sites that only need it.
 */
export function maskNonCode(src) {
  return scanSource(src).masked;
}

/** 1-based line number of a byte offset. */
export function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

/**
 * Index of the bracket that closes the one at `open` (`[` or `{`), scanning the
 * MASKED text so brackets inside strings and comments never count.
 * Returns -1 when unbalanced.
 */
export function matchBracket(masked, open) {
  const closeOf = { "[": "]", "{": "}", "(": ")" };
  const opener = masked[open];
  const closer = closeOf[opener];
  if (!closer) return -1;
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    const c = masked[i];
    if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ───────────────────────────── the order literal ──────────────────────────────

/**
 * Parse `options.storySort.order` out of `preview.tsx`'s source.
 *
 * @param {string} src raw `preview.tsx`
 * @returns {{ groups: string[], children: Record<string, string[]>, raw: unknown[] }}
 * @throws {Error} when the literal cannot be found or does not parse
 */
export function parseStorySortOrder(src) {
  const { masked, withoutComments } = scanSource(src);
  // The LAST `order:` key, per preview.tsx's own instruction: the prose block
  // above the literal is where a first-match parser goes wrong.
  const keys = [...masked.matchAll(/(^|[^A-Za-z0-9_$.])order\s*:\s*\[/g)];
  if (keys.length === 0) {
    throw new Error(`no \`order: [\` key found in ${PREVIEW_REL}`);
  }
  const m = keys[keys.length - 1];
  const open = m.index + m[0].length - 1; // the `[`
  const close = matchBracket(masked, open);
  if (close < 0) throw new Error(`the \`order\` array in ${PREVIEW_REL} is unbalanced`);

  // The comment-free view keeps the string CONTENT, so the slice is already the
  // literal minus its prose. Drop trailing commas and it is JSON.
  const json = withoutComments.slice(open, close + 1).replace(/,(\s*[\]}])/g, "$1");
  let raw;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(
      `the \`order\` array in ${PREVIEW_REL} is not a plain literal of strings and nested ` +
        `arrays (${err.message}). It must stay inline and literal — Storybook parses it ` +
        `statically.`,
    );
  }
  if (!Array.isArray(raw)) throw new Error(`the \`order\` value in ${PREVIEW_REL} is not an array`);

  const groups = [];
  const children = {};
  for (const entry of raw) {
    if (typeof entry === "string") {
      groups.push(entry);
    } else if (Array.isArray(entry)) {
      const parent = groups[groups.length - 1];
      if (parent === undefined) {
        throw new Error(`a nested child array in ${PREVIEW_REL}'s \`order\` has no parent group`);
      }
      children[parent] = entry.filter((c) => typeof c === "string");
    } else {
      throw new Error(`unexpected \`order\` entry in ${PREVIEW_REL}: ${JSON.stringify(entry)}`);
    }
  }
  return { groups, children, raw };
}

// ───────────────────────────── story titles ───────────────────────────────────

/**
 * Extract the story TITLE a file contributes to the sidebar.
 *
 * `.stories.ts(x)` — Storybook reads the default export's `title`. This walks the
 * same path: `export default <ident>` → that identifier's object literal, or
 * `export default { … }` directly, then the `title` key at depth 1 of that
 * object. Reading the meta object (rather than the first `title:` anywhere) is
 * load-bearing: story files are full of `title:` keys in `argTypes`, in demo data
 * and in JSX props, and a first-match scan reads those instead.
 *
 * `.mdx` — a docs page declares `<Meta title="…" />`.
 *
 * @param {string} src
 * @param {{ mdx?: boolean }} [opts]
 * @returns {{ title: string, line: number } | null} null when the file declares no
 *   title (an MDX page attached with `<Meta of={…} />`, a story file with no
 *   default export) — the caller decides whether that is legal.
 */
export function extractStoryTitle(src, { mdx = false } = {}) {
  if (mdx) {
    const m = /<Meta\b[^>]*?\btitle\s*=\s*"([^"]*)"/s.exec(src);
    if (!m) return null;
    return { title: m[1], line: lineOf(src, m.index) };
  }

  const masked = maskNonCode(src);
  const def = /\bexport\s+default\s+/.exec(masked);
  if (!def) return null;
  const after = def.index + def[0].length;

  let objOpen = -1;
  if (masked[after] === "{") {
    objOpen = after;
  } else {
    const ident = /^([A-Za-z_$][A-Za-z0-9_$]*)/.exec(masked.slice(after));
    if (!ident) return null;
    // `const meta = {` / `const meta: Meta<typeof X> = {` / `let|var` alike.
    const decl = new RegExp(
      `\\b(?:const|let|var)\\s+${ident[1]}\\b[^=;{]*=\\s*(?:\\{|\\(\\s*\\{)`,
      "s",
    ).exec(masked);
    if (!decl) return null;
    objOpen = masked.indexOf("{", decl.index + decl[0].length - 2);
    if (objOpen < 0) return null;
  }

  const objClose = matchBracket(masked, objOpen);
  if (objClose < 0) return null;

  // The `title` key at depth 1 of that object literal.
  let depth = 0;
  for (let i = objOpen; i < objClose; i++) {
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
    const key = /^(?:title|"title"|'title')\s*:\s*"/.exec(masked.slice(i, i + 40));
    if (!key) {
      // Skip the rest of this identifier so `subtitle` can never match `title`.
      while (i < objClose && /[A-Za-z0-9_$]/.test(masked[i])) i++;
      continue;
    }
    // Guard against matching the tail of a longer identifier (`docsTitle:`).
    if (i > 0 && /[A-Za-z0-9_$]/.test(masked[i - 1])) continue;
    const valueStart = i + key[0].length; // first byte inside the quotes
    const valueEnd = src.indexOf('"', valueStart);
    if (valueEnd < 0) return null;
    return { title: src.slice(valueStart, valueEnd), line: lineOf(src, i) };
  }
  return null;
}

// ───────────────────────────── the guidelines list ────────────────────────────

/** The `##` section of the guidelines that holds the numbered group list. */
export const GUIDELINES_SECTION = "Sidebar taxonomy";

/**
 * The numbered top-level group list in `docs/STORYBOOK_GUIDELINES.md`.
 * A list item reads `N. **Group** — prose`; the bold name is the group.
 * Continuation lines of a wrapped item are indented, so anchoring on
 * `^\d+\. \*\*` cannot pick one up.
 *
 * SCOPED to one `##` section on purpose. The document has other numbered
 * `**bold**` lists (this gate's own rungs are one), and a whole-file scan reads
 * them as groups — which is not a hypothetical: it happened the first time this
 * doc was updated to describe the gate.
 *
 * @param {string} md
 * @param {string} [section] the `##` heading whose list to read
 * @returns {{ groups: string[], lines: number[], sectionFound: boolean }}
 */
export function parseGuidelinesGroups(md, section = GUIDELINES_SECTION) {
  const groups = [];
  const lines = [];
  const heading = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`, "m");
  const start = heading.exec(md);
  if (!start) return { groups, lines, sectionFound: false };
  const from = start.index + start[0].length;
  const nextHeading = /^##\s/m.exec(md.slice(from));
  const body = nextHeading ? md.slice(from, from + nextHeading.index) : md.slice(from);
  const re = /^(\d+)\.\s+\*\*([^*]+)\*\*/gm;
  for (const m of body.matchAll(re)) {
    groups.push(m[2].trim());
    lines.push(lineOf(md, from + m.index));
  }
  return { groups, lines, sectionFound: true };
}

// ───────────────────────────── the three rungs ────────────────────────────────

/** True when `title` is covered by a `NAMING_EXEMPTIONS` prefix or exact entry. */
export function isNamingExempt(title, exemptions = NAMING_EXEMPTIONS) {
  return exemptions.some((e) => title === e || title.startsWith(`${e}/`));
}

/**
 * Rung 1 + 2 for one title.
 *
 * @param {string} title
 * @param {string[]} groups the top-level names from `storySort.order`
 * @returns {{ rung: "orphan-group" | "segment-naming", message: string }[]}
 */
export function checkTitle(title, groups) {
  const problems = [];
  const segments = title.split("/").map((s) => s.trim());
  const [group, ...rest] = segments;

  if (!groups.includes(group)) {
    problems.push({
      rung: "orphan-group",
      message:
        `"${title}" — top-level group "${group}" is not in storySort.order, so it sorts to ` +
        `the bottom of the sidebar in arbitrary story-import order`,
    });
  }

  if (!isNamingExempt(title)) {
    for (const seg of rest) {
      if (/\s/.test(seg)) {
        problems.push({
          rung: "segment-naming",
          message:
            `"${title}" — segment "${seg}" contains a space; the component segment is ` +
            `PascalCase with no spaces (docs/STORYBOOK_GUIDELINES.md § Naming)`,
        });
        break;
      }
    }
  }

  return problems;
}

/**
 * Rung 3 — the guidelines list against the order array.
 *
 * @param {string[]} orderGroups
 * @param {string[]} docGroups
 * @returns {string[]} human-readable differences (empty when the two agree)
 */
export function diffGroupLists(orderGroups, docGroups) {
  if (orderGroups.length === docGroups.length && orderGroups.every((g, i) => g === docGroups[i])) {
    return [];
  }
  const out = [];
  const inOrder = new Set(orderGroups);
  const inDoc = new Set(docGroups);
  for (const g of orderGroups)
    if (!inDoc.has(g)) out.push(`"${g}" is in storySort.order but not in the guidelines list`);
  for (const g of docGroups)
    if (!inOrder.has(g)) out.push(`"${g}" is in the guidelines list but not in storySort.order`);
  if (out.length === 0) {
    out.push(
      `same groups, different ORDER:\n      storySort.order: ${orderGroups.join(" → ")}\n      guidelines:      ${docGroups.join(" → ")}`,
    );
  }
  return out;
}

// ───────────────────────────── file discovery ─────────────────────────────────

/**
 * The story files Storybook actually indexes, mirroring the globs in
 * `apps/docs/.storybook/main.ts`: every `packages/<pkg>/src/**` story for a
 * package directory that has a `package.json`, plus `apps/docs/stories/**`
 * stories and MDX pages. `registry/` is deliberately NOT scanned — `main.ts`
 * does not glob it, so registry files contribute no sidebar entry.
 *
 * @param {string} root repo root
 * @returns {{ path: string, mdx: boolean }[]} absolute paths
 */
export function listStoryFiles(root = REPO_ROOT) {
  const out = [];
  const packagesDir = join(root, "packages");
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!existsSync(join(packagesDir, entry.name, "package.json"))) continue;
      walk(join(packagesDir, entry.name, "src"), out, { mdx: false });
    }
  }
  walk(join(root, "apps", "docs", "stories"), out, { mdx: true });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function walk(dir, acc, { mdx }) {
  let ents = [];
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, acc, { mdx });
      continue;
    }
    if (/\.stories\.(ts|tsx)$/.test(e.name)) acc.push({ path: p, mdx: false });
    else if (mdx && /\.mdx$/.test(e.name)) acc.push({ path: p, mdx: true });
  }
  return acc;
}

// ───────────────────────────── the whole check ────────────────────────────────

/**
 * Run every rung against a tree. Pure enough to drive from the self-test with a
 * fixture root.
 *
 * @param {string} root
 * @returns {{ findings: {file: string|null, line: number|null, rung: string, message: string}[],
 *             titles: {file: string, line: number, title: string}[],
 *             groups: string[] }}
 */
export function checkStorybookGroups(root = REPO_ROOT) {
  const findings = [];
  const titles = [];

  const previewPath = join(root, PREVIEW_REL);
  if (!existsSync(previewPath)) {
    return {
      findings: [
        {
          file: PREVIEW_REL,
          line: null,
          rung: "unreadable",
          message: "the Storybook preview config is missing — the sidebar order cannot be read",
        },
      ],
      titles,
      groups: [],
    };
  }

  let parsed;
  try {
    parsed = parseStorySortOrder(readFileSync(previewPath, "utf8"));
  } catch (err) {
    return {
      findings: [{ file: PREVIEW_REL, line: null, rung: "unreadable", message: err.message }],
      titles,
      groups: [],
    };
  }
  const { groups } = parsed;
  if (groups.length === 0) {
    return {
      findings: [
        {
          file: PREVIEW_REL,
          line: null,
          rung: "unreadable",
          message:
            "storySort.order resolved to ZERO groups — every title below would pass vacuously",
        },
      ],
      titles,
      groups,
    };
  }

  // Rungs 1 + 2 — every indexed story title.
  for (const { path, mdx } of listStoryFiles(root)) {
    const rel = relative(root, path);
    const src = readFileSync(path, "utf8");
    const found = extractStoryTitle(src, { mdx });
    if (!found) {
      if (mdx && !/<Meta\b/.test(src)) continue; // a plain MDX page with no Meta contributes nothing
      findings.push({
        file: rel,
        line: null,
        rung: "unreadable",
        message:
          "could not read this file's sidebar title. A title this gate cannot read is a " +
          "failure, not a skip — and an OMITTED title is not an exemption either: Storybook " +
          "then derives one from the file path, which is precisely the unreviewed group this " +
          'gate exists to catch. Declare a literal `title: "Group/Component"` on the ' +
          'default-exported meta (or `<Meta title="…" />` in MDX)',
      });
      continue;
    }
    titles.push({ file: rel, line: found.line, title: found.title });
    for (const p of checkTitle(found.title, groups)) {
      findings.push({ file: rel, line: found.line, ...p });
    }
  }

  // Rung 4 — a listed group no story uses any more (the reverse of rung 1).
  const used = new Set(titles.map((t) => t.title.split("/")[0].trim()));
  for (const g of groups) {
    if (used.has(g)) continue;
    findings.push({
      file: PREVIEW_REL,
      line: null,
      rung: "stale-group",
      message:
        `"${g}" is listed in storySort.order but no story titles into it any more — remove it ` +
        `from the array and from ${GUIDELINES_REL}'s numbered list, or restore the stories`,
    });
  }

  // Rung 3 — the hand-kept guidelines list.
  const guidelinesPath = join(root, GUIDELINES_REL);
  if (existsSync(guidelinesPath)) {
    const md = readFileSync(guidelinesPath, "utf8");
    const doc = parseGuidelinesGroups(md);
    if (doc.groups.length === 0) {
      findings.push({
        file: GUIDELINES_REL,
        line: null,
        rung: "doc-parity",
        message: doc.sectionFound
          ? `the "## ${GUIDELINES_SECTION}" section holds no numbered \`N. **Group** —\` list — ` +
            "rung 3 would pass vacuously. Restore the list, or update this gate if the doc's " +
            "shape deliberately changed"
          : `no "## ${GUIDELINES_SECTION}" section — rung 3 would pass vacuously. Restore the ` +
            "heading, or update GUIDELINES_SECTION if the doc was deliberately restructured",
      });
    } else {
      for (const diff of diffGroupLists(groups, doc.groups)) {
        findings.push({ file: GUIDELINES_REL, line: null, rung: "doc-parity", message: diff });
      }
    }
  }

  return { findings, titles, groups };
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const rootIdx = args.indexOf("--root");
  const root = rootIdx >= 0 ? args[rootIdx + 1] : REPO_ROOT;

  const { findings, titles, groups } = checkStorybookGroups(root);

  if (args.includes("--list")) {
    for (const t of titles.sort((a, b) => a.title.localeCompare(b.title))) {
      console.log(`${t.title}\t${t.file}:${t.line}`);
    }
    console.log(`\n${titles.length} title(s), ${groups.length} group(s) in storySort.order.`);
    return 0;
  }

  if (findings.length > 0) {
    const label = warnOnly ? "⚠ storybook-groups" : "✖ storybook-groups gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const f of findings) {
      const where = f.line == null ? f.file : `${f.file}:${f.line}`;
      console.error(`  ${where}  ${f.message}`);
    }
    console.error(
      `\n  storySort.order currently lists: ${groups.join(", ") || "(none)"}\n` +
        `\n  Fix: put the group in \`${PREVIEW_REL}\`'s \`options.storySort.order\` in the right\n` +
        `  tier (primitives → composites → domain packages → utilities → demos) AND in the\n` +
        `  numbered list in \`${GUIDELINES_REL}\` — same groups, same order — or retitle the\n` +
        `  story into a group that already exists. The order array must stay an INLINE literal:\n` +
        `  Storybook parses it statically and rejects any identifier or spread.`,
    );
    if (!warnOnly) return 1;
    return 0;
  }

  console.log(
    `✔ storybook-groups: ${titles.length} story title(s) across ${groups.length} listed group(s); ` +
      `${GUIDELINES_REL}'s list matches storySort.order`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv));
}
