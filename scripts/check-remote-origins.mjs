#!/usr/bin/env node
/**
 * check-remote-origins.mjs — every remote origin a component can reach is declared.
 *
 * brand-ui ships into locked-down deployments. A component that quietly fetches
 * from a third-party host works on a laptop and fails behind a CSP — and the
 * failure is usually silent (a blank logo, an empty animation box). The consumer
 * report that prompted this gate listed origins nobody had written down, and
 * missed one that was there all along (`basemaps.cartocdn.com` in @qlik-coe-emea/qlabs-components-maps).
 *
 * So: every `https://` origin appearing in `packages/*​/src` must be BOTH
 *
 *   1. present in `scripts/remote-origins-allowlist.json` (a deliberate decision,
 *      with the CSP directive it needs and its escape hatch), and
 *   2. documented in `docs/CSP-AND-NETWORK.md`, so the deployment doc can't rot
 *      away from the code.
 *
 * A new origin fails CI until both are true.
 *
 * Example/spec URLs are ignored (`example.com`, `*.test`, `*.invalid`, schema and
 * namespace URLs like `w3.org`/`json-schema.org`), as are origins inside a
 * `*.test.*` or `*.stories.*` file — those never ship to a consumer.
 *
 * Flags:
 *   --warn     never exit non-zero (dev-hook mode); still prints findings.
 *   --update   rewrite the allowlist from what's in the tree (review the diff!).
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const ALLOWLIST = join(SCRIPT_DIR, "remote-origins-allowlist.json");
const CSP_DOC = join(REPO_ROOT, "docs", "CSP-AND-NETWORK.md");

/** Hosts that are documentation, schemas or namespaces — never runtime fetches. */
const IGNORED_HOSTS = [
  "example.com",
  "example.org",
  "json-schema.org",
  "localhost",
  "schema.org",
  "www.w3.org",
  "w3.org",
];

const isIgnored = (host) =>
  IGNORED_HOSTS.includes(host) ||
  host.endsWith(".example.com") ||
  host.endsWith(".test") ||
  host.endsWith(".invalid") ||
  host.endsWith(".local");

/**
 * Distinct `https://` hosts referenced by a source file.
 * @param {string} source
 * @returns {string[]}
 */
export function findRemoteHosts(source) {
  const hosts = new Set();
  for (const m of source.matchAll(/https:\/\/([A-Za-z0-9._-]+\.[A-Za-z]{2,})(?:[/:?#]|\b)/g)) {
    const host = m[1].toLowerCase();
    if (!isIgnored(host)) hosts.add(host);
  }
  return [...hosts].sort();
}

/** Shipping source files under `packages/*​/src` (no tests, no stories). */
function shippingFiles(root) {
  const out = [];
  const pkgsDir = join(root, "packages");
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(full);
      } else if (
        /\.(tsx?|css)$/.test(entry.name) &&
        !/\.(test|spec|stories)\.[^.]+$/.test(entry.name)
      ) {
        out.push(full);
      }
    }
  };
  for (const pkg of readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = join(pkgsDir, pkg.name, "src");
    try {
      if (statSync(src).isDirectory()) walk(src);
    } catch {
      /* package has no src/ */
    }
  }
  return out;
}

/** @returns {Map<string, string[]>} host → files that reference it. */
export function collectOrigins(root = REPO_ROOT) {
  const byHost = new Map();
  for (const file of shippingFiles(root)) {
    for (const host of findRemoteHosts(readFileSync(file, "utf8"))) {
      const rel = relative(root, file);
      byHost.set(host, [...(byHost.get(host) ?? []), rel]);
    }
  }
  return new Map([...byHost].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Origins that are missing from the allowlist, or absent from the CSP doc.
 * @returns {{ host: string, rule: string, detail: string }[]}
 */
export function findUndeclaredOrigins(byHost, { allowlist, cspDoc }) {
  const allowed = new Set(Object.keys(allowlist));
  const out = [];
  for (const [host, files] of byHost) {
    if (!allowed.has(host)) {
      out.push({
        host,
        rule: "undeclared-origin",
        detail: `reached from ${files.join(", ")} — add it to scripts/remote-origins-allowlist.json with its CSP directive and escape hatch`,
      });
      continue;
    }
    if (!cspDoc.includes(host)) {
      out.push({
        host,
        rule: "undocumented-origin",
        detail: `allowlisted but absent from docs/CSP-AND-NETWORK.md — a consumer configuring a CSP would never learn about it`,
      });
    }
  }
  return out;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const update = argv.includes("--update");

  const byHost = collectOrigins();

  if (update) {
    let existing = {};
    try {
      existing = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
    } catch {
      /* first run */
    }
    const next = {};
    for (const [host, files] of byHost) {
      next[host] = existing[host] ?? {
        directive: "TODO (connect-src | img-src | none — navigation only)",
        escapeHatch: "TODO — the prop or config that avoids this origin",
        usedBy: files,
      };
    }
    writeFileSync(ALLOWLIST, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`✔ remote-origins: allowlist updated — ${Object.keys(next).length} origin(s).`);
    return 0;
  }

  let allowlist = {};
  try {
    allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  } catch {
    console.error(`✖ remote-origins: missing allowlist at ${ALLOWLIST} (run with --update).`);
    return warnOnly ? 0 : 1;
  }

  let cspDoc = "";
  try {
    cspDoc = readFileSync(CSP_DOC, "utf8");
  } catch {
    console.error(`✖ remote-origins: missing ${relative(REPO_ROOT, CSP_DOC)}.`);
    return warnOnly ? 0 : 1;
  }

  const violations = findUndeclaredOrigins(byHost, { allowlist, cspDoc });

  if (violations.length === 0) {
    console.log(
      `✔ remote-origins: ${byHost.size} origin(s) reachable from shipped source — all allowlisted and documented.`,
    );
    return 0;
  }

  console.error("✖ remote-origins: a component can reach an origin nobody declared:");
  for (const v of violations) console.error(`  ${v.host} — ${v.rule}\n      ${v.detail}`);
  console.error(
    "\n  A remote origin is a deployment constraint, not an implementation detail:\n" +
      "  behind a CSP it fails, usually silently. Declare it in the allowlist AND in\n" +
      "  docs/CSP-AND-NETWORK.md, and give consumers a way to avoid it (a `src`\n" +
      "  override, a self-host recipe, or a local fallback).",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
