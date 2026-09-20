#!/usr/bin/env node
/**
 * site-smoke.mjs — what one HOST must serve after a deploy (RM-105).
 *
 * The website and Storybook are two Vercel projects. The website owns the public
 * addresses (`elabs-components.vercel.app`, `elabs-ai.com`) and reaches Storybook by
 * rewriting `/storybook/:path*` to the Storybook project; `/mcp` is the website's own
 * route. Nothing in that arrangement is visible from either project's build log: a
 * rewrite that points at a dead origin, a project whose Root Directory was never
 * switched, or a domain still aliased to the old deployment all produce a GREEN deploy
 * and a wrong site. Hence this: one pass over every address a consumer or an agent
 * actually opens, against a base URL given on the command line.
 *
 *   node scripts/site-smoke.mjs https://elabs-components.vercel.app
 *   node scripts/site-smoke.mjs https://elabs-ai.com --version 5.0.0 --stories 30
 *
 *   --version <v>   also assert the hosted MCP reports this version
 *   --stories <n>   sample n stories from the served index and crawl them THROUGH
 *                   /storybook/ (0, the default, skips the crawl)
 *   --json          print the result table as JSON instead of text
 *
 * TWO ASSERTIONS EARN THIS FILE'S EXISTENCE, and both are ones a status-code check
 * would miss:
 *
 *   - **`/` must NOT look like Storybook.** Before the split, the same addresses served
 *     the Storybook manager at `/`. A 200 at `/` is therefore worthless as proof that
 *     the website is live — the failure mode this whole cut-over risks answers 200 too.
 *     So `/` is asserted to carry the site's own shell AND to carry no Storybook manager
 *     markup.
 *   - **`/storybook/` must be reached through the rewrite, not by a redirect.** A
 *     3xx to another hostname would keep every deep link working while quietly moving
 *     Storybook off the public address, which is exactly what was asked not to happen.
 *     The check refuses to follow redirects and demands a 200 with Storybook's markup.
 *
 * The pure parts (`siteChecks`, `judge`, `sampleIds`) hold every expectation and are
 * exported for `site-smoke.test.mjs`, which plants each failure without a network.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { crawlStories, storiesFromIndex } from "./lib/story-crawl.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Playwright is `apps/docs`'s devDependency (the Storybook Vitest browser runner owns
 * it), not the root's, and pnpm does not hoist it — so resolve it from there. Its entry
 * point is CommonJS whose `module.exports` is built at runtime, so Node finds no named
 * exports and `chromium` has to be read off whichever shape the namespace has; getting
 * that wrong once produced "Cannot read properties of undefined (reading 'launch')",
 * which reads like a broken site (scripts/release-smoke.mjs `pickChromium`).
 */
async function resolveChromium(root = REPO_ROOT) {
  const from = pathToFileURL(join(root, "apps", "docs", "package.json")).href;
  try {
    const resolved = createRequire(from).resolve("playwright");
    const mod = await import(pathToFileURL(resolved).href);
    return mod?.chromium ?? mod?.default?.chromium;
  } catch {
    return undefined;
  }
}

/** JSON-RPC `initialize`, the one call every MCP client makes first. */
const MCP_INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "site-smoke", version: "0.0.0" },
  },
};

/**
 * Every address one host must answer, as data. `status` is the exact status expected
 * (a redirect is asserted as a redirect — see the file header); `type` is a substring
 * of the content-type; `must`/`mustNot` are substrings of the body; `location` is the
 * exact `Location` header a redirect must carry, relative to the base.
 */
export function siteChecks(base, { version } = {}) {
  const root = String(base).replace(/\/+$/, "");
  const at = (path) => `${root}${path}`;
  return [
    {
      name: "the site's own home page",
      url: at("/"),
      status: 200,
      type: "text/html",
      // The site renders its shell through the library, so every page carries at least
      // one `data-slot`. `sb-manager` is Storybook's manager bundle: present only if
      // this address is still serving the OLD build.
      must: ["data-slot="],
      mustNot: ["sb-manager", "storybook-root"],
    },
    {
      name: "/storybook gains its trailing slash",
      url: at("/storybook"),
      status: 308,
      location: "/storybook/",
    },
    {
      name: "Storybook's manager, through the rewrite",
      url: at("/storybook/"),
      status: 200,
      type: "text/html",
      must: ["sb-manager"],
    },
    {
      name: "Storybook's story index, through the rewrite",
      url: at("/storybook/index.json"),
      status: 200,
      type: "json",
      must: ['"entries"'],
    },
    {
      name: "the hosted MCP endpoint",
      url: at("/mcp"),
      status: 200,
      method: "POST",
      body: MCP_INITIALIZE,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      must: ['"serverInfo"', '"protocolVersion"', ...(version ? [`"version":"${version}"`] : [])],
    },
    {
      name: "the agent entry point",
      url: at("/llms.txt"),
      status: 200,
      type: "text/plain",
      must: ["/mcp"],
      // A generated file that leaked a dev origin is the one defect that makes this
      // file actively harmful to an agent following it.
      mustNot: ["localhost", "127.0.0.1"],
    },
    {
      name: "the MCP discovery document",
      url: at("/.well-known/mcp.json"),
      status: 200,
      type: "json",
    },
    {
      name: "the shadcn registry index",
      url: at("/r/registry.json"),
      status: 200,
      type: "json",
      must: ['"items"'],
    },
    {
      name: "the social preview image",
      url: at("/opengraph-image"),
      status: 200,
      type: "image/png",
    },
    { name: "robots.txt", url: at("/robots.txt"), status: 200 },
    { name: "the sitemap", url: at("/sitemap.xml"), status: 200, type: "xml" },
    {
      name: "a legacy ?path= deep link",
      url: at("/?path=/docs/core-button--docs"),
      status: 308,
      location: "/storybook/?path=/docs/core-button--docs",
    },
    {
      name: "a legacy /iframe.html deep link",
      url: at("/iframe.html"),
      status: 308,
      location: "/storybook/iframe.html",
    },
  ];
}

