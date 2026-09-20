# ADR 0038 — The website lives in `apps/home` (Next.js); Storybook moves to `/storybook`; `/mcp` moves with the domain

- **Status:** Accepted — confirmed by the maintainer on 2026-09-18 (all four proposals under
  "Maintainer confirmation" below accepted as drafted).
- **Date:** 2026-09-18
- **Deciders:** maintainer (drafted by `brand-ui-component-builder` for RM-089)
- **Context:** `docs/review/2026-09-18-homepage-concept.md` §1, §6, §8;
  `docs/review/2026-09-17-storybook-and-hosted-mcp-review.md` §4
- **Issue:** #459 (RM-089 scaffolds; RM-105 performs the domain cut-over)
- **Related:** ADR [0007](./0007-presentation-layer-scope-boundary.md) (the hosted MCP is a lookup
  over the committed manifest, not a model runtime — moving it does not change that),
  ADR [0030](./0030-public-npm-distribution.md) (the site consumes the published package shapes),
  `docs/RELEASING.md` (production deploys only on release), `docs/CONSUMING.md` (the `@source`
  wiring the site must copy)

## Context

### What serves `elabs-ai.com` today

The public front door is the Storybook static build in `apps/docs`, deployed as the Vercel project
`elabs-components`:

```json
{
  "outputDirectory": "storybook-static",
  "git": { "deploymentEnabled": false },
  "functions": { "api/mcp.mjs": { "excludeFiles": "**/*.{ts,tsx,mts,cts}" } },
  "rewrites": [{ "source": "/mcp", "destination": "/api/mcp" }]
}
```

Git deployments are off. `.github/workflows/release.yml` → `deploy-docs` checks out the newest
`@elabs-ai/components-cli@<version>` tag, runs `vercel deploy --prod`, then (1) POSTs `initialize`
to `https://elabs-ai.com/mcp` and fails unless it reports the released version, and (2) crawls
every story from `https://elabs-ai.com/index.json` (`scripts/release-smoke.mjs --stories-only`).
Production therefore only ever changes on a release, and keeps the previous deployment until the
next one.

Everything below is served from the domain root today, and every one of these addresses has to keep
resolving after the move:

| Address                                                                                                           | Served by                                             |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/`, `/?path=…`                                                                                                   | Storybook manager                                     |
| `/iframe.html?…`, `/index.json`, `/sb-*/…`, `/assets/…`                                                           | Storybook preview + manager assets                    |
| `/mcp`                                                                                                            | `apps/docs/api/mcp.mjs` via the rewrite               |
| `/llms.txt`, `/llms/…`, `/robots.txt`, `/.well-known/mcp.json`, `/brand-ui-context.md`, `/component-inventory.md` | files in `apps/docs/public/` (Storybook `staticDirs`) |

`/mcp` is a public contract: the repo names `https://elabs-ai.com/mcp` 20 times across 11 files
(among them the root and CLI READMEs, `llms.txt`, `robots.txt`, `/.well-known/mcp.json` and four
Storybook docs pages), and every agent that ran
`claude mcp add --transport http brand-ui https://elabs-ai.com/mcp` has it configured. It must
never go dark.

### What the concept settled

The concept (§1) keeps Storybook as the _reference_ and replaces it as the _front door_ with a
real site; §6 recommends Next.js in `apps/home`, two Vercel projects on one domain, `/mcp` moving
into the site, and "dogfooding is a rule, checked"; §8.2 settles the Storybook address as
`/storybook` via rewrite, with `/?path=…` deep links redirected to `/storybook/?path=…`.

`apps/docs/api/mcp.mjs` is a Web-standard handler — `export const POST/GET/OPTIONS = handler` over
`createMcpHttpHandler({ manifest, hosted: true })` from `packages/cli/lib/mcp-http.mjs` — which is
the exact shape a Next.js App Router route handler exports. The transport moves without change.

## Decision

### 1. Framework: Next.js App Router on React 19 and Tailwind v4, in `apps/home`

