/**
 * Self-test for check-community-themes.mjs — every planted defect must fail,
 * and a family freshly scaffolded from the reference themes must pass (so the
 * gate is not vacuous in either direction).
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

import { runCheck } from "./check-community-themes.mjs";
import { TOKENS_SRC } from "./lib/theme-sources.mjs";
import { scaffoldCss, scaffoldReadme, scaffoldThemeTs } from "./new-community-theme.mjs";

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A valid two-scheme family in a fresh temp `themes/` dir, then `mutate` it. */
async function fixture(mutate = () => {}, { slug = "ocean", schemes = ["light", "dark"] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "community-themes-"));
  dirs.push(dir);
  const folder = join(dir, slug);
  mkdirSync(folder);
  const files = {};
  for (const scheme of schemes) {
    const reference = readFileSync(join(TOKENS_SRC, "themes", `${scheme}.css`), "utf8");
    files[`${slug}-${scheme}.css`] = scaffoldCss(reference, {
      slug,
      scheme,
      label: "Ocean",
      hue: 235,
    });
  }
  files["theme.ts"] = scaffoldThemeTs({ slug, label: "Ocean", schemes });
  files["README.md"] = scaffoldReadme({ slug, label: "Ocean", schemes });
  mutate(files);
  for (const [name, content] of Object.entries(files)) {
    if (content !== undefined) writeFileSync(join(folder, name), content);
  }
  return await runCheck({ dir });
}

function assertFails(result, pattern) {
  assert.equal(result.ok, false, "expected the gate to fail");
  assert.match(result.lines.join("\n"), pattern);
}

describe("check-community-themes", () => {
  it("passes a family scaffolded from the reference themes", async () => {
    const result = await fixture();
    assert.equal(result.ok, true, result.lines.join("\n"));
  });

  it("passes a single-scheme family", async () => {
    assert.equal((await fixture(() => {}, { schemes: ["dark"] })).ok, true);
  });

  it("fails an empty themes folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "community-themes-"));
    dirs.push(dir);
    assertFails(await runCheck({ dir }), /no theme families/);
  });

  it("fails a missing contract token", async () => {
    assertFails(
      await fixture((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace(/^\s*--card:.*\n/m, "");
      }),
      /missing 1 contract token\(s\): --card\b/,
    );
  });

  it("fails a token outside the contract", async () => {
    assertFails(
      await fixture((f) => {
        f["ocean-dark.css"] = f["ocean-dark.css"].replace("{\n", "{\n  --made-up: red;\n");
      }),
      /outside the contract: --made-up/,
    );
  });

  it("fails unreadable body text", async () => {
    assertFails(
      await fixture((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace(
          /--foreground: [^;]+;/,
          "--foreground: oklch(0.95 0.002 235);",
        );
      }),
      /--foreground on --background is 1\.\d+:1/,
    );
  });

  it("fails a color-scheme that disagrees with the file", async () => {
    assertFails(
      await fixture((f) => {
        f["ocean-dark.css"] = f["ocean-dark.css"].replace(
          "color-scheme: dark",
          "color-scheme: light",
        );
      }),
      /color-scheme must be "dark"/,
    );
  });

  it("fails a selector that does not match the file name", async () => {
    assertFails(
      await fixture((f) => {
        f["ocean-light.css"] = f["ocean-light.css"].replace('"ocean-light"', '"ocean"');
      }),
      /exactly one \[data-theme="ocean-light"\] block/,
    );
  });

  it("fails a theme.ts whose dark flag disagrees", async () => {
    assertFails(
      await fixture((f) => {
        f["theme.ts"] = f["theme.ts"].replace("dark: true", "dark: false");
      }),
      /"ocean-dark" must set dark: true/,
    );
  });

  it("fails a theme.ts with the wrong family", async () => {
    assertFails(
      await fixture((f) => {
        f["theme.ts"] = f["theme.ts"].replaceAll('family: "ocean"', 'family: "sea"');
      }),
      /must set family: "ocean"/,
    );
  });

  it("fails a stray stylesheet and a missing README", async () => {
    const result = await fixture((f) => {
      f["extra.css"] = "";
      f["README.md"] = undefined;
    });
    assertFails(result, /unexpected stylesheet extra\.css/);
    assertFails(result, /missing README\.md/);
  });
});
