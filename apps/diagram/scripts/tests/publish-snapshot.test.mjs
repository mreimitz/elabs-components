/* global structuredClone */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (name) =>
  (
    await runnerImport(`${root}src/viewer/${name}.ts`, {
      root,
      configFile: false,
      logLevel: "error",
    })
  ).module;
const { createViewerSnapshot } = await load("create-snapshot");
const { sanitizePublishedText, safeSnapshotJson, validateSnapshot } = await load("manifest");
const icon = { label: "Product", src: "data:image/svg+xml;base64,PHN2Zy8+" };
const entry = {
  name: "vendor/product",
  vendor: "vendor",
  slug: "product",
  label: "Product name",
  icon: "vendor/product",
  kind: "service",
  description: "Public product description",
  tags: [],
  aliases: [],
  curated: true,
  notes: "CATALOG_SECRET",
};
const defaults = {
  theme: "light",
  catalog: [entry],
  iconNames: new Set(["vendor/product", "lucide/box"]),
  loadDocument: async () => {
    throw Error("Missing");
  },
  loadIcon: async () => icon,
};
test("public root/reference/catalog closure strips author-only fields before embedding", async () => {
  const text =
    'diagram: "1"\n# SECRET_COMMENT\ntitle: Public title\nnotes: [{at: a, text: SECRET_NOTE}]\nmetrics: {private: SECRET_METRIC}\nnodes:\n - {id: a, ref: catalog/vendor/product}\n - {id: t, ref: ws/private-customer/child}\n';
  const child =
    'diagram: "1"\ntitle: Public child\ncomponent: {description: Public component, extensionPoints: [{private: SECRET_EXTENSION}]}\nnodes:\n - {id: leaf, title: Visible leaf, metrics: SECRET_CHILD}\n';
  const snapshot = await createViewerSnapshot({
    ...defaults,
    text,
    loadDocument: async (path) => {
      assert.equal(path, "private-customer/child.yaml");
      return child;
    },
  });
  assert.deepEqual(Object.keys(snapshot.documents), [
    "published.yaml",
    "embedded/component-1.yaml",
  ]);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /SECRET_|private-customer|extensionPoints/);
  assert.match(snapshot.documents["published.yaml"], /ws\/embedded\/component-1.yaml/);
  assert.match(serialized, /Public product description/);
  assert.match(serialized, /Public child/);
  assert.equal(snapshot.catalog.length, 1);
  assert.deepEqual(Object.keys(snapshot.icons), ["vendor/product"]);
  validateSnapshot(snapshot);
});
test("valid scalar flow labels and empty zones preserve authored public semantics", () => {
  const text =
    'diagram: "1"\nzones: [{id: z, owner: customer, title: Zone}]\nnodes: [{id: a}, {id: b}]\nflows: [{a -> b: true}]\n';
  const sanitized = sanitizePublishedText(text);
  assert.match(sanitized, /owner: customer/);
  assert.match(sanitized, /a -> b: true/);
});
test("missing and cyclic required references fail clearly rather than publish partial diagrams", async () => {
  const text = 'diagram: "1"\nnodes: [{id: t, ref: ws/child}]\n';
  await assert.rejects(
    createViewerSnapshot({ ...defaults, text }),
    /Cannot embed referenced diagram/,
  );
  await assert.rejects(
    createViewerSnapshot({ ...defaults, text, loadDocument: async () => text }),
    /cycle/,
  );
});
test("invalid story targets cannot silently disappear from the customer snapshot", async () => {
  await assert.rejects(
    createViewerSnapshot({
      ...defaults,
      text: 'diagram: "1"\nnodes: [{id: a}]\nstory: {steps: [{title: Broken, targets: [missing]}]}\n',
    }),
    /Cannot publish/,
  );
});
test("HTML delimiters and JS line separators remain inert JSON content", () => {
  const text = "</script><script>globalThis.pwned=true</script>\u2028\u2029";
  const json = safeSnapshotJson({ text });
  assert.ok(!json.includes("<"));
  assert.ok(!json.includes("\u2028"));
  assert.deepEqual(JSON.parse(json), { text });
});
test("recursive aliases, unsupported versions and unfiltered runtime payloads fail", async () => {
  assert.throws(
    () => sanitizePublishedText('diagram: "1"\nnodes: &loop [*loop]\n'),
    /Recursive|alias/,
  );
  const snapshot = await createViewerSnapshot({
    ...defaults,
    text: 'diagram: "1"\nnodes: [{id: a}]\n',
  });
  assert.throws(() => validateSnapshot({ ...snapshot, version: 2 }), /unsupported version/);
  assert.throws(() => validateSnapshot({ ...snapshot, extra: "secret" }), /unsupported fields/);
  assert.throws(
    () =>
      validateSnapshot({
        ...snapshot,
        documents: {
          "published.yaml":
            snapshot.documents["published.yaml"] + "notes: [{at: a, text: secret}]\n",
        },
      }),
    /unfiltered/,
  );
  assert.throws(
    () =>
      validateSnapshot({
        ...snapshot,
        icons: { x: { label: "bad", src: "https://example.com/x.svg" } },
      }),
    /Invalid embedded icon/,
  );
});

