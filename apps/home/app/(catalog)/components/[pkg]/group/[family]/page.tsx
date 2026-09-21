import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FamilyIndex,
  familiesOf,
  familyBySlug,
} from "../../../../../../components/catalog/listing";
import { hasCategoryArt } from "../../../../../../components/art/category-art";
import { entriesOf } from "../../../../../../lib/catalog";
import { familySlug } from "../../../../../../lib/catalog-index";
import { chartFamilyCopy } from "../../../../../../content/copy";

type Params = { pkg: string; family: string };

export function generateStaticParams(): Params[] {
  const pkgs = Array.from(new Set(entriesOf("components").map((e) => e.package)));
  return pkgs.flatMap((pkg) =>
    familiesOf(entriesOf("components", pkg), "components", pkg).map(([label]) => ({
      pkg,
      family: familySlug(label),
    })),
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { pkg, family } = await params;
  const found = familyBySlug(entriesOf("components", pkg), family);
  return {
    title: found ? `${found.label} · ${pkg}` : undefined,
    alternates: { canonical: `/components/${pkg}/group/${family}` },
  };
}

export default async function ComponentFamilyPage({ params }: { params: Promise<Params> }) {
  const { pkg, family } = await params;
  const found = familyBySlug(entriesOf("components", pkg), family);
  if (!found) notFound();
  return (
    <FamilyIndex
      family={found.label}
      lead={pkg === "charts" ? chartFamilyCopy[found.label] : undefined}
      art={hasCategoryArt(pkg) ? pkg : undefined}
      entries={found.entries}
    />
  );
}
