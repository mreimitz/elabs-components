import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for issue #26 — `react-hook-form` / `@hookform/resolvers`
 * are used ONLY by the RHF-bound `Form` family
 * (`packages/ui/src/components/form/form.tsx`); `FieldRow` and every other
 * component in this package render from plain props and never import either.
 *
 * A consumer who never imports `Form` should not be forced to install (or
 * have their bundler resolve) react-hook-form. Declaring both as
 * `dependencies` defeats that — npm/pnpm install them unconditionally for
 * every consumer of `@elabs-ai/components-ui`, regardless of whether `Form`
 * is ever imported. This test locks the fix: both packages are declared as
 * OPTIONAL peers, and neither reappears as a hard `dependency`.
 *
 * `zod` is used only inside `form.stories.tsx` (the `zodResolver` demo) and
 * never in shipped runtime source — it belongs in `devDependencies`, never as
 * a runtime `dependency` or a peer a consumer must install.
 */
const PACKAGE_JSON_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

function readPackageJson(): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
} {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
}

describe("packages/ui/package.json — react-hook-form is an optional peer, not a hard dependency", () => {
  const pkg = readPackageJson();

  it.each(["react-hook-form", "@hookform/resolvers"])(
    "declares %s as an OPTIONAL peerDependency",
    (name) => {
      expect(pkg.dependencies?.[name]).toBeUndefined();
      expect(pkg.peerDependencies?.[name]).toBeTruthy();
      expect(pkg.peerDependenciesMeta?.[name]?.optional).toBe(true);
    },
  );

  it("still lists react-hook-form + @hookform/resolvers as devDependencies for the workspace's own build/test", () => {
    // The package's own `Form` tests/stories (and `form.tsx` itself) need the
    // real library to typecheck/run inside this workspace — peer alone does
    // not guarantee resolution here, only for an external consumer.
    expect(pkg.devDependencies?.["react-hook-form"]).toBeTruthy();
    expect(pkg.devDependencies?.["@hookform/resolvers"]).toBeTruthy();
  });

  it("declares zod as a devDependency only — never a runtime dependency or peer", () => {
    expect(pkg.dependencies?.zod).toBeUndefined();
    expect(pkg.peerDependencies?.zod).toBeUndefined();
    expect(pkg.devDependencies?.zod).toBeTruthy();
  });
});