- A new private workspace app, `@elabs-ai/home`, in `apps/home` (the `apps/*` glob in
  `pnpm-workspace.yaml` already covers it).
- **Next.js App Router.** Server components render the static shell; heavy packages (Monaco,
  MapLibre, React Flow, the process and terminal packages) are dynamic imports behind the section
  that needs them; route handlers host the agent surface (`/mcp` now; `/llms.txt`,
  `/.well-known/mcp.json` and `/r` in later items).
- **Not a static export.** The concept's "static export where possible" holds per page (pages are
  prerendered), but `output: "export"` is ruled out: it supports neither rewrites, redirects nor a
  POST route handler, and this site needs all three. The site deploys as a normal Next.js project.
- **React 19 and Tailwind v4, consumed like a customer.** `app/globals.css` imports
  `tailwindcss` and `@elabs-ai/components-tokens/styles.css` plus the `@source` lines copied from
  `docs/CONSUMING.md` — the site wires the library the way the docs tell a consumer to.
- **Library only, checked.** The site imports React, Next, `motion`, `@vercel/analytics`,
  `lucide-react`, `@elabs-ai/*` and copy-own registry blocks, nothing else. Two new check rules
  (`home-imports`, `home-tokens`) and the existing `raw-palette` and `motion-tokens` rules extended
  to `apps/home` enforce it; `.claude/rules/home.md` carries the standing rules.
  2026-09-19: `lucide-react` allowed (maintainer decision).
- **Version.** The roadmap text names Next.js 15.x. To the drafter's knowledge a 16.x line has
  been stable since late 2025; this was not checked against the npm registry while drafting (no
  network). Proposal: the scaffold uses the current stable major, read from the registry at
  scaffold time, and records it in the commit.

### 2. Two Vercel projects; Storybook reached at `/storybook` through a rewrite

- **`elabs-components`** (the EXISTING project, Root Directory switched to `apps/home`, framework
  Next.js) owns every public address: `elabs-components.vercel.app` and `elabs-ai.com`.
  `apps/home/vercel.json` pins `framework: "nextjs"` and `{ "git": { "deploymentEnabled": false } }`
  — deploy on release only, like today.
- **`elabs-storybook`** (the NEW project, root `apps/docs`) builds the Storybook static output. It
  owns no public address of its own beyond `storybook.elabs-ai.com`, and is reached through the
  site: `/storybook/:path*` → `${STORYBOOK_ORIGIN}/:path*`, with `STORYBOOK_ORIGIN` read from the
  environment (default `https://storybook.elabs-ai.com`).
- Each project keeps its own deploy; both deploy from the release tag.

**Which project keeps which name is not cosmetic.** A `*.vercel.app` address is derived from the
project's NAME and cannot be reassigned to a sibling project, so the project that must answer on
`elabs-components.vercel.app` is the one named `elabs-components` — and that is why the public
build was moved INTO the existing project rather than the domain being moved out of it. It also
means no domain was ever detached: both addresses kept answering throughout, serving the previous
Storybook deployment until the first website deployment replaced it.

**Storybook's assets work under a sub-path as built — no base-path flag, no subdomain needed —
provided the URL ends in a slash.** Evidence:

- `@storybook/builder-vite` 10.4.2 (the version in the lockfile) sets `base: "./"` for the preview
  build (`node_modules/.pnpm/@storybook+builder-vite@10.4.2_…/dist/index.js`, line 1442).
- A local static build of this Storybook (10.4.2, `apps/docs/storybook-static/` in the main
  checkout, built 2026-09-08, not committed) references only relative URLs: the manager
  `index.html` loads `./sb-manager/runtime.js`, `./sb-addons/<addon>/manager-bundle.js` and
  `./brand-favicon.svg`; its fonts are `url('./sb-common-assets/nunito-sans-*.woff2')`;
  `iframe.html` loads `./assets/iframe-*.js`, `./assets/iframe-*.css` and
  `./vite-inject-mocker-entry.js`; the preload helper resolves chunk URLs with
  `new URL(chunk, importer)`, i.e. relative to the chunk that asks.
