/**
 * @elabs-ai/components-cli — persistent `brand-ui mcp` stdio server (WP-03 #81).
 *
 * An always-on Model Context Protocol server that exposes the SAME engine
 * (lib/core.mjs) the CLI uses, so an agent gets brand-ui ground truth in ANY
 * session/harness WITHOUT booting Storybook (the Storybook addon-mcp only exists
 * while `pnpm storybook` runs). It is a thin TRANSPORT over the engine — the
 * manifest is the single source of truth; this module only renders it as MCP tool
 * results.
 *
 * DEPENDENCY-FREE on purpose: MCP's stdio transport is newline-delimited JSON-RPC
 * 2.0, which is small enough to implement directly. That keeps `@elabs-ai/components-cli`
 * dependency-light (it runs in any consuming project via `npx @elabs-ai/components-cli mcp`) and
 * keeps the protocol handler a PURE function (`handleMessage`) we can unit-test
 * without spawning a process.
 *
 * Tools: `info`, `search`, `docs`, `tokens`, `audit` — the read surface of the CLI.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  loadManifest,
  flat,
  matchPlaybooks,
  resolveTasteProfile,
  tasteSearchDirs,
} from "./core.mjs";
import { scanText } from "./audit.mjs";

export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_INFO = { name: "brand-ui", version: "3.1.0" };

/** The tool catalogue advertised over `tools/list`. */
export const TOOLS = [
  {
    name: "info",
    description:
      "Project context: which @elabs-ai/components-* packages are present, the themes + default, the token count, the registry size, and the ACTIVE taste profile (register × density × motion × expressiveness). Call once at the start of a session.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search",
    description:
      'Find components/hooks/registry items by name or package substring, AND archetype playbooks by free-text intent ("build a dashboard" → the dashboard playbook). Use before writing UI — prefer an existing component, and start a whole screen from its playbook.',
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name, concept, or whole-screen intent." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "docs",
    description:
      "The real API for a component from the manifest: own-declared props (type/default/description), expanded cva variant values, per-component intent (purpose/relationships/anti-patterns), and resolved inherited props when enriched. Never guess props — call this.",
    inputSchema: {
      type: "object",
      properties: {
        component: { type: "string", description: "Exact component name, e.g. Button." },
      },
      required: ["component"],
      additionalProperties: false,
    },
  },
  {
    name: "tokens",
    description:
      "The theme/token summary: the available themes, the default theme, the base radius, and the semantic token count.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "audit",
    description:
      "Static token/style/anti-slop lint of a file or directory (raw colors, anti-patterns). Severities are judged against the active taste register (product = restrained default; brand softens the expressive tells). The rendered cross-theme + WCAG-contrast pass lives in the brand-ui-audit skill.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File or directory to audit." },
        register: {
          type: "string",
          enum: ["product", "brand"],
          description:
            "Override the active taste register. Omit to use the project's resolved profile.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
];

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

const result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
const error = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const textContent = (text) => ({ content: [{ type: "text", text }] });

// ── tool implementations (reuse the engine; render compact text) ─────────────

function toolInfo(root) {
  const manifest = root ? loadManifest(root) : null;
  if (!manifest)
    return textContent(
      "No manifest — run inside the brand-ui monorepo or install @elabs-ai/components-cli.",
    );
  const pkgs = Object.keys(manifest.packages);
  const taste = activeTaste(root, manifest);
  const lines = [
    `packages (${pkgs.length}): ${pkgs.join(", ")}`,
    `themes (${(manifest.themes || []).length}): ${(manifest.themes || []).join(", ")}  · default: ${manifest.defaultTheme ?? "—"}`,
    `radius: ${manifest.radius ?? "—"} · tokens: ${manifest.tokenCount ?? 0} · registry items: ${(manifest.registry || []).length}`,
    `taste profile [${taste.source}]: register ${taste.register} · density ${taste.density} · motion ${taste.motion} · expressiveness ${taste.expressiveness} (the --decoration dial)`,
  ];
  return textContent(lines.join("\n"));
}

/**
 * The ACTIVE taste profile — shipped defaults ⊕ the nearest `brand-ui.config.json`,
 * searched from the audited TARGET first, then the cwd, then the repo root
 * (nearest wins). Passing the target is what lets `audit { path: "/some/app" }`
 * judge that app against ITS profile rather than the host repo's.
 */
function activeTaste(root, manifest, target = null) {
  return resolveTasteProfile({ manifest, dirs: tasteSearchDirs({ target, root }) });
}

function toolSearch(root, q) {
  const query = String(q || "").toLowerCase();
  if (!query) return { ...textContent("usage: search { query }"), isError: true };
  const manifest = root ? loadManifest(root) : null;
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  const rows = flat(manifest).filter(
    (r) => r.name.toLowerCase().includes(query) || r.pkg.toLowerCase().includes(query),
  );
  const reg = (manifest.registry || []).filter((r) =>
    `${r.name} ${r.title} ${r.description}`.toLowerCase().includes(query),
  );
  const books = matchPlaybooks(manifest, query);
  const lines = [`Components/hooks matching "${query}":`];
  for (const r of rows.slice(0, 40)) lines.push(`  ${r.name}  (${r.pkg} · ${r.kind})`);
  if (!rows.length) lines.push("  (none)");
  if (reg.length) {
    lines.push("", `Registry items matching "${query}":`);
    for (const r of reg) lines.push(`  ${r.name}  [${r.type}] — ${r.title}`);
  }
  // Playbooks (WP-09 #66/#84) — a whole-screen intent routes to its recipe.
  if (books.length) {
    lines.push("", `Playbooks matching "${query}" (start a WHOLE screen here):`);
    for (const p of books) {
      lines.push(`  ${p.archetype}  — ${p.intent}`);
      lines.push(`    ${p.file}${p.template ? `  · template ${p.template}` : ""}`);
    }
  }
  return textContent(lines.join("\n"));
}

/** Compact docs rendering from the manifest entry (the same data `brand-ui docs` prints). */
function renderDocsEntry(hit) {
  const lines = [`# ${hit.name}  (${hit.pkg})`];
  if (hit.importPath) lines.push(`import from: ${hit.importPath}`);
  lines.push(`source: ${hit.module}`);
  const intent = hit.intent;
  if (intent) {
    if (intent.purpose)
      lines.push(`purpose: ${intent.purpose}${intent.category ? `  [${intent.category}]` : ""}`);
    const rel = intent.relationships || {};
    for (const [label, key] of [
      ["used inside", "usedInside"],
      ["contains", "contains"],
      ["pairs with", "pairsWith"],
      ["avoid next to", "avoidNextTo"],
    ])
      if (rel[key]?.length) lines.push(`  ${label}: ${rel[key].join(", ")}`);
    if (intent.antiPatterns?.length) {
      lines.push("anti-patterns (avoid):");
      for (const ap of intent.antiPatterns) lines.push(`  x ${ap}`);
    }
  }
  if (hit.props) {
    if (hit.props.extends?.length) lines.push(`extends: ${hit.props.extends.join(", ")}`);
    if (hit.props.props?.length) {
      lines.push("props (own-declared):");
      for (const p of hit.props.props) {
        const req = p.optional ? "?" : "";
        const def = p.defaultValue !== undefined ? `  = ${p.defaultValue}` : "";
        const desc = p.description ? `  — ${p.description}` : "";
        lines.push(`  ${p.name}${req}: ${p.type}${def}${desc}`);
      }
    }
    const resolved = hit.props.resolved;
    if (resolved && Object.keys(resolved).length) {
      lines.push("props (inherited, resolved):");
      for (const name of Object.keys(resolved).sort((a, b) => a.localeCompare(b))) {
        const r = resolved[name];
        const req = r.optional === false ? "" : "?";
        const type = r.type ? `: ${r.type}` : "";
        const def = r.defaultValue !== undefined ? `  = ${r.defaultValue}` : "";
        const desc = r.description ? `  — ${r.description}` : "";
        lines.push(`  ${name}${req}${type}${def}${desc}`);
      }
    }
  }
  if (hit.variants?.variants) {
    lines.push("variants (expanded from cva — the real values):");
    for (const [group, values] of Object.entries(hit.variants.variants)) {
      const def = hit.variants.defaultVariants?.[group];
      lines.push(
        `  ${group}: ${values.map((v) => (v === def ? `${v} (default)` : v)).join(" | ")}`,
      );
    }
  }
  return lines.join("\n");
}

function toolDocs(root, component) {
  const name = String(component || "");
  if (!name) return { ...textContent("usage: docs { component }"), isError: true };
  const manifest = root ? loadManifest(root) : null;
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  const hit = flat(manifest).find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!hit) return textContent(`${name} not found. Try the search tool with "${name}".`);
  return textContent(renderDocsEntry(hit));
}

