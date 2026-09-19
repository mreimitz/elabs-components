/**
 * tabs.ts — the surface tour's tab registry (RM-096). Metadata only: id, label, use case, hint,
 * the component whose Storybook docs page "Open in Storybook" opens, the agent prompt and the
 * scaffold command. The surfaces themselves are registered in `tour.tsx` (RM-097 / RM-098 append
 * theirs there, in tab order, under their own comments).
 *
 * Every story id is resolved from `content/generated/story-ids.json` HERE, at module load: a
 * component without a docs page throws, which fails `next build` — a tour link can never 404.
 */
import { install, playbooks, storyIdFor } from "../../lib/content";
import { tourCopy } from "../../content/copy";

export type TourTabId = keyof typeof tourCopy.tabs;

export interface TourTabMeta {
  id: TourTabId;
  label: string;
  useCase: string;
  hint: string | null;
  /** `/storybook/?path=/docs/<id>` — resolved from story-ids.json, never typed. */
  storybookHref: string;
  /** The multi-line "Copy prompt" text. */
  prompt: string;
  /** `npx … create <dir> --template <archetype>`, or null when the CLI has no template for it. */
  scaffold: string | null;
  /**
   * How the surface loads once registered: `server` = `next/dynamic` with `ssr: true` (text in the
   * server HTML for crawlers); `client` = `ssr: false` (flow / process / editor engines).
   */
  render: "server" | "client";
}

/** The CLI package, read from the generated install command (`pnpm add -D <pkg>`). */
const CLI_PACKAGE = install.cli.split(" ").at(-1) ?? "";

function storybookHref(component: string): string {
  const id = storyIdFor(component);
  if (!id) {
    throw new Error(
      `tour/tabs.ts: "${component}" has no Storybook docs id in content/generated/story-ids.json — pick a component with an autodocs page or run \`pnpm gen\`.`,
    );
  }
  return `/storybook/?path=/docs/${id}`;
}

function intentOf(archetype: string): string {
  const playbook = playbooks.find((p) => p.archetype === archetype);
  if (!playbook) {
    throw new Error(
      `tour/tabs.ts: no playbook "${archetype}" in content/generated/playbooks.json.`,
    );
  }
  return playbook.intent;
}

function tab(
  id: TourTabId,
  { story, scaffold, render }: { story: string; scaffold: boolean; render: "server" | "client" },
): TourTabMeta {
  const copy = tourCopy.tabs[id];
  return {
    id,
    label: copy.label,
    useCase: copy.useCase,
    hint: copy.hint,
    storybookHref: storybookHref(story),
    prompt: tourCopy.prompt({
      mcpUrl: install.hostedMcp.url,
      archetype: id,
      intent: intentOf(id),
      useCase: copy.useCase,
    }),
    // `brand-ui create --template` accepts the six CLI archetypes; process-explorer has none.
    scaffold: scaffold ? `npx -y ${CLI_PACKAGE} create my-${id} --template ${id}` : null,
    render,
  };
}

/** The seven tabs in the concept's order (§4.2). */
export const TOUR_TABS: TourTabMeta[] = [
  tab("dashboard", { story: "DashboardSheet", scaffold: true, render: "server" }),
  tab("ai-assistant", { story: "AiChat", scaffold: true, render: "server" }),
  tab("data-app", { story: "DataTable", scaffold: true, render: "server" }),
  tab("flow-workspace", { story: "CanvasShell", scaffold: true, render: "client" }),
  tab("process-explorer", { story: "ProcessMap", scaffold: false, render: "client" }),
  tab("settings", { story: "FieldRow", scaffold: true, render: "server" }),
  tab("marketing", { story: "Hero", scaffold: true, render: "server" }),
];

// RM-097

// RM-098
