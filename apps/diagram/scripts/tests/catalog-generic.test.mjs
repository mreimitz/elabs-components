/** Isolated disk + bundled parity + real dialect regression for generic catalog products. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runnerImport } from "vite";
import { parse } from "yaml";

const app = fileURLToPath(new URL("../../", import.meta.url));
const { module: api } = await runnerImport(join(app, "src/server-surface.ts"), {
  root: app,
  configFile: false,
  logLevel: "error",
});
const { module: browser } = await runnerImport(join(app, "src/catalog/catalog-merge.ts"), {
  root: app,
  configFile: false,
  logLevel: "error",
});
const index = { "aws/lambda": { path: "/icons/aws/lambda.svg", label: "Lambda", pack: "aws" } };
const iconNames = new Set([
  "aws/lambda",
  ...[...api.ICON_NAMES].filter((n) => n.startsWith("lucide/")),
]);
const patch = (slug, extra = {}) => ({
  slug,
  name: slug,
  description: "A test product.",
  docs: "",
  kind: "service",
  ...extra,
});
async function sandbox(fn) {
  const dir = await fs.mkdtemp(join(tmpdir(), "atlas-catalog-"));
  try {
    await fs.mkdir(join(dir, "server"));
    await fs.mkdir(join(dir, "catalog/parts"), { recursive: true });
    await fs.mkdir(join(dir, "public/icons"), { recursive: true });
    await fs.symlink(join(app, "node_modules"), join(dir, "node_modules"));
    for (const file of ["catalog-fs.mjs", "workspace-fs.mjs"])
      await fs.copyFile(join(app, "server", file), join(dir, "server", file));
    await fs.writeFile(join(dir, "public/icons/index.json"), JSON.stringify(index));
    const disk = await import(pathToFileURL(join(dir, "server/catalog-fs.mjs")).href);
    const write = (vendor, patches, options = {}) =>
      disk.update(vendor, patches, { iconNames, ...options });
    const text = (vendor) => fs.readFile(join(dir, "catalog", `${vendor}.yaml`), "utf8");
    const put = (vendor, value) => fs.writeFile(join(dir, "catalog", `${vendor}.yaml`), value);
    await fn({ dir, disk, write, text, put });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("new vendor is explicit, safe and never created for an invalid batch", () =>
  sandbox(async ({ dir, write }) => {
    for (const vendor of ["../escape", "UPPER", "", "lucide", "a/b", "a.yaml", "__proto__"]) {
      await assert.rejects(write(vendor, [patch("one")], { createVendor: true }), /vendor/);
    }
    await assert.rejects(write("newvendor", [patch("one")]), /create_vendor/);
    const result = await write(
      "newvendor",
      [
        patch("a", { kind: undefined }),
        patch("b", { kind: "wrong" }),
        patch("c", { icon: "fake/icon" }),
        patch("../x"),
        patch("d", { docs: "http://localhost/x" }),
        patch("e", { description: "line\rbreak" }),
      ],
      { createVendor: true },
    );
    assert.equal(result.written.length, 0);
    assert.equal(result.rejected.length, 6);
    assert.deepEqual(await fs.readdir(join(dir, "catalog")), ["parts"]);
  }));

test("all kinds get matching glyphs, optional icons and existing vendor updates work", () =>
  sandbox(async ({ disk, write, text }) => {
    const expected = {
      service: "box",
      actor: "user",
      datastore: "database",
      queue: "layers",
      external: "globe",
      note: "file",
    };
    assert.equal(
      (
        await write(
          "newvendor",
          Object.keys(expected).map((kind) => patch(kind, { kind })),
          { createVendor: true },
        )
      ).written.length,
      6,
    );
    assert.equal(
      (
        await write("newvendor", [
          patch("pictured", { icon: "aws/lambda" }),
          patch("glyph", { icon: "lucide/brain" }),
        ])
      ).written.length,
      2,
    );
    const all = (await disk.readAll(iconNames)).entries.filter((e) => e.vendor === "newvendor");
    for (const [kind, glyph] of Object.entries(expected))
      assert.equal(all.find((e) => e.slug === kind).icon, `lucide/${glyph}`);
    assert.equal(all.find((e) => e.slug === "pictured").icon, "aws/lambda");
    assert.equal(all.find((e) => e.slug === "glyph").icon, "lucide/brain");
    assert.ok(all.every((e) => e.generic && !e.curated));
    const stored = parse(await text("newvendor"));
    assert.equal(stored.service.icon, undefined);
    assert.equal(stored.service.generic, true);
    assert.equal(
      (await write("newvendor", [{ slug: "service", description: "Updated." }])).written.length,
      1,
    );
    const before = await text("newvendor");
    assert.equal((await write("newvendor", [{ slug: "service", kind: null }])).rejected.length, 1);
    assert.equal(await text("newvendor"), before);
    assert.equal((await disk.missing("newvendor", iconNames)).missing.length, 8);
    assert.ok((await disk.missing("newvendor", iconNames)).missing.every((e) => e.generic));
  }));

test("curated entries and parts stay untouched; real pack wins and clears generic marker", () =>
  sandbox(async ({ disk, put, text, write }) => {
    await put(
      "aws",
      "# Preserve this comment\nlambda: {name: Curated, kind: service, curated: true}\n",
    );
    const before = await text("aws");
    assert.deepEqual((await write("aws", [patch("lambda")])).skippedCurated, ["lambda"]);
    assert.equal(await text("aws"), before);
    await put(
      "aws",
      "lambda: {name: Legacy generic, kind: service, icon: lucide/brain, generic: true, curated: false}\n",
    );
    assert.equal(
      (await disk.readAll(iconNames)).entries.find((e) => e.name === "aws/lambda").icon,
      "aws/lambda",
    );
    assert.equal(
      (await disk.readAll(iconNames)).entries.find((e) => e.name === "aws/lambda").generic,
      undefined,
    );
    await write("aws", [patch("lambda")]);
    assert.equal(parse(await text("aws")).lambda.generic, undefined);
    assert.equal(parse(await text("aws")).lambda.icon, undefined);
    await put("parts/aws", "preset: {name: Protected part, icon: aws/lambda, curated: true}\n");
    assert.equal((await write("aws", [patch("preset")])).rejected.length, 1);
    assert.equal(parse(await text("aws")).preset, undefined);
  }));

test("server and bundled merge agree on generic entries, malformed metadata and icon precedence", () =>
  sandbox(async ({ disk, put }) => {
    const vendors = {
      aws: "lambda: {generic: true, icon: lucide/user, kind: service}\nnew: {kind: queue}\nbad: {kind: bogus}\narray: []\nwrong-icon: {kind: service, icon: nope}\n",
      fresh:
        "human: {kind: actor, icon: lucide/users, curated: true}\nnote: {kind: note}\nwrong: {kind: actor, icon: 2}\n",
      lucide: "user: {kind: service}\n",
    };
    const parts = { aws: "preset: {icon: aws/lambda, name: Preset}\n" };
    for (const [name, text] of Object.entries(vendors)) await put(name, text);
    for (const [name, text] of Object.entries(parts)) await put(`parts/${name}`, text);
    assert.deepEqual(
      await disk.readAll(iconNames),
      browser.mergeCatalog({ index, iconNames, vendors, parts }),
    );
  }));

test("reference-first and legacy aliases compile without unknown icons; real icon still wins", () =>
  sandbox(async ({ disk, write }) => {
    await write("aws", [
      patch("custom", { kind: "datastore" }),
      patch("pictured", { icon: "lucide/brain" }),
    ]);
    const entries = (await disk.readAll(iconNames)).entries;
    for (const slug of ["custom", "pictured"]) {
      for (const key of ["ref", "icon"]) {
        const yaml = `diagram: "1"\nnodes:\n  - id: a\n    ${key}: ${key === "ref" ? "catalog/" : ""}aws/${slug}\n`;
        const checked = api.checkDiagram(yaml, entries);
        assert.equal(checked.ok, true, JSON.stringify(checked.issues));
        assert.equal(
          checked.issues.some((i) => i.code === "unknown-icon"),
          false,
        );
        assert.equal(
          checked.spec.nodes[0].data.icon,
          slug === "custom" ? "lucide/database" : "lucide/brain",
        );
      }
      assert.match(
        api.entrySnippet(entries.find((e) => e.name === `aws/${slug}`)),
        /ref: catalog\/aws\//,
      );
    }
  }));

test("serialized writes preserve concurrent accepted entries and reject kind deletion", () =>
  sandbox(async ({ write, text }) => {
    await Promise.all([
      write("newvendor", [patch("a")], { createVendor: true }),
      write("newvendor", [patch("b")], { createVendor: true }),
    ]);
    assert.deepEqual(Object.keys(parse(await text("newvendor"))).sort(), ["a", "b"]);
    const result = await write("newvendor", [patch("c"), { slug: "a", kind: "" }]);
    assert.deepEqual(result.written, ["c"]);
    assert.equal(result.rejected.length, 1);
    assert.equal(parse(await text("newvendor")).a.kind, "service");
  }));

test("curated YAML aliases are protected and complete generics leave the missing worklist", () =>
  sandbox(async ({ put, write, text, disk }) => {
    await put(
      "fresh",
      'original: &protected {name: Checked, kind: service, curated: true}\nalias: *protected\nflag: {name: Flag, kind: service, curated: &checked true}\nflag-alias: {name: Also checked, kind: service, curated: *checked}\ncomplete: {name: Complete, kind: queue, description: Done, docs: "https://example.com/docs"}\n',
    );
    const before = await text("fresh");
    const result = await write("fresh", [patch("alias"), patch("flag-alias")]);
    assert.deepEqual(result.skippedCurated, ["alias", "flag-alias"]);
    assert.equal(await text("fresh"), before);
    assert.equal((await disk.missing("fresh", iconNames)).missing.length, 0);
  }));

test("generic missing pagination uses the same ordering as its cursor", () =>
  sandbox(async ({ write, disk }) => {
    const slugs = ["ab", "a-b", "a0", "a", "a-1", "a1"];
    await write(
      "fresh",
      slugs.map((slug) => patch(slug)),
      { createVendor: true },
    );
    const seen = [];
    let after;
    for (let i = 0; i < slugs.length; i++) {
      const page = await disk.missing("fresh", iconNames, { limit: 1, after });
      assert.equal(page.total, slugs.length);
      assert.equal(page.missing.length, 1);
      after = page.missing[0].slug;
      seen.push(after);
    }
    assert.deepEqual(seen, slugs.sort());
    assert.equal((await disk.missing("fresh", iconNames, { limit: 1, after })).missing.length, 0);
  }));
