#!/usr/bin/env node
/**
 * brand-ui agent benchmark — SCORER (2026-09-17 review, item 4).
 *
 * Grades every `App.tsx` a run produced (`run.mjs`) on four axes and writes
 * `scripts/bench/out/<run>/scores.json` + `scores.md`:
 *
 *   hallucination  imports of a `@elabs-ai/components-*` package that do not
 *                  exist in the manifest, and JSX props on a brand-ui component
 *                  that are neither own-declared, inherited (resolved), a cva
 *                  variant axis, nor a native HTML/React attribute. For other
 *                  libraries only the import check runs (against
 *                  context/<lib>.components.json when you provide it) — props
 *                  cannot be verified without a manifest, and the report says so.
 *   tokens         `brand-ui audit`-style static findings on the file (raw hex,
 *                  raw palette utilities, arbitrary colours, content slop) —
 *                  library-agnostic, so it is fair to both.
 *   a11y           axe-core violations after rendering the screen in a real
 *                  browser. brand-ui outputs are dropped into an app made by
 *                  `brand-ui create` and built with Vite. Another library renders
 *                  only if you provide `scripts/bench/baseline/<lib>/` — a Vite
 *                  app whose src/App.tsx the scorer may replace (see README).
 *   cost           input/output tokens and wall time from meta.json.
 *
 *   node scripts/bench/score.mjs --run <name> [--no-render] [--keep]
 *
 * Every axis is a count the reader can re-derive; there is no weighted total,
 * because the point is the comparison table, not a single number.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
// axe-core and playwright are devDependencies of apps/docs (the Storybook
// test harness) — resolve them from there so the scorer needs nothing extra.
const require = createRequire(join(ROOT, "apps/docs/package.json"));
const { loadManifest, flat } = await import(join(ROOT, "packages/cli/lib/core.mjs"));
const { scanText } = await import(join(ROOT, "packages/cli/lib/audit.mjs"));

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const RUN = flag("--run");
if (!RUN) {
  console.error("usage: node scripts/bench/score.mjs --run <name> [--no-render] [--keep]");
  process.exit(1);
}
const RENDER = !argv.includes("--no-render");
const outRoot = join(HERE, "out", RUN);

const manifest = loadManifest(ROOT);
const rows = flat(manifest);
const byName = new Map(rows.filter((r) => r.kind === "component").map((r) => [r.name, r]));
const PKGS = new Set(Object.keys(manifest.packages));

// Native attributes a React element accepts — a prop in this set is never a
// hallucination. `react-dom-attributes.json` is React DOM's own
// `possibleStandardNames` list (492 names, extracted from react-dom 19).
const NATIVE = new Set(JSON.parse(readFileSync(join(HERE, "react-dom-attributes.json"), "utf8")));
for (const n of (
  "children className style id key ref role tabIndex title lang dir hidden draggable " +
  "onClick onChange onSubmit onInput onKeyDown onKeyUp onFocus onBlur onMouseEnter onMouseLeave onPointerDown onPointerUp onScroll " +
  "aria-label aria-labelledby aria-describedby aria-hidden aria-live aria-current aria-expanded aria-controls aria-pressed aria-selected aria-checked aria-disabled aria-invalid aria-busy aria-haspopup aria-modal aria-required aria-valuenow aria-valuemin aria-valuemax aria-valuetext aria-sort aria-orientation aria-atomic aria-multiselectable aria-activedescendant aria-owns aria-details " +
  "type name value defaultValue placeholder disabled required readOnly checked defaultChecked autoFocus autoComplete href target rel src alt width height min max step pattern maxLength rows cols htmlFor form action method colSpan rowSpan scope headers open size multiple accept selected label " +
  "data-slot data-testid data-state data-status data-tone data-theme"
).split(/\s+/))
  NATIVE.add(n);

/** import { A, B as C } from "pkg" → [{ pkg, names }] */
function imports(src) {
  const out = [];
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = m[1]
      .split(",")
      .map((s) =>
        s
          .trim()
          .split(/\s+as\s+/)[0]
          .replace(/^type\s+/, ""),
      )
      .filter(Boolean);
    out.push({ pkg: m[2], names });
  }
  return out;
}