- The manager derives the preview URL from its own pathname
  (`managerBase.replace(/\/[^/]*\.html$/, "").replace(/\/?$/, "/") + "iframe.html"`) or uses the
  relative `iframe.html`. The only root-absolute string in the manager and addon bundles,
  `"/iframe.html"`, is appended to a _composition ref's_ URL; this Storybook has no refs
  (`project.json`: `refCount: 0`).
- The project's own `managerHead` additions use `./brand-favicon.svg` (relative) and absolute
  `https://elabs-ai.com/…` URLs for metadata, which stay valid.

**The trailing-slash trap.** Relative URLs resolve against the page's directory. At
`/storybook/`, `./sb-manager/runtime.js` becomes `/storybook/sb-manager/runtime.js` — rewritten
and served. At `/storybook` (no slash) it becomes `/sb-manager/runtime.js` — a path on the site,
which 404s, and the manager renders blank. Next.js by default (`trailingSlash: false`) answers
`/storybook/` with a 308 to `/storybook`, which is exactly the wrong direction. So the site:

1. sets `skipTrailingSlashRedirect: true` in `next.config.ts`;
2. redirects `/storybook` → `/storybook/` (308) in `apps/home/proxy.ts`, not in `next.config.ts`:
   Next compiles every config redirect source with an optional trailing slash, so a config
   redirect `/storybook` → `/storybook/` also matches `/storybook/` and loops;
3. rewrites only `/storybook/:path*` (the roadmap text also rewrites bare `/storybook`; that rewrite
   would serve the manager at a slash-less URL and break every asset, so it is dropped).

**Root addresses that must keep resolving** (the table under Context):

- `/?path=…` → 308 `/storybook/?path=…` (concept §8.2); `/iframe.html` → 308
  `/storybook/iframe.html` with the query preserved (shared embed links).
- `/llms.txt`, `/llms/:path*`, `/robots.txt`, `/.well-known/mcp.json`, `/brand-ui-context.md`,
  `/component-inventory.md` —
  until the site generates its own, these are **fallback** rewrites to `STORYBOOK_ORIGIN`, so a
  site-owned version wins automatically when a later item adds one.
- `/index.json` is only read by the release smoke; RM-105 points `--stories` at
  `https://elabs-ai.com/storybook/` (whether `scripts/release-smoke.mjs` accepts a base with a path
  is for RM-105 to check).

**Not verified while drafting:** (a) a browser run of Storybook under the rewrite — that is RM-089's
phase-B acceptance, with a story open and screenshots; (b) the live production HTML (not fetched —
no network in the drafting session; the evidence above is the local 10.4.2 build and the builder
source); (c) whether a `*.vercel.app` origin is publicly reachable. If Vercel
Deployment Protection covers that URL, the rewrite would proxy a login page. **Settled at
build time (2026-09-20): the subdomain is the origin, not the fallback** — `storybook.elabs-ai.com`
is used as `STORYBOOK_ORIGIN` outright, because a provider-generated address is derived from the
project name and would break the site's Storybook section the moment that project is renamed. The
public address stays `/storybook`.

### 3. The domain moves from `elabs-components` to `elabs-home` — cut-over order (RM-105)

Both projects are in the same Vercel team, so the move is a project-domain reassignment, not a DNS
change. Order:

1. **Deploy `elabs-home` to production from the release tag**, while the domain still points at
   `elabs-components`. Against the home project's own production URL, check: `initialize` on
   `/mcp` reports the released version; `/storybook/` renders the manager with a story open, in a
   browser; `/storybook` is a 308 to `/storybook/`; `/?path=/docs/core-button--docs` is a 308 to
   `/storybook/?path=/docs/core-button--docs`; `/llms.txt` answers 200.
