/**
 * gen-package-readmes.test.mjs — locks issue #28 (published READMEs said
 * private/UNLICENSED while the packages are public MIT).
 * Run in CI: `node --test scripts/gen-package-readmes.test.mjs`
 * (`pnpm gen:readmes:check:test`).
 *
 * The generator must derive the license/install story from each package's own
 * `package.json` (`license`, `private`) rather than a hardcoded private-repo
 * template — these tests plant both a public-MIT package and a genuinely
 * private one so a regression to the old blanket template fails loudly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReadmeRegion, spliceRegion, licenseMismatch } from "./gen-package-readmes.mjs";

const baseOpts = {
  purpose: "Example purpose.",
  componentCount: 3,
  sample: ["Button", "Card"],
  extras: [],
};

// ── public, MIT-licensed package (the real shape of all 12 shipped packages) ─

test("PUBLIC/MIT: never says 'private'", () => {
  const region = renderReadmeRegion("@elabs-ai/components-ui", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  assert.ok(!/private/i.test(region), "generated region must not say 'private'");
});

test("PUBLIC/MIT: includes the literal license value from package.json", () => {
  const region = renderReadmeRegion("@elabs-ai/components-ui", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  assert.match(region, /## License\n\nMIT/);
});

test("PUBLIC/MIT: the Install block never contains workspace:*", () => {
  const region = renderReadmeRegion("@elabs-ai/components-ui", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  assert.ok(!region.includes("workspace:*"), "install block must not use workspace:*");
});

test("PUBLIC/MIT: gives a real, runnable npm/pnpm install command naming the package", () => {
  const region = renderReadmeRegion("@elabs-ai/components-ui", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  const install = region.slice(region.indexOf("## Install"));
  assert.match(install, /pnpm add[^\n]*@elabs-ai\/components-ui/);
});

test("PUBLIC/MIT: the tokens package installs itself only (no self-referential pair)", () => {
  const region = renderReadmeRegion("@elabs-ai/components-tokens", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  const install = region.slice(region.indexOf("## Install"), region.indexOf("## Set up styling"));
  const occurrences = (install.match(/@elabs-ai\/components-tokens/g) ?? []).length;
  assert.equal(occurrences, 1, `expected exactly one mention, got ${occurrences}`);
});

test("PUBLIC/MIT: the CLI installs as a dev dependency", () => {
  const region = renderReadmeRegion("@elabs-ai/components-cli", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  const install = region.slice(region.indexOf("## Install"));
  assert.match(install, /pnpm add -D[^\n]*@elabs-ai\/components-cli/);
});

// ── a genuinely private package must still say so (no blanket replace) ──────

test("PRIVATE: still says private, still uses workspace:*", () => {
  const region = renderReadmeRegion("@elabs-ai/components-internal", {
    ...baseOpts,
    license: "UNLICENSED",
    isPrivate: true,
  });
  assert.match(region, /private/i);
  assert.match(region, /workspace:\*/);
  assert.match(region, /## License\n\nUNLICENSED/);
});

// ── spliceRegion still preserves hand-written prose outside the markers ─────

test("spliceRegion leaves prose outside the markers untouched", () => {
  const existing = [
    "<!-- brand-ui:gen:readme:start -->",
    "OLD",
    "<!-- brand-ui:gen:readme:end -->",
    "",
    "## Hand-written section",
    "kept verbatim",
  ].join("\n");
  const next = spliceRegion(
    existing,
    "<!-- brand-ui:gen:readme:start -->\nNEW\n<!-- brand-ui:gen:readme:end -->",
  );
  assert.ok(next.includes("## Hand-written section"));
  assert.ok(next.includes("kept verbatim"));
  assert.ok(!next.includes("OLD"));
});

// ── licenseMismatch: the explicit "cannot drift again" assertion ────────────

test("licenseMismatch: null when the README's License section agrees with package.json", () => {
  const readme = [
    "<!-- brand-ui:gen:readme:start -->",
    "## License",
    "",
    "MIT",
    "<!-- brand-ui:gen:readme:end -->",
  ].join("\n");
  assert.equal(licenseMismatch(readme, { license: "MIT", private: false }), null);
});

test("licenseMismatch: flags a README claiming UNLICENSED for an MIT package.json", () => {
  const readme = [
    "<!-- brand-ui:gen:readme:start -->",
    "## License",
    "",
    "UNLICENSED — private.",
    "<!-- brand-ui:gen:readme:end -->",
  ].join("\n");
  const message = licenseMismatch(readme, { license: "MIT", private: false });
  assert.ok(message, "expected a mismatch message");
  assert.match(message, /MIT/);
});

test("licenseMismatch: null when there is no existing README (nothing to compare)", () => {
  assert.equal(licenseMismatch("", { license: "MIT", private: false }), null);
  assert.equal(licenseMismatch(null, { license: "MIT", private: false }), null);
});