/** JSX props per component tag: <Button variant="x" size={y} onClick={…}> → { Button: Set(variant,size,onClick) } */
function jsxProps(src) {
  const out = new Map();
  // Walk each opening tag attribute by attribute, skipping every VALUE (a quoted
  // string, or a balanced {…} expression) so words inside `title="up 8% over"`
  // never read as props.
  const tagRe = /<([A-Z][A-Za-z0-9.]*)\b/g;
  let m;
  while ((m = tagRe.exec(src))) {
    const tag = m[1].split(".")[0];
    const set = out.get(tag) ?? new Set();
    let i = tagRe.lastIndex;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ">") break;
      if (ch === "/" && src[i + 1] === ">") break;
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === "{") {
        i = skipBraces(src, i);
        continue;
      } // {...spread}
      const nm = /^[A-Za-z_][\w:.-]*/.exec(src.slice(i));
      if (!nm) {
        i++;
        continue;
      }
      set.add(nm[0]);
      i += nm[0].length;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === "=") {
        i++;
        while (i < src.length && /\s/.test(src[i])) i++;
        if (src[i] === '"' || src[i] === "'") {
          const q = src[i];
          i = src.indexOf(q, i + 1) + 1 || src.length;
        } else if (src[i] === "{") i = skipBraces(src, i);
      }
    }
    out.set(tag, set);
  }
  return out;
}

function skipBraces(src, i) {
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i = src.indexOf(q, i + 1);
      if (i === -1) return src.length;
    }
  }
  return src.length;
}

function knownProps(row) {
  const set = new Set();
  for (const p of row.props?.props ?? []) set.add(p.name);
  for (const p of Object.keys(row.props?.resolved ?? {})) set.add(p);
  for (const axis of Object.keys(row.variants?.variants ?? {})) set.add(axis);
  // Unknown-prop findings need a real prop table (own-declared or resolved);
  // a component the extractor only knows through its cva axes still gets its
  // variant VALUES checked, but an extra prop on it is not counted.
  const hasTable = Boolean(
    row.props?.props?.length || (row.props?.resolved && Object.keys(row.props.resolved).length),
  );
  return { set, hasTable, axes: row.variants?.variants ?? {} };
}

/** The literal value of a JSX prop when it is a plain string: variant="primary" → "primary". */
function literalValue(src, tag, prop) {
  const m = src.match(new RegExp(`<${tag}\\b[^>]*?\\s${prop}\\s*=\\s*"([^"]*)"`, "s"));
  return m ? m[1] : null;
}

function scoreHallucination(lib, src) {
  const findings = [];
  const imps = imports(src);
  let checkedProps = 0;
  if (lib === "brand-ui") {
    const localNames = new Map();
    for (const { pkg, names } of imps) {
      if (!pkg.startsWith("@elabs-ai/components-")) continue;
      const base = pkg.split("/").slice(0, 2).join("/");
      if (!PKGS.has(base)) {
        findings.push(`import from unknown package ${pkg}`);
        continue;
      }
      for (const n of names) {
        const row = rows.find((r) => r.name === n && r.pkg === base);
        if (!row) findings.push(`${n} is not exported by ${pkg}`);
        else localNames.set(n, row);
      }
    }
    for (const [tag, props] of jsxProps(src)) {
      const row = localNames.get(tag);
      if (!row || row.kind !== "component") continue;
      const { set, hasTable, axes } = knownProps(row);
      for (const p of props) {
        if (NATIVE.has(p) || /^(data-|aria-|on[A-Z])/.test(p)) continue;
        checkedProps++;
        if (!set.has(p)) {
          if (hasTable)
            findings.push(
              `<${tag} ${p}> — no such prop (known: ${[...set].slice(0, 8).join(", ")})`,
            );
          continue;
        }
        const allowed = axes[p];
        const v = allowed ? literalValue(src, tag, p) : null;
        if (allowed && v !== null && !allowed.includes(v))
          findings.push(`<${tag} ${p}="${v}"> — not a ${p} value (real: ${allowed.join(" | ")})`);
      }
    }
  } else {
    const listFile = join(HERE, "context", `${lib}.components.json`);
    if (existsSync(listFile)) {
      const known = new Set(JSON.parse(readFileSync(listFile, "utf8")));
      for (const { pkg, names } of imps) {
        if (!/components\/ui/.test(pkg)) continue;
        for (const n of names)
          if (!known.has(n))
            findings.push(`${n} imported from ${pkg} is not a known ${lib} export`);
      }
    } else
      findings.push(
        `(unverifiable: no scripts/bench/context/${lib}.components.json — import check skipped)`,
      );
  }
  return { count: findings.filter((f) => !f.startsWith("(")).length, checkedProps, findings };
}

