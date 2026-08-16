---
name: brand-ui-new-app
description: Define-to-build — scaffold a new brand-ui app from a plain-language description (VP-02). Use when the user wants to START an app, page, or demo ("build me a sales dashboard", "I need an admin console for X", "new app", "scaffold a chat assistant", "create a landing page for a pitch") rather than add to an existing one. Runs a staged interview (quick 3-question mode or full 7-stage spec mode), writes an app-spec.md, then scaffolds from the matching template + playbook with every wiring point annotated and a starter CLAUDE.md so later agent sessions stay on-brand. For adding components to an existing app use `brand-ui`; for authoring library components use `brand-ui-component`.
user-invocable: true
argument-hint: "[description of the app, e.g. 'sales pipeline dashboard, qlik-dark']"
allowed-tools:
  - Bash(npx @qlik-coe-emea/qlabs-components-cli *)
  - Bash(pnpm brand-ui *)
  - Bash(pnpm exec brand-ui *)
  - Bash(npx brand-ui *)
  - Bash(npx shadcn@latest *)
  - Bash(pnpm dlx shadcn@latest *)
  - Bash(pnpm storybook *)
---

# brand-ui-new-app (define-to-build)

Take a developer from "I want to build X" to a running, on-brand scaffold —
without them needing to know component names, composition patterns, or
design rules. **Ask first, generate second**: interview to a concrete spec,
write the spec down, scaffold _from the spec_.

## 0 · Pick the mode

| Signal                                                                      | Mode                                                                   |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Short ask, archetype obvious ("a dashboard for deals")                      | **Quick** (3 questions)                                                |
| Rich description, multiple surfaces/entities, or user asks to "spec it out" | **Full** (7 stages)                                                    |
| User said "just scaffold it" / "defaults are fine"                          | Quick, zero extra questions where the description already answers them |

Never re-ask what the description already states (theme, archetype, title).

## Quick mode (the 80% path)

One `AskUserQuestion` round, only for the unknowns among:

1. **Archetype** — dashboard · data app · AI assistant · flow workspace ·
   settings · marketing page (mapping table: `reference/archetypes.md`).
2. **Theme** — qlik-bright (default) · qlik-dark · blueprint. Offer a preview
   when Storybook is available (ladder below).
3. **App title** — free text, defaults to the archetype name.

Then go straight to **Scaffold** with the archetype's defaults; record the
defaults used in `app-spec.md` so the user sees what was decided for them.
Quick mode does **not** ask about taste — it records the restrained default
profile (`product / comfortable / system / 0`) in the spec, except for the
`marketing` archetype, which records `register: "brand"`.

## Full mode — the 7 stages (VP-02)

Each stage is 1–2 `AskUserQuestion` rounds (≤4 questions each, options ≤4,
"Other" is free). Every answer is appended to `app-spec.md` immediately —
the spec is the source of truth, reviewable and re-runnable. **Full per-stage
question script: `reference/stages.md`** (stage-6 archetype question sets:
`reference/archetypes.md`).

| #   | Stage              | Capture                                                                                                                                 |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Intent             | what, for whom, rough scale                                                                                                             |
| 2   | Archetype          | app shape → template + playbook (show rendered archetypes if possible)                                                                  |
| 3   | Surfaces & nav     | screens/sections (multi-select common ones per archetype + own)                                                                         |
| 4   | Data & entities    | main objects + key fields → table/form/detail stubs                                                                                     |
| 5   | Brand & feel       | theme (+ render a sample surface in it), the **taste profile** (register · density · motion · expressiveness), brand color              |
| 6   | Per-surface detail | per archetype — columns/filters, KPI list, chart types, fields, node taxonomy, message parts (question sets: `reference/archetypes.md`) |
| 7   | Confirm → scaffold | show the assembled spec, confirm, generate                                                                                              |

Stage 6 is skippable ("scaffold with sensible defaults") — record the
defaults in the spec. If the user corrects the same dimension twice, stop
patching and re-derive the frame (conceptual-framing rule).

## Visual feedback (propose → preview → pick → refine)

At every visual decision (archetype, nav, theme, chart types) run the shared
loop — **`reference/visual-loop.md`** (VP-04). Use the highest fidelity rung
available — **real Storybook render > generated artifact > option preview >
text** — and **never decide a visual on prose when a render is possible**
(start `pnpm storybook` in the background to reach the MCP if needed; theme
slugs `qlik-bright`/`qlik-dark`/`blueprint`).

Layout options come from the curated arsenal — **`reference/patterns.md`** —
filtered by the spec's taste profile (calm/product is the default; brand and
high-expressiveness patterns are opt-in).

## Scaffold (generated FROM the spec — run the CLI, don't hand-roll it)

`brand-ui scaffold` is the deterministic half. It reads the spec's fenced `json`
block, applies it to the archetype template and writes the app. Do **not**
hand-roll the files it emits (step 3) — the CLI is what makes the flow repeatable.

