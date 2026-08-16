#!/usr/bin/env node
/**
 * vendor-fonts.mjs — download the self-hosted webfonts into src/fonts/.
 *
 * @elabs/components-tokens ships its faces rather than pulling a CDN at runtime, so a
 * consumer gets correct typography with no network dependency and no CSP hole.
 * Inter and IBM Plex Mono were vendored by hand; this script does the same job
 * reproducibly for the Qlik-theme faces and can re-run to add weights.
 *
 * WHY: `light` / `dark` (the DEFAULT themes) ask for Source Sans Pro
 * and Source Code Pro, but only Storybook ever loaded them — from Google Fonts,
 * with a comment admitting the gap. Every external consumer silently fell back
 * to Helvetica. These are the exact families/weights Storybook was fetching, so
 * self-hosting makes consumers match Storybook rather than restyling anything.
 *
 * Both families are SIL OFL 1.1, which permits redistribution; the licence is
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

/** Weights match what apps/docs/.storybook/preview.css used to fetch. */
const FAMILIES = [
  { pkg: "source-sans-3", dir: "source-sans-3", weights: [400, 600, 700] },
  { pkg: "source-code-pro", dir: "source-code-pro", weights: [400, 500, 600] },
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

for (const { pkg, dir, weights } of FAMILIES) {
  console.log(`${pkg}:`);
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    await fetchTo(`${CDN}/@fontsource/${pkg}@5/files/${file}`, join(FONTS_DIR, dir, file), {
      binary: true,
    });
  }
  await fetchTo(`${CDN}/@fontsource/${pkg}@5/LICENSE`, join(FONTS_DIR, dir, "OFL.txt"), {
    binary: false,
  });
}

console.log(
  "\nDone. Faces are declared via @font-face in src/themes.css and copied to dist/ by the build.",
);
