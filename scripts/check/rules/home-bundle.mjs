/**
 * home-bundle — the website's `/` route keeps its initial JavaScript inside a budget and free of
 * the per-section engines (RM-104, ADR 0038). Reads a `next build` in `apps/home/.next` through
 * the site's own budget script (`apps/home/scripts/bundle-budget.mjs`), so the gate and the
 * report never disagree.
 *
 * Budget: a `per-file` baseline whose one finding is WEIGHTED by the gzip bytes (baseline.mjs):
 * `scripts/check/baseline.json` → `"home-bundle": { "apps/home/.next/server/app/index.html": N }`,
 * N = the first green build + 5 %. Over N fails; `pnpm check:update --rule home-bundle` only
 * ratchets it down to the measured size. A per-section engine in an initial chunk is a finding on
 * that chunk, whose baseline is always 0.
 * No build (the Quality job, a fresh clone): prints "skipped: no home build" and passes (the
 * committed budget is carried as the weight, so `check:update` cannot erase it) — unless
 * `HOME_BUNDLE_REQUIRED=1` (the `home` CI job), where a missing build fails.
 */
import {
  analyzeHomeBundle,
  formatReport,
  NEXT_DIR,
} from "../../../apps/home/scripts/bundle-budget.mjs";

const BASELINE = "scripts/check/baseline.json";
const SIZE_KEY = `${NEXT_DIR}/server/app/index.html`;

const budgetOf = (ctx) =>
  ctx.exists(BASELINE) ? ctx.json(BASELINE)["home-bundle"]?.[SIZE_KEY] : undefined;

function ioFor(ctx) {
  const at = (rel) => `${NEXT_DIR}/${rel}`;
  return {
    read: (rel) => ctx.readFile(at(rel)),
    exists: (rel) => ctx.exists(at(rel)),
    list: (rel) => ctx.dirFiles(at(rel)),
  };
}

const say = (ctx, lines) => {
  // Real runs print the size (stderr keeps `--json` stdout clean); fixtures stay quiet.
  if (ctx.root !== "/__fixture__")
    for (const l of lines) process.stderr.write(`  home-bundle: ${l}\n`);
};

// ── fixtures ────────────────────────────────────────────────────────────────
const buildFixture = ({ initialChunk, budget = 100_000 }) => ({
  baseline: { [`${NEXT_DIR}/server/app/index.html`]: budget },
  files: {
    [`${NEXT_DIR}/build-manifest.json`]: JSON.stringify({
      polyfillFiles: ["static/chunks/poly.js"],
      rootMainFiles: ["static/chunks/main.js"],
    }),
    [`${NEXT_DIR}/server/app/page_client-reference-manifest.js`]:
      'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/page"] = {"entryJSFiles":{"[project]/apps/home/app/page":["static/chunks/page.js"]}};\n',
    [`${NEXT_DIR}/server/app/index.html`]:
      '<script src="/_next/static/chunks/main.js"></script><script src="/_next/static/chunks/page.js"></script>',
    [`${NEXT_DIR}/server/app/page/react-loadable-manifest.json`]: JSON.stringify({
      1: { id: 1, files: ["static/chunks/flow.js"] },
    }),
    [`${NEXT_DIR}/static/chunks/poly.js`]: "self.polyfill=1;",
    [`${NEXT_DIR}/static/chunks/main.js`]: "console.log('main');",
    [`${NEXT_DIR}/static/chunks/page.js`]: initialChunk,
    [`${NEXT_DIR}/static/chunks/flow.js`]:
      'x.jsx("div",{className:"react-flow__viewport xyflow__viewport react-flow__container"})',
  },
});

export default {
  id: "home-bundle",
  scope: "packages",
  doc: "Keep the website's `/` initial JavaScript (gzip, `apps/home/.next`) within the `home-bundle` budget in `scripts/check/baseline.json` and free of per-section engines (@xyflow, monaco-editor, maplibre-gl, @milkdown, components-process, components-terminal); skipped without a build unless `HOME_BUNDLE_REQUIRED=1`.",
  baseline: "per-file",
  run(ctx) {
    const report = analyzeHomeBundle(ioFor(ctx));
    if (!report) {
      if (process.env.HOME_BUNDLE_REQUIRED === "1")
        return [
          {
            file: `${NEXT_DIR}/build-manifest.json`,
            line: 1,
            msg: "no home build, and HOME_BUNDLE_REQUIRED=1 — run `pnpm --filter @elabs-ai/home build` first",
          },
        ];
      say(ctx, ["skipped: no home build"]);
      // Carry the committed budget as the finding's weight, so the rule passes AND a
      // `check:update` on a tree without a build never erases the budget.
      const carried = budgetOf(ctx);
      return typeof carried === "number"
        ? [
            {
              file: SIZE_KEY,
              line: 1,
              weight: carried,
              msg: "skipped: no home build (budget carried unchanged)",
            },
          ]
        : [];
    }
    const budget = budgetOf(ctx);
    say(ctx, formatReport(report, budget).slice(0, 8));
    return [
      {
        file: SIZE_KEY,
        line: 1,
        weight: report.initialGzipBytes,
        msg: `/ initial JS is ${report.initialGzipBytes} B gzip${typeof budget === "number" ? ` (budget ${budget} B)` : ""} — trim the initial chunks; raising the budget is a reviewed edit of baseline.json`,
      },
      ...report.heavyInInitial.map((c) => ({
        file: `${NEXT_DIR}/${c.file}`,
        line: 1,
        msg: `initial chunk of / contains ${c.heavy.join(", ")} — load it per section with a dynamic import() (standing rule, RM-094)`,
      })),
    ];
  },
  fixtures: {
    pass: [buildFixture({ initialChunk: "export const page = 1;" })],
    fail: [
      // @xyflow's runtime in an initial chunk.
      buildFixture({
        initialChunk:
          'x.jsx("div",{className:"react-flow__renderer"});x.jsx("div",{className:"xyflow__viewport"})',
      }),
      // Over budget.
      buildFixture({ initialChunk: "export const page = 1;", budget: 10 }),
    ],
  },
};
