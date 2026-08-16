#!/usr/bin/env node
/**
 * check-csp-policy.mjs — the recommended CSP and the published doc cannot drift.
 *
 * `docs/csp-policy.json` is the single source for the policy this repo recommends
 * a consumer deploy. `docs/CSP-AND-NETWORK.md` §2.7 publishes it as prose, and
 * this gate keeps the two byte-identical in meaning.
 *
 * The failure mode this gate exists to stop is **silent widening**: a page won't
 * load, someone adds `'unsafe-eval'` to make it load, and the published guidance
 * quietly starts lying about what a consumer needs. So four rules:
 *
 *   1. The `<!-- csp:published -->` fenced block in docs/CSP-AND-NETWORK.md §2.7
 *      equals the PUBLISHED policy — the one a production deployment sends.
 *   2. The `<!-- csp:dev -->` block equals published + the named dev-only delta.
 *      A dev relaxation that never reaches the doc is itself a drift.
 *   3. Every relaxation in the published policy is covered by a named carve-out.
 *      `'self'`/`'none'`/`'script'` are the baseline; `https://` origins belong to
 *      `pnpm origins:check` + §1. Everything else must justify itself in writing.
 *   4. No carve-out names a source the policy no longer contains — a stale
 *      justification reads as if a relaxation were still needed.
 *
 * **Known limit, deliberately recorded.** This gate used to have a fifth arm: an
 * in-repo Vite app (`apps/playground`) SERVED this exact policy as a real response
 * header in dev and preview, and `apps/e2e/tests/csp.spec.ts` failed on any
 * violation a real browser reported — so the doc could only be wrong in ways CI
 * noticed. Both that app and the E2E suite were removed on 2026-08-02 (80a12fb),
 * and the maintainer's call on 2026-08-10 was to complete that removal rather than
 * rehome the serving dogfood. What survives is doc parity and carve-out
 * discipline, which are static: nothing in this repo now proves a browser can
 * actually load a brand-ui surface under this policy. Treat the policy as
 * REVIEWED, not EXECUTED. Rehoming the serving arm (onto `apps/docs`, which is the
 * only app left) is the fix if that guarantee is ever wanted back.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const POLICY_JSON = "docs/csp-policy.json";
const DOC = "docs/CSP-AND-NETWORK.md";

/**
 * Sources that are NOT relaxations and so need no carve-out.
 * `'script'` is `require-trusted-types-for`'s value, not a source.
 */
const BASELINE_SOURCES = new Set(["'self'", "'none'", "'script'"]);

/** Remote origins are inventoried by `pnpm origins:check` + §1, not here. */
const isRemoteOrigin = (source) => source.startsWith("https://") || source.startsWith("http://");

// ───────────────────────────── policy assembly ────────────────────────────────

/** Serialise directives into a `Content-Security-Policy` header value. */
export function formatCsp(directives) {
  return Object.entries(directives)
    .map(([directive, sources]) =>
      sources.length ? `${directive} ${sources.join(" ")}` : directive,
    )
    .join("; ");
}

/** Merge `devOnly` additions on top of the published directives, preserving order. */
export function withDevDelta(directives, devOnly = {}) {
  const merged = { ...directives };
  for (const [directive, delta] of Object.entries(devOnly)) {
    const existing = merged[directive] ?? [];
    merged[directive] = [...existing, ...delta.add.filter((s) => !existing.includes(s))];
  }
  return merged;
}

/**
 * Compare two policy strings by MEANING, not by whitespace: the doc wraps one
 * directive per line and ends each with `;`, the header is a single line.
 */
export function normalizeCsp(text) {
  return text
    .split(";")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("; ");
}

/**
 * Read the fenced code block that follows an HTML marker comment.
 * @returns {string | null} the block's contents, or null when absent.
 */
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

// ───────────────────────────────── rules ──────────────────────────────────────

/**
 * @returns {{ rule: string, detail: string }[]}
 */
