/**
 * sidebar-drift — registry sidebar blocks never re-fork the shared nav primitives (#99).
 *
 * #99 consolidated `TeamSwitcher`, `NavMain`, `NavUser`, `NavNotifications` into
 * `@elabs-ai/components-ui`; before that `team-switcher` had been copied into two blocks
 * and the copies drifted 25 lines apart. A sidebar block must IMPORT or RE-EXPORT them.
 *
 * Flags a LOCAL runtime declaration of a guarded name: `export function|const|class`,
 * `export default function Name`, `export default Name` backed by a local declaration,
 * and non-exported component-shaped `function`/arrow/`forwardRef`/`memo`/`class`.
 * Not flagged: imports, (aliased) re-exports, `export type`, JSX usage, comments.
 * `AppSidebar` is not guarded: sidebar-04/05 legitimately compose their own.
 *
 * Scope: registry/blocks/sidebar-*\/**\/*.{ts,tsx}, minus tests and stories. Zero files
 * is a loud failure — the old gate once silently scanned nothing after a blocks move.
 */
import { lineOf } from "../context.mjs";
import { blankJsComments } from "../lib/css.mjs";

export const GUARDED = new Set(["TeamSwitcher", "NavMain", "NavUser", "NavNotifications"]);
const SCOPE = "registry/blocks/sidebar-*/**/*.{ts,tsx}";
const ID = "[A-Za-z_$][A-Za-z0-9_$]*";

/** Local runtime declarations of a guarded primitive: `[{ name, line }]`. */
export function findSidebarDriftViolations(src, guarded = GUARDED) {
  const code = blankJsComments(src);
  const out = [];
  const seen = new Set();
  const add = (name, index) => {
    const line = lineOf(code, index);
    if (seen.has(`${name}::${line}`)) return;
    seen.add(`${name}::${line}`);
    out.push({ name, line });
  };
  const scan = (re, check = () => true) => {
    for (const m of code.matchAll(re)) if (guarded.has(m[1]) && check(m[1])) add(m[1], m.index);
  };
  // A: export function Name(
  scan(new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+(${ID})\\s*[(<\\n{]`, "g"));
  // B: export const|let|var Name = / :
  scan(new RegExp(`\\bexport\\s+(?:const|let|var)\\s+(${ID})\\s*[=:]`, "g"));
  // C: export class Name
  scan(new RegExp(`\\bexport\\s+(?:abstract\\s+)?class\\s+(${ID})\\b`, "g"));
  // D: export default function Name(
  scan(new RegExp(`\\bexport\\s+default\\s+(?:async\\s+)?function\\s+(${ID})\\s*[(<\\n{]`, "g"));
  // E: export default Name — only when Name is declared locally (an imported one is pass-through)
  scan(new RegExp(`\\bexport\\s+default\\s+(${ID})\\s*[;\\n]`, "g"), (name) =>
    new RegExp(
      `(?:^|[\\n;])\\s*(?:(?:export|async)\\s+)*(?:function|const|let|var|class)\\s+${name}\\b`,
    ).test(code),
  );
  // F: non-exported component-shaped local re-implementation
  scan(new RegExp(`(?:^|[\\n;{])\\s*(?:async\\s+)?function\\s+(${ID})\\s*[(<]`, "g"));
  scan(
    new RegExp(
      `(?:^|[\\n;{])\\s*(?:const|let|var)\\s+(${ID})\\s*(?::[^=\\n]+)?=\\s*(?:\\([^)]*\\)\\s*(?::[^=>\\n]+)?=>|(?:async\\s+)?function\\b|(?:React\\.)?(?:forwardRef|memo)\\b)`,
      "g",
    ),
  );
  scan(new RegExp(`(?:^|[\\n;{])\\s*(?:abstract\\s+)?class\\s+(${ID})\\b`, "g"));
  return out;
}

const block = (text, file = "registry/blocks/sidebar-02/components/nav.tsx") => ({
  files: { [file]: text },
});

export default {
  id: "sidebar-drift",
  scope: "registry",
  doc: "Import or re-export `TeamSwitcher`, `NavMain`, `NavUser` and `NavNotifications` from `@elabs-ai/components-ui` in registry sidebar blocks; never re-declare a local copy.",
  baseline: "none",
  run(ctx) {
    const files = ctx.glob(SCOPE, {
      ignore: ["**/*.{test,stories}.{ts,tsx}", "**/{node_modules,dist}/**"],
    });
    if (files.length === 0)
      return [
        {
          file: "registry/blocks",
          line: 1,
          msg: `found no sidebar block files matching ${SCOPE} — a moved or renamed blocks directory must fail loudly, never pass silently`,
        },
      ];
    return files.flatMap((file) =>
      findSidebarDriftViolations(ctx.readFile(file)).map((v) => ({
        file,
        line: v.line,
        msg: `${v.name} is re-declared locally — import it from @elabs-ai/components-ui instead (#99)`,
      })),
    );
  },
  fixtures: {
    pass: [
      block(`export { TeamSwitcher } from "@elabs-ai/components-ui";\n`),
      block(`export { NavMain as DashboardNavigation } from "@elabs-ai/components-ui";\n`),
      block(
        `export { NavMain as default, NavMain as DashboardNavigation } from "@elabs-ai/components-ui";\n`,
      ),
      block(
        `import { TeamSwitcher, NavUser } from "@elabs-ai/components-ui";\nexport function DashboardSidebar() {\n  return <TeamSwitcher teams={[]} />;\n}\n`,
      ),
      block(
        `export type { TeamSwitcherProps, TeamSwitcherTeam } from "@elabs-ai/components-ui";\n`,
      ),
      block(
        `export function AppSidebar() { return null; }\nexport function MailProvider() { return null; }\n`,
      ),
      block(`import { NavMain } from "@elabs-ai/components-ui";\nexport default NavMain;\n`),
      block(
        `// re-exports the shared TeamSwitcher\n/* export function TeamSwitcher() {} -- old copy */\nconst el = <NavNotifications notifications={[]} />;\n`,
      ),
      // tests, stories and non-sidebar blocks are out of scope
      {
        files: {
          ...block(`export {};\n`).files,
          "registry/blocks/sidebar-02/nav.test.tsx": `export function NavMain() { return null; }\n`,
          "registry/blocks/sidebar-02/nav.stories.tsx": `export function NavMain() { return null; }\n`,
          "registry/blocks/dashboard-01/nav.tsx": `export function NavMain() { return null; }\n`,
        },
      },
    ],
    fail: [
      block(`export function TeamSwitcher() { return null; }\n`),
      block(`export const NavMain = () => null;\n`),
      block(`export class NavUser {}\n`),
      block(`export default function NavNotifications() { return null; }\n`),
      block(`function TeamSwitcher() { return null; }\nexport { TeamSwitcher };\n`),
      block(`const NavMain = (props) => null;\n`),
      block(`function NavUser() { return null; }\nexport default NavUser;\n`),
      block(`const NavUser = React.forwardRef(function NavUser(props, ref) { return null; });\n`),
      // an empty scope fails loudly
      { files: { "registry/blocks/dashboard-01/nav.tsx": `export {};\n` } },
    ],
  },
};