2. **Confirm `STORYBOOK_ORIGIN` is reachable without a login** (see §2, unverified item c).
3. **Move `elabs-ai.com`** (and `www.elabs-ai.com`, if it is configured) from `elabs-components`
   to `elabs-home` in the Vercel dashboard (Project → Settings → Domains).
4. **Repeat step 1's checks on `https://elabs-ai.com`**, plus the story crawl against
   `https://elabs-ai.com/storybook/`.
5. **Then** change `release.yml` so every release deploys both projects and the `/mcp` version
   smoke runs after the home deploy (RM-105 owns `release.yml`).

**Rollback** is step 3 reversed: move the domain back to `elabs-components`. That only restores
the old behaviour if the Storybook project's live deployment still carries `/mcp` — which is why
§4 keeps it there until the cut-over is done.

### 4. `/mcp` moves into `apps/home/app/mcp/route.ts`; the gap window

- **The move.** `apps/home/app/mcp/route.ts` imports `createMcpHttpHandler` from
  `@elabs-ai/components-cli/lib/mcp-http.mjs` and the committed repo-root
  `brand-ui.manifest.json` (data, not code), builds `createMcpHttpHandler({ manifest, hosted: true
})` once, exports it as `GET`, `POST` and `OPTIONS`, and sets `runtime = "nodejs"` and
  `dynamic = "force-dynamic"`. The transport stays in `packages/cli/lib/mcp-http.mjs`; each host is
  a ten-line adapter. The `excludeFiles` workaround in `apps/docs/vercel.json` existed because
  Vercel's plain Node builder type-checked every `.ts` file the function traced; a Next.js route is
  bundled by Next's own compiler, so it is not expected to be needed — the phase-B build is the
  check.
- **The gap.** The Storybook project only changes on a release deploy. If RM-089 deletes
  `apps/docs/api/mcp.mjs` (as the roadmap text says) and any release is cut before RM-105 moves the
  domain, `deploy-docs` ships a Storybook with no `/mcp`: `https://elabs-ai.com/mcp` 404s for every
  configured agent, and the job's own MCP smoke fails _after_ `deploy --prod` has already switched
  production. The site cannot cover it — it does not own the domain yet.
- **Proposal: keep both copies until the cut-over.** RM-089 adds the site route and leaves
  `apps/docs/api/mcp.mjs` and its `functions`/`rewrites` block in place. RM-105 deletes them in the
  same change that moves the domain, after step 4 of §3 is green. Cost: two thin adapters over one
  shared handler for the length of the track — no duplicated logic, both answer from the same
  manifest. Gain: no release freeze, and the rollback target stays whole.
- **What serves `/mcp`, when** (with the proposal): until step 3, the Storybook project's last
  release deployment; during the domain reassignment, whichever project the edge routes to — both
  answer identically; from then on, the home project. There is no moment without a server.
- **After the cut-over,** `/mcp` reports the version of the last _home_ deploy. A release that
  deploys only the Storybook project would leave the MCP reporting an older version; RM-105's
  workflow change deploys both on every release for that reason.

## Consequences

- **Two Vercel projects, two production deploys and two smokes per release.** The home project has
  to be created in the Vercel dashboard (a maintainer action) before RM-105; its project id becomes
  a second non-secret `VERCEL_PROJECT_ID` in `release.yml`. Both deploys use the existing
  `secrets.VERCEL_TOKEN`, which the current job already refuses to run without.
- **The site carries two non-default settings for Storybook** (`skipTrailingSlashRedirect` and the
  `/storybook` → `/storybook/` redirect in `proxy.ts`). They are load-bearing; the site's end-to-end test opens a
  story under `/storybook/` so a regression shows up there, not in production.
- **`apps/docs` changes little.** It keeps `outputDirectory` and `git`; its `api/` function stays
  until the cut-over (per §4) and then goes. Its `managerHead` metadata (`og:url`
  `https://elabs-ai.com/`) will describe the site rather than the Storybook — a small follow-up once
  the site ships its own metadata.