function scoreTokens(src) {
  const f = scanText(src, { path: "App.tsx" });
  const blocking = f.filter((x) => !x.advisory);
  return {
    count: blocking.length,
    advisory: f.length - blocking.length,
    findings: blocking.slice(0, 20).map((x) => `${x.rule}: ${x.msg}`),
  };
}

/** Render App.tsx in a real browser and run axe. brand-ui: a `create` app; others: baseline/<lib>. */
function renderAndAxe(lib, appTsx, keep) {
  const work = join(tmpdir(), `bench-${lib}-${Date.now()}`);
  let app;
  if (lib === "brand-ui") {
    const r = spawnSync(
      process.execPath,
      [join(ROOT, "packages/cli/bin/brand-ui.mjs"), "create", work, "--template", "dashboard"],
      { encoding: "utf8", cwd: ROOT },
    );
    if (r.status !== 0) return { error: `create failed: ${r.stderr || r.stdout}` };
    app = work;
    // Every package a generated screen may import — the scorer must not fail on
    // a missing dependency when the code itself is right.
    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
    for (const p of PKGS) pkg.dependencies[p] = pkg.dependencies[p] ?? "latest";
    writeFileSync(join(app, "package.json"), JSON.stringify(pkg, null, 2));
    const css = readFileSync(join(app, "src/styles.css"), "utf8");
    const sources = [...PKGS]
      .map((p) => `@source "../node_modules/${p}/dist";`)
      .filter((l) => !css.includes(l))
      .join("\n");
    writeFileSync(join(app, "src/styles.css"), `${css}\n${sources}\n`);
  } else {
    const base = join(HERE, "baseline", lib);
    if (!existsSync(base)) return { error: `no scripts/bench/baseline/${lib}/ app to render in` };
    cpSync(base, work, { recursive: true });
    app = work;
  }
  writeFileSync(join(app, "src/App.tsx"), appTsx);
  const pm = existsSync(join(app, "node_modules")) ? null : "pnpm";
  if (pm) {
    const i = spawnSync(pm, ["install", "--silent"], {
      cwd: app,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    // pnpm 10 exits non-zero for "ignored build scripts" (esbuild's optional
    // postinstall) even though the tree is complete — judge by what landed.
    if (!existsSync(join(app, "node_modules", "vite")))
      return { error: `install failed: ${(i.stderr || i.stdout).slice(-400)}` };
  }
  const b = spawnSync("npx", ["vite", "build", "--logLevel", "error"], {
    cwd: app,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (b.status !== 0)
    return { error: `build failed: ${(b.stderr || b.stdout).slice(-600)}`, buildFailed: true };
  const script = `
    import pw from ${JSON.stringify(require.resolve("playwright"))};
    const { chromium } = pw;
    import { createServer } from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
    const dist = ${JSON.stringify(join(app, "dist"))};
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
    const srv = createServer((req, res) => { let p = join(dist, decodeURIComponent(req.url.split("?")[0])); if (!existsSync(p) || p.endsWith("/")) p = join(dist, "index.html"); res.setHeader("content-type", types[extname(p)] || "application/octet-stream"); res.end(readFileSync(p)); }).listen(0);
    const port = srv.address().port;
    // BENCH_CHROMIUM overrides the browser binary (a CI image with its own Chromium).
    const browser = await chromium.launch(process.env.BENCH_CHROMIUM ? { executablePath: process.env.BENCH_CHROMIUM } : {}); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    await page.goto("http://localhost:" + port + "/", { waitUntil: "load" }); await page.waitForTimeout(2500);
    await page.addScriptTag({ path: ${JSON.stringify(require.resolve("axe-core/axe.min.js"))} });
    const r = await page.evaluate(async () => { const res = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }); return res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })); });
    const text = (await page.evaluate(() => document.body.innerText)).length;
    console.log(JSON.stringify({ violations: r, errors, textLen: text }));
    await browser.close(); srv.close();
  `;
  const scriptPath = join(app, "axe-run.mjs");
  writeFileSync(scriptPath, script);
  const a = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: join(ROOT, "node_modules") },
  });
  if (!keep) rmSync(work, { recursive: true, force: true });
  if (a.status !== 0) return { error: `axe run failed: ${(a.stderr || a.stdout).slice(-600)}` };
  const line = a.stdout.trim().split("\n").pop();
  try {
    return JSON.parse(line);
  } catch {
    return { error: `unparseable axe output: ${line.slice(0, 200)}` };
  }
}

const results = [];
for (const lib of readdirSync(outRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  for (const task of readdirSync(join(outRoot, lib))) {
    const file = join(outRoot, lib, task, "App.tsx");
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    const meta = existsSync(join(outRoot, lib, task, "meta.json"))
      ? JSON.parse(readFileSync(join(outRoot, lib, task, "meta.json"), "utf8"))
      : {};
    const cell = {
      lib,
      task,
      lines: src.split("\n").length,
      hallucination: scoreHallucination(lib, src),
      tokens: scoreTokens(src),
      cost: {
        input: meta.usage?.input_tokens ?? null,
        output: meta.usage?.output_tokens ?? null,
        ms: meta.ms ?? null,
      },
    };
    if (RENDER) {
      process.stderr.write(`rendering ${lib}/${task}…\n`);
      const r = renderAndAxe(lib, src, argv.includes("--keep"));
      cell.a11y = r.error
        ? { error: r.error, buildFailed: !!r.buildFailed }
        : {
            violations: r.violations.reduce((n, v) => n + v.nodes, 0),
            rules: r.violations,
            runtimeErrors: r.errors,
            textLen: r.textLen,
          };
    }
    results.push(cell);
    console.log(
      `${lib}/${task}: hallucinated ${cell.hallucination.count} (of ${cell.hallucination.checkedProps} props checked) · token findings ${cell.tokens.count} · a11y ${cell.a11y ? (cell.a11y.error ? "ERR" : cell.a11y.violations) : "skipped"} · ${cell.cost.input ?? "?"}/${cell.cost.output ?? "?"} tokens`,
    );
  }
}
writeFileSync(join(outRoot, "scores.json"), JSON.stringify(results, null, 2));

const libs = [...new Set(results.map((r) => r.lib))];
const tasks = [...new Set(results.map((r) => r.task))];
const md = [
  `# Benchmark ${RUN}`,
  "",
  "| task | " +
    libs.map((l) => `${l}: hallucinated · token findings · a11y · in/out tokens`).join(" | ") +
    " |",
  "| --- | " + libs.map(() => "---").join(" | ") + " |",
];
for (const t of tasks) {
  md.push(
    `| ${t} | ` +
      libs
        .map((l) => {
          const c = results.find((r) => r.lib === l && r.task === t);
          if (!c) return "—";
          const a = c.a11y
            ? c.a11y.error
              ? c.a11y.buildFailed
                ? "build failed"
                : "n/a"
              : String(c.a11y.violations)
            : "skipped";
          return `${c.hallucination.count} · ${c.tokens.count} · ${a} · ${c.cost.input ?? "?"}/${c.cost.output ?? "?"}`;
        })
        .join(" | ") +
      " |",
  );
}
md.push(
  "",
  "Details per cell (findings, axe rules, runtime errors): `scores.json`. A build failure means the generated file did not compile in a real app — the strongest hallucination signal there is.",
);
writeFileSync(join(outRoot, "scores.md"), md.join("\n") + "\n");
console.log(`\nwrote ${join(outRoot, "scores.md")}`);
