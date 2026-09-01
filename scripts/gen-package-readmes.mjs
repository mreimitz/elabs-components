#!/usr/bin/env node
/**
 * gen-package-readmes.mjs — every published package ships the getting-started guide.
 *
 * WHY: a developer reaching for `@elabs-ai/components-ui` lands on the package
 * directory and reads its README. Before this, 9 of 12 distributable packages
 * had **no README at all** — the `ui` package shipped zero documentation — so
 * the entry point was blank and the real guide was buried in `docs/CONSUMING.md`.
 *
 * This generates a "Getting started" region into every distributable package's
 * README: install, the Tailwind wiring (the #1 mistake), that package's own
 * peers/extras, and how to make a coding agent aware of it.
 *
 * The region lives between markers, so hand-written prose ABOVE and BELOW it is
 * preserved — `ai`, `editor` and `maps` already had real content and keep it.
 *
 * The license/install story is DERIVED, per package, from that package's own
 * `package.json` (`license`, `private`) — not a hardcoded private-repo template
 * (issue #28). All 12 distributable packages are `"license": "MIT"` and
 * published to the public npm registry today; a genuinely private package
 * (`private: true`) still gets the private/`workspace:*` language, so this
 * cannot regress into a blanket replace.
 *
 * Source of truth: PKG_PURPOSE (packages/cli/lib/render-docs.mjs),
 * brand-ui.manifest.json, and each package's own package.json. Never
 * hand-edit inside the markers.
 *
 * Usage:
 *   node scripts/gen-package-readmes.mjs           write
 *   node scripts/gen-package-readmes.mjs --check   fail if any README is stale
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PKG_PURPOSE } from "../packages/cli/lib/render-docs.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const START = "<!-- brand-ui:gen:readme:start -->";
const END = "<!-- brand-ui:gen:readme:end -->";
const SCOPE = "@elabs-ai";

/**
 * Per-package extras a consumer must know at install time. Only what is
 * genuinely package-specific — the shared setup is in the common region.
 */
const EXTRAS = {
  [`${SCOPE}/components-tokens`]: [
    "`tailwindcss` `^4` is a peer — it must be the SAME instance that processes the token stylesheet.",
    "Ships the shipped themes and the self-hosted fonts. Everything else depends on this package.",
    "Font smoothing is already applied: the stylesheet's `@layer base` `body` rule sets `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale`. **Do not re-add those two lines in your app CSS** — importing `styles.css` is enough. It is a base-layer rule, so an app that genuinely wants subpixel rendering can still override it.",
  ],
  [`${SCOPE}/components-editor`]: [
    "`monaco-editor` is a peer — it owns `globalThis.MonacoEnvironment`, so two copies break it.",
    "Import `.../monaco-environment` once at your app entry to enable language workers (Vite-only).",
    "`./markdown/parse` and `./markdown/frontmatter` are pure, Monaco-free and server-safe.",
  ],
  [`${SCOPE}/components-maps`]: [
    "`maplibre-gl` is a peer — it owns a WebGL context and global CSS.",
    "No CSS import needed: `MapCanvas` pulls in MapLibre's stylesheet and the brand overrides itself.",
  ],
  [`${SCOPE}/components-flow`]: [
    "`@xyflow/react` is a peer — it carries the React context `useReactFlow` reads, so two copies break.",
    'Import `"@xyflow/react/dist/style.css"` once.',
  ],
  [`${SCOPE}/components-ai`]: [
    "`ai` (Vercel AI SDK) is a **types-only, optional** peer — your app owns the model calls.",
    "`@xyflow/react` is a peer too (required), if you render the agent canvas.",
    '`mermaid`, `@rive-app/react-webgl2`, `@xterm/xterm` + `@xterm/addon-fit` and `media-chrome` are optional peers reached only through a lazy `import()` (ADR 0019) — see "Only install what you render" below.',
  ],
  [`${SCOPE}/components-charts`]: [
    '`@visx/*`-backed charts do not render meaningfully under jsdom. `.../test` is the official jsdom-safe test double — `vi.mock("@elabs-ai/components-charts", () => import("@elabs-ai/components-charts/test"))` — and still THROWS on a missing/invalid required prop, so a mocked test doesn\'t silently pass a broken chart.',
  ],
  [`${SCOPE}/components-ui`]: [
    "The class-merge helper is at `.../lib/cn` — a pure, server-safe entry point.",
  ],
  [`${SCOPE}/components-cli`]: [
    "Provides the `brand-ui` binary. Bundles the component manifest, so it answers with no monorepo, no network and no dev server.",
  ],
};

