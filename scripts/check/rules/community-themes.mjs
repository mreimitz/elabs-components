/**
 * community-themes — downloadable theme families in `themes/` are complete and readable (ADR 0036).
 *
 * Per family folder (`auditFamily`, scripts/lib/community-themes.mjs, shared with the
 * Storybook wiring generator and the scaffolder):
 *   - `<slug>-light.css` and/or `<slug>-dark.css` (+ optional `<slug>-fonts.css`), nothing else;
 *   - each is exactly one `[data-theme="<slug>-<scheme>"]` block with a matching `color-scheme`;
 *   - every `THEME_TOKEN_NAMES` token declared, nothing outside the contract (font, radius
 *     and type-scale base overrides allowed);
 *   - the core ink pairs clear WCAG AA, opaque;
 *   - `theme.ts` registers each variant with matching `dark`/`family`, a `familyLabel`, and a README.
 * Zero families is a failure: a gate that audits nothing is not a pass.
 *
 * Staleness of the generated Storybook wiring is NOT checked here (it needs Prettier,
 * async): `node scripts/gen-community-themes.mjs --check`.
 */
import { posix } from "node:path";

import { THEMES_ENGINE_CSS } from "../context.mjs";
import {
  auditFamily,
  rootDeclarationsFrom,
  themeOverridableFrom,
  tokenNamesFrom,
} from "../../lib/community-themes.mjs";

const DIR = "themes";
const TOKEN_NAMES = "packages/tokens/src/theme-token-names.generated.ts";

