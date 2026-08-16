/**
 * check-csp-policy.test.mjs — locks the CSP dogfood gate.
 *
 * A gate that can silently stop firing is worse than none, so every rule below
 * plants a bad fixture and asserts the gate REPORTS it. The last test runs the
 * gate against the real tree, so a real drift fails here too.
 *
 * Run in CI: `node --test scripts/check-csp-policy.test.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  fencedBlockAfter,
  findPolicyDrift,
  formatCsp,
  normalizeCsp,
  withDevDelta,
} from "./check-csp-policy.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** A minimal, VALID fixture: policy, doc and config all agree. */
function fixture(overrides = {}) {
  const policyFile = {
    policy: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:"],
      "require-trusted-types-for": ["'script'"],
    },
    carveOuts: [
      {
        directive: "img-src",
        sources: ["data:"],
        why: "Inline SVG/PNG data URIs in icon and chart output; cannot execute script, but still a relaxation.",
      },
    ],
    devOnly: {
      "script-src": {
        add: ["'unsafe-inline'"],
        why: "Vite dev injects the React Refresh preamble as an inline module script; blocking it kills HMR.",
      },
    },
    ...overrides.policyFile,
  };

  const published = formatCsp(policyFile.policy);
  const dev = formatCsp(withDevDelta(policyFile.policy, policyFile.devOnly));

  const docText =
    overrides.docText ??
    `# doc\n\n<!-- csp:published -->\n\n\`\`\`\n${published.split("; ").join(";\n")};\n\`\`\`\n\n<!-- csp:dev -->\n\n\`\`\`\n${dev.split("; ").join(";\n")};\n\`\`\`\n`;

  return { policyFile, docText };
}

const rules = (findings) => findings.map((f) => f.rule);

// ── the fixture itself must be clean, or the negative tests prove nothing ─────
test("a policy, doc and config that agree produce no findings", () => {
  assert.deepEqual(findPolicyDrift(fixture()), []);
});

// ── rule 1/2: the doc must publish what is served ────────────────────────────
test("a doc block that drifts from the served policy FAILS", () => {
  const f = fixture();
  f.docText = f.docText.replace("default-src 'self'", "default-src 'self' 'unsafe-eval'");
  assert.ok(rules(findPolicyDrift(f)).includes("doc-policy-drift"));
});

test("a missing doc block FAILS", () => {
  const f = fixture();
  f.docText = f.docText.replace("<!-- csp:dev -->", "");
  assert.ok(rules(findPolicyDrift(f)).includes("doc-block-missing"));
});

test("a dev-only relaxation that never reaches the doc FAILS", () => {
  // Silently widening the DEV policy is still drift: the doc stops describing it.
  const f = fixture();
  f.policyFile.devOnly["style-src"] = {
    add: ["'unsafe-inline'"],
    why: "Something plausible-sounding that is long enough to pass the prose length rule.",
  };
  assert.ok(rules(findPolicyDrift(f)).includes("doc-policy-drift"));
});

// ── rule 3: silent widening is the whole point ───────────────────────────────
test("adding 'unsafe-eval' without a carve-out FAILS", () => {
  const f = fixture();
  f.policyFile.policy["script-src"] = ["'self'", "'unsafe-eval'"];
  const found = findPolicyDrift(f);
  assert.ok(
    rules(found).includes("undeclared-relaxation"),
    "an undeclared relaxation must be reported, not merely re-documented",
  );
});

test("a remote https origin needs no carve-out here (origins:check owns it)", () => {
  const f = fixture();
  f.policyFile.policy["connect-src"] = ["'self'", "https://example.invalid"];
  // Re-derive the doc so rule 1/2 stays satisfied and only rule 3 is under test.
  const fresh = fixture({ policyFile: f.policyFile });
  assert.equal(
    rules(findPolicyDrift(fresh)).filter((r) => r === "undeclared-relaxation").length,
    0,
  );
});

// ── rule 4: no stale or empty justification ──────────────────────────────────
test("a carve-out for a source the policy no longer has FAILS", () => {
  const f = fixture();
  f.policyFile.carveOuts.push({
    directive: "script-src",
    sources: ["'unsafe-eval'"],
    why: "A reason long enough to clear the prose-length rule but for a source that is gone.",
  });
  assert.ok(rules(findPolicyDrift(f)).includes("stale-carve-out"));
});

test("a carve-out with no substantive reason FAILS", () => {
  const f = fixture();
  f.policyFile.carveOuts[0].why = "needed";
  assert.ok(rules(findPolicyDrift(f)).includes("carve-out-unexplained"));
});

test("a dev delta with no substantive reason FAILS", () => {
  const f = fixture();
  f.policyFile.devOnly["script-src"].why = "vite";
  assert.ok(rules(findPolicyDrift(f)).includes("dev-delta-unexplained"));
});

// ── the wiring arm is GONE, and that is a deliberate, recorded loss ──────────
// This gate used to assert that `apps/playground/vite.config.ts` served the
// header on BOTH `configureServer` and `configurePreviewServer`, and that the
// served string was derived from the JSON rather than hand-copied. That app and
// the E2E suite that asserted a real browser's violations were deleted in
// 80a12fb; the maintainer's call was to complete the removal. Nothing here can
// replace those assertions — doc parity is static — so rather than leave four
// tests passing against fixtures for code that no longer exists, they are
// removed and the gap is stated. See check-csp-policy.mjs's header comment.

// ── helpers ──────────────────────────────────────────────────────────────────
test("normalizeCsp compares by meaning, not whitespace", () => {
  assert.equal(normalizeCsp("a 'self';\n b  x;\n"), normalizeCsp("a 'self'; b x"));
});

test("fencedBlockAfter returns null when the marker is absent", () => {
  assert.equal(fencedBlockAfter("# doc", "<!-- csp:published -->"), null);
});

// ── the real tree ────────────────────────────────────────────────────────────
test("the repo's own policy and doc agree", () => {
  const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");
  const found = findPolicyDrift({
    policyFile: JSON.parse(read("docs/csp-policy.json")),
    docText: read("docs/CSP-AND-NETWORK.md"),
  });
  assert.deepEqual(found, [], JSON.stringify(found, null, 2));
});
