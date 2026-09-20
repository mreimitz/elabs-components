/**
 * The hero: the positioning, the two ways in and the agent command. What follows it on the page
 * is the library itself, led by the use cases (`UseCasesSection`). Server component; the command
 * chip is the client island.
 */
import { Button, CommandChip } from "@elabs-ai/components-ui";
import { TrustStrip, type TrustFact } from "@elabs-ai/components-marketing";
import { AGENT_HOSTS } from "../../lib/agent-hosts";
import { counts } from "../../lib/content";
import { heroCopy } from "../../content/copy";

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
      <section
        aria-labelledby="hero-title"
        data-slot="hero"
        className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pt-20 pb-12 text-center"
      >
        <h1 id="hero-title" className="text-display-lg font-semibold text-balance">
          {heroCopy.headline}
        </h1>
        <p className="text-subtitle text-pretty text-muted-foreground">{heroCopy.sub}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={`/storybook/?path=/docs/${heroCopy.ctaPrimaryStoryId}`}>
              {heroCopy.ctaPrimary}
            </a>
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
        <TrustStrip aria-label={heroCopy.trust.label} facts={FACTS} className="justify-center" />
      </section>
    </>
  );
}