export function findPolicyDrift({ policyFile, docText }) {
  const out = [];
  const directives = policyFile.policy ?? {};
  const carveOuts = policyFile.carveOuts ?? [];
  const devOnly = policyFile.devOnly ?? {};

  const published = formatCsp(directives);
  const dev = formatCsp(withDevDelta(directives, devOnly));

  // ── 1 + 2: the doc must publish exactly what is served ──────────────────────
  for (const [marker, expected, label] of [
    ["<!-- csp:published -->", published, "published"],
    ["<!-- csp:dev -->", dev, "dev"],
  ]) {
    const block = fencedBlockAfter(docText, marker);
    if (block === null) {
      out.push({
        rule: "doc-block-missing",
        detail: `${DOC} has no fenced block after ${marker} — the ${label} policy is undocumented`,
      });
      continue;
    }
    const got = normalizeCsp(block);
    const want = normalizeCsp(expected);
    if (got !== want) {
      out.push({
        rule: "doc-policy-drift",
        detail:
          `${DOC} ${marker} does not match the ${label} policy ${POLICY_JSON} serves.\n` +
          `      served: ${want}\n` +
          `      doc:    ${got}`,
      });
    }
  }

  // ── 3: every relaxation is justified ────────────────────────────────────────
  const carvedOut = new Set();
  for (const carveOut of carveOuts) {
    for (const source of carveOut.sources ?? []) carvedOut.add(`${carveOut.directive} ${source}`);
  }

  for (const [directive, sources] of Object.entries(directives)) {
    for (const source of sources) {
      if (BASELINE_SOURCES.has(source) || isRemoteOrigin(source)) continue;
      if (!carvedOut.has(`${directive} ${source}`)) {
        out.push({
          rule: "undeclared-relaxation",
          detail:
            `${POLICY_JSON} relaxes \`${directive}\` with \`${source}\` but no carveOut explains it.\n` +
            `      Widening the policy to make a page load is exactly the drift this gate exists to stop —\n` +
            `      add a carveOut with the reason it could not be avoided, and document it in ${DOC} §2.7.`,
        });
      }
    }
  }

  // ── 4: no stale justification ───────────────────────────────────────────────
  for (const carveOut of carveOuts) {
    const sources = directives[carveOut.directive] ?? [];
    for (const source of carveOut.sources ?? []) {
      if (!sources.includes(source)) {
        out.push({
          rule: "stale-carve-out",
          detail: `${POLICY_JSON} carves out \`${carveOut.directive} ${source}\`, but the policy no longer contains it — delete the carveOut`,
        });
      }
    }
    if (!carveOut.why || carveOut.why.trim().length < 40) {
      out.push({
        rule: "carve-out-unexplained",
        detail: `${POLICY_JSON} carveOut for \`${carveOut.directive}\` has no substantive \`why\` — a relaxation without a reason is a silent widening with extra steps`,
      });
    }
  }

  for (const [directive, delta] of Object.entries(devOnly)) {
    if (!delta.why || delta.why.trim().length < 40) {
      out.push({
        rule: "dev-delta-unexplained",
        detail: `${POLICY_JSON} devOnly.${directive} has no substantive \`why\` — say which build-tool behaviour needs it`,
      });
    }
  }

  return out;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");

  let policyFile, docText;
  try {
    policyFile = JSON.parse(read(POLICY_JSON));
    docText = read(DOC);
  } catch (error) {
    console.error(`✖ csp-policy: could not read the inputs — ${error.message}`);
    return warnOnly ? 0 : 1;
  }

  const violations = findPolicyDrift({ policyFile, docText });

  if (violations.length === 0) {
    const relaxations = (policyFile.carveOuts ?? []).reduce(
      (n, c) => n + (c.sources?.length ?? 0),
      0,
    );
    console.log(
      `✔ csp-policy: ${POLICY_JSON} matches ${DOC} §2.7 and ${relaxations} relaxation(s) carry a named carve-out. (Doc parity only — no in-repo app serves this header since 80a12fb.)`,
    );
    return 0;
  }

  console.error("✖ csp-policy: the recommended CSP and its published guidance disagree:");
  for (const v of violations) console.error(`  ${v.rule}\n      ${v.detail}`);
  console.error(
    "\n  The policy this repo recommends and the policy it documents must say the\n" +
      "  same thing. Fix the policy or the doc — never widen the policy silently.",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
