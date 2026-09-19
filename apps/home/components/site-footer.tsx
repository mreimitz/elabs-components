/**
 * The link directory that used to be the site footer, now the body of `/resources` (the app
 * shell has no page footer). A plain server component — no hooks, no client
 * boundary — so the whole footer is real HTML before hydration ("It reads perfectly with
 * JS off", concept §5). The open-source attributions have their own route, `/attributions`.
 */
import type { ReactNode } from "react";
import { packages } from "../lib/content";
import { galleryCopy, shellCopy } from "../content/copy";
// The published CLI version — the same figure `SERVER_INFO.version` in the hosted MCP and
// `.well-known/mcp.json` carry (`packages/cli/lib/mcp.mjs`), read from its own manifest
// rather than typed, per "Generated, not typed" (`.claude/rules/home.md`).
import cliPackageJson from "../../../packages/cli/package.json";

function storybookPath(docId: string): string {
  return `/storybook/?path=/docs/${docId}`;
}

function FooterColumn({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-caption font-semibold text-muted-foreground">{heading}</h2>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a
        href={href}
        className="text-body text-muted-foreground hover:text-foreground focus-ring rounded-sm"
      >
        {children}
      </a>
    </li>
  );
}

export function SiteFooter() {
  return (
    <div data-slot="site-resources">
      <div className="grid w-full gap-8 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <FooterColumn heading={shellCopy.footer.packagesHeading}>
          {packages.map((pkg) => (
            <FooterLink key={pkg.name} href={`/llms/${pkg.shortName}.txt`}>
              {pkg.shortName}
            </FooterLink>
          ))}
        </FooterColumn>
        <FooterColumn heading={shellCopy.footer.agentsHeading}>
          <FooterLink href="/llms.txt">{shellCopy.footer.llmsTxt}</FooterLink>
          <FooterLink href="/.well-known/mcp.json">{shellCopy.footer.mcpDiscovery}</FooterLink>
          <FooterLink href="/mcp">{shellCopy.footer.hostedMcp}</FooterLink>
          <FooterLink href={storybookPath(shellCopy.footer.mcpServerDocId)}>
            {shellCopy.footer.mcpServerDoc}
          </FooterLink>
        </FooterColumn>
        <FooterColumn heading={shellCopy.footer.docsHeading}>
          <FooterLink href={storybookPath(shellCopy.footer.gettingStartedDocId)}>
            {shellCopy.footer.gettingStarted}
          </FooterLink>
          <FooterLink href="/storybook/">{shellCopy.footer.storybookHome}</FooterLink>
          <FooterLink href={shellCopy.links.changelog}>{shellCopy.footer.changelog}</FooterLink>
        </FooterColumn>
        <FooterColumn heading={shellCopy.footer.projectHeading}>
          <FooterLink href={shellCopy.links.github}>{shellCopy.footer.github}</FooterLink>
          <FooterLink href={shellCopy.links.npm}>{shellCopy.footer.npm}</FooterLink>
          <FooterLink href="/attributions">{galleryCopy.attributions.footerLink}</FooterLink>
        </FooterColumn>
      </div>
      <div className="flex w-full items-center justify-between border-t border-border pt-6 text-caption text-muted-foreground">
        <span>{shellCopy.footer.license}</span>
        <span aria-label={shellCopy.footer.versionLabel} className="tabular-nums">
          v{cliPackageJson.version}
        </span>
      </div>
    </div>
  );
}
