/**
 * story-coverage.mjs — shared helpers for the story-coverage check rules
 * (`variant-coverage`, `state-coverage`, `loading-states` in scripts/check/rules/).
 * Every read goes through the check runner's `ctx`, so the rules' fixtures stay hermetic.
 */

export const MANIFEST = "brand-ui.manifest.json";

/** `<pkg.path>/src` for a manifest package entry (repo-relative, no leading slash). */
export const pkgSrcDir = (pkg) => (pkg?.path ? `${pkg.path}/src` : "src");

/**
 * Every `*.stories.tsx` under `srcDir` that actually IMPORTS or RENDERS `componentName` —
 * a co-located story file, or a shared story file a sub-/child component is exercised from
 * (`Line` → `line-chart.stories.tsx`). Deliberately narrower than a bare `\bName\b` scan:
 * a prose string like `name: "Terminal error"` must not "prove" coverage of `Terminal`.
 */
export function storyFilesFor(ctx, srcDir, componentName) {
  const importRe = new RegExp(`import\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}\\s*from`);
  const jsxRe = new RegExp(`<${componentName}[\\s/>]`);
  return ctx.glob(`${srcDir}/**/*.stories.tsx`, { ignore: "**/node_modules/**" }).filter((f) => {
    const text = ctx.readFile(f);
    return importRe.test(text) || jsxRe.test(text);
  });
}

/** The manifest, or a finding explaining why it cannot be read. */
export function readManifest(ctx, id) {
  if (!ctx.exists(MANIFEST))
    return {
      error: {
        file: MANIFEST,
        line: 1,
        msg: `${id}: ${MANIFEST} not found — run \`pnpm gen\`.`,
      },
    };
  try {
    return { manifest: ctx.json(MANIFEST) };
  } catch {
    return { error: { file: MANIFEST, line: 1, msg: `${id}: ${MANIFEST} failed to parse.` } };
  }
}
