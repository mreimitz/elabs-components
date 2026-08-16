---
TYPE: issue
TITLE: "[ui] One parameterized AppSidebar + shared nav primitives (stop the drifting copies)"
LABELS: type:tech-debt, severity:P1, area:ui, area:registry, needs-triage
WP: WP-13
---

## Summary

`sidebar-02`, `sidebar-04`, `sidebar-05` each ship their own `app-sidebar.tsx`, and **`team-switcher`
is copied into sidebar-02 and sidebar-05 — the two copies have drifted 25 lines apart.** The nav parts
(`nav-main`, `nav-notifications`, `nav-user`, `mail-context`, `logo`) are block-local. Classic
copy-paste drift. Consolidate into shared primitives + one parameterized sidebar.

## Source

Component audit ([`../../07-component-audit.md`](../../07-component-audit.md) C-2/C-4); verified the two
`team-switcher` copies differ by 25 lines.

## Severity & impact

**P1.** Eliminates drift, gives consumers/agents _one_ sidebar to learn (parameterized), and turns the
registry "sidebar-NN" blocks into thin, honest compositions.

## Current state & why the gap exists

The sidebar variants were added as independent shadcn-style blocks, each copying the shared parts —
which then diverged.

## Proposed solution

- Promote shared primitives into `@qlik-coe-emea/qlabs-components-ui`: `TeamSwitcher`, `NavMain`, `NavUser`,
  `NavNotifications` (reconcile the two drifted `TeamSwitcher` copies into one correct version).
- Provide **one parameterized `AppSidebar`** (variant/slots for header, nav groups, footer) that the
  three registry blocks compose, rather than three full forks.
- Keep `sidebar-02/04/05` as registry blocks (copy-own is fine) but have them import the shared
  primitives so they can't silently drift again.
- Document the nav family ("when to use `top-nav` vs `navigation-menu` vs `menubar` vs sidebar nav") —
  feeds WP-12 (D2/D3 guidance).

## Affected files

- [ ] `packages/ui/src/components/{team-switcher,nav-main,nav-user,nav-notifications}/**` (new shared)
- [ ] `packages/ui/src/blocks/sidebar-0{2,4,5}/**` (recompose on shared primitives)
- [ ] one `AppSidebar` (parameterized) + barrel exports
- [ ] `registry/registry.json` (sidebar blocks reference shared deps); stories/tests (six themes)

## Acceptance criteria

- [ ] One `TeamSwitcher`/`NavMain`/`NavUser`/`NavNotifications` shared; no duplicated copies remain.
- [ ] One parameterized `AppSidebar`; the three registry blocks compose it.
- [ ] `pnpm registry:validate` passes; stories render in six themes; gates green (WP-10).

## Test to add

A test/lint that fails if a sidebar block re-declares a shared nav primitive locally (drift guard) —
fits the WP-10 registration/gate approach.

## Risks / ripple effects

- Behavioral parity: reconcile the drifted `TeamSwitcher` carefully (capture both variants' intent).
- Copy-own consumers of the old blocks — note in the migration guide (WP-07).

## References

- `../../07-component-audit.md` C-2/C-4; `.claude/rules/registry.md`; WP-10 (drift gate), WP-12 (nav guidance).
