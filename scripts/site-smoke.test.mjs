/**
 * site-smoke.test.mjs — self-test for the per-host deploy smoke (RM-105).
 * Run in CI: `node --test scripts/site-smoke.test.mjs` (`pnpm check:test`).
 *
 * The smoke itself needs a deployed host, so CI cannot run its network path. What CI
 * CAN lock is the thing that makes it worth having: that it FAILS on each way the
 * two-project split can go wrong while every status code is still 200. Every assertion
 * below plants one:
 *
 *   - the public address still serving the OLD Storybook build at `/`,
 *   - `/storybook/` satisfied by a REDIRECT to another host instead of the rewrite,
 *   - a deep-link redirect pointed somewhere else,
 *   - a generated `llms.txt` that leaked a dev origin,
 *   - the hosted MCP answering with the previous version.
 *
 * The redirect comparison is asserted host-agnostic on purpose: the same expectations
 * run against `elabs-components.vercel.app` and `elabs-ai.com`, and Vercel may answer
 * with either an absolute or a relative `Location`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeTarget, judge, sampleIds, siteChecks } from "./site-smoke.mjs";

const BASE = "https://elabs-ai.com";

/** One check by name, so a reordering of the list does not silently move a test. */
function check(name, opts) {
  const found = siteChecks(BASE, opts).find((c) => c.name === name);
  assert.ok(found, `no check named ${name}`);
  return found;
}

test("every check is an absolute URL on the base host", () => {
  for (const c of siteChecks(BASE)) {
    assert.ok(c.url.startsWith(`${BASE}/`), `${c.name} → ${c.url}`);
  }
});

test("the base URL's trailing slashes never double up", () => {
  for (const c of siteChecks("https://elabs-ai.com///")) {
    assert.ok(!c.url.includes("///"), c.url);
  }
});

test("/ passes on the site's own shell", () => {
  const c = check("the site's own home page");
  const seen = {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: '<main data-slot="app-shell-content">brand-ui</main>',
  };
  assert.deepEqual(judge(c, seen), []);
});

test("/ FAILS when the address still serves the old Storybook build", () => {
  // The failure this whole cut-over risks, and it answers 200.
  const c = check("the site's own home page");
  const seen = {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: '<div id="storybook-root" data-slot="x"></div><script src="./sb-manager/globals.js">',
  };
  const problems = judge(c, seen);
  assert.ok(
    problems.some((p) => p.includes("sb-manager")),
    problems.join(" | "),
  );
});

test("/ FAILS when the shell never rendered", () => {
  const c = check("the site's own home page");
  const problems = judge(c, { status: 200, contentType: "text/html", body: "<html></html>" });
  assert.ok(
    problems.some((p) => p.includes("data-slot=")),
    problems.join(" | "),
  );
});

test("/storybook/ FAILS when it is satisfied by a redirect instead of the rewrite", () => {
  // A 3xx to storybook.elabs-ai.com would keep deep links working while moving
  // Storybook off the public address — the one outcome that was ruled out.
  const c = check("Storybook's manager, through the rewrite");
  const problems = judge(c, {
    status: 308,
    contentType: "text/html",
    location: "https://storybook.elabs-ai.com/",
    body: "",
  });
  assert.ok(
    problems.some((p) => p.includes("answered 308")),
    problems.join(" | "),
  );
});

test("/storybook/ passes on the manager bundle", () => {
  const c = check("Storybook's manager, through the rewrite");
  const seen = {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: '<script type="module" src="./sb-manager/runtime.js"></script>',
  };
  assert.deepEqual(judge(c, seen), []);
});

test("a percent-encoded redirect target is the same target", () => {
  // Next answers `?path=/docs/core-button--docs` as `?path=%2Fdocs%2Fcore-button--docs`.
  // Asserting the raw bytes failed a redirect that works, on a live deployment.
  const c = check("a legacy ?path= deep link");
  const encoded = { status: 308, location: "/storybook/?path=%2Fdocs%2Fcore-button--docs" };
  assert.deepEqual(judge(c, encoded), []);
  assert.equal(
    decodeTarget("/storybook/?path=%2Fdocs%2Fcore-button--docs"),
    decodeTarget("https://elabs-ai.com/storybook/?path=/docs/core-button--docs"),
  );
});

