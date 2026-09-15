/**
 * trusted-types-sinks — no NEW Trusted-Types-fatal HTML sink, in our source or in a
 * direct third-party dependency. Ported from scripts/check-csp-sinks.mjs (rungs 1 + 3;
 * rung 2, the patched Radix packages, is `trusted-types-patches`).
 *
 * WHY. Under `require-trusted-types-for 'script'` (a sandboxed Electron renderer) every
 * `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` assignment throws.
 * React performs `dangerouslySetInnerHTML` during COMMIT, so no error boundary catches
 * it and React tears down the ROOT: a BLANK WINDOW. jsdom enforces no CSP and a sink
 * mounted on interaction screenshots fine — hence a static check. `innerHTML = ""` is
 * NOT a carve-out (Chromium throws on it; `@number-flow/react` reaches the sink so).
 *
 * The `keys` baseline is exactly the set a strict-CSP consumer must avoid:
 * `ours::<file>` (engine output rendered as HTML: KaTeX, Mermaid) and `package::<name>`.
 *
 * HONEST LIMIT: only DIRECT runtime dependencies of distributable packages are scanned
 * (their `dist/*.{mjs,cjs,js}` and root `*.{mjs,cjs,js}`), not the transitive tree.
 * Dependency scanning reads `node_modules`, so it needs `pnpm install`.
 */