function toolTokens(root) {
  const manifest = root ? loadManifest(root) : null;
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  const lines = [
    `themes (${(manifest.themes || []).length}): ${(manifest.themes || []).join(", ")}`,
    `default theme: ${manifest.defaultTheme ?? "—"}`,
    `base radius: ${manifest.radius ?? "—"}`,
    `semantic token count: ${manifest.tokenCount ?? 0}`,
    "Use semantic token utilities only (bg-background, text-muted-foreground, …); never raw hex outside themes.css.",
  ];
  return textContent(lines.join("\n"));
}

/** Walk a directory for auditable source files (mirrors the CLI's audit walk). */
function walkFiles(dir, acc) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git" || e === "dist" || e === "storybook-static") continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walkFiles(p, acc);
    else if (/\.(tsx|jsx|css|html)$/.test(e)) acc.push(p);
  }
  return acc;
}

function toolAudit(root, targetPath, registerOverride) {
  const target = String(targetPath || "");
  if (!target) return { ...textContent("usage: audit { path }"), isError: true };
  const abs = resolve(target);
  if (!existsSync(abs)) return { ...textContent(`not found: ${target}`), isError: true };
  const files = statSync(abs).isDirectory() ? walkFiles(abs, []) : [abs];
  const taste = activeTaste(root, root ? loadManifest(root) : null, abs);
  const register =
    registerOverride === "brand" || registerOverride === "product"
      ? registerOverride
      : taste.register;
  const findings = [];
  for (const f of files) {
    const isCss = f.endsWith(".css");
    const isThemeFile = /themes\.css$/.test(f);
    const text = readFileSync(f, "utf8");
    for (const hit of scanText(text, { isCss, isThemeFile, register }))
      findings.push({ file: f, ...hit });
  }
  const header = `judged against register: ${register}`;
  if (!findings.length)
    return textContent(`audit: ${files.length} file(s) clean — no violations. (${header})`);
  // Content slop is its own bucket, never folded into "advisory": in GENERATED
  // output it blocks "done" (mirrors `brand-ui audit --strict`).
  const contentSlop = findings.filter((f) => f.category === "content-slop").length;
  const blocking = findings.filter((f) => !f.advisory && f.category !== "content-slop").length;
  const advisory = findings.length - contentSlop - blocking;
  const lines = [
    `audit: ${findings.length} finding(s) across ${files.length} file(s) — ` +
      `${blocking} blocking style, ${contentSlop} content-slop (blocking in generated output), ` +
      `${advisory} advisory. (${header})`,
  ];
  for (const f of findings.slice(0, 100))
    lines.push(
      `  ${f.file}:${f.line ?? "?"}  ${f.rule}${f.category === "content-slop" ? " (content slop)" : f.advisory ? " (advisory)" : ""}: ${f.msg}`,
    );
  if (findings.length > 100) lines.push(`  …and ${findings.length - 100} more.`);
  return textContent(lines.join("\n"));
}

