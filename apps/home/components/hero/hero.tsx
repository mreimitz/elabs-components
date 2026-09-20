/**
 * The hero: the positioning, the two ways in and the agent command. What follows it on the page
 * is the library itself, led by the use cases (`UseCasesSection`). Server component; the command
 * chip is the client island.
 */
import { Button, CommandChip, DraftingMarks } from "@elabs-ai/components-ui";
import { TrustStrip, type TrustFact } from "@elabs-ai/components-marketing";
import { AGENT_HOSTS } from "../../lib/agent-hosts";
import { counts } from "../../lib/content";
import { heroCopy } from "../../content/copy";
import { HeroAnatomy } from "./hero-anatomy";

const REPO = "https://github.com/mreimitz/elabs-components";

const FACTS: TrustFact[] = [
  { id: "npm", label: heroCopy.trust.npm, href: "https://www.npmjs.com/org/elabs-ai" },
  {
    id: "packages",
    label: heroCopy.trust.packages(counts.packages.value),
    href: `${REPO}/tree/main/packages`,
  },
  { id: "license", label: heroCopy.trust.license, href: `${REPO}/blob/main/LICENSE` },
  { id: "axe", label: heroCopy.trust.axe, href: `${REPO}/blob/main/docs/GATES.md` },
  {
    id: "themes",
    label: heroCopy.trust.themes(counts.themeFamilies.value),
    href: `${REPO}/tree/main/themes`,
  },
];

export function Hero() {
  const { chip } = heroCopy;
  return (
    <>
      {/* The hero band: an offset fill structured by the library's own hairline elements.
          Corner stripes stream out of the top-right and are gone by the middle; a construction
          drawing sits in the bottom-left, its vertical guide landing exactly on the page's left
          rail (globals.css places it), so the line that leaves the hero is the line the first
          section picks up. Copy on the left, the anatomy drawing on the right. */}
      <div data-slot="hero-band" className="overflow-hidden bg-surface-muted bg-hairline-stripes">
        <DraftingMarks anchor="bottom-start" />
        <section
          aria-labelledby="hero-title"
          data-slot="hero"
          className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-6 pt-16 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]"
        >
          <div
            data-slot="hero-copy"
            className="flex min-w-0 flex-col items-center gap-6 text-center lg:items-start lg:text-start"
          >
            <h1 id="hero-title" className="text-display-lg font-semibold text-balance">
              {heroCopy.headline}
            </h1>
            <p className="text-subtitle text-pretty text-muted-foreground">{heroCopy.sub}</p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild size="lg">
                <a href={heroCopy.ctaPrimaryHref}>{heroCopy.ctaPrimary}</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={heroCopy.ctaSecondaryHref}>{heroCopy.ctaSecondary}</a>
              </Button>
            </div>
            <CommandChip
              aria-label={chip.label}
              hosts={AGENT_HOSTS}
              labels={{
                copy: chip.copy,
                copied: chip.copied,
                selectFallback: chip.selectFallback,
                chooseHost: chip.chooseHost,
                menuLabel: chip.menuLabel,
              }}
              className="w-full max-w-xl text-start"
            />
            <TrustStrip
              aria-label={heroCopy.trust.label}
              facts={FACTS}
              className="justify-center lg:justify-start"
            />
          </div>
          <HeroAnatomy className="hidden lg:block" />
        </section>
      </div>
    </>
  );
}
