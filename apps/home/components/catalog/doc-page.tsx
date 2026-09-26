/**
 * DocPage — the detail page for one catalogue record (a component, a chart, a block, a
 * template), rendered entirely from generated data: what it is for, when to use it and when not
 * to, what it works with, every example live, and its API. Server component; the previews and
 * the copy buttons are the client islands.
 */
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  CommandChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { entryForComponent, hrefOf, type CatalogApi, type CatalogPage } from "../../lib/catalog";
import { install } from "../../lib/content";
import { catalogCopy, heroCopy } from "../../content/copy";
import { startCopy } from "../../content/start-copy";
import { blockPrompt, componentPrompt, packageInstall } from "../../content/prompts";
import { CommandLine } from "../start/command-line";
import { PromptCard } from "../start/prompt-card";
import { BlockHero } from "./block-renders";
import type { NativeBlockName } from "./block-render-meta";
import {
  LiveExample,
  LiveExamplesCount,
  LiveSection,
  MissingExamples,
  StorybookUnreachable,
} from "./story-availability";
import { StoryFrame, type StoryFrameSize } from "./story-frame";
import type { StoryExpandDetail } from "./story-expand";
import { Band } from "../band";
import { PageBand } from "../page-band";

const copy = catalogCopy.detail;
const REPO = "https://github.com/mreimitz/elabs-components";

/**
 * The import line shown to the visitor. The keyword is assembled rather than spelled, because the
 * home-imports rule reads any `from "<specifier>"` in this app as a real import.
 */
const FROM = ["fr", "om"].join("");
const importSnippet = (name: string, specifier: string) =>
  `import { ${name} } ${FROM} ${JSON.stringify(specifier)};`;

const anchor = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function Copyable({ label, command }: { label: string; command: string }) {
  return (
    <CommandChip
      aria-label={label}
      hosts={[{ id: "cmd", label, command }]}
      labels={{
        copy: heroCopy.chip.copy,
        copied: heroCopy.chip.copied,
        selectFallback: heroCopy.chip.selectFallback,
        chooseHost: label,
        menuLabel: label,
      }}
      className="w-full"
    />
  );
}

