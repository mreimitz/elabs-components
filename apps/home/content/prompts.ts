/**
 * The ready-to-paste prompts, written once. `/start`, every template page and every component,
 * chart and block detail page build their prompt here, so a visitor copies the same route in
 * wherever they are.
 *
 * A prompt is pasted into a coding agent that has never seen this site, so each one is
 * self-contained: absolute urls, the install line, the lookup step and the done gate. Every
 * command and url is `install` (`content/generated/install.json`) — none is typed here.
 */
import { install } from "../lib/content";
import { shellCopy } from "./copy";

const CLI = `npx -y ${install.cliPackage}`;
const REPO = shellCopy.links.github;

/** How the agent gets the real API — with MCP when the host has it, the CLI when not. */
const LOOKUP = [
  `Read ${install.llmsTxt} first: it maps every package and the rules.`,
  `If you can use MCP servers, connect ${install.hostedMcp.url} and use its search, docs and tokens tools. If not, run the same lookups in the terminal: \`${CLI} search "<what you need>"\` and \`${CLI} docs <Component>\`.`,
].join(" ");

/** The three lines of wiring every first install needs; the most common first failure. */
const WIRING =
  "If this is the first brand-ui package in the project, wire it once: import `@elabs-ai/components-tokens/styles.css` plus the `themes/light.css` and `themes/dark.css` stylesheets in the CSS entry, add one Tailwind `@source` line per installed @elabs-ai package (Tailwind does not scan node_modules, so without it everything renders unstyled), and wrap the app root in `ThemeProvider` from `@elabs-ai/components-tokens`.";

const RULES =
  "Rules: use only @elabs-ai/components-* components and the semantic tokens — no raw colours, no raw font sizes, no arbitrary Tailwind values. Look up each component's real props with the docs tool before you use it; never guess a prop.";

const DONE = `Done means: the typecheck passes, \`${install.audit}\` reports nothing, and you have opened the app and looked at every screen you touched in the light and the dark theme.`;

const numbered = (steps: string[]) => steps.map((step, i) => `${i + 1}. ${step}`).join("\n");

/** What the visitor wants, or the bracketed line they replace after pasting. */
const orPlaceholder = (text: string | undefined, placeholder: string) =>
  text && text.trim().length > 0 ? text.trim() : `[${placeholder}]`;

export const createCommand = (template: string, dir = "my-app") =>
  `${install.create.prefix} ${dir} --template ${template}`;

/** The install line for one package, with tokens + ui first when the package is neither. */
export function packageInstall(pkg: string): { command: string; npm: string } {
  const inBase = install.base.command.split(" ").includes(pkg);
  const suffix = inBase ? "" : ` ${pkg}`;
  return { command: `${install.base.command}${suffix}`, npm: `${install.base.npm}${suffix}` };
}

export function newProjectPrompt({
  template,
  description,
}: {
  template: string;
  description?: string;
}): string {
  return [
    "Build a new app with brand-ui, the React component library published on npm as @elabs-ai/components-*.",
    "",
    numbered([
      LOOKUP,
      `Scaffold the app: \`${createCommand(template)}\`. Install its dependencies, start the dev server and confirm the starter screen renders before you change anything.`,
      `Then build this on top of the scaffold: ${orPlaceholder(description, "describe the app: who uses it, its screens, its data")}`,
      `Start each whole screen from the playbook the search tool returns for it (dashboard, data-app, ai-assistant, flow-workspace, settings, marketing) and compose registry blocks before writing layout by hand.`,
      RULES,
      DONE,
    ]),
  ].join("\n");
}

export function migratePrompt({ notes }: { notes?: string } = {}): string {
  return [
    "Move this existing app onto brand-ui, the React component library published on npm as @elabs-ai/components-*, one reviewable phase at a time and without breaking it.",
    "",
    numbered([
      LOOKUP,
      `Profile the app without changing it: \`${install.migrate.scan}\`, then \`${install.migrate.map}\`. Read migration/analysis.md and migration/plan.md, show me the plan and wait for my OK.`,
      `Phase 1 is wiring only: \`${install.base.command}\` (or \`${install.base.npm}\`). ${WIRING} The app must still build and every screen must look unchanged.`,
      "Then migrate one phase of the plan at a time, smallest components first. Keep each phase a change I can read, and stop for review after each one.",
      `What matters most to me: ${orPlaceholder(notes, "screens to start with, things that must not change")}`,
      RULES,
      DONE,
    ]),
  ].join("\n");
}

