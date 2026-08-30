// Self-test for check-registry-published.mjs's liveness check (#31).
// Injects a fake fetchImpl — no real network calls. See the module's header
// comment for why the gate checks the REMOTE snapshot's item list rather than
// the local tree's (a PR adding a new, unreleased item must not fail this).
import test from "node:test";
import assert from "node:assert/strict";
import { checkPublishedItems } from "./check-registry-published.mjs";

const BASE = "https://mreimitz.github.io/elabs-components/r";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test("checkPublishedItems: skips when the canary snapshot is unreachable (network error)", async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /unreachable/);
});

test("checkPublishedItems: skips when the canary returns a non-ok status (Pages not enabled / no release yet)", async () => {
  const fetchImpl = async () => jsonResponse(null, false, 404);
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /404/);
});

test("checkPublishedItems: ok when the canary is reachable and every published item resolves", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/latest/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }, { name: "data-table" }] });
    }
    return jsonResponse({});
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "ok");
});

test("checkPublishedItems: fails when a published item's file no longer resolves (real rot)", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/latest/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }, { name: "data-table" }] });
    }
    if (url.endsWith("/latest/data-table.json")) {
      return jsonResponse(null, false, 404);
    }
    return jsonResponse({});
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "failed");
  assert.equal(result.unreachable.length, 1);
  assert.match(result.unreachable[0], /data-table/);
});

test("checkPublishedItems: never checks a name absent from the remote snapshot (unreleased local item is not penalized)", async () => {
  const calledUrls = [];
  const fetchImpl = async (url) => {
    calledUrls.push(url);
    if (url.endsWith("/latest/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }] });
    }
    return jsonResponse({});
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "ok");
  assert.ok(!calledUrls.some((u) => u.includes("brand-new-unreleased-item")));
  assert.equal(calledUrls.length, 2); // canary + app-shell only
});

test("checkPublishedItems: fails when the canary is reachable but not valid JSON", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error("Unexpected token");
    },
  });
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "failed");
  assert.match(result.reason, /not valid JSON/);
});

test("checkPublishedItems: fails when the canary lists no items (empty/malformed snapshot)", async () => {
  const fetchImpl = async () => jsonResponse({ items: [] });
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl });
  assert.equal(result.status, "failed");
  assert.match(result.reason, /no items/);
});

test("checkPublishedItems: tolerates a trailing slash on baseUrl", async () => {
  const calledUrls = [];
  const fetchImpl = async (url) => {
    calledUrls.push(url);
    return jsonResponse({ items: [{ name: "app-shell" }] });
  };
  await checkPublishedItems({ baseUrl: `${BASE}/`, fetchImpl });
  assert.ok(calledUrls.every((u) => !u.includes("//latest")));
});
