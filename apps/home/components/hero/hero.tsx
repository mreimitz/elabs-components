/**
 * The hero (RM-094): headline, CTAs, the agent command chip, the theme switch + dials and the
 * trust strip on the left; the flagship app-shell scene on the right. Server component — the
 * interactive parts are client islands from `@elabs-ai/components-ui` and the hero files.
 */
import { Button, Card, CommandChip, type CommandChipHost } from "@elabs-ai/components-ui";
import { TrustStrip, type TrustFact } from "@elabs-ai/components-marketing";
import { counts, install } from "../../lib/content";
import { heroCopy } from "../../content/copy";
import { HeroDials, HeroThemeSwitch } from "./hero-dials";
import { HeroFloat } from "./hero-float";
import { HeroShell } from "./hero-shell";
import { streamGateScript } from "./hero-stream";

const REPO = "https://github.com/mreimitz/elabs-components";
const STREAM_GATE = streamGateScript();

// Per-host forms around the generated commands/URL (install.json carries the Claude Code and
// stdio forms; the host wrappers are the hosts' own documented syntax).
const HOSTS: CommandChipHost[] = [
  { id: "claude-code", label: heroCopy.chip.hosts.claudeCode, command: install.hostedMcp.command },
  { id: "cursor", label: heroCopy.chip.hosts.cursor, command: install.localMcp.command },
  {
    id: "vscode",
    label: heroCopy.chip.hosts.vscode,
    command: `code --add-mcp '${JSON.stringify({ name: "brand-ui", type: "http", url: install.hostedMcp.url })}'`,
  },
  {
    id: "codex",
    label: heroCopy.chip.hosts.codex,
    command: `codex mcp add brand-ui -- ${install.localMcp.command}`,
  },
  { id: "url", label: heroCopy.chip.hosts.url, command: install.hostedMcp.url },
];

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
    <section
      aria-labelledby="hero-title"
      data-slot="hero"
      className="mx-auto grid w-full max-w-7xl gap-10 px-6 pt-12 pb-16 lg:grid-cols-12 lg:gap-8"
    >
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-5 lg:pt-6">
        <h1 id="hero-title" className="text-display font-semibold text-balance">
          {heroCopy.headline}
        </h1>
        <p className="text-subtitle text-muted-foreground">{heroCopy.sub}</p>
        <div className="flex flex-wrap gap-3">
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
          hosts={HOSTS}
          labels={{
            copy: chip.copy,
            copied: chip.copied,
            selectFallback: chip.selectFallback,
            chooseHost: chip.chooseHost,
            menuLabel: chip.menuLabel,
          }}
          className="w-full"
        />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <HeroThemeSwitch />
            <HeroDials />
          </div>
          <p className="text-meta text-muted-foreground">{heroCopy.switchCaption}</p>
        </div>
        <TrustStrip aria-label={heroCopy.trust.label} facts={FACTS} />
      </div>
      <div className="relative min-w-0 self-start lg:col-span-7">
        <Card
          role="region"
          aria-label={heroCopy.scene.label}
          className="h-148 gap-0 overflow-hidden p-0 shadow-md"
        >
          <div className="group/stream h-full overflow-x-auto" suppressHydrationWarning>
            <script>{STREAM_GATE}</script>
            <HeroShell />
          </div>
        </Card>
        <HeroFloat />
      </div>
    </section>
  );
}
