/**
 * reference-leakage — third-party product names outside attribution and themes.
 *
 * House rule: a competitor or reference product may be named in exactly two
 * places — an ATTRIBUTION surface, where crediting upstream is the point, and a
 * THEME surface, where the brand IS the artefact. Everywhere else, naming one
 * describes this library in another vendor's vocabulary and implies a
 * relationship that does not exist.
 *
 * The product list, the zone map and the context classifier are NOT duplicated
 * here: they are imported from the repo-cleanup skill's analyzer, which is the
 * one place they are measured and maintained. Two copies of a deny-list drift,
 * and a drifted deny-list fails open — it stops reporting and nobody notices.
 *
 * Two mention classes are reported but never counted, because deleting them
 * breaks working software:
 *   - `package-specifier`  — `["@mui/material", "mui"]` in the migrate command
 *   - `migration-source`   — the libraries that command converts from
 *
 * `review`-tier names (a real company used as demo data, a true interop claim)
 * are warn-only for the same reason: they have a measured false-positive rate,
 * and a gate that cries wolf gets disabled.
 *
 * Per-file ratchet: what is already here is recorded, so the count can only go
 * down. A NEW mention fails.
 */
import {
  PRODUCTS,
  classifyContext,
  classifyZone,
  specifierSpans,
} from "../../../.claude/skills/repo-cleanup/scripts/reference-leakage.mjs";
import { lineOf } from "../context.mjs";

const IGNORE = [
  "**/{node_modules,dist,build,out,coverage,storybook-static,.next,.turbo,__output}/**",
  ".claude/worktrees/**",
  // The tooling has to spell the names out in order to look for them.
  ".claude/skills/repo-cleanup/**",
  "scripts/check/rules/reference-leakage.mjs",
];

/**
 * Generated artefacts. Nobody writes these by hand: they are rebuilt from the
 * package source's own JSDoc, so a mention here is a SYMPTOM and the fix is
 * upstream. Counting them would double-count every leak and churn the baseline
 * on every `pnpm gen`, which is how a ratchet stops meaning anything.
 *
 * Two shapes qualify. A whole generated FILE matches `GENERATED` below. A
 * generated REGION inside an otherwise hand-written file is delimited by the
 * repo's own `brand-ui:gen:<name>:start/end` markers and is matched by
 * `GEN_REGION` — scoped that way so relocating a generated block into a
 * hand-written document exempts the block and nothing else. The prose around
 * it stays fully enforced.
 */
const GENERATED = [
  /(^|\/)generated(\/|\.)/,
  /\.generated\.[a-z]+$/,
  /(^|\/)brand-ui\.manifest\.json$/,
  /(^|\/)CHANGELOG\.md$/,
  /^llms(\.txt|\/)/,
];

const GEN_REGION = {
  start: /<!--\s*brand-ui:gen:[\w-]+:start\s*-->/,
  end: /<!--\s*brand-ui:gen:[\w-]+:end\s*-->/,
};

const GLOBS = [
  "packages/*/{src,lib,bin,schemas}/**/*.{ts,tsx,mjs,cjs,js,json,md,mdx,css}",
  "registry/**/*.{ts,tsx,json,md}",
  "apps/{home,docs}/**/*.{ts,tsx,mdx,md,json,css}",
  "skills/**/*.md",
  "plugin/**/*.{json,md}",
  "docs/**/*.md",
  "roadmap/**/*.md",
  ".changeset/*.md",
  "*.{md,json}",
];

/** One scan pass, shared by the rule and its fixtures. */
export function scanReferenceLeakage(ctx) {
  const out = [];
  for (const file of ctx.glob(GLOBS, { ignore: IGNORE })) {
    const zone = classifyZone(file);
    if (zone === "allowed" || zone === "self-exempt") continue;

    let text;
    try {
      text = ctx.readFile(file);
    } catch {
      continue;
    }

    const fileIsGenerated = GENERATED.some((g) => g.test(file));
    let inGenRegion = false;
    let offset = 0;
    for (const line of text.split("\n")) {
      if (GEN_REGION.start.test(line)) inGenRegion = true;
      else if (GEN_REGION.end.test(line)) inGenRegion = false;
      const spans = specifierSpans(line);
      for (const p of PRODUCTS) {
        p.re.lastIndex = 0;
        for (const m of line.matchAll(p.re)) {
          const context = classifyContext(line, file, m.index ?? 0, spans);
          // Load-bearing: the software needs this string to work.
          if (context === "package-specifier" || context === "migration-source") continue;
          out.push({
            file,
            line: lineOf(text, offset + (m.index ?? 0)),
            msg:
              `third-party product name \`${m[0]}\` in a ${zone} surface — ` +
              "attribution and theme files are the only places a product may be named" +
              (context === "unclassified" ? "" : ` (reads as a ${context})`),
            ...(p.tier === "review" || fileIsGenerated || inGenRegion ? { warn: true } : {}),
          });
        }
      }
      offset += line.length + 1;
    }
  }
  return out;
}

const at = (path, body) => ({ files: { [path]: body } });

export default {
  id: "reference-leakage",
  scope: "repo",
  doc: "Name a third-party product (Datawrapper, Qlik, Grafana, MUI, …) only in an attribution or theme surface; everywhere else — shipped source, the manifest, changesets, docs, roadmap — say what the feature does instead. Package specifiers and the libraries `brand-ui migrate` converts from are exempt.",
  baseline: "per-file",
  run: scanReferenceLeakage,
  fixtures: {
    pass: [
      // attribution and themes: the two allowed homes
      at("themes/qlik/theme.ts", 'export const name = "Qlik";'),
      at("scripts/attributions.sources.json", '{ "name": "Datawrapper" }'),
      at("docs/ATTRIBUTIONS.md", "Adapted from Datawrapper."),
      // load-bearing: a package specifier and a migration source
      at("packages/cli/lib/engine.mjs", 'const MAP = [["@mui/material", "mui"]];'),
      at("packages/cli/lib/migrate.mjs", "convert from Chakra to brand-ui"),
      // the feature described on its own terms
      at(
        "docs/ADR/0039-chart-responsive-contract.md",
        "Bars are drawn from a zero-including domain.",
      ),
      at(".changeset/x.md", "`BarChart` gains percent stacking and diverging stacks."),
      // a name that is NOT on the list, and must never be
      at("packages/charts/src/x.ts", "const scale = linearScale(); // linear interpolation"),
      at("packages/charts/src/y.ts", "/** Stripe pitch of a stripes range, in px. */"),
      // generated: reported as a warning, never counted — fix the source instead
      at("brand-ui.manifest.json", '{ "description": "Datawrapper alt text." }'),
      at("apps/home/content/generated/catalog.json", '{ "d": "Recharts yAxisId" }'),
    ],
    fail: [
      at(".changeset/x.md", "`BarChart` gains Datawrapper-parity bar/column richness."),
      at("packages/charts/src/x.ts", "// Grafana does this with a Scenes object."),
      at("docs/ADR/0001-x.md", "Power BI and Looker Studio use a free canvas."),
      at("roadmap/RM-1.md", "Reach Qlik Sense parity for the filter pane."),
      at("apps/home/app/page.tsx", 'const blurb = "A Tableau-style workbook";'),
    ],
  },
};