test("private canvas notes are excluded recursively and required removed targets fail clearly", async () => {
  const text =
    'diagram: "1"\ntitle: Public\ndescription: Public narrative\nzones: [{id: z, children: [{id: nested, type: note, text: SECRET_NESTED}, {id: a}]}]\nnodes: [{id: note, type: note, text: SECRET_NOTE}, {id: t, ref: ws/child}]\n';
  const child = 'diagram: "1"\nnodes: [{id: secret, type: note, text: SECRET_CHILD}, {id: b}]\n';
  const snapshot = await createViewerSnapshot({
    ...defaults,
    text,
    loadDocument: async () => child,
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET_|type: note/);
  assert.match(JSON.stringify(snapshot), /Public narrative/);
  for (const dependency of [
    "flows: [{note -> a: null}]",
    "story: {steps: [{title: Note, targets: [note]}]}",
  ])
    await assert.rejects(
      createViewerSnapshot({
        ...defaults,
        text:
          'diagram: "1"\nnodes: [{id: note, type: note, text: SECRET_NOTE}, {id: a}]\n' +
          dependency +
          "\n",
      }),
      /Cannot publish/,
    );
  await assert.rejects(
    createViewerSnapshot({
      ...defaults,
      text: 'diagram: "1"\nnodes: [{id: a}, {id: t, ref: ws/child}]\nflows: [{a -> t.secret: null}]\n',
      loadDocument: async () => child,
    }),
    /Cannot publish/,
  );
});

test("catalog-supplied note kinds and part fallback are private; explicit service overrides retain only public prose", async () => {
  const note = {
    ...entry,
    name: "test/note",
    vendor: "test",
    slug: "note",
    kind: "note",
    icon: "lucide/sticky-note",
  };
  const part = {
    ...entry,
    name: "test/part",
    vendor: "test",
    slug: "part",
    kind: undefined,
    icon: "test/note",
    part: {},
  };
  const catalog = [note, part];
  const text =
    'diagram: "1"\nzones: [{id: z, children: [{id: n, ref: catalog/test/note, type: null, text: SECRET_NULL_NOTE}]}]\nnodes: [{id: part, ref: catalog/test/part, text: SECRET_PART_NOTE}, {id: t, ref: ws/child}, {id: override, ref: catalog/test/note, type: service, text: SECRET_DORMANT_NOTE, description: Public service}]\n';
  const child =
    'diagram: "1"\nnodes: [{id: inherited, ref: catalog/test/note, text: SECRET_CHILD_NOTE}, {id: kept}]\n';
  const snapshot = await createViewerSnapshot({
    ...defaults,
    text,
    catalog,
    loadDocument: async () => child,
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET_|id: inherited|id: part|id: n\b/);
  assert.match(snapshot.documents["published.yaml"], /Public service/);
  assert.match(snapshot.documents["published.yaml"], /type: service/);
  const changed = {
    ...snapshot,
    documents: {
      ...snapshot.documents,
      "published.yaml": snapshot.documents["published.yaml"].replace("type: service", "type: null"),
    },
  };
  assert.throws(() => validateSnapshot(changed), /private catalog-supplied note/);
  await assert.rejects(
    createViewerSnapshot({
      ...defaults,
      catalog,
      text: 'diagram: "1"\nnodes: [{id: n, ref: catalog/test/part}, {id: a}]\nflows: [{a -> n: null}]\n',
    }),
    /Cannot publish/,
  );
});

test("fixed theme, workspace selection and complete resolved profiles survive the publish boundary", async () => {
  const text =
    'diagram: "1"\nstyle: {technical: inherit, visual: inherit}\nzones: [{id: z, role: vendor-cloud, children: [{id: a, ref: catalog/vendor/product}]}]\n';
  const snapshot = await createViewerSnapshot({
    ...defaults,
    text,
    theme: "qlik-dark",
    workspaceStyles: { styles: { technical: "atlas-clean", visual: "qlik-marketecture" } },
    catalog: [{ ...entry, capability: "Data integration" }],
  });
  assert.equal(snapshot.style.resolved.hero, "qlik");
  assert.equal(snapshot.style.resolved.visual.ground.followTheme, false);
  assert.equal(snapshot.style.resolved.provenance.visual.level, "workspace");
  assert.equal(snapshot.catalog[0].capability, "Data integration");
  assert.match(snapshot.documents["published.yaml"], /role: vendor-cloud/);
  const changed = structuredClone(snapshot);
  changed.style.resolved.visual.ground.fill = "url(https://example.invalid/private)";
  assert.throws(() => validateSnapshot(changed), /profile does not match/);
  await assert.rejects(
    createViewerSnapshot({
      ...defaults,
      text,
      workspaceStyles: { styles: { visual: "remote-custom" } },
    }),
    /configuration is valid/,
  );
  const neutral = await createViewerSnapshot({ ...defaults, text, theme: "dark" });
  assert.equal(neutral.style.resolved.hero, null);
  assert.equal(neutral.style.resolved.visual.ground.followTheme, true);
});
