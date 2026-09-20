import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "../../../../../components/catalog/doc-page";
import { catalogPage, entriesOf } from "../../../../../lib/catalog";
import { catalogCopy } from "../../../../../content/copy";

type Params = { pkg: string; slug: string };

/** Groups whose stories fill a viewport (shells, canvases, maps) get a working-size stage. */
const TALL_GROUPS = new Set([
  "Layout",
  "Flow",
  "Maps",
  "Editor",
  "Terminal",
  "Process",
  "Viewer",
  "Dashboard",
]);

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
  return (
    <DocPage
      page={page}
      frameSize={TALL_GROUPS.has(page.group) ? "tall" : "auto"}
      trail={[
        { href: "/components", label: catalogCopy.sections.components },
        { href: `/components/${pkg}`, label: pkg },
      ]}
    />
  );
}