export function componentPrompt({
  name,
  pkg,
  kind = "component",
  where,
}: {
  name: string;
  pkg: string;
  kind?: "component" | "chart";
  where?: string;
}): string {
  const installLine = packageInstall(pkg);
  return [
    `Add the brand-ui ${name} ${kind} (from ${pkg}) to this project.`,
    "",
    numbered([
      LOOKUP,
      `Look ${name} up before writing code: \`${CLI} docs ${name}\` prints its real props, variants, what it pairs with and what to avoid.`,
      `If ${pkg} is not installed yet: \`${installLine.command}\` (or \`${installLine.npm}\`). ${WIRING}`,
      `Use it here: ${orPlaceholder(where, "the screen or file, and what it should show")}`,
      RULES,
      DONE,
    ]),
  ].join("\n");
}

export function packagePrompt({ pkg, goal }: { pkg: string; goal?: string }): string {
  const installLine = packageInstall(pkg);
  const short = pkg.replace("@elabs-ai/components-", "");
  return [
    `Use the brand-ui ${short} package (${pkg}) in this project.`,
    "",
    numbered([
      LOOKUP,
      `Read what the package offers: ${install.llmsTxt.replace(/llms\.txt$/, `llms/${short}.txt`)}`,
      `Install it: \`${installLine.command}\` (or \`${installLine.npm}\`). ${WIRING}`,
      `What I want to build with it: ${orPlaceholder(goal, "the screen or feature")}`,
      RULES,
      DONE,
    ]),
  ].join("\n");
}

export function blockPrompt({
  name,
  title,
  where,
}: {
  name: string;
  title: string;
  where?: string;
}): string {
  return [
    `Add the brand-ui registry block "${title}" (${name}) to this project. A block is copied into the app and becomes my code.`,
    "",
    numbered([
      LOOKUP,
      `Find it and what it is built from: \`${CLI} search ${name}\`.`,
      `Make sure the base is in place: \`${install.base.command}\` (or \`${install.base.npm}\`), plus the packages the block imports. ${WIRING}`,
      `Copy the block in with \`npx shadcn@latest add ${install.registryHomepage}/${name}.json\`; if that url does not answer, copy its files from ${REPO}/tree/main/registry/blocks/${name} instead. Then adapt it here: ${orPlaceholder(where, "the screen or file, and the real data it should show")}`,
      RULES,
      DONE,
    ]),
  ].join("\n");
}

/**
 * A use-case template is a whole product copied in with the blocks it composes; the prompt
 * names them, so the agent gets the recipe and not only the intent.
 */
export function templatePrompt({
  name,
  title,
  scenario,
  blocks,
  packages,
  where,
}: {
  name: string;
  title: string;
  scenario?: string;
  blocks: string[];
  packages: string[];
  where?: string;
}): string {
  const parts = blocks.filter((block) => block !== name);
  return [
    `Add the brand-ui template "${title}" (${name}) to this project — a whole screen copied into the app, built from registry blocks and the @elabs-ai/components-* packages.${scenario ? ` ${scenario}` : ""}`,
    "",
    numbered([
      LOOKUP,
      `Make sure the base is in place: \`${install.base.command}\` (or \`${install.base.npm}\`), then the packages the template imports: ${packages.join(", ")}. ${WIRING}`,
      `Copy the template in with \`npx shadcn@latest add ${install.registryHomepage}/${name}.json\` — it brings its blocks with it${parts.length ? ` (${parts.join(", ")})` : ""}; if that url does not answer, copy the folders from ${REPO}/tree/main/registry/blocks instead.`,
      `Mount the page at a route, keep its \`WorkspaceShell\` frame, and replace the seeded data with ours: ${orPlaceholder(where, "the route, the real data source, and what should change from the template")}`,
      RULES,
      DONE,
    ]),
  ].join("\n");
}