/**
 * Packages whose optional peers must NOT get an unconditional `pnpm add`
 * line in the base Install block, because they already document a per-format
 * / per-feature opt-in install story elsewhere in their README (hand-written
 * prose below the generated markers). `@elabs-ai/components-viewer` declares
 * SEVEN optional adapter peers (papaparse, pdfjs-dist, mammoth, xlsx, jszip,
 * shiki, streamdown) precisely so an app that only opens CSVs never downloads
 * a PDF or spreadsheet parser — blanket-installing all seven in the base
 * Install block would contradict that design and the README's own "Only
 * install what you open" table.
 *
 * `@elabs-ai/components-ai` joined this set once issue #33 moved its four
 * lazy engines (mermaid, `@rive-app/react-webgl2`, `@xterm/xterm` +
 * `@xterm/addon-fit`, `media-chrome`) to optional peers alongside the
 * pre-existing `ai` SDK peer — the SAME per-feature-adapter shape as the
 * viewer, not the single-broadly-relevant-peer shape this comment used to
 * cite `ai` as an example of. `@elabs-ai/components-ai`'s hand-written
 * prose below the markers carries its own "Only install what you render"
 * table covering all six.
 *
 * Keep this list to genuine per-feature-adapter packages — a package with
 * ONE broadly-relevant optional peer and nothing else belongs in the base
 * Install block, not here.
 */
const SKIP_OPTIONAL_PEER_INSTALL = new Set([
  `${SCOPE}/components-viewer`,
  `${SCOPE}/components-ai`,
]);

