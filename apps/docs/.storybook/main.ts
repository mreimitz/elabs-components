import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const require = createRequire(import.meta.url);

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Story globs for every package EXCEPT the paused ones.
 *
 * A paused package (`brandUi.paused` in its own package.json — see
 * `.claude/rules/paused-surfaces.md`) is kept as source but must not load: its
 * stories would otherwise appear in the sidebar, run in `test-storybook`, and
 * be swept by the a11y job — i.e. it would still be tested while paused. This
 * enumerates the directories instead of using a `packages/*` wildcard so the
 * exclusion is explicit and cannot be defeated by glob-negation semantics.
 */
function packageStoryGlobs(): string[] {
  const packagesDir = join(REPO_ROOT, "packages");
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      try {
        const pkg = JSON.parse(
          readFileSync(join(packagesDir, entry.name, "package.json"), "utf8"),
        ) as { brandUi?: { paused?: unknown } };
        return pkg.brandUi?.paused == null;
      } catch {
        return false;
      }
    })
    .map((entry) => `../../../packages/${entry.name}/src/**/*.stories.@(ts|tsx)`)
    .sort();
}

const config: StorybookConfig = {
  // Intro docs live here; component stories are co-located in every package.
  // apps/docs/stories also holds cross-package COMPOSITION demos (e.g. the
  // interactive ChartFrame + DataTable flip) that no single library package may
  // own under the one-way dep rule — apps compose siblings freely.
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)", ...packageStoryGlobs()],
  addons: [
    getAbsolutePath("@storybook/addon-themes"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@chromatic-com/storybook"),
    // Testing + agent surface: addon-vitest runs stories as tests; addon-mcp
    // exposes Storybook to coding agents over MCP (see test-storybook setup).
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-mcp"),
  ],
  framework: { name: getAbsolutePath("@storybook/react-vite"), options: {} },
  core: { disableTelemetry: true },
  // Hide the "Become an expert" onboarding-checklist widget at the top of the
  // sidebar (official Storybook feature flag; default true).
  features: { sidebarOnboardingChecklist: false },
  staticDirs: ["../public"],
  managerHead: (head) =>
    `${head}
    <link rel="icon" type="image/svg+xml" href="./qlik-favicon.svg" />
    <style>
      /* Hide the addon-vitest "Run tests" testing-module bar at the sidebar
         bottom. UI-only: the CLI test-storybook script and the MCP
         run-story-tests tool drive Vitest directly, so this does not disable
         any testing — it only removes the in-manager button. */
      #storybook-testing-module { display: none !important; }
    </style>`,
  async viteFinal(viteConfig) {
    viteConfig.plugins = viteConfig.plugins ?? [];
    viteConfig.plugins.push(tailwindcss());

    // Trusted-Types safety — resolve two transitive markdown deps to their
    // DOM-FREE builds (their `browser` condition points at `innerHTML`/
    // `DOMParser` builds, which blank content under Trusted Types). Absolute
    // paths via the CJS resolver: neither package exposes `./index.js` as a
    // subpath. This mirrors apps/playground/vite.config.ts and the snippet in
    // docs/CSP-AND-NETWORK.md §2.2, so we dogfood what we publish.
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias as Record<string, string> | undefined),
      "decode-named-character-reference": require.resolve("decode-named-character-reference"),
      "hast-util-from-html-isomorphic": require.resolve("hast-util-from-html-isomorphic"),
    };
    return viteConfig;
  },
};

export default config;

// Resolves an addon/framework package to an absolute path so Storybook works in
// pnpm's strict node_modules layout (added by the SB10 upgrade automigration).
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
