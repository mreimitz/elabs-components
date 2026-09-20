/**
 * content.ts — the ONLY door site code has onto `apps/home/content/generated/*.json`
 * (RM-090, `.claude/rules/home.md` "Generated, not typed"). Every count, list of
 * packages/themes/gates/verbs/blocks, and install command a page renders comes
 * through one of these readers, never a literal in a component.
 *
 * The JSON is written by `scripts/gen-home.mjs` (`pnpm gen --only home`) and
 * checked for staleness by `pnpm gen:check` — never hand-edit a file under
 * `content/generated/`.
 */
import packagesJson from "../content/generated/packages.json";
import countsJson from "../content/generated/counts.json";
import themesJson from "../content/generated/themes.json";
import gatesJson from "../content/generated/gates.json";
import cliJson from "../content/generated/cli.json";
import blocksJson from "../content/generated/blocks.json";
import playbooksJson from "../content/generated/playbooks.json";
import storyIdsJson from "../content/generated/story-ids.json";
import installJson from "../content/generated/install.json";

export interface HomePackage {
  name: string;
  shortName: string;
  description: string;
  path: string;
  layer: number | null;
  exportCount: number;
  engines: string[];
}

export interface CountEntry {
  value: number;
  source: string;
}

export type HomeCounts = Record<
  | "packages"
  | "componentExports"
  | "registryBlocks"
  | "templates"
  | "playbooks"
  | "themeFamilies"
  | "tokens"
  | "skills"
  | "hostedMcpTools"
  | "gates",
  CountEntry
>;

export interface ThemeSwatch {
  mode: "light" | "dark";
  value: string;
  label: string;
  primary: string | null;
  background: string | null;
  /** The family's own `--chart-1` (RM-103 W5-B, #586): a second, more saturated colour
   * alongside `primary` so the nine swatch cards read apart even though `background` is
   * deliberately near-white/near-black in every family. */
  chart1: string | null;
}

export interface ThemeFamily {
  slug: string;
  displayName: string;
  isDefault: boolean;
  hasTypeface: boolean;
  modes: ThemeSwatch[];
}

export interface Gate {
  id: string;
  doc: string;
  category: string;
  source: string;
}

export interface CliVerb {
  verb: string;
  usage: string;
  does: string;
}

export interface CliContent {
  verbGroups: Record<string, CliVerb[]>;
  hostedMcpTools: string[];
  localOnlyTools: string[];
  routine: string;
  hostedMcpUrl: string;
  hostedMcpCommand: string;
  localMcpCommand: string;
  cliInstallCommand: string;
}

export interface RegistryBlock {
  name: string;
  title: string;
  categories: string[];
  dependencies: string[];
  archetype: string | null;
}

export interface Playbook {
  archetype: string;
  intent: string;
  keywords: string[];
  packages: string[];
  file: string;
  template: string;
}

export type StoryIds = Record<string, string>;

export interface InstallContent {
  cli: string;
  cliNpm: string;
  cliPackage: string;
  hostedMcp: { command: string; url: string };
  localMcp: { command: string };
  /** The absolute llms.txt url — a prompt is pasted somewhere else, so it never says "/llms.txt". */
  llmsTxt: string;
  plugin: { marketplaceAdd: string; install: string; skillCount: number };
  skills: { add: string };
  /** tokens + ui: what every app installs first. */
  base: { command: string; npm: string };
  create: { prefix: string; templates: string[]; run: { command: string; npm: string } };
  migrate: { scan: string; map: string };
  audit: string;
  registryHomepage: string | null;
  perArchetype: { archetype: string; command: string }[];
}

export const packages: HomePackage[] = packagesJson;
export const counts: HomeCounts = countsJson as HomeCounts;
export const themes: ThemeFamily[] = themesJson as ThemeFamily[];
export const gates: Gate[] = gatesJson;
export const cli: CliContent = cliJson as CliContent;
export const blocks: RegistryBlock[] = blocksJson as RegistryBlock[];
export const playbooks: Playbook[] = playbooksJson;
export const storyIds: StoryIds = storyIdsJson;
export const install: InstallContent = installJson as InstallContent;

/**
 * The Storybook docs id for a component the site links to, or `null` when the
 * component has no autodocs page. Callers that build an "Open in Storybook"
 * link decide what to render for `null` — this reader never invents an id.
 */
export function storyIdFor(componentName: string): string | null {
  return storyIds[componentName] ?? null;
}

/** One count by key, typed — `counts.packages.value`, `counts.packages.source`. */
export function countFor(key: keyof HomeCounts): CountEntry {
  return counts[key];
}
