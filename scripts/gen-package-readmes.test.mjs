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
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  renderReadmeRegion,
  spliceRegion,
  licenseMismatch,
  optionalPeersOf,
} from "./gen-package-readmes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);

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

// ── optionalPeersOf + Install-block rendering (#12/#53 review, P2): a package
// with an OPTIONAL peer (peerDependenciesMeta[x].optional === true) is not
// auto-installed by npm/pnpm, so the generated Install guide must spell it
// out explicitly rather than leaving the requirement undocumented outside
// the changelog. ─────────────────────────────────────────────────────────

test("optionalPeersOf: finds a peer marked optional, paired with its declared range", () => {
  const pkg = {
    peerDependencies: { ai: "^6.0.0 || ^7.0.0", react: "^19.0.0" },
    peerDependenciesMeta: { ai: { optional: true } },
  };
  assert.deepEqual(optionalPeersOf(pkg), [{ name: "ai", range: "^6.0.0 || ^7.0.0" }]);
});

test("optionalPeersOf: a REQUIRED peer (no optional:true) is not returned", () => {
  const pkg = {
    peerDependencies: { react: "^19.0.0" },
    peerDependenciesMeta: { react: { optional: false } },
  };
  assert.deepEqual(optionalPeersOf(pkg), []);
});

test("optionalPeersOf: peerDependenciesMeta with no matching peerDependencies entry is dropped", () => {
  const pkg = {
    peerDependencies: {},
    peerDependenciesMeta: { ghost: { optional: true } },
  };
  assert.deepEqual(optionalPeersOf(pkg), []);
});

test("optionalPeersOf: no peerDependenciesMeta at all returns []", () => {
  assert.deepEqual(optionalPeersOf({ peerDependencies: { react: "^19.0.0" } }), []);
});

test("renderReadmeRegion: an optional peer gets its own explicit `pnpm add` line in Install", () => {
  const region = renderReadmeRegion("@elabs-ai/components-ai", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
    optionalPeers: [{ name: "ai", range: "^6.0.0 || ^7.0.0" }],
  });
  const install = region.slice(region.indexOf("## Install"), region.indexOf("## Set up styling"));
  assert.match(install, /pnpm add ai@"\^6\.0\.0 \|\| \^7\.0\.0"/);
});

test("renderReadmeRegion: no optionalPeers means no extra install line (default [])", () => {
  const region = renderReadmeRegion("@elabs-ai/components-ui", {
    ...baseOpts,
    license: "MIT",
    isPrivate: false,
  });
  const install = region.slice(region.indexOf("## Install"), region.indexOf("## Set up styling"));
  assert.ok(!install.includes("optional peer"));
});

// ── the real repo: the shipped ai README documents its real optional peer,
// and the shipped viewer README (which already documents its 7 per-format
// adapter peers by hand, below the generated markers) is NOT force-fed a
// blanket install of all of them ────────────────────────────────────────

test("REAL repo: packages/ai/README.md's generated Install block names the real ai peer range", () => {
  const pkgJson = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "packages", "ai", "package.json"), "utf8"),
  );
  const aiPeer = optionalPeersOf(pkgJson).find((p) => p.name === "ai");
  assert.ok(aiPeer, "packages/ai/package.json must declare ai as an optional peer");
  const readme = readFileSync(path.join(REPO_ROOT, "packages", "ai", "README.md"), "utf8");
  assert.ok(
    readme.includes(`pnpm add ai@"${aiPeer.range}"`),
    "README's Install block must spell out the exact peer range from package.json",
  );
});

test("REAL repo: packages/viewer/README.md's generated Install block stays free of its 7 adapter peers", () => {
  const readme = readFileSync(path.join(REPO_ROOT, "packages", "viewer", "README.md"), "utf8");
  const generatedRegion = readme.slice(
    readme.indexOf("<!-- brand-ui:gen:readme:start -->"),
    readme.indexOf("<!-- brand-ui:gen:readme:end -->"),
  );
  assert.ok(
    !generatedRegion.includes("optional peer"),
    "viewer's adapter peers are documented per-format below the generated markers — " +
      "the generated Install block must not blanket-install all seven",
  );
});

test("the REAL repo currently passes gen:readmes:check (CLI run)", () => {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/gen-package-readmes.mjs", "--check"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  });
});
