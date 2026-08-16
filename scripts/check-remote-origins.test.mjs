/**
 * check-remote-origins.test.mjs — locks the remote-origin inventory gate.
 * Run in CI: `node --test scripts/check-remote-origins.test.mjs`.
 *
 * Inline fixtures, plus an integration test that the real tree's origins are all
 * allowlisted AND documented.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectOrigins, findRemoteHosts, findUndeclaredOrigins } from "./check-remote-origins.mjs";

// ── Extraction ───────────────────────────────────────────────────────────────
test("finds a host in an img src", () => {
  const src = `<img src={\`https://models.dev/logos/\${provider}.svg\`} />`;
  assert.deepEqual(findRemoteHosts(src), ["models.dev"]);
});

test("finds the Rive blob host", () => {
  const src = `source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv",`;
  assert.deepEqual(findRemoteHosts(src), ["ejiidnob33g9ap1r.public.blob.vercel-storage.com"]);
});

test("dedupes and sorts multiple hosts", () => {
  const src = `
    createUrl: () => "https://chatgpt.com/?q=",
    other: "https://claude.ai/new",
    again: "https://chatgpt.com/x",
  `;
  assert.deepEqual(findRemoteHosts(src), ["chatgpt.com", "claude.ai"]);
});

test("ignores documentation, schema and namespace hosts", () => {
  const src = `
    xmlns="http://www.w3.org/2000/svg"
    const schema = "https://json-schema.org/draft/2020-12/schema";
    const demo = "https://example.com/thing";
    const sub = "https://cdn.example.com/thing";
    const local = "https://my-app.local/x";
    const t = "https://foo.test/x";
  `;
  assert.deepEqual(findRemoteHosts(src), []);
});

test("http:// is not matched — only https origins are inventoried", () => {
  assert.deepEqual(findRemoteHosts(`const u = "http://insecure.example.org/x";`), []);
});

// ── Declaration rules ────────────────────────────────────────────────────────
test("FAILS: an origin missing from the allowlist", () => {
  const byHost = new Map([["newcdn.io", ["packages/ai/src/thing.tsx"]]]);
  const v = findUndeclaredOrigins(byHost, { allowlist: {}, cspDoc: "" });
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "undeclared-origin");
  assert.match(v[0].detail, /thing\.tsx/, "the message must name where it came from");
});

test("FAILS: an allowlisted origin that never made it into the CSP doc", () => {
  const byHost = new Map([["newcdn.io", ["packages/ai/src/thing.tsx"]]]);
  const v = findUndeclaredOrigins(byHost, {
    allowlist: { "newcdn.io": { directive: "img-src" } },
    cspDoc: "# CSP\n\nnothing about it here",
  });
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "undocumented-origin");
});

test("PASSES: allowlisted AND documented", () => {
  const byHost = new Map([["newcdn.io", ["packages/ai/src/thing.tsx"]]]);
  const v = findUndeclaredOrigins(byHost, {
    allowlist: { "newcdn.io": { directive: "img-src" } },
    cspDoc: "| `newcdn.io` | `img-src` | thing | pass `src` |",
  });
  assert.deepEqual(v, []);
});

// ── The real tree ────────────────────────────────────────────────────────────
test("every origin in the shipped source is allowlisted and documented", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));

  const allowlist = JSON.parse(readFileSync(join(here, "remote-origins-allowlist.json"), "utf8"));
  const cspDoc = readFileSync(join(here, "..", "docs", "CSP-AND-NETWORK.md"), "utf8");
  const violations = findUndeclaredOrigins(collectOrigins(), { allowlist, cspDoc });

  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
});

test("every allowlist entry classifies itself and names an escape hatch", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const allowlist = JSON.parse(readFileSync(join(here, "remote-origins-allowlist.json"), "utf8"));

  for (const [host, entry] of Object.entries(allowlist)) {
    assert.ok(
      ["fetch", "navigation", "comment"].includes(entry.kind),
      `${host}: kind must be fetch | navigation | comment`,
    );
    assert.ok(entry.escapeHatch, `${host}: needs an escapeHatch (or "n/a")`);
    assert.ok(!/^TODO/.test(entry.directive ?? ""), `${host}: directive still says TODO`);
    assert.ok(!/^TODO/.test(entry.escapeHatch), `${host}: escapeHatch still says TODO`);
  }
});

test("each fetching origin has a real, non-'n/a' escape hatch", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const allowlist = JSON.parse(readFileSync(join(here, "remote-origins-allowlist.json"), "utf8"));

  // A runtime fetch a consumer cannot avoid is exactly the #5 defect.
  for (const [host, entry] of Object.entries(allowlist)) {
    if (entry.kind !== "fetch") continue;
    assert.notEqual(entry.escapeHatch, "n/a", `${host}: a fetched origin must be avoidable`);
    assert.ok(entry.directive !== "none", `${host}: a fetched origin needs a CSP directive`);
  }
});