function callTool(root, name, argsObj = {}) {
  switch (name) {
    case "info":
      return toolInfo(root);
    case "search":
      return toolSearch(root, argsObj.query);
    case "docs":
      return toolDocs(root, argsObj.component);
    case "tokens":
      return toolTokens(root);
    case "audit":
      return toolAudit(root, argsObj.path, argsObj.register);
    default:
      return null; // unknown tool → caller emits an MCP error
  }
}

/**
 * The PURE protocol handler: one JSON-RPC request in, one response out (or `null`
 * for notifications, which get no reply). Spawning a process is unnecessary to
 * exercise this — the stdio loop (`runMcpServer`) is a thin wrapper that only does
 * line framing + I/O. `root` is the repo root (the engine's data source).
 * @returns {object|null}
 */
export function handleMessage(msg, { root } = {}) {
  if (!msg || typeof msg !== "object") return error(null, -32600, "Invalid Request");
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "initialized":
      return null; // notification — no response
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: TOOLS });
    case "tools/call": {
      const name = params?.name;
      const out = callTool(root, name, params?.arguments || {});
      if (out === null) return error(id, -32602, `Unknown tool: ${name}`);
      return result(id, out);
    }
    default:
      if (isNotification) return null; // ignore unknown notifications
      return error(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * The stdio transport loop: read newline-delimited JSON-RPC from stdin, dispatch
 * via `handleMessage`, write newline-delimited JSON-RPC responses to stdout.
 * Used by `brand-ui mcp`. Resolves when stdin closes.
 * @param {{ root?: string, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} [opts]
 */
export function runMcpServer({ root, input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolveDone) => {
    let buffer = "";
    const send = (obj) => obj && output.write(`${JSON.stringify(obj)}\n`);
    input.setEncoding?.("utf8");
    input.on("data", (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          send(error(null, -32700, "Parse error"));
          continue;
        }
        send(handleMessage(msg, { root }));
      }
    });
    input.on("end", () => resolveDone());
    input.on("close", () => resolveDone());
  });
}
