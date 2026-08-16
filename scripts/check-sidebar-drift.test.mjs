/**
 * check-sidebar-drift.test.mjs — locks the #99 sidebar drift-guard gate.
 * Run in CI: `node --test scripts/check-sidebar-drift.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic — never real files).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findSidebarDriftViolations, GUARDED } from "./check-sidebar-drift.mjs";

const isClean = (src) => findSidebarDriftViolations(src).length === 0;
const hasViolation = (src) => findSidebarDriftViolations(src).length > 0;
const flagged = (src) => findSidebarDriftViolations(src).map((v) => v.name);

// ── Local re-declaration — must FLAG (drift) ─────────────────────────────────

test("FLAGS: export function TeamSwitcher (local re-declaration)", () => {
  assert.ok(hasViolation(`export function TeamSwitcher() { return null; }`));
});

test("FLAGS: export const NavMain = (local component)", () => {
  assert.ok(hasViolation(`export const NavMain = () => null;`));
});

test("FLAGS: export class NavUser (local class component)", () => {
  assert.ok(hasViolation(`export class NavUser {}`));
});

test("FLAGS: export default function NavNotifications", () => {
  assert.ok(hasViolation(`export default function NavNotifications() { return null; }`));
});

test("FLAGS: every one of the four guarded names when re-declared", () => {
  for (const name of GUARDED) {
    const src = `export function ${name}() { return null; }`;
    assert.ok(hasViolation(src), `expected ${name} to be flagged`);
    assert.deepEqual(flagged(src), [name]);
  }
});

test("FLAGS: non-exported local re-implementation (function)", () => {
  const src = `
function TeamSwitcher() { return null; }
export { TeamSwitcher };
`;
  assert.ok(hasViolation(src));
});

test("FLAGS: non-exported local re-implementation (arrow const)", () => {
  assert.ok(hasViolation(`const NavMain = (props) => null;`));
});

test("FLAGS: export default bare identifier backed by a local declaration", () => {
  const src = `
function NavUser() { return null; }
export default NavUser;
`;
  assert.ok(hasViolation(src));
});

test("reports the correct line number", () => {
  const src = `import { Sidebar } from "@qlik-coe-emea/qlabs-components-ui";

export function TeamSwitcher() { return null; }
`;
  const [v] = findSidebarDriftViolations(src);
  assert.equal(v.name, "TeamSwitcher");
  assert.equal(v.line, 3);
});

// ── Reuse (re-export / import) — must NOT FLAG ───────────────────────────────

test("DOES NOT FLAG: export { TeamSwitcher } from @qlik-coe-emea/qlabs-components-ui (pass-through)", () => {
  assert.ok(isClean(`export { TeamSwitcher } from "@qlik-coe-emea/qlabs-components-ui";`));
});

test("DOES NOT FLAG: aliased re-export — export { NavMain as X } from @qlik-coe-emea/qlabs-components-ui", () => {
  assert.ok(
    isClean(`export { NavMain as DashboardNavigation } from "@qlik-coe-emea/qlabs-components-ui";`),
  );
});

test("DOES NOT FLAG: multi-name aliased re-export with `as default`", () => {
  assert.ok(
    isClean(
      `export { NavMain as default, NavMain as DashboardNavigation } from "@qlik-coe-emea/qlabs-components-ui";`,
    ),
  );
});

test("DOES NOT FLAG: import { TeamSwitcher } from @qlik-coe-emea/qlabs-components-ui usage", () => {
  const src = `
import { TeamSwitcher, NavUser } from "@qlik-coe-emea/qlabs-components-ui";
export function DashboardSidebar() {
  return <TeamSwitcher teams={[]} />;
}
`;
  assert.ok(isClean(src));
});

test("DOES NOT FLAG: aliased re-export — NavNotifications as NotificationsPopover", () => {
  assert.ok(
    isClean(
      `export { NavNotifications as NotificationsPopover } from "@qlik-coe-emea/qlabs-components-ui";`,
    ),
  );
});

test("DOES NOT FLAG: every guarded name as a pass-through re-export", () => {
  for (const name of GUARDED) {
    assert.ok(
      isClean(`export { ${name} } from "@qlik-coe-emea/qlabs-components-ui";`),
      `${name} re-export should be clean`,
    );
    assert.ok(
      isClean(`export { ${name} as Foo } from "@qlik-coe-emea/qlabs-components-ui";`),
      `${name} aliased re-export should be clean`,
    );
  }
});

test("DOES NOT FLAG: export type { TeamSwitcherProps } (types only)", () => {
  assert.ok(
    isClean(
      `export type { TeamSwitcherProps, TeamSwitcherTeam } from "@qlik-coe-emea/qlabs-components-ui";`,
    ),
  );
});

test("DOES NOT FLAG: a non-guarded local declaration (block-local AppSidebar wrapper)", () => {
  // sidebar-04/05 legitimately declare a block-local `AppSidebar` composition.
  assert.ok(isClean(`export function AppSidebar() { return null; }`));
  assert.ok(isClean(`export function MailProvider() { return null; }`));
});

test("DOES NOT FLAG: export default bare identifier that was imported, not declared", () => {
  const src = `
import { NavMain } from "@qlik-coe-emea/qlabs-components-ui";
export default NavMain;
`;
  assert.ok(isClean(src));
});

test("DOES NOT FLAG: comments mentioning a guarded primitive", () => {
  assert.ok(
    isClean(`// re-exports the shared TeamSwitcher from @qlik-coe-emea/qlabs-components-ui`),
  );
  assert.ok(isClean(`/* export function TeamSwitcher() {} -- old copy, removed */`));
});

test("DOES NOT FLAG: a guarded name used only as a JSX tag / call site", () => {
  assert.ok(isClean(`const el = <NavNotifications notifications={[]} />;`));
});
