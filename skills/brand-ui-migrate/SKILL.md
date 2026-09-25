---
name: brand-ui-migrate
description: Bring an app that already exists onto brand-ui (@elabs-ai/components-*). Use when someone wants to migrate, port, adopt or "move to" the design system in a codebase they already have ("migrate this project to brand-ui", "we use MUI, can we switch", "adopt your design system in our admin app", "replace our components with yours"). Profiles the repo, maps every component it finds to a brand-ui verdict, writes a phased migration plan, and then walks the phases with the user approving each one. Read-only until the plan is approved. For a brand-new app use `brand-ui-new-app`; for using components in an app already on brand-ui use `brand-ui`.
user-invocable: true
argument-hint: "[path to the project, defaults to the current directory]"
allowed-tools:
  - Bash(npx @elabs-ai/components-cli *)
  - Bash(pnpm brand-ui *)
  - Bash(npx brand-ui *)
  - Bash(pnpm exec brand-ui *)
---

# brand-ui-migrate (brownfield adoption)

Move an existing UI onto brand-ui **in reviewable steps**, never in one sweep.
The CLI does the deterministic analysis; you do the edits; the user approves
every phase. The order matters: understand → map → plan → migrate → verify.

## 0 · Preconditions (check, don't assume)

The analysis commands come from the brand-ui CLI, a **public package** —
`pnpm add -D @elabs-ai/components-cli` installs anonymously, nothing to
configure (see `docs/CONSUMING.md` §1 and §7a). If `brand-ui` is not already
runnable in the project, say so and point the user at that one install command
before running anything. Do not paper over a missing CLI by guessing at the
codebase.

Inside the brand-ui repository itself, use `pnpm brand-ui <cmd>`; in a consuming
project, `pnpm exec brand-ui <cmd>` once the CLI is installed.

## 1 · Understand — change nothing

```bash
brand-ui scan . --json > brand-ui-scan.json
brand-ui map brand-ui-scan.json --json > brand-ui-map.json
brand-ui scan . --out migration/
brand-ui map brand-ui-scan.json --out migration/
brand-ui audit src/ --json
```

`--out` is the only thing these commands write, and it only creates
`migration/repo-profile.md`, `migration/analysis.md` and `migration/plan.md`.
No source file is touched at this stage — say that out loud, so the user knows
it is safe to run.

Then **read the three documents and report back**, in the user's terms:

- what the project is built on (framework, UI library, styling approach);
- the coverage number — the share of component **usages** a direct match or a
  prop remap already covers;
- the verdict split, and specifically what falls into `gap`;
- the token debt — how many raw colour, spacing and font values need replacing.

## 2 · Read the verdicts honestly

| Verdict     | What you do with it                                                            |
| ----------- | ------------------------------------------------------------------------------ |
| **direct**  | Rename plus an import change. The safe bulk of the work.                       |
| **props**   | Same idea, different API. Apply the prop remap the analysis lists.             |
| **compose** | No single equivalent — rebuild it from primitives. Show the composition first. |
| **gap**     | Nothing matched. Search before you conclude — then keep theirs and record why. |
| **drop**    | Not UI (routing, document head, language constructs). Leave it alone.          |

Two limits to state plainly rather than discover later:

- the inventory is a **heuristic source scan, not an AST parse** — good enough to
  rank work by blast radius, not a refactoring index;
- `gap` means "the map has no entry", not "no equivalent exists". Run
  `brand-ui search <name>` before telling the user something is missing.
- a verdict is made per (name, **library**) — the `lib` column. A brand-ui
  export that merely shares the name (`Grid` in charts is gridlines, `List` in
  editor is a markdown block) is reported as a `gap` with a "name coincidence"
  note, never as a direct match. Do not "fix" that by importing the namesake.

## 3 · Plan — the strangler-fig phases

`migration/plan.md` already lays these out with the actual components per phase.
Walk them in order and **stop for approval between each**:

1. **Coexistence** — install, wire the tokens stylesheet and one Tailwind
   `@source` line per installed package, wrap the root in `ThemeProvider`. The
   app must still build and render before anything else happens. A missing
   `@source` renders components unstyled — verify each one. **Decide the theme
   here**: an app that had a brand (the old library's palette, a corporate typeface) gets
   it back as a brand-ui theme — a family from `themes/<family>/` in the
   brand-ui repository, or one built with `brand-ui-create-theme` — registered
   on `ThemeProvider` and added to the `@custom-variant dark (…)` line. The
   brand never re-enters as per-component colours in a later phase.
2. **Leaf components** — the `direct` matches, lowest blast radius first.
3. **Composite surfaces** — the `props` remaps and the `compose` rebuilds.
4. **App shell** — the frame itself: navigation, header, page scaffold. **Ask
   which of the library's shells the app moves into** — flagship (recommended)
   · dashboard · mail · double-sided, the entries under Storybook's
   _Layout/App Shell_ — with the question, the story ids to render and the
   block each maps to in `../brand-ui-new-app/reference/app-shells.md`. Show the
   rendered shells before the person picks, then copy the chosen block in
   (`npx shadcn add <registry>/<block>.json` → `src/components/<block>/`) and
   make the app's screens its `children` (the flagship `WorkspaceShell` takes
   the nav, the signed-in user and the trail as props; the other three carry
   their nav in `nav-items.ts` — rewrite it from the app's routes). **Never
   hand-roll the frame** from `SidebarProvider` + `Sidebar` + `SidebarInset`:
   that bare composition is the stand-in the archetype stories use, not a
   finished shell, and it is how a migrated app ends up looking like a plain
   rail with a one-word header. Charts and KPI tiles move into `ChartFrame` /
   `MetricCard` in the same pass, not into bare `Card`s. Any custom grid cell
   holding a table or chart keeps `min-w-0`, or one wide child pushes the page
   past the viewport. Record the chosen shell in `migration/plan.md`.
5. **Theming cutover** — raw values become semantic tokens.
6. **Remove the old library** — or document what stays and why.

Keep every phase to a diff a person can actually read. Run the project's build
and tests after each batch, not at the end.

## 4 · Migrate — the rules that do not bend

- **Never guess a prop.** Run `brand-ui docs <Name>` and use the real API. If it
  lists anti-patterns for that component, follow them.
- **Semantic tokens only** — `bg-background`, `text-foreground`, `border-border`.
  Never a raw hex.
- **Prefer composing what exists** over writing a new component.
- **Do not force a bad fit.** A `gap` stays the user's component until they say
  otherwise.
- **Visual decisions run the loop.** Any choice the user can see — which shell,
  which theme, which layout — goes through propose → preview → pick → refine, on
  a render rather than on prose. The shell is the first of these and is never
  skipped (`../brand-ui-new-app/reference/app-shells.md`). The loop and its fidelity ladder are in
  `../brand-ui-new-app/reference/visual-loop.md`; there is one copy, and both
  flows use it.

## 5 · Verify — per screen, per theme

- `brand-ui audit src/` and fix what it reports.
- Check every migrated screen in **every registered theme** — light, dark and
  the brand family. A screen that only works in one theme is not migrated.
- Report honestly: what moved, what was skipped and why, and what the user should
  look at closely. Lead with what you did **not** verify.

## What this skill does not do

It does not run an automated codemod. The transform engine is not implemented —
`brand-ui codemod <map.json>` emits a plan and a dry-run contract and edits no
files. The edits are yours to make and the user's to review. Say that up front
rather than implying a one-command migration.
