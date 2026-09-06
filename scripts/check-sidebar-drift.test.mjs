/**
 * check-sidebar-drift.test.mjs — locks the #99 sidebar drift-guard gate.
 * Run in CI: `node --test scripts/check-sidebar-drift.test.mjs`.
 *
 * Most fixtures are INLINE strings (hermetic — never real files); the
 * "real filesystem lookup" section below is a deliberate exception (see the
 * comment there) — it is the case that let a self-tested gate go dark after
 * the app-shell-blocks move silently blinded it (task-12 fix round 2).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findSidebarDriftViolations,
  GUARDED,
  BLOCKS_DIR,
  listSidebarBlockFiles,
  scanSidebarBlocksOrThrow,
} from "./check-sidebar-drift.mjs";

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
  const src = `import { Sidebar } from "@elabs-ai/components-ui";

export function TeamSwitcher() { return null; }
`;
  const [v] = findSidebarDriftViolations(src);
  assert.equal(v.name, "TeamSwitcher");
  assert.equal(v.line, 3);
});

// ── Reuse (re-export / import) — must NOT FLAG ───────────────────────────────

test("DOES NOT FLAG: export { TeamSwitcher } from @elabs-ai/components-ui (pass-through)", () => {
  assert.ok(isClean(`export { TeamSwitcher } from "@elabs-ai/components-ui";`));
});

test("DOES NOT FLAG: aliased re-export — export { NavMain as X } from @elabs-ai/components-ui", () => {
  assert.ok(isClean(`export { NavMain as DashboardNavigation } from "@elabs-ai/components-ui";`));
});

test("DOES NOT FLAG: multi-name aliased re-export with `as default`", () => {
  assert.ok(
    isClean(
      `export { NavMain as default, NavMain as DashboardNavigation } from "@elabs-ai/components-ui";`,
    ),
  );
});

test("DOES NOT FLAG: import { TeamSwitcher } from @elabs-ai/components-ui usage", () => {
  const src = `
import { TeamSwitcher, NavUser } from "@elabs-ai/components-ui";
export function DashboardSidebar() {
  return <TeamSwitcher teams={[]} />;
}
`;
  assert.ok(isClean(src));
});

test("DOES NOT FLAG: aliased re-export — NavNotifications as NotificationsPopover", () => {
  assert.ok(
    isClean(`export { NavNotifications as NotificationsPopover } from "@elabs-ai/components-ui";`),
  );
});

test("DOES NOT FLAG: every guarded name as a pass-through re-export", () => {
  for (const name of GUARDED) {
    assert.ok(
      isClean(`export { ${name} } from "@elabs-ai/components-ui";`),
      `${name} re-export should be clean`,
    );
    assert.ok(
      isClean(`export { ${name} as Foo } from "@elabs-ai/components-ui";`),
      `${name} aliased re-export should be clean`,
    );
  }
});

test("DOES NOT FLAG: export type { TeamSwitcherProps } (types only)", () => {
  assert.ok(
    isClean(`export type { TeamSwitcherProps, TeamSwitcherTeam } from "@elabs-ai/components-ui";`),
  );
});

test("DOES NOT FLAG: a non-guarded local declaration (block-local AppSidebar wrapper)", () => {
  // sidebar-04/05 legitimately declare a block-local `AppSidebar` composition.
  assert.ok(isClean(`export function AppSidebar() { return null; }`));
  assert.ok(isClean(`export function MailProvider() { return null; }`));
});

test("DOES NOT FLAG: export default bare identifier that was imported, not declared", () => {
  const src = `
import { NavMain } from "@elabs-ai/components-ui";
export default NavMain;
`;
  assert.ok(isClean(src));
});

test("DOES NOT FLAG: comments mentioning a guarded primitive", () => {
  assert.ok(isClean(`// re-exports the shared TeamSwitcher from @elabs-ai/components-ui`));
  assert.ok(isClean(`/* export function TeamSwitcher() {} -- old copy, removed */`));
});

test("DOES NOT FLAG: a guarded name used only as a JSX tag / call site", () => {
  assert.ok(isClean(`const el = <NavNotifications notifications={[]} />;`));
});

// ── Real filesystem lookup — the gate's actual blind spot ────────────────────
//
// Every test above drives findSidebarDriftViolations() against an INLINE
// string — it never touches disk, so it could never have caught the #99 gate
// silently scanning zero files after BLOCKS_DIR went stale (the app-shell-
// blocks move ported the blocks from packages/ui/src/blocks into
// registry/blocks, and listSidebarBlockFiles() swallowed the resulting
// readdirSync failure and returned []). These tests exercise the REAL
// filesystem lookup so that class of regression fails the suite again.

test("REAL FS: listSidebarBlockFiles() finds a non-zero number of real registry blocks", () => {
  const files = listSidebarBlockFiles();
  assert.ok(
    files.length > 0,
    `expected at least one sidebar block file under ${BLOCKS_DIR} — an empty result here is ` +
      `exactly how the gate went blind after a blocks-directory move`,
  );
  for (const f of files) {
    assert.match(f, /\.(ts|tsx)$/);
  }
});

test("REAL FS: scanSidebarBlocksOrThrow() does not throw against the real BLOCKS_DIR", () => {
  const files = scanSidebarBlocksOrThrow();
  assert.ok(files.length > 0);
});

test("REAL FS: scanSidebarBlocksOrThrow() FAILS LOUDLY when the directory does not exist", () => {
  const missing = join(tmpdir(), "sidebar-drift-check-does-not-exist-" + Date.now());
  assert.throws(
    () => scanSidebarBlocksOrThrow(missing),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /found no sidebar block files to scan/);
      assert.ok(
        err.message.includes(missing),
        "error message should name the directory it looked in",
      );
      return true;
    },
  );
});

test("REAL FS: scanSidebarBlocksOrThrow() FAILS LOUDLY on an existing directory with no sidebar-* blocks", () => {
  const emptyDir = mkdtempSync(join(tmpdir(), "sidebar-drift-check-empty-"));
  try {
    assert.throws(() => scanSidebarBlocksOrThrow(emptyDir), /found no sidebar block files to scan/);
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("REAL FS: listSidebarBlockFiles() returns [] (not a throw) for a missing directory — scanSidebarBlocksOrThrow is the loud wrapper", () => {
  const missing = join(tmpdir(), "sidebar-drift-check-does-not-exist-" + Date.now());
  assert.deepEqual(listSidebarBlockFiles(missing), []);
});