0. **Standalone or in-monorepo?** Ask once, and record it in the spec
   (`"standalone": true` + an optional `"release"`). A **standalone** app lives
   outside the brand-ui repo, so it needs the private-registry install handoff and
   real semver ranges; an in-monorepo app keeps `workspace:*`. Getting this wrong
   is the difference between an app that installs and one that doesn't.

1. **Locate the target.** A new app folder (a Vite app, or whatever the project
   uses) or a folder the user names; in an existing project, its `app/` or `src/`.

2. **Write `app-spec.md` first** (template: `reference/app-spec-template.md`). It
   carries a single fenced `json` **Machine spec** block — the contract the CLI
   reads (schema: `reference/app-spec.schema.json`, validated by
   `pnpm app-spec:check`; example:
   `reference/app-spec.example.md`). Keep the prose and the `json` block in sync.

3. **Emit.**

   ```bash
   brand-ui scaffold <path>/app-spec.md --dry-run --write <target>   # see the plan
   brand-ui scaffold <path>/app-spec.md --write <target>             # emit
   ```

   (`pnpm brand-ui …` inside the brand-ui repo; `pnpm exec brand-ui …` in a project
   that installed `@qlik-coe-emea/qlabs-components-cli` — the CLI **ships the
   archetype templates and the manifest**, so `--write` works with no brand-ui
   checkout anywhere. `--write <target>` may point at any directory.) It writes:

   | File                             | What it carries                                                                                         |
   | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
   | `index.html`                     | the Vite entry — `<div id="root">` + the module script, `data-theme` set for the first paint            |
   | `src/App.tsx`                    | the archetype template with the spec applied — nav labels, `interface <Entity>`, `ColumnDef<Entity>[]`  |
   | `src/main.tsx`                   | root wiring: the token stylesheet, `<ThemeProvider defaultTheme="<chosen>">`, engine side-effects       |
   | `src/styles.css`                 | the token `@import` + one `@source` per installed package (skip these and it renders **unstyled**)      |
   | `vite.config.ts`                 | react + **`@tailwindcss/vite`** — without that plugin `styles.css` is never processed                   |
   | `tsconfig.json`                  | strict, `react-jsx`, `vite/client` types — `pnpm typecheck` runs on day one                             |
   | `app-spec.md`                    | the spec, verbatim                                                                                      |
   | `CLAUDE.md`                      | the agent contract every later session inherits (theme, archetype, playbook, install recipe)            |
   | `AGENTS.md`                      | the vendor-neutral pointer at the same contract                                                         |
   | `brand-ui-context.md`            | the manifest-derived component inventory — what exists, so a later agent never guesses an API           |
   | `eslint.config.js`               | `brand/no-raw-font-size` + `brand/no-raw-color` at **`error`** (`reference/lint-and-taxonomy.md`)       |
   | `.github/workflows/brand-ui.yml` | the gates that actually run: `typecheck`, `lint`, `audit:ui` (`brand-ui audit src`)                     |
   | `package.json`                   | deps (`workspace:*` or real semver ranges) + engine peers at their **declared** ranges, and the tooling |

   The emitted app **runs**: `pnpm install && pnpm dev`.

   It never overwrites an existing file unless you pass `--force`. Scaffolding into
   a folder that already has some of these (e.g. a `create-vite` app) comes back
   **`partial`** with a non-zero exit and names what it skipped — that app is
   incomplete until you merge those files by hand. Don't reach for `--force` to
   silence it: it overwrites the user's `package.json`/`src/App.tsx` too.

4. **Apply the taste profile — through the dials, never per component.** Carry the
   spec's `taste` block into the root `<ThemeProvider>` as props —
   `defaultRegister`, `defaultDensity`, `defaultMotionPreference`,
   `defaultDecoration` (= `taste.expressiveness`) — and write
   `brand-ui.config.json` at the app root with the same block, so `brand-ui audit` /
   `brand-ui info` judge the app against the profile it was built to. Apply the
   profile ONLY through those dials; never bake a density/expressiveness decision
   into emitted component source (the scaffolded `brand/no-raw-*` lint already
   blocks the colour/size half). **`defaultMotionPreference` is only ever
   `"system"` or `"reduced"`** — never `"full"`, which is an informed-consent
   override that suppresses a visitor's OS reduce-motion request
   (`reference/stages.md`; the app-spec schema rejects it). If the app wants a
   motion control, scaffold a settings toggle over `useMotionPreference()` and let
   the person choose.

5. **Do the judgment the CLI can't.** Wire the generated entity model into the real
   surface and delete the placeholder rows; build the surfaces the template had no
   slot for; pick the KPI/chart shapes the spec described in prose (renderer per
   field type — see `playbooks/data-app.md` §Columns). Anything the spec doesn't
   answer **stays a `// TODO(spec):` comment** — never invent data, never silently
   drop an unanswered field. The command prints the full `TODO(spec)` list; that is
   the work queue.

