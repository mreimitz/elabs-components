/**
 * RouteCards — the four ways off this page (RM-102, concept §4.4/§4.6): Adopt, Point your
 * agent, Re-brand, Read the source. A plain server component built from `UseCaseCard`
 * (`@elabs-ai/components-marketing`, server-safe) and `Button` (`@elabs-ai/components-ui`).
 * Every string is `routeCardsCopy` (`content/copy.ts`); every URL is `shellCopy.links` or a
 * Storybook docs id, never typed inline.
 */
import { BookOpen, Bot, Github, Palette } from "lucide-react";
import { Button } from "@elabs-ai/components-ui";
import { UseCaseCard } from "@elabs-ai/components-marketing";
import { routeCardsCopy, shellCopy } from "../../content/copy";

function storybookDocsHref(docId: string): string {
  return `/storybook/?path=/docs/${docId}`;
}

export function RouteCards() {
  return (
    <section
      data-slot="route-cards"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16"
    >
      <h2 className="text-title text-foreground">{routeCardsCopy.heading}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UseCaseCard
          icon={<BookOpen aria-hidden="true" />}
          title={routeCardsCopy.adopt.title}
          description={routeCardsCopy.adopt.description}
          footer={
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <a href={routeCardsCopy.adopt.href}>{routeCardsCopy.adopt.action}</a>
            </Button>
          }
        />
        <UseCaseCard
          icon={<Bot aria-hidden="true" />}
          title={routeCardsCopy.pointAgent.title}
          description={routeCardsCopy.pointAgent.description}
          footer={
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <a href="#agents">{routeCardsCopy.pointAgent.action}</a>
            </Button>
          }
        />
        <UseCaseCard
          icon={<Palette aria-hidden="true" />}
          title={routeCardsCopy.rebrand.title}
          description={routeCardsCopy.rebrand.description}
          footer={
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <a href={storybookDocsHref(routeCardsCopy.rebrand.docId)}>
                {routeCardsCopy.rebrand.action}
              </a>
            </Button>
          }
        />
        <UseCaseCard
          icon={<Github aria-hidden="true" />}
          title={routeCardsCopy.readSource.title}
          description={routeCardsCopy.readSource.description}
          footer={
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <a href={shellCopy.links.github}>{routeCardsCopy.readSource.action}</a>
            </Button>
          }
        />
      </div>
    </section>
  );
}
