import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandChip } from "@elabs-ai/components-ui";
import { EntryGrid, GroupHeading, IndexHeader } from "../../../../components/catalog/entry-grid";
import { entriesOf, grouped } from "../../../../lib/catalog";
import { packages } from "../../../../lib/content";
import { catalogCopy, heroCopy } from "../../../../content/copy";

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
      <IndexHeader
        title={info?.name ?? pkg}
        lead={info?.description ?? catalogCopy.sectionLead.components}
        count={entries.length}
      />
      {info ? (
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
      ) : null}
      {grouped(entries).map(([group, list]) => (
        <section key={group} className="flex flex-col gap-5">
          <GroupHeading id={group.toLowerCase()} label={group} count={list.length} />
          <EntryGrid entries={list} />
        </section>
      ))}
    </div>
  );
}
