/**
 * A template's page is a PRODUCT page (review 2026-09-23, RM-147): the live screen, the scenario
 * (who sits in front of it, what happens), the hand-off above the fold — the one command that
 * copies the template in and the prompt an agent pastes, which names the blocks — then the tour of
 * the views the navigation names and what the template is made of, generated from the registry
 * item's own dependencies. Starters (the CLI archetypes) keep their scaffold command instead.
 */
import { isNativeBlock } from "../../../../components/catalog/block-render-meta";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandChip } from "@elabs-ai/components-ui";
import { Copyable, DocPage } from "../../../../components/catalog/doc-page";
import { TemplateStory, templateParts } from "../../../../components/catalog/template-story";
import { catalogPage, entriesOf } from "../../../../lib/catalog";
import { install, playbooks } from "../../../../lib/content";
import { catalogCopy, heroCopy, tourCopy } from "../../../../content/copy";
import { startCopy } from "../../../../content/start-copy";
import { newProjectPrompt, templatePrompt } from "../../../../content/prompts";
import { tourOf } from "../../../../content/template-tours";
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
    description: tourOf(slug)?.scenario ?? page?.template?.description,
    alternates: { canonical: `/templates/${slug}` },
  };
}

const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text;
const CLI_PACKAGE = install.cli.split(" ").at(-1) ?? "";

export default async function TemplatePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = catalogPage("templates", slug);
  if (!page) notFound();
  const tour = tourOf(slug);
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
  const lead =
    tour?.scenario ??
    useCase ??
    playbook?.intent ??
    (firstSentence(page.template?.description ?? "") || undefined);

  // The hand-off. A registry template: the copy command + a prompt that names its blocks. A
  // starter: the scaffold command + the new-project prompt. A story-only template: the
  // archetype prompt, so no template page is without a route for an agent.
  let handoff: ReactNode = null;
  if (page.block) {
    const { blocks, packages } = templateParts(page);
    const installLine = `npx shadcn@latest add ${install.registryHomepage}/${page.block.name}.json`;
    handoff = (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Copyable label={catalogCopy.detail.install} command={installLine} />
          <p className="text-meta text-muted-foreground">
            {startCopy.wiring.lead}{" "}
            <a className="underline underline-offset-2 focus-ring" href="/start#wiring">
              {startCopy.wiring.title}
            </a>
          </p>
        </div>
        <PromptCard
          compact
          prompt={templatePrompt({
            name: page.block.name,
            title: page.name,
            scenario: tour?.scenario,
            blocks: blocks.map((b) => b.name),
            packages: packages.map((p) => p.name),
          })}
        />
      </div>
    );
  } else if (scaffoldable) {
    handoff = (
      <div className="grid gap-4 lg:grid-cols-2">
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
          className="w-full self-start"
        />
        <PromptCard compact prompt={newProjectPrompt({ template: slug, description: useCase })} />
      </div>
    );
  } else {
    const intent = playbook?.intent ?? useCase ?? lead;
    if (intent) {
      handoff = (
        <PromptCard
          compact
          prompt={tourCopy.prompt({
            mcpUrl: install.hostedMcp.url,
            archetype: slug,
            intent,
            useCase: useCase ?? intent,
          })}
        />
      );
    }
  }

  return (
    <DocPage
      page={page}
      frameSize="screen"
      wide
      nativeBlock={isNativeBlock(page.block?.name) ? page.block.name : undefined}
      lead={lead}
      useFor={[playbook?.intent].filter((line): line is string => Boolean(line))}
      trail={[{ href: "/templates", label: catalogCopy.sections.templates }]}
      showCommands={false}
      showDependencies={false}
    >
      <TemplateStory page={page} tour={tour} handoff={handoff} />
    </DocPage>
  );
}