/** The generated region for one package. */
export function renderReadmeRegion(
  pkgName,
  { purpose, componentCount, sample, extras, license, isPrivate, optionalPeers = [] },
) {
  const short = pkgName.replace(`${SCOPE}/components-`, "");
  const isCli = short === "cli";
  const isTokens = short === "tokens";

  const lines = [
    START,
    "<!-- Generated by scripts/gen-package-readmes.mjs — do not edit inside these markers. -->",
    "",
    `# \`${pkgName}\``,
    "",
  ];

  if (purpose) lines.push(`> ${purpose}`, "");

  lines.push(`Part of **brand-ui**, a source-owned, token-driven React component system.`);

  if (isPrivate) {
    lines.push(
      `These packages are **private** and are not published to any registry — they are`,
      `consumed from this workspace. See \`docs/CONSUMING.md\`.`,
      "",
      "## Install",
      "",
      "Inside this monorepo the packages resolve as workspace dependencies:",
      "",
      "```json",
      `"${pkgName}": "workspace:*"`,
      "```",
      "",
    );
  } else {
    lines.push(
      `Published to the **public npm registry** under the \`${SCOPE}\` scope — it`,
      `installs like any other npm dependency, with no registry configuration and`,
      `no token required. See \`docs/CONSUMING.md\`.`,
      "",
      "## Install",
      "",
      "```bash",
      isCli
        ? `pnpm add -D ${pkgName}`
        : isTokens
          ? `pnpm add ${pkgName}`
          : `pnpm add ${SCOPE}/components-tokens ${pkgName}`,
      // Optional peers (peerDependenciesMeta[name].optional === true) are NOT
      // auto-installed by npm/pnpm — a bare install above silently omits them,
      // so a consumer whose app doesn't already declare a compatible version
      // hits a missing-module/type error the moment they import from this
      // package. Spell out the exact supported range from THIS package's own
      // package.json (never hand-typed) so the install guide can't drift from
      // the peer contract it documents (#12/#53 review, P2).
      ...optionalPeers.map((p) => `pnpm add ${p.name}@"${p.range}"  # optional peer`),
      "```",
      "",
    );
  }

  if (!isCli) {
    lines.push(
      "## Set up styling (do not skip)",
      "",
      "Components are Tailwind v4 classes backed by semantic tokens. Two lines in",
      "your CSS entry, or **everything renders unstyled** — the single most common",
      "mistake:",
      "",
      "```css",
      `@import "${SCOPE}/components-tokens/styles.css";`,
      `@source "../node_modules/${pkgName}/dist";`,
      "```",
      "",
      "The `@source` line is required because Tailwind ignores `node_modules`. Add",
      "one per brand-ui package you render. Then wrap your app once:",
      "",
      "```tsx",
      `import { ThemeProvider } from "${SCOPE}/components-tokens";`,
      "",
      '<ThemeProvider defaultTheme="light">{children}</ThemeProvider>;',
      "```",
      "",
    );
  }

  if (extras.length > 0) {
    lines.push("## This package specifically", "", ...extras.map((e) => `- ${e}`), "");
  }

  if (!isCli && componentCount > 0) {
    lines.push(
      `## What's in it`,
      "",
      `${componentCount} exported component${componentCount === 1 ? "" : "s"}${
        sample.length > 0 ? ` — including ${sample.map((s) => `\`${s}\``).join(", ")}.` : "."
      }`,
      "",
      "Don't guess the API — ask the CLI:",
      "",
      "```bash",
      `pnpm add -D ${SCOPE}/components-cli`,
      `pnpm exec brand-ui search <query>   # find a component`,
      `pnpm exec brand-ui docs <Name>      # its real props, from source`,
      "```",
      "",
    );
  }

  lines.push(
    "## Using an AI coding agent?",
    "",
    "For Claude Code, install the plugin from this repo's checkout:",
    "",
    "```",
    "/plugin marketplace add .",
    "/plugin install brand-ui",
    "```",
    "",
    "`brand-ui docs <Name>` returns intent, composition, state→token mappings and",
    "anti-patterns — tell your agent to run it instead of guessing a prop. The CLI",
    "also runs as an MCP server (`brand-ui mcp`).",
    "",
    "## Full guide",
    "",
    `Tailwind and Next.js wiring, per-package extras, agent enablement and a`,
    `prompt for migrating an existing project: \`docs/CONSUMING.md\`.`,
    "",
    "## License",
    "",
    license ?? (isPrivate ? "UNLICENSED — private." : "UNLICENSED"),
    // Prettier inserts a blank line before a trailing HTML comment. Emitting it
    // here keeps `gen -> format -> gen:readmes:check` convergent; without it the
    // formatter and the generator fight and the gate can never go green.
    "",
    END,
  );

  return lines.join("\n");
}

/**
 * Explicit "cannot drift again" assertion (issue #28): does an EXISTING
 * generated README's `## License` line still agree with that package's own
 * `package.json`? Returns `null` when they agree (or there is nothing yet to
 * compare), or a human-readable mismatch message otherwise. This is
 * independent of — and a narrower, more legible check than — the general
 * "is the whole region stale" diff below, so a future refactor of the
 * template can't silently drop the license guarantee.
 */
export function licenseMismatch(existingReadme, pkg) {
  if (!existingReadme) return null;
  const start = existingReadme.indexOf(START);
  const end = existingReadme.indexOf(END);
  if (start === -1 || end === -1 || end <= start) return null;
  const region = existingReadme.slice(start, end);
  const marker = "## License";
  const markerIdx = region.indexOf(marker);
  if (markerIdx === -1) return null;
  const after = region.slice(markerIdx + marker.length).split("\n");
  const onDisk = after.map((l) => l.trim()).find((l) => l.length > 0);
  if (onDisk == null) return null;

  const expected = pkg.license ?? (pkg.private === true ? "UNLICENSED — private." : "UNLICENSED");
  if (onDisk !== expected) {
    return `README says "${onDisk}" but package.json says "${pkg.license ?? "(no license field)"}"`;
  }
  return null;
}

