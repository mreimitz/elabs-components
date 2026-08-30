#!/usr/bin/env node
/**
 * vendor-fonts.mjs — download the self-hosted webfonts into src/fonts/.
 *
 * @elabs-ai/components-tokens ships its faces rather than pulling a CDN at runtime, so a
 * consumer gets correct typography with no network dependency and no CSP hole.
 * Inter was originally vendored by hand as `.woff`; this script now vendors it
 * (as `.woff2`) the same reproducible way as the other faces, and can re-run
 * to add weights or families.
 *
 * WHY: `light` / `dark` (the DEFAULT themes) ask for Source Code Pro as their
 * mono, but only Storybook ever loaded it — from Google Fonts, with a comment
 * admitting the gap. Every external consumer silently fell back to a system
 * mono. These are the exact weights Storybook was fetching, so self-hosting
 * makes consumers match Storybook rather than restyling anything.
 *
 * The family is SIL OFL 1.1, which permits redistribution; the licence is
 * vendored next to the files.
 *
 * Usage: node packages/tokens/scripts/vendor-fonts.mjs [--force]
 *   Skips files already present unless --force.
 */
/* global fetch -- Node 18+ ships fetch as a global; this package's ESLint
   config targets browser/React source, so it isn't in its globals list. */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FONTS_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "src", "fonts");
const CDN = "https://cdn.jsdelivr.net/npm";

/**
 * Font families to vendor. Two source-file shapes, since a fixed-weight face
 * and a variable font aren't named the same way upstream:
 *
 *  - `weights` — @fontsource's fixed-weight naming, one file per weight:
 *    `${pkg}-latin-${w}-normal.woff2`. Weights match what
 *    apps/docs/.storybook/preview.css used to fetch (Source Code Pro).
 *  - `files` — an explicit src→dest map, for a variable font whose upstream
 *    package (`@fontsource-variable/<pkg>`) splits each style into SEVEN
 *    per-script unicode-range subsets (latin, latin-ext, cyrillic,
 *    cyrillic-ext, greek, greek-ext, vietnamese) instead of one file per
 *    weight. Issue #16 was scoped as "swap the one Inter file for its woff2
 *    equivalent", but the previously hand-vendored `Inter-Variable.woff`
 *    carries all of these scripts in a single unsubsetted file (verified via
 *    `fontTools` cmap inspection — Latin, Latin Extended, Cyrillic, Cyrillic
 *    Extended, Greek and Vietnamese combining marks all present, 2849 glyphs).
 *    Vendoring only the "latin" file would silently drop the rest, so all
 *    seven subsets are vendored per style (14 files) and declared as 14
 *    separate `@font-face` blocks in themes.css, each scoped by
 *    `unicode-range` — the standard web-font subsetting pattern, and the
 *    reason the *combined* size still comes out well under the original
 *    single file (see themes.css for the measured before/after). `dest`
 *    names follow this repo's `Inter(-Italic)-Variable-<subset>.woff2`
 *    convention rather than upstream's own filenames.
 */
const FAMILIES = [
  {
    pkg: "source-code-pro",
    scope: "@fontsource",
    dir: "source-code-pro",
    weights: [400, 500, 600],
  },
  {
    pkg: "inter",
    scope: "@fontsource-variable",
    dir: "inter",
    files: [
      // normal
      { src: "inter-latin-wght-normal.woff2", dest: "Inter-Variable-latin.woff2" },
      { src: "inter-latin-ext-wght-normal.woff2", dest: "Inter-Variable-latin-ext.woff2" },
      { src: "inter-cyrillic-wght-normal.woff2", dest: "Inter-Variable-cyrillic.woff2" },
      { src: "inter-cyrillic-ext-wght-normal.woff2", dest: "Inter-Variable-cyrillic-ext.woff2" },
      { src: "inter-greek-wght-normal.woff2", dest: "Inter-Variable-greek.woff2" },
      { src: "inter-greek-ext-wght-normal.woff2", dest: "Inter-Variable-greek-ext.woff2" },
      { src: "inter-vietnamese-wght-normal.woff2", dest: "Inter-Variable-vietnamese.woff2" },
      // italic
      { src: "inter-latin-wght-italic.woff2", dest: "Inter-Italic-Variable-latin.woff2" },
      { src: "inter-latin-ext-wght-italic.woff2", dest: "Inter-Italic-Variable-latin-ext.woff2" },
      { src: "inter-cyrillic-wght-italic.woff2", dest: "Inter-Italic-Variable-cyrillic.woff2" },
      {
        src: "inter-cyrillic-ext-wght-italic.woff2",
        dest: "Inter-Italic-Variable-cyrillic-ext.woff2",
      },
      { src: "inter-greek-wght-italic.woff2", dest: "Inter-Italic-Variable-greek.woff2" },
      {
        src: "inter-greek-ext-wght-italic.woff2",
        dest: "Inter-Italic-Variable-greek-ext.woff2",
      },
      {
        src: "inter-vietnamese-wght-italic.woff2",
        dest: "Inter-Italic-Variable-vietnamese.woff2",
      },
    ],
  },
];

const WOFF2_MAGIC = "wOF2";
const force = process.argv.includes("--force");

async function fetchTo(url, dest, { binary }) {
  if (existsSync(dest) && !force) {
    console.log(`  skip   ${dest.slice(FONTS_DIR.length + 1)} (already vendored)`);
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // Never let an HTML error page land on disk as a "font".
  if (binary) {
    if (buf.length < 1024) throw new Error(`suspiciously small (${buf.length}B): ${url}`);
    if (buf.subarray(0, 4).toString("latin1") !== WOFF2_MAGIC) {
      throw new Error(`not a WOFF2 (bad magic "${buf.subarray(0, 4).toString("latin1")}"): ${url}`);
    }
  } else if (!/SIL Open Font License/i.test(buf.toString("utf8"))) {
    throw new Error(`licence text does not look like the OFL: ${url}`);
  }

  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  console.log(`  vendor ${dest.slice(FONTS_DIR.length + 1)} (${buf.length} bytes)`);
}

for (const { pkg, scope, dir, weights, files } of FAMILIES) {
  console.log(`${pkg}:`);
  const sourceFiles =
    files ?? weights.map((w) => ({ src: `${pkg}-latin-${w}-normal.woff2`, dest: null }));
  for (const { src, dest } of sourceFiles) {
    await fetchTo(`${CDN}/${scope}/${pkg}@5/files/${src}`, join(FONTS_DIR, dir, dest ?? src), {
      binary: true,
    });
  }
  await fetchTo(`${CDN}/${scope}/${pkg}@5/LICENSE`, join(FONTS_DIR, dir, "OFL.txt"), {
    binary: false,
  });
}

console.log(
  "\nDone. Faces are declared via @font-face in src/themes.css and copied to dist/ by the build.",
);
