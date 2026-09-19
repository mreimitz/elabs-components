import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "../../../../components/catalog/doc-page";
import { catalogPage, entriesOf } from "../../../../lib/catalog";
import { catalogCopy } from "../../../../content/copy";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return entriesOf("blocks").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = catalogPage("blocks", slug);
  return {
    title: page?.name,
    description: page?.summary || undefined,
    alternates: { canonical: `/blocks/${slug}` },
  };
}

export default async function BlockPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = catalogPage("blocks", slug);
  if (!page) notFound();
  return <DocPage page={page} trail={[{ href: "/blocks", label: catalogCopy.sections.blocks }]} />;
}
