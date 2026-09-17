// Self-test for the theme kit shipped with the brand-ui-create-theme / brand-ui-update-theme
// plugin skills. It lives here (not beside the script) so `pnpm check:test` runs it and the
// plugin does not ship it. The kit is zero-dependency and must agree with the repo's own
// community-themes gate — the parity tests below pin that.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { contrast as repoContrast } from "./lib/community-themes.mjs";
import {
  applyTokens,
  auditTheme,
  contractFromCss,
  contrast,
  escapeHtml,
  renderProposal,
  svgToToken,
  themeBlocks,
  toOklch,
} from "../skills/brand-ui-create-theme/scripts/theme-kit.mjs";

// Hex → oklch pairs measured for the Qlik family and committed in themes/qlik/qlik-light.css.
const QLIK = [
  ["#00873D", "oklch(0.545 0.149 150.2)"],
  ["#D7004B", "oklch(0.559 0.224 13.9)"],
  ["#005DB9", "oklch(0.488 0.163 255.5)"],
  ["#009845", "oklch(0.594 0.163 150)"],
  ["#54565A", "oklch(0.453 0.007 264.5)"],
  ["#19426C", "oklch(0.373 0.086 251.7)"],
  ["#404040", "oklch(0.371 0 0)"],
  ["#6E6E6E", "oklch(0.538 0 0)"],
  ["#FAFAFA", "oklch(0.985 0 0)"],
  ["#FFFFFF", "oklch(1 0 0)"],
];

test("toOklch reproduces the committed Qlik conversions", () => {
  for (const [hex, expected] of QLIK) assert.equal(toOklch(hex), expected, hex);
});

test("toOklch accepts the colour syntaxes brand sources use", () => {
  assert.equal(toOklch("#fff"), "oklch(1 0 0)");
  assert.equal(toOklch("rgb(0, 135, 61)"), toOklch("#00873D"));
  assert.equal(toOklch("rgb(0 135 61)"), toOklch("#00873D"));
  assert.equal(toOklch("hsl(120 100% 50%)"), toOklch("#00FF00"));
  assert.equal(toOklch("hsl(210, 50%, 40%)"), toOklch("rgb(51, 102, 153)"));
  assert.equal(toOklch("white"), "oklch(1 0 0)");
  assert.equal(toOklch("black"), "oklch(0 0 0)");
  assert.equal(toOklch("rgba(0,0,0,.6)"), "oklch(0 0 0 / 0.6)");
  assert.equal(toOklch("#00000099"), "oklch(0 0 0 / 0.6)");
  assert.equal(toOklch("oklch(0.5 0.1 200)"), "oklch(0.5 0.1 200)");
  assert.equal(toOklch("not-a-colour"), null);
});

test("contrast agrees with the community-themes gate on oklch literals", () => {
  const pairs = [
    ["#404040", "#FAFAFA"],
    ["#FFFFFF", "#00873D"],
    ["#6E6E6E", "#FFFFFF"],
    ["#10CFC9", "#FFFFFF"],
  ];
  for (const [fg, bg] of pairs) {
    const ours = contrast(fg, bg);
    const gate = repoContrast(toOklch(fg), toOklch(bg));
    assert.ok(Math.abs(ours - gate) < 0.02, `${fg} on ${bg}: kit ${ours} vs gate ${gate}`);
  }
  assert.ok(Math.abs(contrast("#000", "#fff") - 21) < 0.01);
});

const SVG = `<?xml version="1.0"?>
<!-- exported -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50">
  <path fill="#29B5E8" d="M0 0h200v50H0z"/>
</svg>`;