/** Repo-context I/O for `auditFamily`: paths are repo-relative posix. */
function ctxIo(ctx, tracked) {
  const norm = (p) => p.split("\\").join("/");
  return {
    readdir: (folder) => {
      const prefix = `${norm(folder)}/`;
      const names = new Set();
      for (const f of tracked)
        if (f.startsWith(prefix)) names.add(f.slice(prefix.length).split("/")[0]);
      return [...names];
    },
    read: (p) => ctx.readFile(norm(p)),
    exists: (p) => ctx.exists(posix.normalize(norm(p))),
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--muted",
  "--muted-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--accent",
  "--accent-foreground",
  "--ring",
];
const LIGHT = {
  "--background": "oklch(0.99 0.002 235)",
  "--foreground": "oklch(0.25 0.02 235)",
  "--card": "oklch(1 0 235)",
  "--card-foreground": "var(--foreground)",
  "--popover": "oklch(1 0 235)",
  "--popover-foreground": "oklch(0.25 0.02 235)",
  "--muted": "oklch(0.96 0.002 235)",
  "--muted-foreground": "oklch(0.45 0.012 235)",
  "--primary": "oklch(0.45 0.14 235)",
  "--primary-foreground": "oklch(0.99 0 235)",
  "--secondary": "oklch(0.95 0.003 235)",
  "--secondary-foreground": "oklch(0.25 0.02 235)",
  "--accent": "oklch(0.93 0.025 235)",
  "--accent-foreground": "oklch(0.25 0.02 235)",
  "--ring": "var(--primary)",
};
const DARK = {
  ...LIGHT,
  "--background": "oklch(0.18 0.01 235)",
  "--foreground": "oklch(0.96 0.005 235)",
  "--card": "oklch(0.22 0.01 235)",
  "--popover": "oklch(0.22 0.01 235)",
  "--popover-foreground": "oklch(0.96 0.005 235)",
  "--muted": "oklch(0.26 0.01 235)",
  "--muted-foreground": "oklch(0.78 0.01 235)",
  "--primary": "oklch(0.8 0.12 235)",
  "--primary-foreground": "oklch(0.18 0.01 235)",
  "--secondary": "oklch(0.28 0.01 235)",
  "--secondary-foreground": "oklch(0.96 0.005 235)",
  "--accent": "oklch(0.3 0.03 235)",
  "--accent-foreground": "oklch(0.96 0.005 235)",
};
const css = (slug, scheme, values, head = "") =>
  `/* ${slug} — ${scheme}. --foreground: prose in a comment is ignored. */\n[data-theme="${slug}-${scheme}"] {\n  color-scheme: ${scheme};\n${head}${Object.entries(
    values,
  )
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}\n`;
const themeTs = (slug, schemes = ["light", "dark"], extra = {}) =>
  `import { defineTheme } from "@elabs-ai/components-tokens";\nexport const t = [\n${schemes
    .map(
      (s, i) =>
        `  defineTheme({\n    value: "${slug}-${s}",\n    label: "Ocean ${s}",\n    dark: ${extra[`dark-${s}`] ?? s === "dark"},\n    family: "${extra.family ?? slug}",${i === 0 ? `\n    familyLabel: 'Ocean "Deep"',` : ""}\n  }),`,
    )
    .join("\n")}\n];\n`;

/** A valid two-scheme "ocean" family; `mutate(files)` edits the family files (keys relative to the folder). */
function family(mutate = () => {}, schemes = ["light", "dark"]) {
  const f = {
    "theme.ts": themeTs("ocean", schemes),
    "README.md": "# Ocean\n",
  };
  if (schemes.includes("light")) f["ocean-light.css"] = css("ocean", "light", LIGHT);
  if (schemes.includes("dark")) f["ocean-dark.css"] = css("ocean", "dark", DARK);
  mutate(f);
  const files = {
    [TOKEN_NAMES]: `export const THEME_TOKEN_NAMES = [\n${TOKENS.map((t) => `  "${t}",`).join("\n")}\n] as const;\n`,
    [THEMES_ENGINE_CSS]: `:root {\n  --type-size-display: 2rem;\n  --type-weight-title: 600;\n  --foreground: oklch(0.2 0 0);\n}\n`,
  };
  for (const [name, text] of Object.entries(f))
    if (text !== undefined) files[`${DIR}/ocean/${name}`] = text;
  return { files };
}

export default {
  id: "community-themes",
  scope: "themes",
  doc: "Ship each downloadable theme family in `themes/<slug>/` complete and readable: one `[data-theme]` block per `<slug>-<scheme>.css` with a matching `color-scheme`, every contract token and nothing else, AA ink pairs, and a `theme.ts` + README that agree.",
  baseline: "none",
  run(ctx) {
    for (const required of [TOKEN_NAMES, THEMES_ENGINE_CSS])
      if (!ctx.exists(required))
        return [
          {
            file: required,
            line: 1,
            msg: `${required} is missing — cannot audit community themes`,
          },
        ];
    const tracked = ctx.glob(`${DIR}/*/**`);
    const families = [...new Set(tracked.map((f) => f.split("/")[1]))]
      .filter((n) => !n.startsWith(".") && !n.startsWith("_"))
      .sort();
    if (families.length === 0)
      return [
        {
          file: DIR,
          line: 1,
          msg: `no theme families found in ${DIR}/ — a gate that audits zero families is not a pass`,
        },
      ];
    const engine = ctx.readFile(THEMES_ENGINE_CSS);
    const opts = {
      dir: DIR,
      tokenNames: tokenNamesFrom(ctx.readFile(TOKEN_NAMES)),
      root: rootDeclarationsFrom(engine),
      overridable: themeOverridableFrom(engine),
      io: ctxIo(ctx, tracked),
    };
    return families.flatMap((slug) =>
      auditFamily(slug, opts).errors.map((msg) => {
        const named = msg.match(/^([\w.-]+\.(?:css|ts)): /);
        const file = `${DIR}/${slug}/${named ? named[1] : ""}`.replace(/\/$/, "");
        return {
          file: ctx.exists(file) ? file : `${DIR}/${slug}`,
          line: 1,
          msg: `${slug}: ${msg}`,
        };
      }),
    );
  },
  fixtures: {
    pass: [
      family(),
      family(() => {}, ["dark"]),
      // type-scale base overrides are allowed when the engine declares the role
      family((f) => {
        f["ocean-light.css"] = css(
          "ocean",
          "light",
          LIGHT,
          "  --type-size-display: 1.5rem;\n  --type-weight-title: 700;\n  --radius-base: 0.25rem;\n  --font-sans: Inter, sans-serif;\n",
        );
      }),
      // a fonts stylesheet whose files ship with it
      family((f) => {
        f["ocean-fonts.css"] =
          '@font-face { font-family: "Ocean Sans"; src: url("./fonts/ocean-sans/ocean-sans.woff2") format("woff2"); }';
        f["fonts/ocean-sans/ocean-sans.woff2"] = "";
      }),
    ],
    fail: [
      // empty themes folder
      { files: { [TOKEN_NAMES]: family().files[TOKEN_NAMES], [THEMES_ENGINE_CSS]: ":root {}\n" } },
      // missing contract token
      family((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace(/^\s*--card:.*\n/m, "");
      }),
      // token outside the contract / made-up type role
      family((f) => {
        f["ocean-dark.css"] = f["ocean-dark.css"].replace("{\n", "{\n  --made-up: red;\n");
      }),
      family((f) => {
        f["ocean-dark.css"] = f["ocean-dark.css"].replace(
          "{\n",
          "{\n  --type-size-headline: 2rem;\n",
        );
      }),
      // unreadable body text
      family((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace(
          /--foreground: oklch[^;]+;/,
          "--foreground: oklch(0.95 0.002 235);",
        );
      }),
      // translucent ink
      family((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace(
          /--foreground: oklch[^;]+;/,
          "--foreground: oklch(0 0 0 / 1%);",
        );
      }),
      // color-scheme disagrees with the file
      family((f) => {
        f["ocean-dark.css"] = f["ocean-dark.css"].replace(
          "color-scheme: dark",
          "color-scheme: light",
        );
      }),
      // selector does not match the file name
      family((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace('"ocean-light"', '"ocean"');
      }),
      // theme.ts dark flag / family disagree
      family((f) => {
        f["theme.ts"] = themeTs("ocean", ["light", "dark"], { "dark-dark": false });
      }),
      family((f) => {
        f["theme.ts"] = themeTs("ocean", ["light", "dark"], { family: "sea" });
      }),
      // fonts stylesheet with a missing file and a theme block
      family((f) => {
        f["ocean-fonts.css"] =
          '[data-theme="ocean-light"] { --primary: oklch(0.5 0 0); }\n@font-face { font-family: "Ocean Sans"; src: url("./fonts/ocean-sans/missing.woff2") format("woff2"); }';
      }),
      // stray stylesheet, missing README
      family((f) => {
        f["extra.css"] = "";
        f["README.md"] = undefined;
      }),
    ],
  },
};