function ComponentLinks({ label, names }: { label: string; names?: string[] }) {
  if (!names?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-meta font-semibold text-muted-foreground">{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => {
          const entry = entryForComponent(name);
          return (
            <li key={name}>
              {entry ? (
                <Button asChild variant="outline" size="sm">
                  <a href={hrefOf(entry)}>{name}</a>
                </Button>
              ) : (
                <Badge variant="secondary">{name}</Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ApiBlock({ api }: { api: CatalogApi }) {
  const variants = Object.entries(api.variants ?? {});
  return (
    <div className="flex flex-col gap-4">
      <h3 id={`api-${anchor(api.name)}`} className="scroll-mt-24 text-subtitle font-semibold">
        <code>{api.name}</code>
      </h3>
      {variants.length > 0 ? (
        <dl className="flex flex-col gap-3">
          {variants.map(([prop, values]) => (
            <div key={prop} className="flex flex-wrap items-baseline gap-2">
              <dt className="w-28 shrink-0 text-meta font-medium">
                <code>{prop}</code>
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {values.map((value) => (
                  <Badge
                    key={value}
                    variant={api.defaultVariants?.[prop] === value ? "default" : "outline"}
                  >
                    {value}
                    {api.defaultVariants?.[prop] === value ? (
                      <span className="sr-only"> ({copy.defaultValue})</span>
                    ) : null}
                  </Badge>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {api.props.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.prop}</TableHead>
                <TableHead>{copy.type}</TableHead>
                <TableHead>{copy.description}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {api.props.map((prop) => (
                <TableRow key={prop.name}>
                  <TableCell className="align-top whitespace-nowrap">
                    <code className="text-code">{prop.name}</code>
                    {prop.optional ? null : (
                      <span className="ms-2 text-caption text-muted-foreground">
                        {copy.required}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 align-top">
                    <code className="text-code break-words text-muted-foreground">{prop.type}</code>
                  </TableCell>
                  <TableCell className="min-w-64 align-top text-body whitespace-normal text-muted-foreground">
                    {prop.description ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {api.extends.length > 0 ? (
        <p className="text-meta text-muted-foreground">
          {copy.extends}: <code className="text-code">{api.extends.join(", ")}</code>
        </p>
      ) : null}
    </div>
  );
}

export interface DocPageProps {
  page: CatalogPage;
  /** Kept for callers; the shell's top bar renders the trail from the route. */
  trail?: { href: string; label: string }[];
  /** A native render shown instead of the first story (chart pages). */
  hero?: ReactNode;
  /** A registry block the site renders from its own copy — the lead example, with enlarge. */
  nativeBlock?: NativeBlockName;
  /** Extra "use it for" lines authored for this page (chart shapes). */
  useFor?: string[];
  frameSize?: StoryFrameSize;
  /** The opening sentence, when the generated summary is not written for a visitor. */
  lead?: string;
  /** Full-screen subjects (templates): no "on this page" rail, a wider column. */
  wide?: boolean;
  /** Extra blocks rendered under the overview (template scaffold, block install). */
  children?: ReactNode;
  /**
   * Product pages (templates) own their hand-off and their "made of" list, so they turn the
   * generic install chips and the dependency badges off.
   */
  showCommands?: boolean;
  showDependencies?: boolean;
}

export function DocPage({
  page,
  hero: heroProp,
  nativeBlock,
  useFor = [],
  frameSize = "auto",
  lead: leadOverride,
  wide = false,
  children,
  showCommands = true,
  showDependencies = true,
}: DocPageProps) {
  const intent = page.intent;
  const rel = intent?.relationships ?? {};
  const uses = [...useFor, ...(intent?.dataShapes ?? [])];
  const avoid = [...(intent?.avoidWhen ? [intent.avoidWhen] : []), ...(intent?.antiPatterns ?? [])];
  const tokens = Object.entries(intent?.stateTokens ?? {});
  const [first, ...rest] = page.stories;
  // A native block IS the first story rendered on the site, so the examples list starts after
  // it; a chart's native hero is a different render, so every story stays.
  const examples = heroProp ? page.stories : rest;
  const importLine =
    page.component && page.importFrom ? importSnippet(page.component, page.importFrom) : null;
  const installLine = page.block
    ? `npx shadcn@latest add ${install.registryHomepage}/${page.block.name}.json`
    : null;
  // The package to install: the import specifier without any subpath.
  const pkg = page.importFrom ? page.importFrom.split("/").slice(0, 2).join("/") : null;
  const pkgInstall = page.component && pkg ? packageInstall(pkg) : null;
  // One prompt per page, from the same source as `/start` (`content/prompts.ts`). Template
  // pages bring their own (the scaffold prompt) through `children`.
  const agentPrompt = page.block
    ? blockPrompt({ name: page.block.name, title: page.name })
    : page.component && pkg
      ? componentPrompt({
          name: page.component,
          pkg,
          kind: page.title.startsWith("Charts/") ? "chart" : "component",
        })
      : null;
  const showAgentRoute = Boolean(agentPrompt) && page.section !== "templates";
  // What the enlarge dialog's detail pane shows for every example on this page.
  const expandDetail: StoryExpandDetail = {
    pageName: page.name,
    summary: leadOverride || page.summary || undefined,
    labels: [page.group, page.package],
    commands: [
      ...(installLine ? [{ label: copy.install, command: installLine }] : []),
      ...(importLine ? [{ label: copy.import, command: importLine }] : []),
    ],
    links: [
      { label: catalogCopy.frame.docs, href: `/storybook/?path=/docs/${page.docsId}` },
      { label: catalogCopy.frame.source, href: `${REPO}/blob/main/${page.file}` },
    ],
    stories: page.stories,
  };
  const hero = nativeBlock ? (
    <BlockHero
      name={nativeBlock}
      detail={{
        pageName: page.name,
        question: page.question || undefined,
        summary: expandDetail.summary,
        labels: expandDetail.labels,
        commands: expandDetail.commands,
        links: expandDetail.links,
      }}
    />
  ) : (
    heroProp
  );
  const lead = leadOverride || page.summary || page.template?.description || page.about;

  return (
    <>
      {/* The title block is the page's header band (full-bleed); the article and its "on this
          page" rail start under it, in the same column. */}
      <PageBand width={wide ? "7xl" : "6xl"}>
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display font-semibold text-balance">{page.name}</h1>
            <Badge variant="secondary">{page.group}</Badge>
            {intent?.category ? <Badge variant="outline">{intent.category}</Badge> : null}
          </div>
          {page.question ? <p className="text-title text-balance">{page.question}</p> : null}
          {lead ? <p className="max-w-prose text-subtitle text-muted-foreground">{lead}</p> : null}
          <div className="flex flex-wrap gap-2">
            <LiveExample id={page.docsId}>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/storybook/?path=/docs/${page.docsId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.storybook}
                </a>
              </Button>
            </LiveExample>
            <Button asChild variant="ghost" size="sm">
              <a href={`${REPO}/blob/main/${page.file}`} target="_blank" rel="noopener noreferrer">
                {copy.source}
              </a>
            </Button>
          </div>
        </header>
      </PageBand>
      {/* One band for the whole document: rails down the column, corner marks at its head and
          foot — no seam at every heading, which would turn a long page into a ladder. */}
      <Band width={wide ? "7xl" : "6xl"}>
        <div
          className={`mx-auto flex w-full gap-10 px-6 py-10 ${wide ? "max-w-7xl" : "max-w-6xl"}`}
        >
          <article className="flex min-w-0 flex-1 flex-col gap-12">
            <section aria-label={copy.overview} className="flex flex-col gap-6">
              {hero ? (
                <div
                  className={
                    nativeBlock
                      ? "rounded-lg border border-border bg-hairline-hatch p-4"
                      : "rounded-lg border border-border bg-card p-6"
                  }
                >
                  {hero}
                </div>
              ) : first ? (
                <LiveExample id={first.id}>
                  <StoryFrame
                    id={first.id}
                    name={first.name}
                    size={frameSize}
                    detail={expandDetail}
                  />
                </LiveExample>
              ) : null}
              {/* A natively rendered block is on the page already; only embedded pages owe a note —
                  except that its further examples are still frames, so an unreachable Storybook
                  is said once here whenever the page embeds anything. */}
              {nativeBlock ? null : <MissingExamples stories={page.stories} />}
              {nativeBlock && examples.length === 0 ? null : <StorybookUnreachable />}
              {(importLine || installLine) && !showAgentRoute && showCommands ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {installLine ? <Copyable label={copy.install} command={installLine} /> : null}
                  {importLine ? <Copyable label={copy.import} command={importLine} /> : null}
                </div>
              ) : null}
              {children}
              {showAgentRoute && agentPrompt ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-3">
                    {installLine ? <Copyable label={copy.install} command={installLine} /> : null}
                    {importLine ? <Copyable label={copy.import} command={importLine} /> : null}
                    {pkgInstall ? (
                      <CommandLine
                        label={startCopy.component.install}
                        command={pkgInstall.command}
                        npm={pkgInstall.npm}
                      />
                    ) : null}
                    <p className="text-meta text-muted-foreground">
                      {startCopy.wiring.lead}{" "}
                      <a className="underline underline-offset-2 focus-ring" href="/start#wiring">
                        {startCopy.wiring.title}
                      </a>
                    </p>
                  </div>
                  <PromptCard prompt={agentPrompt} compact />
                </div>
              ) : null}
            </section>

            {uses.length > 0 || avoid.length > 0 ? (
              <section className="grid gap-8 md:grid-cols-2">
                {uses.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <h2 id="use-it-for" className="scroll-mt-24 text-title">
                      {copy.useFor}
                    </h2>
                    <ul className="flex list-disc flex-col gap-2 ps-5 text-body marker:text-success">
                      {uses.map((line) => (
                        <li key={line} className="first-letter:uppercase">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {avoid.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <h2 id="avoid" className="scroll-mt-24 text-title">
                      {copy.avoid}
                    </h2>
                    <ul className="flex list-disc flex-col gap-2 ps-5 text-body marker:text-destructive">
                      {avoid.map((line) => (
                        <li key={line} className="first-letter:uppercase">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {page.about && page.about !== lead ? (
              <p className="max-w-prose text-body text-muted-foreground">{page.about}</p>
            ) : null}

            {Object.values(rel).some((list) => list?.length) ? (
              <section className="flex flex-col gap-4">
                <h2 id="works-with" className="scroll-mt-24 text-title">
                  {copy.worksWith}
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <ComponentLinks label={copy.contains} names={rel.contains} />
                  <ComponentLinks label={copy.usedInside} names={rel.usedInside} />
                  <ComponentLinks label={copy.pairsWith} names={rel.pairsWith} />
                  <ComponentLinks label={copy.avoidNextTo} names={rel.avoidNextTo} />
                </div>
              </section>
            ) : null}

            {showDependencies && page.block?.dependencies.length ? (
              <section className="flex flex-col gap-3">
                <h2 id="dependencies" className="scroll-mt-24 text-title">
                  {copy.dependencies}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {[...page.block.dependencies, ...page.block.registryDependencies].map((dep) => (
                    <li key={dep}>
                      <Badge variant="outline">{dep}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {examples.length > 0 ? (
              <LiveSection ids={examples.map((story) => story.id)}>
                <section className="flex flex-col gap-8">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 id="examples" className="scroll-mt-24 text-title">
                      {copy.examples}
                    </h2>
                    <span className="text-meta text-muted-foreground">
                      <LiveExamplesCount ids={page.stories.map((story) => story.id)} />
                    </span>
                  </div>
                  {examples.map((story) => (
                    <LiveExample key={story.id} id={story.id}>
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <h3
                            id={`example-${anchor(story.id.split("--")[1] ?? story.id)}`}
                            className="scroll-mt-24 text-subtitle font-semibold"
                          >
                            {story.name}
                          </h3>
                          {story.description ? (
                            <p className="max-w-prose text-body text-muted-foreground">
                              {story.description}
                            </p>
                          ) : null}
                        </div>
                        <StoryFrame
                          id={story.id}
                          name={story.name}
                          size={frameSize}
                          detail={expandDetail}
                        />
                      </div>
                    </LiveExample>
                  ))}
                </section>
              </LiveSection>
            ) : null}

            {page.api.length > 0 ? (
              <section className="flex flex-col gap-8">
                <h2 id="api" className="scroll-mt-24 text-title">
                  {copy.api}
                </h2>
                {page.api.map((api) => (
                  <ApiBlock key={api.name} api={api} />
                ))}
              </section>
            ) : null}

            {tokens.length > 0 ? (
              <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id="theming" className="scroll-mt-24 text-title">
                    {copy.theming}
                  </h2>
                  <p className="text-body text-muted-foreground">{copy.themingLead}</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{copy.state}</TableHead>
                        <TableHead>{copy.token}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokens.map(([state, token]) => (
                        <TableRow key={state}>
                          <TableCell className="align-top font-medium">{state}</TableCell>
                          <TableCell className="whitespace-normal">
                            <code className="text-code text-muted-foreground">{token}</code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ) : null}
          </article>

          <nav
            aria-label={copy.onThisPage}
            className={wide ? "hidden" : "hidden w-52 shrink-0 xl:block"}
          >
            <div className="sticky top-6 flex max-h-dvh flex-col gap-3 overflow-y-auto pb-24">
              <p className="text-caption font-semibold text-muted-foreground">{copy.onThisPage}</p>
              <ul className="flex flex-col gap-1.5 text-meta">
                {uses.length > 0 ? <TocLink href="#use-it-for" label={copy.useFor} /> : null}
                {avoid.length > 0 ? <TocLink href="#avoid" label={copy.avoid} /> : null}
                {examples.length > 0 ? (
                  <LiveSection ids={examples.map((story) => story.id)}>
                    <TocLink href="#examples" label={copy.examples} />
                  </LiveSection>
                ) : null}
                {examples.map((story) => (
                  <LiveExample key={story.id} id={story.id}>
                    <TocLink
                      href={`#example-${anchor(story.id.split("--")[1] ?? story.id)}`}
                      label={story.name}
                      nested
                    />
                  </LiveExample>
                ))}
                {page.api.length > 0 ? <TocLink href="#api" label={copy.api} /> : null}
                {page.api.map((api) => (
                  <TocLink
                    key={api.name}
                    href={`#api-${anchor(api.name)}`}
                    label={api.name}
                    nested
                  />
                ))}
                {tokens.length > 0 ? <TocLink href="#theming" label={copy.theming} /> : null}
              </ul>
            </div>
          </nav>
        </div>
      </Band>
    </>
  );
}

function TocLink({ href, label, nested }: { href: string; label: string; nested?: boolean }) {
  return (
    <li className={nested ? "ps-3" : undefined}>
      <a
        href={href}
        className="block truncate rounded-sm text-muted-foreground hover:text-foreground focus-ring"
      >
        {label}
      </a>
    </li>
  );
}
