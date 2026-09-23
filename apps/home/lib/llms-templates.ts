/**
 * `/llms/templates` as text (RM-149) — every template for an agent asked "build me a support
 * desk". Same data as the human page: the scenario and the views from
 * `content/template-tours.ts`, the blocks and packages generated from the registry item, the one
 * command that copies the template in (or scaffolds the starter). Linked from `/llms.txt`.
 */
import { HOSTED_DOCS_URL } from "@elabs-ai/components-cli/lib/render-docs.mjs";
import { catalogPage, entriesOf } from "./catalog";
import { hrefOf } from "./catalog-index";
import { install } from "./content";
import { TEMPLATE_DOMAINS, tourOf } from "../content/template-tours";
import { templateParts } from "../components/catalog/template-story";

const CLI_PACKAGE = install.cli.split(" ").at(-1) ?? "";

export function renderTemplatesText(origin = HOSTED_DOCS_URL): string {
  const entries = entriesOf("templates");
  const lines: string[] = [];
  lines.push("# brand-ui templates");
  lines.push("");
  lines.push(
    `> Whole screens, copy-own: ${entries.length} templates built from @elabs-ai/components-* and the ` +
      "registry's blocks. A registry template is one command away; a starter scaffolds a new app. " +
      `Each has a page at ${origin}/templates/<slug>; the packages are described at ${origin}/llms.txt.`,
  );
  lines.push("");
  for (const entry of entries) {
    const page = catalogPage("templates", entry.slug);
    if (!page) continue;
    const tour = tourOf(entry.slug);
    const { blocks, packages } = templateParts(page);
    const scaffoldable = install.create.templates.includes(entry.slug);
    lines.push(`## ${page.name} — ${origin}${hrefOf(entry)}`);
    lines.push("");
    if (tour) lines.push(`- Domain: ${TEMPLATE_DOMAINS[tour.domain]}`);
    lines.push(`- Scenario: ${tour?.scenario ?? page.template?.description ?? page.summary}`);
    if (tour?.views.length) {
      lines.push("- Views:");
      for (const view of tour.views) lines.push(`  - ${view.label}: ${view.shows}`);
    }
    if (tour?.interaction) lines.push(`- Interaction: ${tour.interaction}`);
    if (blocks.length) {
      lines.push(
        `- Blocks: ${blocks
          .map(({ name, entry: e }) => (e ? `${name} (${origin}${hrefOf(e)})` : name))
          .join(", ")}`,
      );
    }
    if (packages.length) lines.push(`- Packages: ${packages.map((p) => p.name).join(", ")}`);
    if (page.block) {
      lines.push(
        `- Copy in: \`npx shadcn@latest add ${install.registryHomepage}/${page.block.name}.json\` ` +
          `(registry item \`${page.block.name}\`; brings its blocks with it)`,
      );
    } else if (scaffoldable) {
      lines.push(
        `- Scaffold: \`npx -y ${CLI_PACKAGE} create my-${entry.slug} --template ${entry.slug}\``,
      );
    }
    lines.push(`- Storybook: ${origin}/storybook/?path=/docs/${page.docsId}`);
    lines.push("");
  }
  return lines.join("\n");
}
