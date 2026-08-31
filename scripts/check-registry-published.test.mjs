// Self-test for check-registry-published.mjs's liveness check (#31), plus
// (below) the PR #58 review fixes for the two findings on this file:
//   - "Fail after a published registry canary disappears" (P2, NARROWS but
//     does not fully close issue #60) — `everPublished` turns an
//     unreachable/non-ok `latest` canary from a permanent "skipped" into a
//     "failed" once the `gh-pages` branch demonstrably exists on origin (a
//     real regression, not a pending setup step). Deliberately NOT a `git
//     tag` check — see the module header comment for why a tag-based signal
//     false-positive-fails during the ordinary bootstrap window.
//   - "Check immutable version directories for rot" (P2) —
//     `checkVersionedSnapshots` extends the same reachability check to every
//     historical `r/<version>/` an external consumer may have pinned, not
//     just `r/latest/`.
// Injects a fake fetchImpl — no real network calls. See the module's header
// comment for why the gate checks the REMOTE snapshot's item list rather than
// the local tree's (a PR adding a new, unreleased item must not fail this).
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPublishedItems,
  checkVersionedSnapshots,
  selectVersionsToCheck,
  isPagesConfigured,
} from "./check-registry-published.mjs";

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

// ── everPublished: unreachable canary is "skipped" before, "failed" after ──
// (PR #58 "Fail after a published registry canary disappears" / issue #60)

test("checkPublishedItems: still SKIPS an unreachable canary when gh-pages has never been published (default)", async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl, everPublished: false });
  assert.equal(result.status, "skipped");
});

test("checkPublishedItems: FAILS an unreachable canary once gh-pages has been published (real rot, not pending setup)", async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl, everPublished: true });
  assert.equal(result.status, "failed");
  assert.match(result.reason, /gh-pages.*already exists/);
});

test("checkPublishedItems: FAILS a non-ok canary once gh-pages has been published", async () => {
  const fetchImpl = async () => jsonResponse(null, false, 404);
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl, everPublished: true });
  assert.equal(result.status, "failed");
  assert.match(result.reason, /404/);
});

test("checkPublishedItems: a reachable canary with real item rot still fails regardless of everPublished", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/latest/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }] });
    }
    return jsonResponse(null, false, 404);
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl, everPublished: false });
  assert.equal(result.status, "failed");
  assert.ok(result.unreachable);
});

// ── pagesConfigured: the authoritative GitHub Pages-Settings signal (#60) ──
// `everPublished` (branch existence) only proves content was PUSHED, not that
// Settings → Pages was ever toggled on — so it collapses "pushed once, Pages
// never enabled" and "Pages live, canary genuinely broken" into the same
// "failed" outcome. `pagesConfigured` is the authoritative override.

test("checkPublishedItems: PLANTED REGRESSION — Pages not configured (404) wins over everPublished=true, still SKIPS", async () => {
  // This is the exact case the pre-#60-fix decision tree gets wrong: a repo
  // that pushed `gh-pages` at least once (everPublished=true) but whose
  // maintainer never flipped Settings → Pages. Before this fix, everPublished
  // alone drove the decision and this reported "failed" — a false positive.
  // With the fix, the authoritative Pages-config signal must override it.
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({
    baseUrl: BASE,
    fetchImpl,
    everPublished: true,
    pagesConfigured: "not-configured",
  });
  assert.equal(result.status, "skipped");
});

test("checkPublishedItems: Pages configured + canary unreachable → FAILS regardless of everPublished", async () => {
  const fetchImpl = async () => jsonResponse(null, false, 404);
  const result = await checkPublishedItems({
    baseUrl: BASE,
    fetchImpl,
    everPublished: false,
    pagesConfigured: "configured",
  });
  assert.equal(result.status, "failed");
});

test("checkPublishedItems: Pages-config unknown (API call failed) — falls back to everPublished=true → failed", async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({
    baseUrl: BASE,
    fetchImpl,
    everPublished: true,
    pagesConfigured: "unknown",
  });
  assert.equal(result.status, "failed");
});

test("checkPublishedItems: Pages-config unknown (API call failed) — falls back to everPublished=false → skipped", async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({
    baseUrl: BASE,
    fetchImpl,
    everPublished: false,
    pagesConfigured: "unknown",
  });
  assert.equal(result.status, "skipped");
});

test('checkPublishedItems: pagesConfigured defaults to "unknown" when omitted (backward compatible)', async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkPublishedItems({ baseUrl: BASE, fetchImpl, everPublished: true });
  assert.equal(result.status, "failed");
});

// ── isPagesConfigured: injected execImpl, no real `gh`/network call ────────

test("isPagesConfigured: gh api 404 (Not Found) → not-configured", async () => {
  const execImpl = async () => {
    const err = new Error("Command failed: gh api repos/:owner/:repo/pages");
    err.stderr = "gh: Not Found (HTTP 404)";
    err.status = 1;
    throw err;
  };
  const result = await isPagesConfigured({ execImpl });
  assert.equal(result, "not-configured");
});

