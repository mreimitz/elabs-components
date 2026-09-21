import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "../../../../components/catalog/doc-page";
import { isNativeBlock } from "../../../../components/catalog/block-render-meta";
import { catalogPage, entriesOf } from "../../../../lib/catalog";
import { catalogCopy } from "../../../../content/copy";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return entriesOf("visualizations").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = catalogPage("visualizations", slug);
  return {
    title: page?.name,
    description: page?.summary || undefined,
    alternates: { canonical: `/visualizations/${slug}` },
  };
}

export default async function VisualizationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = catalogPage("visualizations", slug);
  if (!page) notFound();
  const native = page.block?.name;
  return (
    <DocPage
      page={page}
      trail={[{ href: "/visualizations", label: catalogCopy.sections.visualizations }]}
      // A dashboard sheet fills a viewport; its stage gets a working size.
      frameSize={page.group === "Dashboard Recipes" ? "tall" : "auto"}
      nativeBlock={isNativeBlock(native) ? native : undefined}
      wide={isNativeBlock(native)}
    />
  );
}
