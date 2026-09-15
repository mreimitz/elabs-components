/**
 * remote-origins — every remote origin shipped source can reach is declared.
 * Ported from scripts/check-remote-origins.mjs. brand-ui ships into locked-down
 * deployments; a quiet third-party fetch works on a laptop and fails silently behind
 * a CSP. Every `https://` host in `packages/*​/src` (incl. the upstream URLs in the
 * generated `attributions.generated.ts`) must be in `scripts/remote-origins-allowlist.json`
 * (kind, CSP directive, escape hatch) AND named in `docs/CSP-AND-NETWORK.md`.
 * Example/schema/namespace hosts and tests/stories are ignored.
 */

export const ALLOWLIST = "scripts/remote-origins-allowlist.json";
export const CSP_DOC = "docs/CSP-AND-NETWORK.md";

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

const HOST_RE = /https:\/\/([A-Za-z0-9._-]+\.[A-Za-z]{2,})(?:[/:?#]|\b)/g;

/** `[{ host, index }]` — first occurrence of each non-ignored https host. */
export function findRemoteHosts(source) {
  const seen = new Map();
  for (const m of source.matchAll(HOST_RE)) {
    const host = m[1].toLowerCase();
    if (!isIgnored(host) && !seen.has(host)) seen.set(host, m.index);
  }
  return [...seen]
    .map(([host, index]) => ({ host, index }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

const SHIPPING = "packages/*/src/**/*.{ts,tsx,css}";
const NOT_SHIPPING = ["**/*.{test,spec,stories}.*", "**/{node_modules,dist}/**"];
const lineAt = (text, i) => text.slice(0, i).split("\n").length;

// ── fixtures ─────────────────────────────────────────────────────────────────
const ENTRY = { directive: "img-src", kind: "fetch", escapeHatch: "Pass `src`." };
function tree({ src, allow = { "newcdn.io": ENTRY }, doc = "| `newcdn.io` | `img-src` |" }) {
  return {
    files: {
      "packages/ai/src/thing.tsx": src,
      [ALLOWLIST]: JSON.stringify(allow),
      [CSP_DOC]: doc,
    },
  };
}
const USES = 'const u = "https://newcdn.io/logo.svg";';

export default {
  id: "remote-origins",
  scope: "packages",
  doc: "Declare every `https://` origin shipped source can reach (including upstream URLs in `attributions.generated.ts`) in `scripts/remote-origins-allowlist.json` with its kind, CSP directive and escape hatch, and name it in `docs/CSP-AND-NETWORK.md`.",
  baseline: "none",
  run(ctx) {
    const out = [];
    let allowlist;
    let cspDoc;
    try {
      allowlist = ctx.json(ALLOWLIST);
      cspDoc = ctx.readFile(CSP_DOC);
    } catch (err) {
      return [{ file: ALLOWLIST, line: 1, msg: `could not read the inputs — ${err.message}` }];
    }
    const reported = new Set();
    for (const file of ctx.glob(SHIPPING, { ignore: NOT_SHIPPING })) {
      const text = ctx.readFile(file);
      for (const { host, index } of findRemoteHosts(text)) {
        if (reported.has(host)) continue; // one finding per host, at its first file
        const where = { file, line: lineAt(text, index) };
        if (!Object.hasOwn(allowlist, host)) {
          reported.add(host);
          out.push({
            ...where,
            msg: `undeclared-origin ${host} — add it to ${ALLOWLIST} with its CSP directive and escape hatch`,
          });
        } else if (!cspDoc.includes(host)) {
          reported.add(host);
          out.push({
            ...where,
            msg: `undocumented-origin ${host} — allowlisted but absent from ${CSP_DOC}`,
          });
        }
      }
    }
    for (const [host, e] of Object.entries(allowlist)) {
      const bad = (msg) => out.push({ file: ALLOWLIST, line: 1, msg: `${host}: ${msg}` });
      if (!["fetch", "navigation", "comment"].includes(e.kind))
        bad("kind must be fetch | navigation | comment");
      if (!e.escapeHatch) bad('needs an escapeHatch (or "n/a")');
      if (/^TODO/.test(e.directive ?? "")) bad("directive still says TODO");
      if (/^TODO/.test(e.escapeHatch ?? "")) bad("escapeHatch still says TODO");
      if (e.kind === "fetch" && e.escapeHatch === "n/a")
        bad("a fetched origin must be avoidable — give a real escapeHatch");
      if (e.kind === "fetch" && e.directive === "none")
        bad("a fetched origin needs a CSP directive");
    }
    return out;
  },
  fixtures: {
    pass: [
      tree({ src: USES }),
      tree({
        src: [
          'xmlns="http://www.w3.org/2000/svg"',
          '"https://json-schema.org/draft/2020-12/schema"',
          '"https://example.com/thing" "https://cdn.example.com/t" "https://my-app.local/x" "https://foo.test/x"',
          '"http://insecure.example.org/x"',
        ].join("\n"),
        allow: {},
        doc: "",
      }),
      {
        files: {
          ...tree({ src: "", allow: {}, doc: "" }).files,
          "packages/ai/src/x.test.tsx": USES,
          "packages/ai/src/x.stories.tsx": USES,
        },
      },
    ],
    fail: [
      tree({ src: USES, allow: {} }),
      tree({ src: USES, doc: "# CSP\n\nnothing about it here" }),
      tree({ src: "", allow: { "newcdn.io": { ...ENTRY, kind: "maybe" } } }),
      tree({ src: "", allow: { "newcdn.io": { ...ENTRY, escapeHatch: "n/a" } } }),
      tree({ src: "", allow: { "newcdn.io": { ...ENTRY, directive: "TODO (connect-src)" } } }),
      {
        files: {
          ...tree({ src: "", allow: {} }).files,
          "packages/ui/src/components/attribution-panel/attributions.generated.ts":
            '  url: "https://github.com/acme/widget",',
        },
      },
    ],
  },
};
