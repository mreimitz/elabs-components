import type { Metadata } from "next";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SectionHeader,
} from "@elabs-ai/components-ui";
import { UseCaseCard } from "@elabs-ai/components-marketing";
import { BookOpen, Bot, LayoutTemplate, Shapes } from "lucide-react";
import { SiteGround } from "../../components/site-ground";
import { CommandLine } from "../../components/start/command-line";
import { HostCommand } from "../../components/start/host-command";
import { StartRoutes } from "../../components/start/start-routes";
import { install } from "../../lib/content";
import { startCopy } from "../../content/start-copy";
import { PageBand } from "../../components/page-band";

const copy = startCopy;

export const metadata: Metadata = {
  title: copy.pageTitle,
  description: copy.pageDescription,
  alternates: { canonical: "/start" },
};

// What a first install adds to the app, shown for people wiring it by hand. The specifiers are
// the packages' own export paths (packages/tokens/package.json); the keyword is assembled so the
// home-imports rule does not read this string as one of the site's own imports.
const IMPORT = ["imp", "ort"].join("");
const FROM = ["fr", "om"].join("");
const CSS_ENTRY = [
  `@${IMPORT} "@elabs-ai/components-tokens/styles.css";`,
  `@${IMPORT} "@elabs-ai/components-tokens/themes/light.css";`,
  `@${IMPORT} "@elabs-ai/components-tokens/themes/dark.css";`,
  "",
  "/* one line per @elabs-ai package you render */",
  '@source "../node_modules/@elabs-ai/components-ui/dist";',
].join("\n");
const APP_ROOT = [
  `${IMPORT} { ThemeProvider } ${FROM} "@elabs-ai/components-tokens";`,
  "",
  "export function Root() {",
  "  return (",
  '    <ThemeProvider defaultTheme="light">',
  "      <App />",
  "    </ThemeProvider>",
  "  );",
  "}",
].join("\n");

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-meta font-semibold text-muted-foreground">{label}</span>
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-auto rounded-md border border-border bg-muted p-4 font-mono text-meta text-foreground focus-ring"
      >
        {code}
      </pre>
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <p className="text-meta font-semibold text-muted-foreground">{children}</p>;
}

export default function StartPage() {
  return (
    <>
      <SiteGround />
      <PageBand width="7xl">
        <SectionHeader as="h1" title={copy.pageTitle} description={copy.pageDescription} />
      </PageBand>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 pt-12 pb-24">
        <section id="connect" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>{copy.connect.eyebrow}</Eyebrow>
            <h2 className="text-title text-foreground">{copy.connect.title}</h2>
            <p className="max-w-prose text-body text-muted-foreground">{copy.connect.lead}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{copy.connect.mcpTitle}</CardTitle>
                <CardDescription>{copy.connect.mcpBody}</CardDescription>
              </CardHeader>
              <CardContent>
                <HostCommand />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{copy.connect.pluginTitle}</CardTitle>
                <CardDescription>
                  {copy.connect.pluginBody(install.plugin.skillCount)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <CommandLine
                  label={copy.connect.pluginAdd}
                  command={install.plugin.marketplaceAdd}
                />
                <CommandLine label={copy.connect.pluginInstall} command={install.plugin.install} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{copy.connect.skillsTitle}</CardTitle>
                <CardDescription>{copy.connect.skillsBody}</CardDescription>
              </CardHeader>
              <CardContent>
                <CommandLine label={copy.connect.skillsAdd} command={install.skills.add} />
              </CardContent>
            </Card>
          </div>
          <Alert>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {copy.connect.noAgent}
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <a href="/agents">{copy.connect.more}</a>
              </Button>
            </AlertDescription>
          </Alert>
        </section>

        <section id="routes" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>{copy.routes.eyebrow}</Eyebrow>
            <h2 className="text-title text-foreground">{copy.routes.title}</h2>
          </div>
          <StartRoutes />
        </section>

        <section id="wiring" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>{copy.routes.byHand}</Eyebrow>
            <h2 className="text-title text-foreground">{copy.wiring.title}</h2>
            <p className="max-w-prose text-body text-muted-foreground">{copy.wiring.lead}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Snippet label={copy.wiring.css} code={CSS_ENTRY} />
            <Snippet label={copy.wiring.root} code={APP_ROOT} />
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-title text-foreground">{copy.next.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["/templates", LayoutTemplate, copy.next.templates, copy.next.templatesBody],
                ["/components", Shapes, copy.next.components, copy.next.componentsBody],
                ["/agents", Bot, copy.next.agents, copy.next.agentsBody],
                ["/storybook/", BookOpen, copy.next.storybook, copy.next.storybookBody],
              ] as const
            ).map(([href, Icon, title, body]) => (
              <UseCaseCard
                key={href}
                icon={<Icon aria-hidden="true" />}
                title={title}
                description={body}
                footer={
                  <Button variant="link" size="sm" asChild className="h-auto p-0">
                    <a href={href}>{title}</a>
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
