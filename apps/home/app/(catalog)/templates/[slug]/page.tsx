import { isNativeBlock } from "../../../../components/catalog/block-render-meta";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, CommandChip } from "@elabs-ai/components-ui";
import { DocPage } from "../../../../components/catalog/doc-page";
import { catalogPage, entriesOf } from "../../../../lib/catalog";
import { install, playbooks } from "../../../../lib/content";
import { catalogCopy, heroCopy, tourCopy } from "../../../../content/copy";
import { newProjectPrompt } from "../../../../content/prompts";
import { PromptCard } from "../../../../components/start/prompt-card";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return entriesOf("templates").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = catalogPage("templates", slug);
  return {
    title: page?.name,
    description: page?.template?.description,
    alternates: { canonical: `/templates/${slug}` },
  };
}

const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text;
const CLI_PACKAGE = install.cli.split(" ").at(-1) ?? "";

export default async function TemplatePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = catalogPage("templates", slug);
  if (!page) notFound();
  const playbook = playbooks.find((p) => p.archetype === slug);
  const useCase = (tourCopy.tabs as Record<string, { useCase: string } | undefined>)[slug]?.useCase;
  const scaffoldable = install.create.templates.includes(slug);
  const chip = heroCopy.chip;
  const labels = (label: string) => ({
    copy: chip.copy,
    copied: chip.copied,
    selectFallback: chip.selectFallback,
    chooseHost: label,
    menuLabel: label,
  });
  return (
    <DocPage
      page={page}
      frameSize="screen"
      wide
      nativeBlock={isNativeBlock(page.block?.name) ? page.block.name : undefined}
      lead={
        useCase ??
        playbook?.intent ??
        (firstSentence(page.template?.description ?? "") || undefined)
      }
      useFor={[playbook?.intent].filter((line): line is string => Boolean(line))}
      trail={[{ href: "/templates", label: catalogCopy.sections.templates }]}
    >
      {page.template?.packages.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta font-semibold text-muted-foreground">
            {catalogCopy.detail.packages}
          </span>
          {page.template.packages.map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
        </div>
      ) : null}
      {playbook ? (
        <div className="flex flex-col gap-3">
          {scaffoldable ? (
            <CommandChip
              aria-label={catalogCopy.detail.scaffold}
              hosts={[
                {
                  id: "scaffold",
                  label: catalogCopy.detail.scaffold,
                  command: `npx -y ${CLI_PACKAGE} create my-${slug} --template ${slug}`,
                },
              ]}
              labels={labels(catalogCopy.detail.scaffold)}
              className="w-full"
            />
          ) : null}
          <PromptCard
            compact
            prompt={
              scaffoldable
                ? newProjectPrompt({ template: slug, description: useCase })
                : tourCopy.prompt({
                    mcpUrl: install.hostedMcp.url,
                    archetype: slug,
                    intent: playbook.intent,
                    useCase: useCase ?? playbook.intent,
                  })
            }
          />
        </div>
      ) : null}
    </DocPage>
  );
}
