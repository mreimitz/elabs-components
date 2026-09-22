/**
 * catalog-visitor-copy — the website's component pages carry visitor copy, never
 * maintainer prose.
 *
 * The generated catalog (`apps/home/content/generated/catalog-pages.json`) is what
 * elabs-ai.com renders: a page's `summary` is its header lead, `about` the paragraph under
 * it, `question` the subtitle. Each is derived from source prose (the intent map, a story
 * file's docs description or file comment, a component's JSDoc) through
 * `scripts/lib/visitor-copy.mjs`. Two things must hold on the generated output:
 *   1. No page's public text carries a maintainer marker — a roadmap item (RM-126), an
 *      ADR, an issue number, a fixture, a story id, a repo path (2026-09-22: the River
 *      page's header was the story file's JSDoc, verbatim).
 *   2. Every page has a lead. A blank header is a page that says nothing.
 */
import { hasMaintainerMarker } from "../../lib/visitor-copy.mjs";

const CATALOG = "apps/home/content/generated/catalog-pages.json";

/** One finding per page field that still reads as maintainer prose, or per blank lead. */
export function auditCatalog(pages) {
  const findings = [];
  for (const [key, page] of Object.entries(pages)) {
    const lead = page.summary || page.template?.description || page.about;
    if (!lead)
      findings.push({
        file: page.file || CATALOG,
        line: 1,
        msg: `${key}: no visitor lead — author an intent purpose or a docs description`,
        key: `${key}::lead`,
      });
    for (const field of ["summary", "about", "question"]) {
      const marker = hasMaintainerMarker(page[field]);
      if (marker)
        findings.push({
          file: page.file || CATALOG,
          line: 1,
          msg: `${key}.${field}: maintainer prose on the website ("${marker}")`,
          key: `${key}::${field}`,
        });
    }
  }
  return findings;
}

const PAGE = (extra = {}) => ({
  section: "components",
  slug: "button",
  file: "packages/ui/src/components/button/button.stories.tsx",
  summary: "Primary action trigger.",
  about: "",
  question: "",
  template: null,
  ...extra,
});

export default {
  id: "catalog-visitor-copy",
  scope: "repo",
  doc: "Keep the website catalog's page leads, about paragraphs and subtitles free of maintainer prose (roadmap items, ADRs, issue numbers, fixtures, story ids, repo paths) and give every page a lead — author a `purpose` in `packages/cli/lib/intent.mjs` or a `docs.description.component` in the story.",
  baseline: "none",
  run(ctx) {
    if (!ctx.exists(CATALOG)) return [];
    return auditCatalog(ctx.json(CATALOG));
  },
  fixtures: {
    pass: [{ files: { [CATALOG]: JSON.stringify({ "components/ui/button": PAGE() }) } }],
    fail: [
      {
        files: {
          [CATALOG]: JSON.stringify({
            "components/charts/river": PAGE({
              slug: "river",
              summary: "",
              about: "Charts / Recipes / River (RM-126). Four deep-dives, every fixture seeded.",
            }),
          }),
        },
      },
      {
        files: {
          [CATALOG]: JSON.stringify({
            "components/ui/kbd": PAGE({ slug: "kbd", summary: "", about: "" }),
          }),
        },
      },
      {
        files: {
          [CATALOG]: JSON.stringify({
            "components/ai/canvas": PAGE({
              summary: "The in-chat workspace graph (ADR 0018).",
            }),
          }),
        },
      },
    ],
  },
};