test("decodeTarget still separates two genuinely different targets", () => {
  assert.notEqual(
    decodeTarget("/storybook/?path=/docs/core-button--docs"),
    decodeTarget("/storybook/?path=/docs/core-card--docs"),
  );
  assert.notEqual(decodeTarget("/storybook/"), decodeTarget("/storybook/iframe.html"));
});

test("a redirect is judged on path and query, whichever form Location takes", () => {
  const c = check("a legacy ?path= deep link");
  const relative = { status: 308, location: "/storybook/?path=/docs/core-button--docs" };
  const absolute = {
    status: 308,
    location: "https://elabs-ai.com/storybook/?path=/docs/core-button--docs",
  };
  assert.deepEqual(judge(c, relative), []);
  assert.deepEqual(judge(c, absolute), []);
});

test("a deep-link redirect FAILS when it drops the query", () => {
  const c = check("a legacy ?path= deep link");
  const problems = judge(c, { status: 308, location: "/storybook/" });
  assert.ok(
    problems.some((p) => p.includes("expected /storybook/?path=")),
    problems.join(" | "),
  );
});

test("a deep-link redirect FAILS when it goes nowhere at all", () => {
  const c = check("a legacy /iframe.html deep link");
  const problems = judge(c, { status: 200, contentType: "text/html", body: "" });
  assert.equal(problems.length, 2, problems.join(" | "));
});

test("llms.txt FAILS on a leaked dev origin", () => {
  const c = check("the agent entry point");
  const problems = judge(c, {
    status: 200,
    contentType: "text/plain; charset=utf-8",
    body: "MCP: http://localhost:3000/mcp",
  });
  assert.ok(
    problems.some((p) => p.includes("localhost")),
    problems.join(" | "),
  );
});

test("llms.txt FAILS when it never mentions the hosted MCP", () => {
  const c = check("the agent entry point");
  const problems = judge(c, {
    status: 200,
    contentType: "text/plain; charset=utf-8",
    body: "brand-ui\n",
  });
  assert.ok(
    problems.some((p) => p.includes("/mcp")),
    problems.join(" | "),
  );
});

test("the hosted MCP check only demands a version when one was given", () => {
  const without = check("the hosted MCP endpoint");
  const withV = check("the hosted MCP endpoint", { version: "5.0.0" });
  assert.ok(!without.must.some((m) => m.includes("version")));
  assert.ok(withV.must.includes('"version":"5.0.0"'));
});

test("the hosted MCP FAILS when it reports the previous version", () => {
  const c = check("the hosted MCP endpoint", { version: "5.0.0" });
  const problems = judge(c, {
    status: 200,
    contentType: "application/json",
    body: '{"result":{"serverInfo":{"name":"brand-ui","version":"4.2.0"},"protocolVersion":"2025-06-18"}}',
  });
  assert.ok(
    problems.some((p) => p.includes('"version":"5.0.0"')),
    problems.join(" | "),
  );
});

test("the hosted MCP is asked with a POST and a JSON-RPC initialize body", () => {
  const c = check("the hosted MCP endpoint");
  assert.equal(c.method, "POST");
  assert.equal(c.body.method, "initialize");
});

test("a wrong content-type is reported even when the body is right", () => {
  const c = check("the social preview image");
  const problems = judge(c, { status: 200, contentType: "text/html", body: "" });
  assert.ok(
    problems.some((p) => p.includes("image/png")),
    problems.join(" | "),
  );
});

test("sampleIds never returns more than asked, and nothing when asked for none", () => {
  const entries = Array.from({ length: 500 }, (_, i) => ({ id: `s-${i}` }));
  assert.equal(sampleIds(entries, 30).length, 30);
  assert.deepEqual(sampleIds(entries, 0), []);
  assert.deepEqual(sampleIds([], 30), []);
});

test("sampleIds spreads across the index instead of taking the head", () => {
  const entries = Array.from({ length: 500 }, (_, i) => ({ id: `s-${i}` }));
  const ids = sampleIds(entries, 10);
  assert.equal(ids[0], "s-0");
  // The last pick must come from the tail; a head-slice would end at s-9.
  assert.ok(Number(ids.at(-1).slice(2)) > 400, ids.join(","));
  assert.equal(new Set(ids).size, ids.length);
});

test("sampleIds takes everything when the index is smaller than the sample", () => {
  const entries = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(sampleIds(entries, 30), ["a", "b"]);
});
