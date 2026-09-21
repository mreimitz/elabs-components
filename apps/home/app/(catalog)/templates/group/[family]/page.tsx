import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyIndex, familiesOf, familyBySlug } from "../../../../../components/catalog/listing";
import { familySlug } from "../../../../../lib/catalog-index";
import { templateEntries } from "../../../../../lib/template-entries";
import { templateFamilyCopy } from "../../../../../content/copy";

type Params = { family: string };

export function generateStaticParams(): Params[] {
  return familiesOf(templateEntries(), "templates").map(([label]) => ({
    family: familySlug(label),
  }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { family } = await params;
  const found = familyBySlug(templateEntries(), family);
  return {
    title: found?.label,
    description: found ? templateFamilyCopy[found.label] : undefined,
    alternates: { canonical: `/templates/group/${family}` },
  };
}

export default async function TemplateFamilyPage({ params }: { params: Promise<Params> }) {
  const { family } = await params;
  const found = familyBySlug(templateEntries(), family);
  if (!found) notFound();
  return (
    <FamilyIndex
      family={found.label}
      lead={templateFamilyCopy[found.label]}
      art="templates"
      entries={found.entries}
      // Starters are plain archetypes and read fine three across; a use-case template is a
      // whole product and gets the wide card.
      columns={found.label === "Starters" ? "default" : "wide"}
      thumbWidth={1440}
    />
  );
}
