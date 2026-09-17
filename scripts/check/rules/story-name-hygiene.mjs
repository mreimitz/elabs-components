/**
 * story-name-hygiene — a story's VISIBLE name is documentation, not a bug tracker.
 *
 * The sidebar is the first thing a visitor to the docs site reads. In the 2026-09-17
 * crawl, 52 of its entries named an issue, an ADR, a roadmap item or a QA device:
 * "Ordered neutral ramp — judgeable hierarchy (#14)", "Keyboard focus indicator (#308)",
 * "Tile operations (RM-081)", "50,000 marks (perf harness)", "Reflow Regression Lock".
 * Each one is a legitimate story with a legitimate reason to exist — the reason simply
 * does not belong in the one string a customer sees.
 *
 * The reference itself is worth keeping, so it moves one line up (a JSDoc/`//` comment
 * over the export) or into `parameters.docs.description.story`, where it is still there
 * for a maintainer and still in `git log`, but not in the navigation.
 *
 * Applies to the name Storybook DISPLAYS: the story's own `name`, or — when it has none —
 * the export identifier in start case, which is why `export const ReflowRegressionLock`
 * fails without a `name` of its own.
 */
import { lineOfNode, parse, ts, walk } from "../lib/ts-ast.mjs";

const IGNORE = ["**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**"];

/** The vocabulary that reads as internal tracking rather than as a component's behaviour. */
export const BANNED = [
  [/#\d+/, "an issue number"],
  [/\bADR\b/, "an ADR reference"],
  [/\bRM-\d/, "a roadmap item"],
  [/\bharness\b/i, '"harness"'],
  [/\bregression\b/i, '"regression"'],
];

/** Storybook's own export-name → display-name derivation (lodash `startCase`, in essence). */
export function storyNameFromExport(id) {
  return String(id)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first banned pattern a displayed name matches, or null. */
export function offence(name) {
  for (const [re, what] of BANNED) if (re.test(name)) return what;
  return null;
}

/** Keys that mark an object literal as a story rather than an ordinary exported const. */
const STORY_KEYS = new Set([
  "render",
  "args",
  "play",
  "parameters",
  "decorators",
  "globals",
  "tags",
  "name",
  "argTypes",
  "loaders",
  "beforeEach",
]);

const propName = (p) =>
  p.name && (ts().isIdentifier(p.name) || ts().isStringLiteral(p.name)) ? p.name.text : "";

export function scanText(file, text) {
  const sf = parse(file, text);
  const t = ts();
  const out = [];
  walk(sf, (node) => {
    if (!t.isVariableStatement(node)) return;
    if (!node.modifiers?.some((m) => m.kind === t.SyntaxKind.ExportKeyword)) return;
    for (const decl of node.declarationList.declarations) {
      if (!t.isIdentifier(decl.name)) continue;
      let init = decl.initializer;
      while (init && (t.isAsExpression(init) || t.isSatisfiesExpression(init)))
        init = init.expression;
      if (!init || !t.isObjectLiteralExpression(init)) continue;
      const keys = init.properties.map(propName);
      // An empty `export const Default: Story = {}` is a story too; its type says so.
      const typed = /\bStory(Obj)?\b/.test(decl.type ? decl.type.getText(sf) : "");
      if (!typed && !keys.some((k) => STORY_KEYS.has(k))) continue;
      // The meta is not a story; it is exported as default, never by name.
      if (keys.includes("title") && keys.includes("component")) continue;
      const nameProp = init.properties.find(
        (p) => t.isPropertyAssignment(p) && propName(p) === "name",
      );
      const explicit =
        nameProp &&
        (t.isStringLiteral(nameProp.initializer) ||
          t.isNoSubstitutionTemplateLiteral(nameProp.initializer))
          ? nameProp.initializer.text
          : null;
      const shown = explicit ?? storyNameFromExport(decl.name.text);
      const what = offence(shown);
      if (!what) continue;
      out.push({
        file,
        line: lineOfNode(sf, nameProp ?? decl),
        msg: `story name "${shown}" carries ${what} — move it to a comment or \`parameters.docs.description.story\` and name the story for what it shows`,
      });
    }
  });
  return out;
}

const story = (body, path = "packages/ui/src/components/x/x.stories.tsx") => ({
  files: { [path]: body },
});

export default {
  id: "story-name-hygiene",
  scope: "stories",
  baseline: "none",
  doc: "A story's visible name says what the story shows — never an issue number (`#123`), an `ADR`, an `RM-` roadmap item, `harness` or `regression`; that reference belongs in a comment or `parameters.docs.description.story`.",
  run(ctx) {
    return ctx
      .glob(
        [
          "packages/*/src/**/*.stories.tsx",
          "apps/*/stories/**/*.stories.tsx",
          "apps/*/src/**/*.stories.tsx",
        ],
        { ignore: IGNORE },
      )
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      story(`/** #308 — the menu item had no focus ring of its own. */
export const KeyboardFocus: Story = {
  name: "Keyboard focus",
  play: async () => {},
};`),
      story(`export const Default: Story = {};`),
      // the meta is not a story, and a title may legitimately name anything
      story(`export const meta = { title: "Internal/Storybook Theme Harness", component: X };`),
      // a component prop that happens to say "regression" is not the story's name
      story(`export const Scatter: Story = { args: { trend: "regression" } };`),
    ],
    fail: [
      story(`export const KeyboardFocusIndicator: Story = {
  name: "Keyboard focus indicator (#308)",
  play: async () => {},
};`),
      story(
        `export const TileOperations: Story = { name: "Tile operations (RM-081)", render: () => null };`,
      ),
      story(`export const FocusRingVsStatus: Story = {
  name: "Focus ring vs. status (supplementary — ADR 0027)",
  render: () => null,
};`),
      // no name of its own: the export identifier is what the sidebar shows
      story(`export const ReflowRegressionLock: Story = { render: () => null };`),
      story(
        `export const FiftyThousandMarks: Story = { name: "50,000 marks (perf harness)", render: () => null };`,
      ),
    ],
  },
};
