import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "../../../../../components/catalog/doc-page";
import { catalogPage, entriesOf } from "../../../../../lib/catalog";
import { ChartHero } from "../../../../../components/gallery/gallery-clients";
import { CHART_TILE_META } from "../../../../../components/gallery/chart-tile-meta";
import { catalogCopy, galleryCopy } from "../../../../../content/copy";

type Params = { pkg: string; slug: string };

/** Packages whose stories fill a viewport (canvases, maps, editors) get a working-size stage… */
const TALL_PACKAGES = new Set(["flow", "maps", "editor", "terminal", "process", "viewer"]);
/** …and so do these families of otherwise ordinary packages. */
const TALL_FAMILIES = new Set(["ui/Layout", "charts/Dashboard"]);

export function generateStaticParams(): Params[] {
  return entriesOf("components").map((e) => ({ pkg: e.package, slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { pkg, slug } = await params;
  const page = catalogPage("components", slug, pkg);
  return {
    title: page?.name,
    description: page?.summary || undefined,
    alternates: { canonical: `/components/${pkg}/${slug}` },
  };
}

export default async function ComponentPage({ params }: { params: Promise<Params> }) {
  const { pkg, slug } = await params;
  const page = catalogPage("components", slug, pkg);
  if (!page) notFound();
  // A chart type with a gallery tile gets that tile's native render as its hero, and the
  // question(s) it answers as its first "use it for" lines.
  const tiles =
    pkg === "charts" ? CHART_TILE_META.filter((t) => t.component === page.component) : [];
  const useFor = tiles.map(
    (t) => `${catalogCopy.charts.questions[t.group]} ${galleryCopy.charts.tiles[t.id].shape}.`,
  );
  const tall = TALL_PACKAGES.has(pkg) || TALL_FAMILIES.has(`${pkg}/${page.group}`);
  return (
    <DocPage
      page={page}
      frameSize={tall ? "tall" : "auto"}
      hero={tiles[0] ? <ChartHero id={tiles[0].id} /> : undefined}
      useFor={useFor}
      trail={[
        { href: "/components", label: catalogCopy.sections.components },
        { href: `/components/${pkg}`, label: pkg },
      ]}
    />
  );
}
