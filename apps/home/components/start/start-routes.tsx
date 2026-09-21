"use client";

/**
 * StartRoutes — the three routes of `/start` as tabs: new project, existing project, one
 * component or package. Each tab shows the commands (pnpm and npm) and builds ONE prompt from
 * what the visitor typed, so what they paste into their agent is already theirs.
 * The tab is mirrored into the hash (`/start#migrate`) so a route can be linked to.
 */
import { useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Combobox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@elabs-ai/components-ui";
import { CATALOG_INDEX, hrefOf } from "../../lib/catalog-index";
import { install, packages } from "../../lib/content";
import { tourCopy } from "../../content/copy";
import { startCopy } from "../../content/start-copy";
import {
  createCommand,
  migratePrompt,
  newProjectPrompt,
  packageInstall,
  componentPrompt,
  packagePrompt,
} from "../../content/prompts";
import { CommandLine } from "./command-line";
import { PromptCard } from "./prompt-card";

const copy = startCopy;
const ROUTES = ["new", "migrate", "component"] as const;
type Route = (typeof ROUTES)[number];

const SCOPE = "@elabs-ai/components-";
const PACKAGE_PREFIX = "package:";

/** A chart type (not the dashboard surface) gets the chart wording of the prompt. */
const isChart = (entry: { package: string; group: string }) =>
  entry.package === "charts" && entry.group !== "Dashboard";

/** Components by name, then every package as "the whole package". */
const PICKS = [
  ...CATALOG_INDEX.filter((entry) => entry.section === "components" && entry.component).map(
    (entry) => ({
      value: `${entry.section}:${entry.package}:${entry.slug}`,
      label: `${entry.component} · ${entry.package}`,
      entry,
    }),
  ),
];
const PACKAGE_PICKS = packages.map((pkg) => ({
  value: `${PACKAGE_PREFIX}${pkg.name}`,
  label: `${copy.component.wholePackage}: ${pkg.shortName}`,
}));
const OPTIONS = [...PICKS.map(({ value, label }) => ({ value, label })), ...PACKAGE_PICKS];
const DEFAULT_PICK =
  PICKS.find((pick) => pick.entry.component === copy.component.pickPlaceholder)?.value ??
  OPTIONS[0]?.value ??
  "";

function templateLabel(id: string): string {
  return tourCopy.tabs[id as keyof typeof tourCopy.tabs]?.label ?? id;
}

function RouteGrid({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 pt-6">
      <p className="max-w-prose text-body text-muted-foreground">{lead}</p>
      <div className="grid gap-8 lg:grid-cols-2">{children}</div>
    </div>
  );
}

function Column({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {title ? <h3 className="text-subtitle text-foreground">{title}</h3> : null}
      {children}
    </div>
  );
}

export function StartRoutes() {
  const [route, setRoute] = useState<Route>("new");
  const [template, setTemplate] = useState(install.create.templates[0] ?? "dashboard");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [pick, setPick] = useState(DEFAULT_PICK);
  const [where, setWhere] = useState("");
  const ids = {
    template: useId(),
    describe: useId(),
    notes: useId(),
    pick: useId(),
    where: useId(),
  };

  // `/start#migrate` opens that tab; changing tab keeps the hash in step without scrolling.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      if ((ROUTES as readonly string[]).includes(hash)) setRoute(hash as Route);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const onRoute = (next: string) => {
    setRoute(next as Route);
    window.history.replaceState(null, "", `#${next}`);
  };

  const picked = useMemo(() => {
    if (pick.startsWith(PACKAGE_PREFIX)) {
      const pkg = pick.slice(PACKAGE_PREFIX.length);
      return {
        pkg,
        name: null,
        href: `/components/${pkg.replace(SCOPE, "")}`,
        prompt: packagePrompt({ pkg, goal: where }),
      };
    }
    const entry = PICKS.find((candidate) => candidate.value === pick)?.entry;
    if (!entry?.component) return null;
    const pkg = `${SCOPE}${entry.package}`;
    return {
      pkg,
      name: entry.component,
      href: hrefOf(entry),
      prompt: componentPrompt({
        name: entry.component,
        pkg,
        kind: isChart(entry) ? "chart" : "component",
        where,
      }),
    };
  }, [pick, where]);

  return (
    <Tabs value={route} onValueChange={onRoute}>
      <TabsList aria-label={copy.routes.tabsLabel}>
        <TabsTrigger value="new">{copy.newProject.tab}</TabsTrigger>
        <TabsTrigger value="migrate">{copy.migrate.tab}</TabsTrigger>
        <TabsTrigger value="component">{copy.component.tab}</TabsTrigger>
      </TabsList>

      <TabsContent value="new">
        <RouteGrid lead={copy.newProject.lead}>
          <Column>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.template}>{copy.newProject.template}</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger id={ids.template} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {install.create.templates.map((id) => (
                    <SelectItem key={id} value={id}>
                      {templateLabel(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.describe}>{copy.newProject.describe}</Label>
              <Textarea
                id={ids.describe}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={copy.newProject.describePlaceholder}
              />
            </div>
            <h3 className="pt-2 text-subtitle text-foreground">{copy.routes.commands}</h3>
            <CommandLine label={copy.newProject.scaffold} command={createCommand(template)} />
            <CommandLine
              label={copy.newProject.run}
              command={install.create.run.command}
              npm={install.create.run.npm}
            />
            <Button asChild variant="link" size="sm" className="h-auto self-start p-0">
              <a href="/templates">{copy.newProject.templates}</a>
            </Button>
          </Column>
          <Column>
            <PromptCard prompt={newProjectPrompt({ template, description })} />
          </Column>
        </RouteGrid>
      </TabsContent>

      <TabsContent value="migrate">
        <RouteGrid lead={copy.migrate.lead}>
          <Column>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.notes}>{copy.migrate.notes}</Label>
              <Textarea
                id={ids.notes}
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={copy.migrate.notesPlaceholder}
              />
            </div>
            <h3 className="pt-2 text-subtitle text-foreground">{copy.routes.commands}</h3>
            <CommandLine label={copy.migrate.scan} command={install.migrate.scan} />
            <CommandLine label={copy.migrate.map} command={install.migrate.map} />
            <CommandLine
              label={copy.migrate.base}
              command={install.base.command}
              npm={install.base.npm}
            />
          </Column>
          <Column>
            <PromptCard prompt={migratePrompt({ notes })} />
          </Column>
        </RouteGrid>
      </TabsContent>

      <TabsContent value="component">
        <RouteGrid lead={copy.component.lead}>
          <Column>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.pick}>{copy.component.pick}</Label>
              <Combobox
                id={ids.pick}
                options={OPTIONS}
                value={pick}
                onValueChange={(value) => value && setPick(value)}
                searchPlaceholder={copy.component.pickPlaceholder}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.where}>{copy.component.where}</Label>
              <Textarea
                id={ids.where}
                rows={3}
                value={where}
                onChange={(event) => setWhere(event.target.value)}
                placeholder={copy.component.wherePlaceholder}
              />
            </div>
            {picked ? (
              <>
                <h3 className="pt-2 text-subtitle text-foreground">{copy.routes.commands}</h3>
                <CommandLine
                  label={copy.component.install}
                  command={packageInstall(picked.pkg).command}
                  npm={packageInstall(picked.pkg).npm}
                />
                {picked.name ? (
                  <CommandLine
                    label={copy.component.docs}
                    command={`npx -y ${install.cliPackage} docs ${picked.name}`}
                  />
                ) : null}
                <div className="flex flex-wrap gap-4">
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <a href={picked.href}>{picked.name ?? picked.pkg}</a>
                  </Button>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <a href="/components">{copy.component.browse}</a>
                  </Button>
                </div>
              </>
            ) : null}
          </Column>
          <Column>{picked ? <PromptCard prompt={picked.prompt} /> : null}</Column>
        </RouteGrid>
      </TabsContent>
    </Tabs>
  );
}
