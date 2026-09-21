import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandChip } from "@elabs-ai/components-ui";
import { BranchIndex } from "../../../../components/catalog/listing";
import { entriesOf } from "../../../../lib/catalog";
import { packages } from "../../../../lib/content";
import { catalogCopy, chartFamilyCopy, heroCopy } from "../../../../content/copy";
import { hasCategoryArt } from "../../../../components/art/category-art";

type Params = { pkg: string };

export function generateStaticParams(): Params[] {
  return Array.from(new Set(entriesOf("components").map((e) => e.package))).map((pkg) => ({ pkg }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { pkg } = await params;
  const info = packages.find((p) => p.shortName === pkg);
  return {
    title: info?.name ?? pkg,
    description: info?.description,
    alternates: { canonical: `/components/${pkg}` },
  };
}

export default async function PackagePage({ params }: { params: Promise<Params> }) {
  const { pkg } = await params;
  const entries = entriesOf("components", pkg);
  if (entries.length === 0) notFound();
  const info = packages.find((p) => p.shortName === pkg);
  const chip = heroCopy.chip;
  return (
    <BranchIndex
      section="components"
      pkg={pkg}
      title={info?.name ?? pkg}
      lead={info?.description ?? catalogCopy.sectionLead.components}
      art={hasCategoryArt(pkg) ? pkg : undefined}
      entries={entries}
      familyCopy={pkg === "charts" ? chartFamilyCopy : undefined}
      header={
        info ? (
          <CommandChip
            aria-label={catalogCopy.detail.install}
            hosts={[
              { id: "pnpm", label: catalogCopy.detail.install, command: `pnpm add ${info.name}` },
            ]}
            labels={{
              copy: chip.copy,
              copied: chip.copied,
              selectFallback: chip.selectFallback,
              chooseHost: catalogCopy.detail.install,
              menuLabel: catalogCopy.detail.install,
            }}
            className="max-w-xl"
          />
        ) : null
      }
    />
  );
}
