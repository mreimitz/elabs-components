/**
 * media-reuse — raw `<img>`, `<video>` and `<audio>` belong to ui's `Image`, `Video` and `Audio`
 * (ADR 0041). Every other package composes those primitives — they own the skeleton, the terminal
 * error fallback, the accessible name and the token-styled controls once.
 *
 * Per-line escape hatch: `// media-reuse-exempt: <reason>` on the tag's line or the line above
 * (reason required). Comments are stripped, line numbers preserved. Scope: every
 * `packages/<pkg>/src` except the foundation/tooling packages and the two owning folders; not
 * tests/stories/__contract__.
 */
import { lineOf } from "../context.mjs";
import { stripCommentsKeepLines } from "./ui-reuse.mjs";

export const OWNERS = [
  "packages/ui/src/components/image/",
  "packages/ui/src/components/media-player/",
];
export const SKIP_PACKAGE_DIRS = [
  "icons",
  "tokens",
  "cli",
  "create",
  "eslint-config",
  "typescript-config",
];
const REPLACEMENT = { img: "Image", video: "Video", audio: "Audio" };
const EXEMPT_RE = /\/\/\s*media-reuse-exempt:\s*\S/;
const TAG_RE = /<(img|video|audio)(?=[\s/>])/g;

/** Violations in one source string → `[{ tag, line }]`, sorted by line. */
export function findMediaReuseViolations(src) {
  const exempt = new Set();
  src.split("\n").forEach((l, i) => {
    if (EXEMPT_RE.test(l)) {
      exempt.add(i + 1); // same line
      exempt.add(i + 2); // the line above the tag
    }
  });
  const code = stripCommentsKeepLines(src);
  const out = [];
  for (const m of code.matchAll(TAG_RE)) {
    const line = lineOf(code, m.index);
    if (!exempt.has(line)) out.push({ tag: m[1], line });
  }
  return out;
}

const isOwner = (file) => OWNERS.some((o) => file.startsWith(o));
const isSkipped = (file) => SKIP_PACKAGE_DIRS.some((d) => file.startsWith(`packages/${d}/`));

// ── fixtures ─────────────────────────────────────────────────────────────────
const src = (body, file = "packages/ai/src/x.tsx") => ({ files: { [file]: body } });

export default {
  id: "media-reuse",
  scope: "packages",
  doc: "No raw `<img>`, `<video>` or `<audio>` in a package outside `ui`'s `image/` and `media-player/` folders — compose `Image`, `Video`, `Audio` from `@elabs-ai/components-ui`; exempt one line with `// media-reuse-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob("packages/*/src/**/*.{ts,tsx}", {
      ignore: [
        "**/*.test.{ts,tsx}",
        "**/*.stories.tsx",
        "**/__contract__/**",
        "**/{node_modules,dist}/**",
      ],
    })) {
      if (isOwner(file) || isSkipped(file)) continue;
      for (const v of findMediaReuseViolations(ctx.readFile(file)))
        out.push({
          file,
          line: v.line,
          msg: `raw <${v.tag}> — compose \`${REPLACEMENT[v.tag]}\` from @elabs-ai/components-ui (or \`// media-reuse-exempt: <reason>\`)`,
        });
    }
    return out;
  },
  fixtures: {
    pass: [
      src(
        'import { Image } from "@elabs-ai/components-ui";\nexport const A = () => <Image alt="" src="x" />;',
      ),
      src('export const A = () => <img alt="" />;', "packages/ui/src/components/image/image.tsx"),
      src(
        "export const A = () => <video />;",
        "packages/ui/src/components/media-player/media-player.tsx",
      ),
      src('export const A = () => <img alt="" />;', "packages/ai/src/x.stories.tsx"),
      src('export const A = () => <img alt="" />;', "packages/ai/src/x.test.tsx"),
      src('export const A = () => <img alt="" />;', "packages/icons/src/service-logo.tsx"),
      src(
        'export const A = () => <img alt="" />; // media-reuse-exempt: 16px glyph in a parser hot path',
      ),
      src(
        '// media-reuse-exempt: 16px glyph in a parser hot path\nexport const A = () => <img alt="" />;',
      ),
      src("/** renders an `<img>` */\n// an <audio> mention\nexport const A = 1;"),
      src('export const A = () => <image href="x" />;'), // SVG <image>, not <img>
      src("export const A = () => <imgur />;"),
    ],
    fail: [
      src('export const A = () => <img alt="" src="x" />;'),
      src("export const A = () => <video controls />;", "packages/viewer/src/adapters/media/x.tsx"),
      src(
        "export const A = () => (\n  <audio\n    controls\n  />\n);",
        "packages/editor/src/x.tsx",
      ),
      src('export const A = () => <img alt="" />; // media-reuse-exempt:'),
      src('/* a\nb */\nexport const A = () => <img alt="" />;', "packages/data/src/x.tsx"),
    ],
  },
};