6. **Cover the state grid.** Loading (`Skeleton` / `DataTable loading`), empty and
   error (`StatePanel kind="empty" | "error"`) — never a blank region.

7. **Verify props against the real API** before using them —
   `brand-ui docs <Component>` or the `mcp__brand-ui__docs` tool. Never guess a prop.

8. **Hand off the install.** For a standalone app the command prints a
   **"Make it runnable (standalone)"** block — the `.npmrc` scope mapping +
   auth line, the `pnpm add` for the packages, the `pnpm add` for the engine peers
   (`@xyflow/react` / `monaco-editor` / `maplibre-gl` / the `ai` SDK), the CSS
   `@import` + `@source` lines, and any one-time side-effect import. **Give that
   block to the user verbatim** and point at `docs/CONSUMING.md` §1–4 in the
   brand-ui repo for the full recipe. A scaffold nobody can install is not done.

## Verify before "done"

- **It runs.** `pnpm install` then `pnpm dev` (or `pnpm build`) in the target — the
  scaffold emits `index.html`, `vite.config.ts` and `tsconfig.json` precisely so
  this is a command you run, not a promise you make. A `partial` emit is NOT done.
- `typecheck` **and `lint`** on the scaffolded app — green. The scaffold wires
  `brand/no-raw-font-size` / `brand/no-raw-color`, so raw sizes/colours must be clean.
- **`brand-ui audit <target> --json --strict` — REQUIRED, and it blocks "done"
  by EXIT CODE, not by you remembering.** Run it over the generated app
  (`pnpm brand-ui audit …` in this monorepo; `pnpm exec brand-ui audit …` in a
  consuming project — `docs/CONSUMING.md` §7a). `--strict` exits **1** when there
  is any blocking style finding or any content slop, and **0** when the app is
  clean — so "did the bar pass?" is a status code you can't talk your way past. A
  scaffolded app is born compliant or it isn't done. (The rendered cross-theme +
  WCAG-contrast pass is the `brand-ui-audit` skill.) It judges against the spec's
  taste profile automatically: the audit resolves `brand-ui.config.json` from the
  **target path** (nearest config wins), which is the one step 4 wrote beside the
  app, so this holds whether you run it from the app dir or from the monorepo.
  - **Content slop BLOCKS "done".** Any `slop-generic-name` / `slop-fake-number` /
    `slop-brand-name` finding means the scaffold shipped placeholder content —
    "John Doe", "99.99%", "Acme". Replace it with real domain content drawn from
    the spec's `intent` and `entities`, then re-run. Do not report done, and do
    not explain it away: a generated app full of Jane Does is the exact failure
    this bar exists to stop. (Cite the rule ids the audit prints; don't restate
    the patterns — the detector owns them.)
  - **Blocking token/style findings** (raw hex, `gradient-text`, `space-y-*`, …)
    are fixed before "done" too — they are the same rules the scaffolded lint
    enforces.
  - **Advisory findings** are reported to the user, not silently dropped.
  - The scaffold wires the same pass as an npm script — `pnpm audit:ui`
    (= `brand-ui audit src`) — and runs it in the emitted CI workflow, so the bar
    outlives this session (that script omits `--strict`; add it when you want the
    non-zero exit). On a **standalone** app it is the only machine enforcement of
    the taxonomy — the shared eslint-config is private and unpublished — which is
    why that CI job exists.
- **For a standalone app: the install handoff has been emitted** (step 8). Not
  optional — without it the app cannot be installed at all.
- Open the playbook checklist for the archetype; confirm each block the spec
  ordered is present.
- If Storybook/browser rendering is available, render the scaffold in **all three
  shipped themes** — `qlik-bright`, `qlik-dark` — and name the surface
  you looked at; otherwise **say plainly that the scaffold compiled and audited
  clean but was not visually verified**. Never claim a visual result you didn't see.
- Report remaining `// TODO(spec):` placeholders as the user's explicit next
  steps (that's the handoff, not a failure).

## Hard rules the scaffold must obey

**Type is a role, not a size** (`text-<role>` / `Heading` / `Text` — never
`text-2xl`/`text-sm`/`text-[18px]`) · **semantic tokens only** — never raw hex
or Tailwind palette (`text-gray-500`), both enforced by the scaffolded
`brand/no-raw-*` lint · **no placeholder slop** — sample content is
domain-specific, drawn from the spec's `intent`/`entities`; never "John Doe",
"99.99%", "Acme", or a filler verb ("Elevate", "Seamless"), and the audit above
enforces it · **taste comes from the dials** — the profile is applied via
`ThemeProvider` props + `brand-ui.config.json`, never hardcoded per component ·
import via `@qlik-coe-emea/qlabs-components-*` · Lucide for generic glyphs ·
loading/empty/error states wired, never blank regions · brand-ui never owns
model calls or data fetching (D5) — scaffold stubs, not transport.
