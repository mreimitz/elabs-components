/**
 * lucide-version — one `lucide-react` version across the workspace (#119).
 * Ported from scripts/check-lucide-version.mjs. Two versions mean two copies in
 * the bundle and icon-set drift. Reads the root manifest (deps + `pnpm.overrides`
 * + `resolutions`) and every `packages/*` and `apps/*` manifest.
 * (The other icon-policy half — no other icon sets — is ESLint `no-restricted-imports`.)
 */
const DEP_KEYS = ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"];

function declarations(ctx) {
  const manifests = [
    ...(ctx.exists("package.json") ? ["package.json"] : []),
    ...ctx.glob("{packages,apps}/*/package.json"),
  ];
  const found = [];
  for (const file of manifests) {
    let json;
    try {
      json = ctx.json(file);
    } catch {
      continue;
    }
    const text = ctx.readFile(file);
    const sources = [
      ...DEP_KEYS.map((k) => [k, json[k]]),
      ["pnpm.overrides", json.pnpm?.overrides],
      ["resolutions", json.resolutions],
    ];
    for (const [key, obj] of sources) {
      const version = obj?.["lucide-react"];
      if (!version) continue;
      const at = text.indexOf(`"lucide-react"`);
      found.push({ file, key, version, line: at < 0 ? 1 : text.slice(0, at).split("\n").length });
    }
  }
  return found;
}

const pkg = (deps) => JSON.stringify(deps, null, 2);

export default {
  id: "lucide-version",
  scope: "packages",
  doc: "Declare ONE `lucide-react` version specifier across every workspace manifest (deps, peers, dev deps, `pnpm.overrides`, `resolutions`).",
  baseline: "none",
  run(ctx) {
    const found = declarations(ctx);
    const versions = [...new Set(found.map((f) => f.version))];
    if (versions.length <= 1) return [];
    return found.map((f) => ({
      file: f.file,
      line: f.line,
      msg: `lucide-react ${f.version} (${f.key}) — ${versions.length} versions in the workspace (${versions.join(", ")}); align on one`,
    }));
  },
  fixtures: {
    pass: [
      { files: { "package.json": pkg({ name: "root" }) } },
      {
        files: {
          "package.json": pkg({ pnpm: { overrides: { "lucide-react": "^0.577.0" } } }),
          "packages/ui/package.json": pkg({ dependencies: { "lucide-react": "^0.577.0" } }),
          "apps/docs/package.json": pkg({ devDependencies: { "lucide-react": "^0.577.0" } }),
        },
      },
      // nested manifests are out of scope
      {
        files: {
          "packages/ui/package.json": pkg({ dependencies: { "lucide-react": "^0.577.0" } }),
          "packages/ui/fixtures/x/package.json": pkg({
            dependencies: { "lucide-react": "^0.1.0" },
          }),
        },
      },
    ],
    fail: [
      {
        files: {
          "packages/ui/package.json": pkg({ dependencies: { "lucide-react": "^0.577.0" } }),
          "packages/ai/package.json": pkg({ dependencies: { "lucide-react": "^0.500.0" } }),
        },
      },
      {
        files: {
          "package.json": pkg({ resolutions: { "lucide-react": "0.400.0" } }),
          "apps/docs/package.json": pkg({ devDependencies: { "lucide-react": "^0.577.0" } }),
        },
      },
      {
        files: {
          "packages/ui/package.json": pkg({
            dependencies: { "lucide-react": "^0.577.0" },
            peerDependencies: { "lucide-react": ">=0.400.0" },
          }),
        },
      },
    ],
  },
};
