/**
 * csp-policy — the recommended CSP and its published doc cannot drift.
 * Ported from scripts/check-csp-policy.mjs. `docs/csp-policy.json` is the single
 * source; `docs/CSP-AND-NETWORK.md` §2.7 publishes it. The failure this stops is
 * SILENT WIDENING: `'unsafe-eval'` added to make a page load while the guidance
 * quietly starts lying. Four checks:
 *   1. the `<!-- csp:published -->` fenced block equals the published policy;
 *   2. the `<!-- csp:dev -->` block equals published + the named dev-only delta;
 *   3. every non-baseline, non-remote source is covered by a carve-out (remote
 *      origins belong to `remote-origins`);
 *   4. no carve-out names a source the policy no longer has, and every carve-out /
 *      dev delta carries a substantive `why`.
 *
 * Known limit: no in-repo app SERVES this header since 80a12fb (apps/playground and
 * the E2E CSP suite were removed). The policy is REVIEWED, not EXECUTED.
 */

export const POLICY_JSON = "docs/csp-policy.json";
export const DOC = "docs/CSP-AND-NETWORK.md";

/** Not relaxations. `'script'` is `require-trusted-types-for`'s value, not a source. */
const BASELINE_SOURCES = new Set(["'self'", "'none'", "'script'"]);
const isRemoteOrigin = (s) => s.startsWith("https://") || s.startsWith("http://");

export function formatCsp(directives) {
  return Object.entries(directives)
    .map(([d, sources]) => (sources.length ? `${d} ${sources.join(" ")}` : d))
    .join("; ");
}

export function withDevDelta(directives, devOnly = {}) {
  const merged = { ...directives };
  for (const [d, delta] of Object.entries(devOnly)) {
    const existing = merged[d] ?? [];
    merged[d] = [...existing, ...delta.add.filter((s) => !existing.includes(s))];
  }
  return merged;
}

/** Compare by meaning: the doc wraps one directive per line, the header is one line. */
export function normalizeCsp(text) {
  return text
    .split(";")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("; ");
}

/** The fenced code block after an HTML marker comment, or null. */
export function fencedBlockAfter(docText, marker) {
  const at = docText.indexOf(marker);
  if (at === -1) return null;
  const fence = docText.indexOf("```", at);
  if (fence === -1) return null;
  const start = docText.indexOf("\n", fence);
  const end = docText.indexOf("```", start);
  if (start === -1 || end === -1) return null;
  return docText.slice(start + 1, end);
}

