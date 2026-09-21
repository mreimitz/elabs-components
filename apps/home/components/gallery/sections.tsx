/**
 * The home page's gallery sections (server components): charts, packages, blocks. Each reads
 * its counts and lists from `content/generated/*.json` through `lib/content.ts` and hands the
 * client grids only what they render.
 */
import { Button, SectionHeader, ThemeSwitcher } from "@elabs-ai/components-ui";
import { EntryGrid } from "../catalog/entry-grid";
import { BlockHero } from "../catalog/block-renders";
import { isNativeBlock } from "../catalog/block-render-meta";
import { BLOCK_FAMILY_ORDER, VISUALIZATION_FAMILY_ORDER } from "../catalog/nav-model";
import { StoryFrame } from "../catalog/story-frame";
import { entriesOf, grouped } from "../../lib/catalog";
import { familyHref, hrefOf } from "../../lib/catalog-index";
import { catalogCopy, templatePitch, tourCopy } from "../../content/copy";
import { TemplateShowcase } from "./template-showcase";
import { ComponentWall } from "./component-wall";
import { HeroDials } from "../hero/hero-dials";
import { countFor, packages } from "../../lib/content";
import { chartDetailLinks } from "../../lib/gallery-links";
import { galleryCopy } from "../../content/copy";
import { CHART_TILE_COMPONENTS } from "./chart-tile-meta";
import { FeaturedCharts } from "./gallery-clients";
import { SectionIndex } from "../section-index";

const copy = galleryCopy.sections;
const SECTION = "mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16";

export function ChartsSection() {
  return (
    <section id="charts" aria-labelledby="charts-title" className={SECTION}>
      <SectionHeader
        size="lg"
        eyebrow={<SectionIndex label="Charts" />}
        title={<span id="charts-title">{copy.charts.title}</span>}
        description={copy.charts.description}
        actions={
          <Button asChild variant="outline">
            <a href="/components/charts">{catalogCopy.home.charts.all}</a>
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
        size="lg"
        eyebrow={<SectionIndex label="Packages" />}
        title={<span id="components-title">{galleryCopy.components.packages}</span>}
        actions={
          <Button asChild variant="outline">
            <a href="/components">{copy.components.all(countFor("componentExports").value)}</a>
          </Button>
        }
      />
      <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        {sorted.map((pkg) => (
          <li key={pkg.name} className="border-t border-dashed border-rule-strong">
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

/** The blocks the home page leads with: one at working size, the rest as linked cards. */
const FEATURED_BLOCK = "command-center-live-ops-01";
const SHOWN_BLOCKS = [
  "command-center-revenue-01",
  "geo-network-map-01",
  "infographic-journey-flow-01",
  "agent-run-review-01",
  "geo-fleet-tracker-01",
  "command-center-market-tape-01",
];

export function BlocksSection() {
  // Every registry block: the data-viz families the site files under Visualizations, then the
  // application blocks.
  const all = [...entriesOf("visualizations"), ...entriesOf("blocks")];
  const families = grouped(all, [...VISUALIZATION_FAMILY_ORDER, ...BLOCK_FAMILY_ORDER]);
  const featured = all.find((entry) => entry.block === FEATURED_BLOCK);
  const shown = SHOWN_BLOCKS.map((name) => all.find((entry) => entry.block === name)).filter(
    (entry): entry is NonNullable<typeof entry> => Boolean(entry),
  );
  return (
    <section id="blocks" aria-labelledby="blocks-title" className={SECTION}>
      <SectionHeader
        size="lg"
        eyebrow={<SectionIndex label="Blocks" />}
        title={<span id="blocks-title">{copy.blocks.title}</span>}
        description={copy.blocks.description}
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/visualizations">{catalogCopy.home.visualizations.all}</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/blocks">{catalogCopy.home.blocks.all}</a>
            </Button>
          </>
        }
      />
      <ul className="flex flex-wrap gap-2" aria-label={copy.blocks.count(all.length)}>
        {families.map(([family, list]) => (
          <li key={family}>
            <a
              href={familyHref(list[0] as (typeof list)[number])}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-meta font-medium text-card-foreground hover:bg-accent focus-ring"
            >
              {family}
              <span className="text-muted-foreground tabular-nums">{list.length}</span>
            </a>
          </li>
        ))}
      </ul>
      {featured && isNativeBlock(featured.block) ? (
        <figure className="flex flex-col gap-3">
          {/* The featured block sits on a faded hatch WELL rather than a grey slab. The page's
              rails already frame the column, so the well keeps a plain hairline edge. */}
          <div className="rounded-lg border border-border bg-hairline-hatch p-4">
            <BlockHero name={featured.block} />
          </div>
          <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body">
            <a
              href={hrefOf(featured)}
              className="rounded-sm font-medium hover:underline focus-ring"
            >
              {featured.group} · {featured.name}
            </a>
            <span className="text-muted-foreground">{featured.question}</span>
          </figcaption>
        </figure>
      ) : null}
      <EntryGrid entries={shown} />
    </section>
  );
}

const USE_CASES = tourCopy.tabs as Record<string, { useCase: string } | undefined>;
const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text;

/** The template the home page shows at reading size; the rest follow as tighter crops. */
const FEATURED_TEMPLATE = "agentic-ai-workspace";
const HOME_TEMPLATES = [
  "revenue-operations",
  "logistics-control-tower",
  "customer-360",
  "support-desk",
  "incident-command",
];

/** "What are you building?" — one template at reading size, five more as crops, each with
 *  the use case it serves in a line. */
export function UseCasesSection() {
  const entries = entriesOf("templates").map((entry) => ({
    ...entry,
    summary:
      templatePitch[entry.slug] ?? USE_CASES[entry.slug]?.useCase ?? firstSentence(entry.summary),
  }));
  // The use-case templates lead — whole products built from the blocks — in this order.
  const shown = HOME_TEMPLATES.map((slug) => entries.find((e) => e.slug === slug)).filter(
    (e): e is NonNullable<typeof e> => Boolean(e),
  );
  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className={SECTION}>
      <SectionHeader
        size="lg"
        eyebrow={<SectionIndex label="Templates" />}
        title={<span id="use-cases-title">{catalogCopy.home.building}</span>}
        description={catalogCopy.home.buildingLead}
        actions={
          <Button asChild variant="outline">
            <a href="/templates">{catalogCopy.index.count(entries.length)}</a>
          </Button>
        }
      />
      <TemplateShowcase
        featured={entries.find((e) => e.slug === FEATURED_TEMPLATE)}
        entries={shown}
      />
    </section>
  );
}

/** The component wall with the theme control above it. */
export function WallSection() {
  return (
    <section id="examples" aria-labelledby="examples-title" className={SECTION}>
      <SectionHeader
        size="lg"
        eyebrow={<SectionIndex label="Components" />}
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
        size="lg"
        eyebrow={<SectionIndex label="Maps" />}
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
