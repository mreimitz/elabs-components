/**
 * timeline-fork — Timeline-rail fork prevention (#190, research 10 §F).
 * Restored from scripts/check-timeline-fork.mjs (git 2fa2ce6).
 *
 * The Timeline rail/node/connector spine lives ONCE in
 * `packages/ui/src/components/timeline` (editor keeps a re-export shim). Two classes:
 *   1. NAME fork — a local runtime declaration (function/const/class) named
 *      `Timeline*` outside the canonical dirs. Type-only declarations never flag.
 *   2. RAIL fork — in one file: a class string with `absolute` AND `w-px` (hairline
 *      connector) plus a status-keyed style map (`Record<…Status…>` or
 *      `const …status… = {`), without importing Timeline/TimelineRoot/TimelineItem
 *      from `@elabs-ai/components-ui`.
 * Comments are stripped first. Allowlist is empty since #192.
 */
import { lineOf } from "../context.mjs";

export const CANONICAL_DIRS = [
  "packages/ui/src/components/timeline",
  "packages/editor/src/timeline",
];
/** Legacy rails with an exit ticket. Empty since #192. */
export const ALLOWLIST = [];

const CONNECTOR_STRING_RE =
  /["'`][^"'`\n]*\babsolute\b[^"'`\n]*\bw-px\b[^"'`\n]*["'`]|["'`][^"'`\n]*\bw-px\b[^"'`\n]*\babsolute\b[^"'`\n]*["'`]/;
const STATUS_MAP_RE =
  /Record<[^\n]*Status|\b(?:const|let|var)\s+[A-Za-z_$]*[Ss]tatus[A-Za-z0-9_$]*\s*(?::[^=\n]+)?=\s*\{/;
const RAIL_IMPORT_RE =
  /import\s+(?:type\s+)?\{[^}]*\bTimeline(?:Root|Item)?\b[^}]*\}\s*from\s*["']@elabs-ai\/components-ui["']/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const NAME = "(Timeline[A-Za-z0-9_$]*)";
const NAME_RES = [
  new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s+${NAME}\\s*[(<]`, "g"),
  new RegExp(
    `\\b(?:export\\s+)?(?:const|let|var)\\s+${NAME}\\s*(?::[^=\\n]+)?=\\s*(?:\\([^)]*\\)\\s*(?::[^=>\\n]+)?=>|(?:async\\s+)?function\\b|(?:React\\.)?(?:forwardRef|memo)\\b)`,
    "g",
  ),
  new RegExp(`\\b(?:export\\s+)?(?:abstract\\s+)?class\\s+${NAME}\\b`, "g"),
];

/** Violations in one source string → `[{ kind, name?, statement?, line, statusMapLine? }]`. */
export function findTimelineForkViolations(src) {
  const code = stripComments(src);
  const out = [];
  const seen = new Set();
  for (const re of NAME_RES) {
    for (const m of code.matchAll(re)) {
      const line = lineOf(code, m.index);
      if (seen.has(`${m[1]}::${line}`)) continue;
      seen.add(`${m[1]}::${line}`);
      out.push({ kind: "name", name: m[1], line });
    }
  }
  if (!RAIL_IMPORT_RE.test(code)) {
    const connector = code.match(CONNECTOR_STRING_RE);
    const statusMap = code.match(STATUS_MAP_RE);
    if (connector && statusMap)
      out.push({
        kind: "rail",
        statement: connector[0].replace(/\s+/g, " ").trim(),
        line: lineOf(code, connector.index),
        statusMapLine: lineOf(code, statusMap.index),
      });
  }
  return out;
}

const isExempt = (rel) =>
  CANONICAL_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)) || ALLOWLIST.includes(rel);

// ── fixtures ─────────────────────────────────────────────────────────────────
const src = (body, file = "packages/ai/src/x.tsx") => ({ files: { [file]: body } });
const HAND_ROLLED_RAIL = `
const railStatusStyles: Record<MyStatus, string> = {
  done: "bg-success",
  pending: "bg-border",
};
export function StepList({ steps }) {
  return steps.map((s) => (
    <div key={s.id}>
      <span className="absolute top-7 bottom-0 left-1/2 w-px bg-border" />
      <span className={railStatusStyles[s.status]} />
    </div>
  ));
}
`;

export default {
  id: "timeline-fork",
  scope: "components",
  doc: "Compose `TimelineRoot`/`TimelineItem`/`Timeline` from `@elabs-ai/components-ui`; never declare a local `Timeline*` component or hand-roll an `absolute w-px` connector with a status-keyed style map outside `packages/ui/src/components/timeline`.",
  baseline: "none",
  run(ctx) {
    const files = ctx.glob("packages/*/src/**/*.{ts,tsx}", {
      ignore: ["**/*.{test,stories}.{ts,tsx}", "**/{node_modules,dist}/**"],
    });
    const out = [];
    for (const file of files) {
      if (isExempt(file)) continue;
      for (const v of findTimelineForkViolations(ctx.readFile(file)))
        out.push({
          file,
          line: v.line,
          msg:
            v.kind === "name"
              ? `"${v.name}" is declared locally — the Timeline rail lives in @elabs-ai/components-ui`
              : `hand-rolled rail: hairline connector \`${v.statement}\` + status-keyed style map (line ${v.statusMapLine})`,
        });
    }
    return out;
  },
  fixtures: {
    pass: [
      src('import { Timeline, TimelineItem } from "@elabs-ai/components-ui";'),
      src('export { Timeline, type TimelineProps } from "@elabs-ai/components-ui";'),
      src(
        'export { Timeline, type TimelineEntry as TimelineItem } from "@elabs-ai/components-ui";',
      ),
      src("export type TimelineThing = { id: string };"),
      src("export interface TimelineConfig { dense?: boolean }"),
      src("const items: TimelineEntry[] = [];"),
      src(
        `import { TimelineRoot, TimelineItem } from "@elabs-ai/components-ui";\n${HAND_ROLLED_RAIL}`,
      ),
      src('const handle = "relative flex w-px items-center bg-border after:absolute after:w-1";'),
      src('const statusStyles: Record<Status, string> = { pending: "bg-secondary" };'),
      src(
        HAND_ROLLED_RAIL.split("\n")
          .map((l) => `// ${l}`)
          .join("\n"),
      ),
      src(`/*${HAND_ROLLED_RAIL}*/`),
      src('const h = "h-full w-px bg-border";\nconst stepStatusStyles = { a: 1 };'),
      // canonical dirs + tests/stories are exempt
      src(
        "export function TimelineRail() { return null; }",
        "packages/ui/src/components/timeline/timeline.tsx",
      ),
      src("export const Timeline = () => null;", "packages/editor/src/timeline/index.ts"),
      src(HAND_ROLLED_RAIL, "packages/ai/src/x.test.tsx"),
      src(HAND_ROLLED_RAIL, "packages/ai/src/x.stories.tsx"),
    ],
    fail: [
      src(
        "export const TimelineFancy = forwardRef(function TimelineFancy(p, ref) { return null; });",
      ),
      src("export function TimelineRail() { return null; }"),
      src("const Timeline = () => null;"),
      src("class TimelineView {}"),
      src(HAND_ROLLED_RAIL),
      src(HAND_ROLLED_RAIL, "packages/ai/src/chain-of-thought.tsx"),
      src(
        '<span className="absolute top-7 bottom-0 left-1/2 -mx-px w-px bg-border" />\nconst x: Record<NonNullable<Props["status"]>, Status> = {};',
      ),
    ],
  },
};