/**
 * A redirect target reduced to what is actually promised: the path and the DECODED query,
 * with any host dropped. Exported so the self-test can pin the equivalences.
 */
export function decodeTarget(target) {
  const path = String(target ?? "").replace(/^https?:\/\/[^/]+/, "");
  const cut = path.indexOf("?");
  if (cut < 0) return path;
  const params = new URLSearchParams(path.slice(cut + 1));
  const query = [...params].map(([k, v]) => `${k}=${v}`).join("&");
  return `${path.slice(0, cut)}?${query}`;
}

/**
 * What is wrong with one response, given what was asked for. Pure; returns a list of
 * human-readable problems (empty = the address is fine).
 *
 * `seen` is `{ status, contentType, body, location }`.
 */
export function judge(check, seen) {
  const problems = [];
  if (seen.status !== check.status) {
    problems.push(`answered ${seen.status}, expected ${check.status}`);
  }
  if (check.type && !String(seen.contentType ?? "").includes(check.type)) {
    problems.push(
      `content-type is ${seen.contentType || "absent"}, expected to contain ${check.type}`,
    );
  }
  if (check.location) {
    // A redirect may name the target absolutely or relatively; only the path and query
    // are the contract, and the host must not change. The query is compared DECODED:
    // Next answers `?path=/docs/core-button--docs` as `?path=%2Fdocs%2Fcore-button--docs`,
    // which is the same value to anything that parses it — asserting the raw bytes here
    // failed a redirect that works, and the point of this check is the target, not its
    // spelling.
    const got = String(seen.location ?? "");
    if (decodeTarget(got) !== decodeTarget(check.location)) {
      problems.push(`redirects to ${got || "nowhere"}, expected ${check.location}`);
    }
  }
  for (const needle of check.must ?? []) {
    if (!String(seen.body ?? "").includes(needle)) problems.push(`body does not contain ${needle}`);
  }
  for (const needle of check.mustNot ?? []) {
    if (String(seen.body ?? "").includes(needle)) problems.push(`body still contains ${needle}`);
  }
  return problems;
}

/** n story ids spread evenly across the index, so the sample is not all of one package. */
export function sampleIds(entries, n) {
  if (n <= 0 || entries.length === 0) return [];
  if (entries.length <= n) return entries.map((e) => e.id);
  const step = entries.length / n;
  return Array.from({ length: n }, (_, i) => entries[Math.floor(i * step)].id);
}

/** One address, fetched the way the check asks. Impure. */
async function probe(check) {
  const res = await fetch(check.url, {
    method: check.method ?? "GET",
    redirect: "manual",
    headers: check.headers,
    ...(check.body ? { body: JSON.stringify(check.body) } : {}),
  });
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    location: res.headers.get("location"),
    // A redirect has no body worth reading, and the OG image is a megabyte of PNG.
    body: check.must?.length || check.mustNot?.length ? (await res.text()).slice(0, 2_000_000) : "",
  };
}

/**
 * The proof the rewrite carries a WORKING Storybook and not just its shell. A manager
 * that loads while every preview is blank is the failure the 2026-09-17 release shipped,
 * and it is invisible to a status-code check: `/storybook/` answers 200 either way.
 *
 * Two pages, because they fail differently:
 *
 *   1. the DEEP LINK a person pastes (`?path=/docs/…`) — proves the manager parsed the
 *      query, resolved the entry and pointed its preview iframe at the right story;
 *   2. the STORY ITSELF (`iframe.html?id=…&viewMode=story`) — proves a component really
 *      mounted. It is asserted as "`#storybook-root` holds a rendered `<button>`", not by
 *      a `data-slot`: `Button` predates that convention and emits none, and a selector
 *      that matches nothing fails a working deployment.
 */