/** `[{ file, marker?, msg }]` — every drift between policy JSON and doc. */
export function findPolicyDrift({ policyFile, docText }) {
  const out = [];
  const directives = policyFile.policy ?? {};
  const carveOuts = policyFile.carveOuts ?? [];
  const devOnly = policyFile.devOnly ?? {};

  for (const [marker, expected, label] of [
    ["<!-- csp:published -->", formatCsp(directives), "published"],
    ["<!-- csp:dev -->", formatCsp(withDevDelta(directives, devOnly)), "dev"],
  ]) {
    const block = fencedBlockAfter(docText, marker);
    if (block === null) {
      out.push({ file: DOC, marker, msg: `doc-block-missing: no fenced block after ${marker}` });
      continue;
    }
    const got = normalizeCsp(block);
    const want = normalizeCsp(expected);
    if (got !== want)
      out.push({
        file: DOC,
        marker,
        msg: `doc-policy-drift: ${marker} does not match the ${label} policy in ${POLICY_JSON} — served: ${want} · doc: ${got}`,
      });
  }

  const carvedOut = new Set();
  for (const c of carveOuts) for (const s of c.sources ?? []) carvedOut.add(`${c.directive} ${s}`);
  for (const [d, sources] of Object.entries(directives))
    for (const s of sources) {
      if (BASELINE_SOURCES.has(s) || isRemoteOrigin(s) || carvedOut.has(`${d} ${s}`)) continue;
      out.push({
        file: POLICY_JSON,
        msg: `undeclared-relaxation: \`${d}\` is relaxed with \`${s}\` but no carveOut explains it — add one (and document it in ${DOC} §2.7) or remove the relaxation`,
      });
    }

  for (const c of carveOuts) {
    const sources = directives[c.directive] ?? [];
    for (const s of c.sources ?? [])
      if (!sources.includes(s))
        out.push({
          file: POLICY_JSON,
          msg: `stale-carve-out: \`${c.directive} ${s}\` is carved out but the policy no longer contains it — delete the carveOut`,
        });
    if (!c.why || c.why.trim().length < 40)
      out.push({
        file: POLICY_JSON,
        msg: `carve-out-unexplained: carveOut for \`${c.directive}\` has no substantive \`why\``,
      });
  }
  for (const [d, delta] of Object.entries(devOnly))
    if (!delta.why || delta.why.trim().length < 40)
      out.push({
        file: POLICY_JSON,
        msg: `dev-delta-unexplained: devOnly.${d} has no substantive \`why\` — name the build-tool behaviour that needs it`,
      });
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const LONG_WHY =
  "Inline SVG/PNG data URIs in icon and chart output; cannot execute script, still a relaxation.";
function tree({ mutate = () => {}, doc } = {}) {
  const policyFile = {
    policy: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:"],
      "require-trusted-types-for": ["'script'"],
    },
    carveOuts: [{ directive: "img-src", sources: ["data:"], why: LONG_WHY }],
    devOnly: { "script-src": { add: ["'unsafe-inline'"], why: `Vite HMR preamble. ${LONG_WHY}` } },
  };
  const wrap = (csp) => `\`\`\`\n${csp.split("; ").join(";\n")};\n\`\`\``;
  const render = (p) =>
    `# doc\n\n<!-- csp:published -->\n\n${wrap(formatCsp(p.policy))}\n\n<!-- csp:dev -->\n\n${wrap(formatCsp(withDevDelta(p.policy, p.devOnly)))}\n`;
  const docText = render(policyFile); // doc from the UNmutated policy unless told otherwise
  const mutated = structuredClone(policyFile);
  mutate(mutated);
  const text = doc ? doc(docText, render(mutated)) : docText;
  return { files: { [POLICY_JSON]: JSON.stringify(mutated), [DOC]: text } };
}
const regen = (_old, fresh) => fresh; // doc re-rendered from the mutated policy

export default {
  id: "csp-policy",
  scope: "repo",
  doc: "Keep `docs/csp-policy.json` and the `csp:published`/`csp:dev` blocks in `docs/CSP-AND-NETWORK.md` §2.7 identical, and justify every non-`'self'` relaxation with a carve-out whose `why` names the reason.",
  baseline: "none",
  run(ctx) {
    let policyFile;
    let docText;
    try {
      policyFile = ctx.json(POLICY_JSON);
      docText = ctx.readFile(DOC);
    } catch (err) {
      return [{ file: POLICY_JSON, line: 1, msg: `could not read the inputs — ${err.message}` }];
    }
    return findPolicyDrift({ policyFile, docText }).map(({ marker, ...f }) => {
      const at = marker ? docText.indexOf(marker) : -1;
      return { ...f, line: at < 0 ? 1 : docText.slice(0, at).split("\n").length };
    });
  },
  fixtures: {
    pass: [
      tree(),
      // a remote origin needs no carve-out here (remote-origins owns it)
      tree({
        mutate: (p) => (p.policy["connect-src"] = ["'self'", "https://x.invalid"]),
        doc: regen,
      }),
    ],
    fail: [
      tree({ doc: (d) => d.replace("default-src 'self'", "default-src 'self' 'unsafe-eval'") }),
      tree({ doc: (d) => d.replace("<!-- csp:dev -->", "") }),
      // a dev-only relaxation that never reaches the doc
      tree({
        mutate: (p) => (p.devOnly["style-src"] = { add: ["'unsafe-inline'"], why: LONG_WHY }),
      }),
      // silent widening, doc kept in sync: still needs a carve-out
      tree({ mutate: (p) => (p.policy["script-src"] = ["'self'", "'unsafe-eval'"]), doc: regen }),
      tree({
        mutate: (p) =>
          p.carveOuts.push({ directive: "script-src", sources: ["'unsafe-eval'"], why: LONG_WHY }),
      }),
      tree({ mutate: (p) => (p.carveOuts[0].why = "needed") }),
      tree({ mutate: (p) => (p.devOnly["script-src"].why = "vite") }),
    ],
  },
};
