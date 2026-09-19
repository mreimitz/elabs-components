/**
 * The home page's gallery sections (server components): charts, packages, blocks. Each reads
 * its counts and lists from `content/generated/*.json` through `lib/content.ts` and hands the
 * client grids only what they render.
 */
import { Badge, Button, SectionHeader, ThemeSwitcher } from "@elabs-ai/components-ui";
import { EntryGrid } from "../catalog/entry-grid";
import { StoryFrame } from "../catalog/story-frame";
import { entriesOf } from "../../lib/catalog";
import { catalogCopy, tourCopy } from "../../content/copy";
import { ComponentWall } from "./component-wall";
import { HeroDials } from "../hero/hero-dials";
import { blocks, countFor, packages } from "../../lib/content";
import { chartDetailLinks, titleCase } from "../../lib/gallery-links";
import { galleryCopy } from "../../content/copy";
import { CHART_TILE_COMPONENTS } from "./chart-tile-meta";
import { FeaturedCharts, BlockExamples } from "./gallery-clients";

const copy = galleryCopy.sections;
const SECTION = "mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16";

export function ChartsSection() {
  return (
    <section id="charts" aria-labelledby="charts-title" className={SECTION}>
      <SectionHeader
        title={<span id="charts-title">{copy.charts.title}</span>}
        description={copy.charts.description}
        actions={
          <Button asChild variant="outline">
            <a href="/charts">{catalogCopy.home.charts.all}</a>
          </Button>
        }
      />
      <FeaturedCharts links={chartDetailLinks(CHART_TILE_COMPONENTS)} />
    </section>
  );
}

export function PackagesSection() {
  const sorted = [...packages].sort((a, b) => b.exportCount - a.exportCount);
  return (
    <section id="packages" aria-labelledby="components-title" className={SECTION}>
      <SectionHeader
        title={<span id="components-title">{galleryCopy.components.packages}</span>}
        actions={
          <Button asChild variant="outline">
            <a href="/components">{copy.components.all(countFor("componentExports").value)}</a>
          </Button>
        }
      />
      <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        {sorted.map((pkg) => (
          <li key={pkg.name} className="border-t border-border">
            <a
              href={`/components/${pkg.shortName}`}
              className="group flex items-baseline gap-4 rounded-sm py-4 focus-ring"
            >
              <span className="w-24 shrink-0 text-subtitle font-semibold group-hover:underline">
                {pkg.shortName}
              </span>
              <span className="min-w-0 flex-1 text-body text-muted-foreground">
                {pkg.description}
              </span>
              <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
                {galleryCopy.components.exports(pkg.exportCount)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BlocksSection() {
  const categories = new Map<string, number>();
  for (const block of blocks) {
    for (const category of block.categories) {
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
  }
  const ordered = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <section id="blocks" aria-labelledby="blocks-title" className={SECTION}>
      <SectionHeader
        title={<span id="blocks-title">{copy.blocks.title}</span>}
        description={copy.blocks.description}
        actions={
          <Button asChild variant="outline">
            <a href="/blocks">{catalogCopy.home.blocks.all}</a>
          </Button>
        }
      />
      <ul className="flex flex-wrap gap-2" aria-label={copy.blocks.count(blocks.length)}>
        {ordered.map(([category, count]) => (
          <li key={category}>
            <Badge variant="outline" className="gap-2">
              {titleCase(category)}
              <span className="text-muted-foreground tabular-nums">{count}</span>
            </Badge>
          </li>
        ))}
      </ul>
      <BlockExamples />
    </section>
  );
}

const USE_CASES = tourCopy.tabs as Record<string, { useCase: string } | undefined>;
const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text;

/** "What are you building?" — every template as a live thumbnail with the use case it serves. */
export function UseCasesSection() {
  const entries = entriesOf("templates").map((entry) => ({
    ...entry,
    summary: USE_CASES[entry.slug]?.useCase ?? firstSentence(entry.summary),
  }));
  // The archetypes a playbook exists for lead; the remaining templates follow.
  const lead = entries.filter((e) => USE_CASES[e.slug]);
  const rest = entries.filter((e) => !USE_CASES[e.slug]);
  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className={SECTION}>
      <SectionHeader
        title={<span id="use-cases-title">{catalogCopy.home.building}</span>}
        description={catalogCopy.home.buildingLead}
        actions={
          <Button asChild variant="outline">
            <a href="/templates">{catalogCopy.index.count(entries.length)}</a>
          </Button>
        }
      />
      <EntryGrid entries={[...lead, ...rest]} thumbWidth={1440} />
    </section>
  );
}

/** The component wall with the theme control above it. */
export function WallSection() {
  return (
    <section id="examples" aria-labelledby="examples-title" className={SECTION}>
      <SectionHeader
        title={<span id="examples-title">{copy.components.title}</span>}
        description={copy.components.description}
        actions={
          <Button asChild variant="outline">
            <a href="/components">{catalogCopy.home.components.all}</a>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-muted-foreground">{galleryCopy.wall.themeCaption}</p>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <HeroDials />
        </div>
      </div>
      <ComponentWall />
    </section>
  );
}

/** Maps: two live map stories and the way into the package. */
export function MapsSection() {
  const maps = entriesOf("components", "maps");
  const pick = (slug: string) => maps.find((e) => e.slug === slug);
  const shown = [pick("maparc"), pick("mapclusterlayer")].filter((e): e is NonNullable<typeof e> =>
    Boolean(e?.first),
  );
  return (
    <section id="maps" aria-labelledby="maps-title" className={SECTION}>
      <SectionHeader
        title={<span id="maps-title">{catalogCopy.home.maps.title}</span>}
        description={catalogCopy.home.maps.lead}
        actions={
          <Button asChild variant="outline">
            <a href="/components/maps">{catalogCopy.home.maps.all}</a>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((entry) => (
          <div key={entry.slug} className="flex flex-col gap-2">
            <StoryFrame
              id={entry.first!}
              name={entry.name}
              size="tall"
              detail={{
                pageName: entry.name,
                summary: entry.summary || undefined,
                labels: [entry.group, entry.package],
                links: [
                  {
                    label: catalogCopy.frame.page(entry.name),
                    href: `/components/maps/${entry.slug}`,
                  },
                ],
              }}
            />
            <a
              href={`/components/maps/${entry.slug}`}
              className="self-start rounded-sm text-body font-medium hover:underline focus-ring"
            >
              {entry.name}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
