/**
 * story-viewport-guard — a story file for a LAYOUT-LEVEL surface sets its canvas
 * layout on the meta, instead of inheriting the preview default.
 *
 * House convention (measured 2026-09 over 328 story files): `apps/docs/.storybook/preview.tsx`
 * defaults `parameters.layout` to `"centered"`, which shrink-wraps the story and hides how a
 * shell/page/grid fills and overflows the viewport. Every layout-level meta therefore sets
 * `parameters: { layout: "fullscreen" }` (shells, templates, scenarios — 71 files) or
 * `"padded"` (DataTable, toolbars); nobody uses `parameters.viewport` today, but it (or
 * `globals.viewport`) is accepted too.
 *
 * Layout-level = the meta `title` is under `Layout/`, `Patterns/Templates/` or
 * `Patterns/Scenarios/`, or its last segment is AppShell, Sidebar, AppSidebar, PageShell,
 * DataTable, ChatShell, Hero or Dashboard. `Overlays/*` (Dialog, Sheet, …) are deliberately
 * NOT included: they portal out of the canvas, so the centered trigger IS the convention there.
 * Only the META counts — a per-story `layout` leaves every other story centered.
 */
import { lineOfNode, parse, ts, walk } from "../lib/ts-ast.mjs";

const IGNORE = ["**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**"];
const PREFIX_RE = /^(?:Layout|Patterns\/Templates|Patterns\/Scenarios)\//;
const COMPONENTS = new Set([
  "AppShell",
  "Sidebar",
  "AppSidebar",
  "PageShell",
  "DataTable",
  "ChatShell",
  "Hero",
  "Dashboard",
]);

export function isLayoutLevel(title) {
  return PREFIX_RE.test(title) || COMPONENTS.has(title.split("/").pop());
}

const propName = (p) =>
  p.name && (ts().isIdentifier(p.name) || ts().isStringLiteral(p.name)) ? p.name.text : "";

function objectProp(obj, name) {
  const t = ts();
  const p = obj.properties.find((x) => t.isPropertyAssignment(x) && propName(x) === name);
  let init = p?.initializer;
  while (init && (t.isAsExpression(init) || t.isSatisfiesExpression(init))) init = init.expression;
  return init && t.isObjectLiteralExpression(init) ? init : null;
}

export function scanText(file, text) {
  if (!/\btitle\s*:/.test(text)) return [];
  const sf = parse(file, text);
  const t = ts();
  let meta = null;
  let title = null;
  walk(sf, (n) => {
    if (meta) return false;
    if (!t.isObjectLiteralExpression(n)) return;
    const p = n.properties.find((x) => t.isPropertyAssignment(x) && propName(x) === "title");
    // the meta is the object that also names a `component` or sits in `export default`/`const meta`
    if (
      !p ||
      !(t.isStringLiteral(p.initializer) || t.isNoSubstitutionTemplateLiteral(p.initializer))
    )
      return;
    const isMeta =
      n.properties.some((x) =>
        ["component", "parameters", "decorators", "tags"].includes(propName(x)),
      ) || t.isExportAssignment(n.parent);
    if (!isMeta) return;
    meta = n;
    title = p.initializer.text;
    return false;
  });
  if (!meta || !isLayoutLevel(title)) return [];
  const params = objectProp(meta, "parameters");
  const globals = objectProp(meta, "globals");
  const has = (obj, name) => obj?.properties.some((x) => propName(x) === name);
  if (has(params, "layout") || has(params, "viewport") || has(globals, "viewport")) return [];
  return [
    {
      file,
      line: lineOfNode(sf, meta),
      msg: `layout-level story "${title}" inherits the centered canvas — set \`parameters: { layout: "fullscreen" }\` (or "padded") on the meta`,
    },
  ];
}

const story = (body, path = "packages/ui/src/components/x/x.stories.tsx") => ({
  files: { [path]: body },
});

export default {
  id: "story-viewport-guard",
  scope: "stories",
  doc: 'A story meta for a layout-level surface (`Layout/*`, `Patterns/Templates/*`, `Patterns/Scenarios/*`, AppShell, Sidebar, DataTable, ChatShell, Hero, …) sets `parameters.layout` (`"fullscreen"`/`"padded"`) or a viewport — never the centered default.',
  baseline: "per-file",
  run(ctx) {
    return ctx
      .glob(
        [
          "packages/*/src/**/*.stories.tsx",
          "apps/*/stories/**/*.stories.tsx",
          "apps/*/src/**/*.stories.tsx",
        ],
        {
          ignore: IGNORE,
        },
      )
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      story(`const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The sidebar primitive set." } },
  },
} satisfies Meta<typeof Sidebar>;
export default meta;`),
      story(`const meta: Meta<typeof DataTable> = {
  title: "Data/DataTable",
  component: DataTable,
  parameters: { layout: "padded" },
};
export default meta;`),
      // overlays keep the centered default on purpose
      story(`const meta = { title: "Overlays/Dialog", component: Dialog } satisfies Meta<typeof Dialog>;
export default meta;`),
      story(`export default { title: "Core/Button", component: Button };`),
      story(`export default {
  title: "Patterns/Templates/Dashboard",
  globals: { viewport: { value: "desktop" } },
};`),
    ],
    fail: [
      story(`const meta = {
  title: "Layout/SectionHeader",
  component: SectionHeader,
  args: { title: "Projects" },
} satisfies Meta<typeof SectionHeader>;
export default meta;`),
      // a component prop named layout is not the canvas parameter
      story(`const meta = {
  title: "Layout/Descriptions",
  component: Descriptions,
  args: { layout: "horizontal" },
} satisfies Meta<typeof Descriptions>;
export default meta;`),
      // per-story layout only: the other stories stay centered
      story(
        `export default { title: "Patterns/Scenarios/Chat", component: Chat };
export const Default = { parameters: { layout: "fullscreen" } };`,
        "apps/docs/stories/chat.stories.tsx",
      ),
    ],
  },
};