test("svgToToken builds a CSS data-URI token and the lockup aspect", () => {
  const { token, aspect } = svgToToken(SVG);
  assert.equal(aspect, 4);
  assert.match(token, /^url\("data:image\/svg\+xml,%3Csvg /);
  assert.ok(!token.slice(5, -2).includes('"'), "double quotes inside the URI are rewritten");
  assert.ok(token.includes("%2329B5E8"), "# is percent-encoded");
  assert.ok(!token.includes("<!--") && !token.includes("?xml"), "prolog and comments dropped");
});

test("svgToToken refuses SVGs that script or reach the network", () => {
  assert.throws(() => svgToToken('<svg viewBox="0 0 1 1"><script>x()</script></svg>'), /script/);
  assert.throws(() => svgToToken('<svg viewBox="0 0 1 1" onload="x()"></svg>'), /event handler/);
  assert.throws(
    () => svgToToken('<svg viewBox="0 0 1 1"><image href="https://x.test/a.png"/></svg>'),
    /external/,
  );
  assert.throws(() => svgToToken("<svg><path d='M0 0'/></svg>"), /viewBox/);
});

const CONTRACT_CSS = `/* reference */
[data-theme="light"] {
  color-scheme: light;
  --radius-base: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.2 0 0);
  --primary: oklch(0.45 0.1 250);
  --primary-foreground: oklch(1 0 0);
  --ring: var(--primary);
}`;

test("contractFromCss reads token names, excluding theme-overridable machinery", () => {
  assert.deepEqual(contractFromCss(CONTRACT_CSS), [
    "--background",
    "--foreground",
    "--primary",
    "--primary-foreground",
    "--ring",
  ]);
});

test("applyTokens renames the block, converts colours and keeps the rest", () => {
  const out = applyTokens(CONTRACT_CSS, {
    name: "acme-dark",
    scheme: "dark",
    header: "Acme — dark",
    tokens: { "--primary": "#29B5E8", "--radius-base": "0.25rem", "--foreground": "var(--card)" },
  });
  const [block] = themeBlocks(out);
  assert.equal(block.name, "acme-dark");
  assert.equal(block.decls.get("color-scheme"), "dark");
  assert.equal(block.decls.get("--primary"), toOklch("#29B5E8"));
  assert.equal(block.decls.get("--radius-base"), "0.25rem");
  assert.equal(block.decls.get("--foreground"), "var(--card)");
  assert.equal(block.decls.get("--ring"), "var(--primary)");
  assert.ok(out.startsWith("/* Acme — dark"));
  assert.throws(
    () => applyTokens(CONTRACT_CSS, { name: "x-light", tokens: { "--nope": "1" } }),
    /contract/,
  );
});

test("applyTokens edits an existing family in place, keeping its comments", () => {
  const family = `/* Acme — light. Values measured on app.acme.example. */
[data-theme="acme-light"] {
  color-scheme: light;
  /* Product type scale: tuned for Acme Sans. */
  --font-sans:
    "Acme Sans", Inter,
    sans-serif;
  --primary: oklch(0.45 0.1 250);
  --ring: var(--primary);
}
`;
  const out = applyTokens(family, {
    name: "acme-light",
    scheme: "light",
    tokens: {
      "--primary": "#0B5FFF",
      "--font-sans": "Inter, sans-serif",
      "--radius-base": "0.25rem",
    },
  });
  assert.ok(out.startsWith("/* Acme — light. Values measured"), "file header kept");
  assert.ok(out.includes("/* Product type scale: tuned for Acme Sans. */"), "inline comment kept");
  const [block] = themeBlocks(out);
  assert.equal(block.decls.get("--primary"), toOklch("#0B5FFF"));
  assert.equal(block.decls.get("--font-sans"), "Inter, sans-serif");
  assert.equal(block.decls.get("--radius-base"), "0.25rem", "a new overridable token is appended");
  assert.equal(block.decls.get("--ring"), "var(--primary)");
});

test("auditTheme reports missing tokens, colour-scheme and failing ink pairs", () => {
  const contract = contractFromCss(CONTRACT_CSS);
  const good = applyTokens(CONTRACT_CSS, { name: "acme-light", scheme: "light", tokens: {} });
  assert.deepEqual(auditTheme(good, contract).errors, []);

  const bad = applyTokens(CONTRACT_CSS, {
    name: "acme-light",
    scheme: "light",
    tokens: { "--primary-foreground": "#6E9EFF" },
  }).replace(/\s*--ring:[^;]+;/, "");
  const { errors, pairs } = auditTheme(bad, contract);
  assert.ok(errors.some((e) => e.includes("missing 1 contract token(s): --ring")));
  assert.ok(errors.some((e) => e.includes("--primary-foreground on --primary")));
  assert.ok(pairs.some((p) => p.fg === "--foreground" && p.pass));
});

test("auditTheme warns about merged chart series and chrome that is not recessed", () => {
  const css = `[data-theme="acme-light"] {
  color-scheme: light;
  --background: oklch(0.98 0 0);
  --sidebar: oklch(0.975 0 0);
  --card: oklch(0.96 0 0);
  --chart-1: oklch(0.6 0.15 250);
  --chart-2: oklch(0.61 0.15 252);
  --chart-3: oklch(0.7 0.15 30);
}`;
  const contract = ["--background", "--sidebar", "--card", "--chart-1", "--chart-2", "--chart-3"];
  const { errors, warnings } = auditTheme(css, contract);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("--chart-1 and --chart-2")));
  assert.ok(!warnings.some((w) => w.includes("--chart-2 and --chart-3")));
  assert.ok(warnings.some((w) => w.includes("--sidebar")));
  assert.ok(warnings.some((w) => w.includes("--card")));
});

test("renderProposal escapes every researched string and embeds the drafts", () => {
  const dir = mkdtempSync(join(tmpdir(), "theme-kit-"));
  try {
    const draft = applyTokens(CONTRACT_CSS, { name: "acme-light", scheme: "light", tokens: {} });
    const html = renderProposal(
      {
        family: "acme",
        label: "Acme <b>",
        mode: "create",
        summary: "From <script>alert(1)</script> the site",
        sources: [{ id: "s1", title: "Brand <i>", url: "javascript:alert(1)", kind: "guideline" }],
        schemes: {
          light: {
            tokens: {
              "--primary": { value: "#29B5E8", source: "s1", confidence: "guideline" },
            },
          },
        },
        deviations: [],
        questions: ["Is <u>this</u> right?"],
      },
      { light: draft },
    );
    assert.ok(!html.includes("<script>alert"), "summary escaped");
    assert.ok(!html.includes("<b>") && !html.includes("<i>") && !html.includes("<u>"));
    assert.ok(!html.includes('href="javascript:'), "non-http source links are not linked");
    assert.ok(html.includes('[data-theme="acme-light"]'), "draft block embedded for the preview");
    assert.match(
      html,
      /<section class="scheme" data-theme="acme-light">[\s\S]*var\(--primary\)[\s\S]*<\/section>/,
      "swatches sit inside the themed element, so their var() colours resolve",
    );
    assert.ok(html.includes("4.5"), "contrast results rendered");
    assert.ok(!html.includes("outside the contract"), "no false coverage errors on the page");
    writeFileSync(join(dir, "p.html"), html);
    assert.ok(readFileSync(join(dir, "p.html"), "utf8").length > 500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

test("renderProposal refuses a draft that could break out of the style element", () => {
  assert.throws(
    () =>
      renderProposal(
        { family: "acme", label: "Acme", mode: "create", sources: [], schemes: {} },
        { light: '[data-theme="acme-light"] { --x: "</style><script>"; }' },
      ),
    /</,
  );
});