- **The rule engine gains a scope for an app that is not Storybook:** `home-imports` and
  `home-tokens` are new; `raw-palette` and `motion-tokens` extend to `apps/home/**`; `docs/GATES.md`
  lists both new rules; `turbo.json` caches `.next/**`.
- **What does NOT change.** No package gains a dependency or an export; the one-way package graph
  is untouched (`apps/home` is a consumer, not a package); the hosted MCP's behaviour, tools and
  transport are unchanged; ADR 0007's boundary holds.
- **Browser-only site primitives live in `@elabs-ai/components-ui`, not in marketing** (maintainer
  decision, 2026-09-18). `ThemeFamilySwitch`, `AmbientField`, `ParallaxPlane`, `RevealOnEnter` and
  `useScrollProgress` need hooks or the DOM, so they ship from ui (already a `"use client"`
  package) with their co-located CSS and `motion` as an optional peer reached only by dynamic
  `import()`. `@elabs-ai/components-marketing` stays fully server-safe — no `"use client"`, no
  banner, no `motion` peer — as `pnpm consumer:check` enforces through its `mustNotHave` list. This
  amends the bullet above: ui gains these exports and one optional peer.

## Alternatives considered

| Option                                                                                                | Verdict                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. A Storybook intro page as the front door                                                           | rejected — concept §1: the manager chrome and a sidebar of ~2,300 entries stay the first screen; no route handlers for the agent surface; the page cannot own its motion or theming outside the manager                                                    |
| B. Vite + SSG (e.g. `vite-plugin-ssr`) in `apps/home`                                                 | rejected — concept §6: more wiring, no upside on Vercel; `/mcp` would stay a standalone Vercel function with the `excludeFiles` workaround                                                                                                                 |
| **C. Next.js App Router in `apps/home`, own Vercel project, owns the domain**                         | **chosen** — Vercel-native; server components for the static shell; per-section dynamic imports; route handlers take `/mcp` as-is                                                                                                                          |
| D. Storybook built with a base path (`--base /storybook/`, Vite `base`)                               | not needed — the build is already relative (§2 evidence); it would also break the Storybook project's own root URL                                                                                                                                         |
| E. Copy the Storybook build into the site (`public/storybook/`)                                       | rejected — couples both deploy cadences, puts a ~2,000-story build inside every site build, and the roadmap forbids papering over a sub-path failure this way                                                                                              |
| F. `storybook.elabs-ai.com` as the only Storybook address, no rewrite                                 | rejected as the public address — concept §8.2 settled `/storybook`; kept as the fallback _rewrite target_ if the `*.vercel.app` origin turns out to be protected (§2)                                                                                      |
| G. Leave `/mcp` on the Storybook project and have the site rewrite `/mcp` to it                       | rejected — zero code moves and zero gap, but the agent surface stays split across two apps (concept §6 puts `/mcp`, `/llms.txt` and `.well-known` together on the site), every MCP call gains a proxy hop, and the `excludeFiles` workaround stays forever |
| H. Delete `apps/docs/api/mcp.mjs` in RM-089 and freeze releases until RM-105 (the roadmap as written) | the realistic alternative to §4's proposal — one file fewer for a few days, but safety rests on nobody merging the release PR in between, and nothing enforces that                                                                                        |

## Maintainer confirmation (2026-09-18)

The maintainer confirmed each proposal as drafted, in chat to the orchestrator, on 2026-09-18:

1. Framework (§1): Next.js App Router, the **current stable major at scaffold time** (not pinned to
   15.x), React 19, Tailwind v4 — accepted. Resolved at scaffold: `next` 16.3.5.
2. Storybook (§2): its own Vercel project, reached at `elabs-ai.com/storybook/` through a rewrite;
   bare `/storybook` redirects to `/storybook/`; trailing-slash handling lives in the site. If the
   Storybook project's `vercel.app` origin is login-protected, a subdomain becomes the rewrite
   target behind the scenes — visitors still use `/storybook/` — accepted.
