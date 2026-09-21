import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyIndex, familiesOf, familyBySlug } from "../../../../../components/catalog/listing";
import { entriesOf } from "../../../../../lib/catalog";
import { familySlug } from "../../../../../lib/catalog-index";
import { blockFamilyCopy } from "../../../../../content/copy";

type Params = { family: string };

export function generateStaticParams(): Params[] {
  return familiesOf(entriesOf("visualizations"), "visualizations").map(([label]) => ({
    family: familySlug(label),
  }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { family } = await params;
  const found = familyBySlug(entriesOf("visualizations"), family);
  return {
    title: found?.label,
    description: found ? blockFamilyCopy[found.label] : undefined,
    alternates: { canonical: `/visualizations/group/${family}` },
  };
}

export default async function FamilyPage({ params }: { params: Promise<Params> }) {
  const { family } = await params;
  const found = familyBySlug(entriesOf("visualizations"), family);
  if (!found) notFound();
  return (
    <FamilyIndex
      family={found.label}
      lead={blockFamilyCopy[found.label]}
      art="charts"
      entries={found.entries}
      thumbWidth={960}
    />
  );
}