/**
 * The `{ name, range }` optional peers declared in a package's own
 * `package.json` — `peerDependenciesMeta[name].optional === true`, paired
 * with that peer's `peerDependencies[name]` range. Derived, never
 * hand-maintained, so the generated install guide can't drift from the real
 * peer contract (#12/#53 review, P2 — the `ai` peer widened to `^6 || ^7`
 * and went `optional: true` without the install guide ever mentioning it).
 */
export function optionalPeersOf(pkg) {
  const meta = pkg.peerDependenciesMeta ?? {};
  const peers = pkg.peerDependencies ?? {};
  return Object.keys(meta)
    .filter((name) => meta[name]?.optional === true && peers[name])
    .sort()
    .map((name) => ({ name, range: peers[name] }));
}

/** Splice the region into existing content, preserving anything outside it. */
export function spliceRegion(existing, region) {
  if (!existing) return region + "\n";
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + region + existing.slice(e + END.length);
  }
  // No markers yet: put the generated block first, keep prior prose beneath it.
  return `${region}\n\n---\n\n${existing.trim()}\n`;
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
// Only run when executed directly (not when imported by the self-test) —
// mirrors the guard in scripts/check-agent-names.mjs.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) runCli();

function runCli() {
  const check = process.argv.includes("--check");
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"));

  const stale = [];
  const licenseMismatches = [];
  let written = 0;

  for (const dir of readdirSync(join(REPO_ROOT, "packages")).sort()) {
    const pkgPath = join(REPO_ROOT, "packages", dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    // Publishable only — mirrors set-version.mjs / check-publish-ready.mjs.
    if (!(pkg.publishConfig || pkg.private !== true)) continue;

    const info = manifest.packages?.[pkg.name] ?? {};
    const components = info.components ?? [];
    const isPrivate = pkg.private === true;
    const region = renderReadmeRegion(pkg.name, {
      purpose: PKG_PURPOSE[pkg.name],
      componentCount: components.length,
      sample: components
        .slice(0, 5)
        .map((c) => (typeof c === "string" ? c : c.name))
        .filter(Boolean),
      extras: EXTRAS[pkg.name] ?? [],
      license: pkg.license ?? null,
      isPrivate,
      optionalPeers: SKIP_OPTIONAL_PEER_INSTALL.has(pkg.name) ? [] : optionalPeersOf(pkg),
    });

    const readmePath = join(REPO_ROOT, "packages", dir, "README.md");
    const existing = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
    const next = spliceRegion(existing, region);

    if (check) {
      const mismatch = licenseMismatch(existing, pkg);
      if (mismatch) licenseMismatches.push(`packages/${dir}/README.md: ${mismatch}`);
    }

    if (next !== existing) {
      if (check) stale.push(`packages/${dir}/README.md`);
      else {
        writeFileSync(readmePath, next);
        written++;
      }
    }
  }

  if (check) {
    if (licenseMismatches.length > 0) {
      console.error(
        `✖ package README license sections DISAGREE with package.json (${licenseMismatches.length}):\n` +
          licenseMismatches.map((s) => "  - " + s).join("\n") +
          "\n\n  Run `pnpm gen:readmes` and commit the result.",
      );
      process.exit(1);
    }
    if (stale.length > 0) {
      console.error(
        `✖ package READMEs are STALE (${stale.length}):\n` +
          stale.map((s) => "  - " + s).join("\n") +
          "\n\n  Run `pnpm gen:readmes` and commit the result.\n" +
          "  These READMEs are what a consumer sees on the GitHub Packages page.",
      );
      process.exit(1);
    }
    console.log("✔ package READMEs are fresh.");
  } else {
    console.log(`✔ package READMEs: ${written} written.`);
  }
}