async function storybookReallyRenders(base, chromium, { timeoutMs = 45_000 } = {}) {
  const root = String(base).replace(/\/+$/, "");
  const browser = await chromium.launch();
  const problems = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    try {
      await page.goto(`${root}/storybook/?path=/docs/core-button--docs`, {
        waitUntil: "load",
        timeout: timeoutMs,
      });
      const preview = page.frameLocator("#storybook-preview-iframe");
      await preview
        .locator("text=@elabs-ai/components-ui")
        .first()
        .waitFor({ state: "attached", timeout: timeoutMs });
    } catch (err) {
      problems.push(
        `the /storybook/?path= deep link never rendered its docs page — ${String(err?.message ?? err).split("\n")[0]}`,
      );
    }

    try {
      await page.goto(`${root}/storybook/iframe.html?id=core-button--default&viewMode=story`, {
        waitUntil: "load",
        timeout: timeoutMs,
      });
      await page
        .locator("#storybook-root button")
        .first()
        .waitFor({ state: "visible", timeout: timeoutMs });
    } catch (err) {
      problems.push(
        `a story never mounted through /storybook/ — ${String(err?.message ?? err).split("\n")[0]}`,
      );
    }

    return problems;
  } finally {
    await browser.close();
  }
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv) {
  const base = argv.find((a) => /^https?:\/\//.test(a));
  if (!base) {
    process.stderr.write(
      "usage: node scripts/site-smoke.mjs <base-url> [--version <v>] [--stories <n>] [--json]\n",
    );
    return 2;
  }
  const version = argValue(argv, "--version");
  const stories = Number(argValue(argv, "--stories") ?? 0);
  const asJson = argv.includes("--json");
  const log = (line) => process.stdout.write(`${line}\n`);

  const results = [];
  for (const check of siteChecks(base, { version })) {
    let problems;
    try {
      problems = judge(check, await probe(check));
    } catch (err) {
      problems = [`could not be reached — ${String(err?.message ?? err).split("\n")[0]}`];
    }
    results.push({ name: check.name, url: check.url, problems });
    if (!asJson) {
      log(problems.length ? `✖ ${check.name} (${check.url})` : `✔ ${check.name}`);
      for (const p of problems) log(`    ${p}`);
    }
  }

  // The browser checks cost a Chromium launch each, so they run only once the plain
  // addresses agree — a dead rewrite would fail them for a reason already reported.
  const rewriteBroken = results.some((r) => r.problems.length && /Storybook/.test(r.name));
  const chromium = rewriteBroken ? undefined : await resolveChromium();
  if (!rewriteBroken && !chromium) {
    results.push({
      name: "Storybook really renders through /storybook/",
      url: base,
      problems: [
        "playwright is not installed — run `pnpm --filter @elabs-ai/components-docs exec " +
          "playwright install --with-deps chromium`",
      ],
    });
    if (!asJson) log("✖ Storybook really renders through /storybook/ (playwright missing)");
  } else if (!rewriteBroken) {
    const problems = await storybookReallyRenders(base, chromium);
    results.push({
      name: "Storybook really renders through /storybook/",
      url: base,
      problems,
    });
    if (!asJson) {
      log(
        problems.length
          ? "✖ Storybook really renders through /storybook/"
          : "✔ Storybook really renders through /storybook/",
      );
      for (const p of problems) log(`    ${p}`);
    }

    if (stories > 0) {
      const root = `${String(base).replace(/\/+$/, "")}/storybook`;
      const index = await (await fetch(`${root}/index.json`)).json();
      const all = storiesFromIndex(index);
      const ids = new Set(sampleIds(all, stories));
      const entries = all.filter((e) => ids.has(e.id));
      const browser = await chromium.launch();
      try {
        // `crawlStories` returns `{ visited, failures }`, not a bare list.
        const { failures } = await crawlStories({ browser, base: root, entries, log: () => {} });
        const problems = failures.map((f) => `${f.id}: ${f.problems.join("; ")}`);
        results.push({
          name: `${entries.length} sampled stories render through /storybook/`,
          url: root,
          problems,
        });
        if (!asJson) {
          log(
            problems.length
              ? `✖ ${problems.length} of ${entries.length} sampled stories failed through /storybook/`
              : `✔ ${entries.length} sampled stories render through /storybook/`,
          );
          for (const p of problems) log(`    ${p}`);
        }
      } finally {
        await browser.close();
      }
    }
  }

  const failed = results.filter((r) => r.problems.length);
  if (asJson) log(JSON.stringify({ base, results }, null, 2));
  else
    log(
      failed.length
        ? `\n✖ site-smoke: ${failed.length} of ${results.length} checks failed on ${base}`
        : `\n✔ site-smoke: all ${results.length} checks passed on ${base}`,
    );
  return failed.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await main(process.argv.slice(2)));
}