3. Domain move (§3): deploy the site on its own `vercel.app` address first; verify `/mcp`,
   `/storybook/` and old Storybook links there; the maintainer moves `elabs-ai.com` in the Vercel
   dashboard; re-verify on the domain. Moving it back is the rollback. The maintainer creates the
   new Vercel project by hand — accepted.
4. `/mcp` (§4): added to the site now (`apps/home/app/mcp/route.ts`); `apps/docs/api/mcp.mjs` and
   the `functions`/`/mcp` rewrite in `apps/docs/vercel.json` stay until the domain cut-over, and
   RM-105 deletes them — accepted (option H not taken).

## Watch for

- **A Storybook upgrade that stops emitting relative asset URLs.** The sub-path relies on upstream
  behaviour (`base: "./"`), not on anything this repo configures; the site's end-to-end story check
  is the guard.
- **`/mcp` reporting a different version from the Storybook** after a release that deployed only
  one project.
- **A non-library UI dependency** added to `apps/home` "just for the homepage" — `home-imports`
  exists to fail it; the answer is a `marketing` component or a registry block.

## Operations (as built, 2026-09-20)

What is actually deployed, so nobody has to read it out of a dashboard. None of these ids is a
secret; the deploy token is.

|                | website                                       | Storybook                          |
| -------------- | --------------------------------------------- | ---------------------------------- |
| Vercel project | `elabs-components`                            | `elabs-storybook`                  |
| project id     | `prj_vAhDf9Ako9r9kiLJQqCQQXOPdTp8`            | `prj_D84K8BP6ySAwJHFmNEeaX2lbwpBj` |
| Root Directory | `apps/home`                                   | `apps/docs`                        |
| framework      | Next.js                                       | Vite (Storybook static)            |
| addresses      | `elabs-components.vercel.app`, `elabs-ai.com` | `storybook.elabs-ai.com`           |
| release job    | `deploy-home`                                 | `deploy-docs`                      |

Vercel team `elabs-ai` (`team_CREpBGwTjqJ21Rj1cpNRTPCv`). Git deployments are off in both projects,
so only a release changes production. `deploy-docs` runs first: the website rewrites `/storybook`
to the Storybook project, so deploying the website first would leave the previous release's
Storybook behind the current site for as long as the two jobs are apart.

**What each public address serves.** Both behave identically, and `scripts/site-smoke.mjs <base>`
asserts exactly this list on either one:

| path                                                                               | served by                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/` and every site page                                                            | the website's own Next.js build                               |
| `/storybook/…`                                                                     | the Storybook project, through the rewrite (never a redirect) |
| `/mcp`                                                                             | the website's own route (`apps/home/app/mcp/route.ts`)        |
| `/llms.txt`, `/llms/<pkg>`                                                         | the website's own routes                                      |
| `/.well-known/mcp.json`, `/r/*`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image` | the website                                                   |
| `/?path=…`, `/iframe.html`                                                         | redirect (308) into `/storybook/`                             |

**`.vercelignore` at the repo root is load-bearing.** Both projects are deployed with
`vercel deploy` from the repo root and let each project's Root Directory pick the app, so the CLI
walks the whole repo — and it does NOT read `.gitignore`. Without that file the transient agent
worktrees under `.claude` (108k files, 40 GB on the machine this was set up from) are walked too,
and the deployment's file manifest, which travels as ONE request with a 10 MB limit, is rejected
with `Request body too large. Limit: 10mb`. That is a deploy that never starts, with no build log
to read.

**Rollback** is per project and needs no domain change: promote the previous production deployment
in the Vercel dashboard, or re-run Release with `deploy-docs` / `deploy-home` ticked at an older
tag. Moving an address between projects is never part of a rollback.

**Still duplicated on purpose:** `apps/docs/api/mcp.mjs` and the `/mcp` rewrite in
`apps/docs/vercel.json` keep the Storybook project answering `/mcp` at
`storybook.elabs-ai.com/mcp`. It is what `deploy-docs` smokes to prove the deployment that just
went live is built from the release tag. The MCP endpoint consumers are told to add is the
website's.