test("isPagesConfigured: gh api returns a clean JSON response → configured", async () => {
  const execImpl = async () =>
    JSON.stringify({ html_url: "https://mreimitz.github.io/elabs-components/" });
  const result = await isPagesConfigured({ execImpl });
  assert.equal(result, "configured");
});

test("isPagesConfigured: no gh binary on PATH (ENOENT) → unknown", async () => {
  const execImpl = async () => {
    const err = new Error("spawnSync gh ENOENT");
    err.code = "ENOENT";
    throw err;
  };
  const result = await isPagesConfigured({ execImpl });
  assert.equal(result, "unknown");
});

test("isPagesConfigured: gh installed but not authenticated → unknown", async () => {
  const execImpl = async () => {
    const err = new Error("Command failed: gh api repos/:owner/:repo/pages");
    err.stderr =
      "To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable.";
    err.status = 4;
    throw err;
  };
  const result = await isPagesConfigured({ execImpl });
  assert.equal(result, "unknown");
});

test("isPagesConfigured: rate-limited / other non-404 failure → unknown (never treated as not-configured)", async () => {
  const execImpl = async () => {
    const err = new Error("Command failed: gh api repos/:owner/:repo/pages");
    err.stderr = "API rate limit exceeded";
    err.status = 1;
    throw err;
  };
  const result = await isPagesConfigured({ execImpl });
  assert.equal(result, "unknown");
});

test("isPagesConfigured: malformed (non-JSON) success response → unknown, not configured", async () => {
  const execImpl = async () => "not json";
  const result = await isPagesConfigured({ execImpl });
  assert.equal(result, "unknown");
});

// ── checkVersionedSnapshots: historical /r/<version>/ rot (PR #58) ─────────

test("checkVersionedSnapshots: a version never published (its own snapshot 404s) is skipped silently", async () => {
  const fetchImpl = async () => jsonResponse(null, false, 404);
  const result = await checkVersionedSnapshots({ baseUrl: BASE, versions: ["1.0.0"], fetchImpl });
  assert.deepEqual(result, { status: "ok" });
});

test("checkVersionedSnapshots: a version whose snapshot is unreachable (network error) is skipped silently", async () => {
  const fetchImpl = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  const result = await checkVersionedSnapshots({ baseUrl: BASE, versions: ["1.0.0"], fetchImpl });
  assert.deepEqual(result, { status: "ok" });
});

test("checkVersionedSnapshots: a published version whose items all resolve — ok", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/4.0.0/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }] });
    }
    return jsonResponse({});
  };
  const result = await checkVersionedSnapshots({ baseUrl: BASE, versions: ["4.0.0"], fetchImpl });
  assert.deepEqual(result, { status: "ok" });
});

test("checkVersionedSnapshots: a published version with a rotted item — fails, names version and item", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/4.0.0/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }, { name: "data-table" }] });
    }
    if (url.endsWith("/4.0.0/data-table.json")) {
      return jsonResponse(null, false, 404);
    }
    return jsonResponse({});
  };
  const result = await checkVersionedSnapshots({ baseUrl: BASE, versions: ["4.0.0"], fetchImpl });
  assert.equal(result.status, "failed");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].version, "4.0.0");
  assert.match(result.failures[0].unreachable[0], /data-table/);
});

test("checkVersionedSnapshots: checks every version independently — a never-published version doesn't mask a rotted one", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/3.0.0/registry.json")) return jsonResponse(null, false, 404); // never published
    if (url.endsWith("/4.0.0/registry.json")) {
      return jsonResponse({ items: [{ name: "app-shell" }] });
    }
    if (url.endsWith("/4.0.0/app-shell.json")) return jsonResponse(null, false, 404); // rotted
    return jsonResponse({});
  };
  const result = await checkVersionedSnapshots({
    baseUrl: BASE,
    versions: ["3.0.0", "4.0.0"],
    fetchImpl,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].version, "4.0.0");
});

// ── selectVersionsToCheck: pure sort + cap ──────────────────────────────────

test("selectVersionsToCheck: sorts newest-first", () => {
  assert.deepEqual(selectVersionsToCheck(["1.0.0", "4.0.0", "2.5.0"]), ["4.0.0", "2.5.0", "1.0.0"]);
});

test("selectVersionsToCheck: caps at max, keeping only the newest", () => {
  const versions = ["1.0.0", "2.0.0", "3.0.0", "4.0.0", "5.0.0"];
  assert.deepEqual(selectVersionsToCheck(versions, 2), ["5.0.0", "4.0.0"]);
});

test("selectVersionsToCheck: empty input — empty output", () => {
  assert.deepEqual(selectVersionsToCheck([]), []);
});
