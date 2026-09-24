import { Button, SectionHeader } from "@elabs-ai/components-ui";
import { Band } from "../components/band";
import { SectionIndex } from "../components/section-index";
import { Hero } from "../components/hero/hero";
import {
  BlocksSection,
  ChartsSection,
  MapsSection,
  PackagesSection,
  UseCasesSection,
  WallSection,
} from "../components/gallery/sections";
import { EmitUiSection } from "../components/agent-loop/emit-ui";
import { ThemeSwatches } from "../components/tokens/theme-swatches";
import { RouteCards } from "../components/routes/route-cards";
import { countFor } from "../lib/content";
import { galleryCopy, shellCopy } from "../content/copy";

const copy = galleryCopy.sections;

// The page in reading order, led by the use case: what you can build (templates), what it is
// built from (blocks, charts, maps, components, packages), how an agent uses it, how it
// re-brands, where to go next. Every tile links into the catalogue's detail pages; the
// agent-loop trace, the install matrix and the gate catalogue live on `/agents`. Every section
// after the hero sits in a `Band`, so one pair of hairline rails runs the length of the page.
export default function HomePage() {
  return (
    <div className="flex w-full flex-col">
      <Hero />
      <Band>
        <UseCasesSection />
      </Band>
      <Band>
        <BlocksSection />
      </Band>
      <Band>
        <ChartsSection />
      </Band>
      <Band>
        <MapsSection />
      </Band>
      <Band>
        <WallSection />
      </Band>
      <Band>
        <PackagesSection />
      </Band>
      <Band>
        <section
          id="agents"
          className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 pt-16 pb-12"
        >
          <SectionHeader
            size="lg"
            eyebrow={<SectionIndex label="Agents" />}
            title={copy.agents.title}
            description={copy.agents.description}
            actions={
              <Button asChild variant="outline">
                <a href="/agents">{copy.agents.more}</a>
              </Button>
            }
          />
          <p className="text-meta text-muted-foreground">
            <a
              className="underline underline-offset-2 focus-ring"
              href={`${shellCopy.links.github}/blob/main/docs/GATES.md`}
            >
              {copy.agents.gates(countFor("gates").value)}
            </a>
          </p>
        </section>
        {/* Same band: the agents header introduces the live editor below it. */}
        <EmitUiSection />
      </Band>
      <Band>
        <section id="themes" className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16">
          <SectionHeader
            size="lg"
            eyebrow={<SectionIndex label="Themes" />}
            title={copy.themes.title}
            description={copy.themes.description}
          />
          <ThemeSwatches />
        </section>
      </Band>
      <Band>
        <RouteCards />
      </Band>
    </div>
  );
}
