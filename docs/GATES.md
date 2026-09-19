# Gates

Automated checks keep the repo's conventions true. Three commands cover all of them.

```bash
pnpm check        # every convention rule + the external check commands
pnpm check:test   # every rule's pass/fail fixtures + every scripts/**/*.test.mjs self-test
pnpm gen:check    # every generated artifact is fresh (pnpm gen rewrites them)
```

- `pnpm check` runs `scripts/check/rules/*.mjs` in one process against
  `scripts/check/baseline.json` (ratchets only go down; `pnpm check:update`), then spawns the
  few checks that need node_modules or their own CLI (`scripts/check/commands.mjs`) in
  parallel. `--rule <id>` / `--scope <scope>` narrow a run; `--list` prints every id.
- `pnpm check:test` proves each check still fails on a planted violation.
- `pnpm check:changed` is the fast local loop: typecheck + lint + test for changed packages.

The full rule list is the generated region of `.claude/rules/conventions.md`
(`pnpm check --list` prints the same set).

## Adding a check

A convention that reads repo files becomes a rule: follow `scripts/check/README.md`. A check
that needs node_modules, a build tool or its own CLI becomes an entry in
`scripts/check/commands.mjs`. Either way its docs line lands in conventions.md via `pnpm gen`.

## CI (`.github/workflows/ci.yml`)

Job `quality`, in order: install → typecheck → lint → format:check → `pnpm check` →
`pnpm check:test` → test → build → built-output checks (`scripts/check-css-assets.mjs`,
`scripts/check-optional-peer-types.mjs`, which read `dist/`) → `pnpm gen:check` →
`pnpm consumer:check`.

Job `storybook` (blocking, `light` and `dark`): every story as an interaction + axe test.

Jobs `create-pack` and `create-matrix` (RM-130; Ubuntu, macOS and Windows × npm and pnpm, six
cells) prove `brand-ui create` for a first-time user. `create-pack` builds and packs every package
and the CLI once on Linux, as a release does. Each cell then runs `scripts/create-matrix.mjs` from
a bare checkout on those tarballs: it creates each template outside the workspace, installs, runs
every step of the created app's own CI workflow, builds, and runs `audit:ui --strict`. npm cells
fail on any `ERESOLVE` warning; the dashboard's entry chunk must stay under 250 KB gzip. It runs on
every push to `main`, and on a PR when job `changes` sees `packages/cli/**`, a package's
`package.json` or `tsup.config.ts`, `docs/playbooks/templates/**`, the lockfile, the script or
`ci.yml`. Locally: build the packages, then `pnpm create:matrix --pm npm` (or `--pm pnpm`;
`--template a,b`, `--keep`).

Job `home` (the website gates below) runs when job `changes` sees a path the site is built from:
`apps/home/**`, `packages/marketing/**`, `packages/tokens/**`, `registry/**`,
`scripts/gen-home.mjs`, the `home-bundle` rule or `ci.yml` itself. It waits for `quality` to reuse
its Storybook build (served on :6006 for the `/storybook/` smoke) and uploads `home-reports`:
Playwright results and HTML report, the Lighthouse reports and `.next/bundle-budget.json`.

The pre-commit hook (`.githooks/pre-commit`) adds commit-time teeth: staged conflict
markers, dependency-field moves, registry validity, and Prettier on staged files.

## Website rules (`apps/home`, ADR 0038)

- `home-imports` — the site imports only react, react-dom, next, motion, `@vercel/analytics`,
  `@elabs-ai/*`, relative paths and provenance-headed registry block copies. The homepage is the
  proof that the library is enough on its own, so an outside UI dependency fails.
- `home-tokens` — no raw hex, `rgb()`/`hsl()`/`oklch()` colour and no arbitrary
  `duration-[…]`/`ease-[…]` in `apps/home`; `app/globals.css` may only reference `var(--…)`. The
  site is a consumer, so its colours and motion come from the themes like everyone else’s.
  `raw-palette` and `motion-tokens` scan `apps/home` too.
- `home-imports` ignores `apps/home/e2e/**`: the Playwright gates below are test tooling that
  never ships in the build.

## Website gates (`apps/home`, RM-104)

The concept's acceptance lines (Lighthouse, a hero interactive under 3 s, tabs interactive within
1 s, readable without JavaScript, reduced motion, nine families × two modes) are a repeatable gate,
not a validator's afternoon. Locally: `pnpm --filter @elabs-ai/home build`, then `… e2e` and
`… lhci` (ports from `E2E_PORT`, default 4620; `E2E_DEV=1` runs against `next dev`).

1. **Playwright** (`apps/home/e2e`, `pnpm --filter @elabs-ai/home e2e`) against `next start`.
   `smoke` on Chromium, Firefox and WebKit (routes, meta, `/llms.txt`, `/mcp`, `/r/registry.json`,
   the fresh-load scroll check; `/storybook/` skips with a reason when its origin is unreachable);
   the rest on Chromium at 1440×900, with `js-off` and `reduced-motion` also at 390×844:
   `theme-sweep` (every family × mode through the switch: `data-theme` and the body background
   equal `themes.json`, region screenshots), `tour-tabs` (each tab interactive within 1 s plus its
   named interaction), `agent-loop` (live `/mcp` calls, and the recorded trace when `/mcp`
   fails), `js-off`, `reduced-motion`, `a11y` (axe, two themes) and `keyboard` (Tab reaches every
   region; every stop shows a ring painted from `--ring`).
   **Why:** the site is the library's proof; a regression here is what a visitor sees first.
2. **Lighthouse CI** (`apps/home/lighthouserc.json`, `pnpm --filter @elabs-ai/home lhci`), median
   of three runs. Desktop fails below performance 0.90, accessibility / best practices / SEO 0.95,
   TTI over 3 s, TBT over 200 ms or CLS over 0.05. Mobile performance below 0.80 is a warning until
   RM-106 turns it into a gate. **Why:** the hero ships `ai`, `charts` and `data`; a budget in
   numbers catches the drift one import at a time. Never trim the page to pass it: a miss goes to
   the maintainer.
3. **axe + motion ratchets.** Serious and critical axe findings must be 0.
   `e2e/a11y-ratchet.json` may exclude at most three library- or theme-owned findings, each with
   an issue or an unfiled finding id; a site-owned finding is never excluded. New moderate
   findings fail. Motion under `prefers-reduced-motion: reduce` counts when it lasts over 1 ms (or
   loops) and animates more than opacity; each known case is listed in
   `e2e/reduced-motion-known.json` (at most three, with owner and finding). **Why:** a gate that
   always fails is ignored; a named, bounded list keeps it trusted.
4. **Bundle budget** (`home-bundle` rule, `pnpm --filter @elabs-ai/home bundle-budget` for the
   report). The `/` initial JavaScript (gzip, from `.next`) stays under the budget in
   `scripts/check/baseline.json` (first green build + 5 %), and no per-section engine (React
   Flow, Monaco, MapLibre, Milkdown, process, terminal) sits in an initial chunk. Without a build
   the rule skips; the `home` job sets `HOME_BUNDLE_REQUIRED=1`. **Why:** heavy packages load per
   section (the standing rule), and the budget makes that visible in bytes.

**The ratchet rule.** Every list and budget only shrinks: the a11y exclusions, the known-motion
list and the bundle budget move down with `pnpm check:update --rule home-bundle` or a deleted
entry; raising any of them is a reviewed edit of the file with the reason in the commit.
Screenshot baselines live per platform in `e2e/__screenshots__/<platform>/`; a platform without
baselines attaches its screenshots instead of comparing, and `e2e:update` regenerates them on
purpose, never to make a red run green.
