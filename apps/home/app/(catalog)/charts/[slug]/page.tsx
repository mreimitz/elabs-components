import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "../../../../components/catalog/doc-page";
import { ChartHero } from "../../../../components/gallery/gallery-clients";
import { CHART_TILE_META } from "../../../../components/gallery/chart-tile-meta";
import { catalogPage, entriesOf } from "../../../../lib/catalog";
import { catalogCopy, galleryCopy } from "../../../../content/copy";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return entriesOf("charts").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = catalogPage("charts", slug);
  return {
    title: page?.name,
    description: page?.summary || undefined,
    alternates: { canonical: `/charts/${slug}` },
  };
}

export default async function ChartPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = catalogPage("charts", slug);
  if (!page) notFound();
  // A chart type with a gallery tile gets that tile's native render as its hero, and the
  // question(s) it answers as its first "use it for" lines.
  const tiles = CHART_TILE_META.filter((t) => t.component === page.component);
  const useFor = tiles.map(
    (t) => `${catalogCopy.charts.questions[t.group]} ${galleryCopy.charts.tiles[t.id].shape}.`,
  );
  return (
    <DocPage
      page={page}
      hero={tiles[0] ? <ChartHero id={tiles[0].id} /> : undefined}
      useFor={useFor}
      trail={[{ href: "/charts", label: catalogCopy.sections.charts }]}
    />
  );
}