export const SINK_PATTERNS = [
  /dangerouslySetInnerHTML/,
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /document\s*\.\s*write(?:ln)?\s*\(/,
];

/**
 * Strip `//` and block comments in CODE position so a prose MENTION is not a sink
 * (viewer's docx-model.ts documents why it never reaches `dangerouslySetInnerHTML`).
 * Conservative: string/template literals are kept verbatim; escapes copied in pairs so
 * a regex literal like `/\/\//` cannot open a line comment.
 */
export function stripComments(text) {
  let out = "";
  let quote = null;
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "\\") {
      out += c + (next ?? "");
      i += 2;
    } else if (quote) {
      out += c;
      if (c === quote) quote = null;
      i++;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
    } else if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

export function findSinks(text) {
  const code = stripComments(text);
  return SINK_PATTERNS.filter((re) => re.test(code)).map((re) => re.source);
}

/** Shipped JS a package carries, shallowly: `dist/*` + package root. */
export function packageCode(ctx, dir) {
  return ["dist", ""].flatMap((sub) => {
    const d = sub ? `${dir}/${sub}` : dir;
    return ctx
      .dirFiles(d)
      .filter((f) => /\.(mjs|cjs|js)$/.test(f))
      .map((f) => `${d}/${f}`);
  });
}

/** Installed dir of `name` as seen from a workspace package, or null. */
export function resolvePkgDir(ctx, name, consumerDir) {
  for (const base of [`${consumerDir}/node_modules`, "node_modules"]) {
    const dir = `${base}/${name}`;
    if (ctx.exists(`${dir}/package.json`)) return dir;
  }
  return null;
}

export const depIsDirty = (ctx, dir) =>
  packageCode(ctx, dir).some((f) => findSinks(ctx.readFile(f)).length > 0);

const OUR_SOURCE = "packages/*/src/**/*.{ts,tsx,js,jsx}";
const NOT_OURS = [
  "**/*.{test,stories}.{ts,tsx,js,jsx}",
  "**/*.d.ts",
  "**/{node_modules,dist,.turbo}/**",
];

// ── fixtures ─────────────────────────────────────────────────────────────────
const pkg = (extra = {}) =>
  JSON.stringify({ name: "@elabs-ai/components-ui", version: "0.0.0", ...extra });
const tree = (files) => ({ files: { "packages/ui/package.json": pkg(), ...files } });

export default {
  id: "trusted-types-sinks",
  scope: "packages",
  doc: "Never assign HTML (`dangerouslySetInnerHTML`, `.innerHTML =`, `insertAdjacentHTML`, `document.write`) in package source or add a dependency that does — it blanks a Trusted-Types app; static markup belongs in CSS or JSX, and an unavoidable engine sink is baselined and documented in `docs/CSP-AND-NETWORK.md`.",
  baseline: "keys",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob(OUR_SOURCE, { ignore: NOT_OURS })) {
      const text = ctx.readFile(file);
      const found = findSinks(text);
      if (!found.length) continue;
      const first = stripComments(text).search(new RegExp(found[0]));
      out.push({
        file,
        line: first < 0 ? 1 : text.slice(0, first).split("\n").length,
        key: `ours::${file}`,
        msg: `assigns HTML (${found.join(", ")}) — fatal under Trusted Types (blank window)`,
      });
    }
    const offenders = new Map();
    for (const p of ctx.packages()) {
      if (!p.json.publishConfig && p.json.private) continue;
      for (const dep of Object.keys(p.json.dependencies ?? {})) {
        if (dep.startsWith("@elabs-ai/")) continue;
        const dir = resolvePkgDir(ctx, dep, p.dir);
        if (!dir || !depIsDirty(ctx, dir)) continue;
        const o = offenders.get(dep) ?? { manifest: `${p.dir}/package.json`, from: [] };
        o.from.push(p.name);
        offenders.set(dep, o);
      }
    }
    for (const [dep, o] of offenders)
      out.push({
        file: o.manifest,
        line: 1,
        key: `package::${dep}`,
        msg: `third-party dependency ${dep} carries a Trusted-Types-fatal sink (reached from ${o.from.join(", ")}) — patch it, avoid it, or baseline and document the escape hatch`,
      });
    return out;
  },
  fixtures: {
    pass: [
      tree({ "packages/ui/src/clean.tsx": "export const A = () => <div />;" }),
      tree({
        "packages/ui/src/x.test.tsx": "el.innerHTML = 'x'",
        "packages/ui/src/x.stories.tsx": "el.innerHTML = 'x'",
      }),
      tree({
        "packages/ui/src/doc.ts":
          "/**\n * Rendering it would mean `dangerouslySetInnerHTML`, so we don't.\n */\n// el.innerHTML = html — never do this\n",
      }),
      tree({
        "packages/ui/package.json": pkg({ dependencies: { "clean-dep": "1" } }),
        "packages/ui/node_modules/clean-dep/package.json": "{}",
        "packages/ui/node_modules/clean-dep/dist/index.mjs": "export const x = 1;",
      }),
      // a private, unpublished workspace package does not ship its deps
      {
        files: {
          "packages/app/package.json": JSON.stringify({ private: true, dependencies: { d: "1" } }),
          "node_modules/d/package.json": "{}",
          "node_modules/d/index.js": "el.innerHTML = x",
        },
      },
    ],
    fail: [
      tree({
        "packages/ui/src/bad.tsx":
          "export const B = () => <style dangerouslySetInnerHTML={{ __html: css }} />;",
      }),
      tree({ "packages/ui/src/a.ts": "el.innerHTML = ''" }), // the empty string is still a sink
      tree({ "packages/ui/src/a.ts": "el.outerHTML = html" }),
      tree({ "packages/ui/src/a.ts": "el.insertAdjacentHTML('beforeend', s)" }),
      tree({ "packages/ui/src/a.ts": "document.write('<b>')" }),
      tree({ "packages/ui/src/a.ts": "/** never use innerHTML */\nel.innerHTML = html" }),
      tree({ "packages/ui/src/a.ts": "const src = 'el.innerHTML = x';" }),
      tree({ "packages/ui/src/a.ts": "const re = /\\/\\//;\nel.innerHTML = html" }),
      tree({
        "packages/ui/package.json": pkg({ dependencies: { "dirty-dep": "1" } }),
        "node_modules/dirty-dep/package.json": "{}",
        "node_modules/dirty-dep/dist/index.cjs": "n.innerHTML = ''",
      }),
    ],
  },
};
