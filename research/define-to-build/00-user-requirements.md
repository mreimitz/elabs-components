# Define-to-Build: User Requirements

> **Goal:** Remove as much UI design work as possible from the developer.
> A developer should be able to describe the structure and views of their app
> and let the plugin produce a well-working, on-brand UI.

This folder captures the **user-perspective requirements** — what an actual developer needs,
what the current state delivers, and what gaps block the goal. This is the demand side;
the supply side (how the plugin works internally) lives in `research/vibe-coder-plugin/`.

---

## How much does the current state help?

**Rating: 4/10** for the define-to-build goal.

The component library itself is strong (solid 8/10). But the guided scaffolding capability
that removes design decisions from the user is **0% delivered**. The score averages to 4.

### What already removes design work today

| Capability                          | Why it helps                                           |
| ----------------------------------- | ------------------------------------------------------ |
| Six themes, one `defaultTheme` prop | Never touch a color. Professional look from line 1.    |
| AppShell + Sidebar registry block   | Collapsible nav shell in a single copy-paste.          |
| DataTable + FilterBar               | Search, facets, pagination in ~50 lines.               |
| Conversation + PromptInput          | Correct chat surface if a streaming endpoint is wired. |
| `cn()` + token utilities            | No design decisions for spacing/radius/focus rings.    |

### What still requires design expertise

Everything else. Picking which components to use, how to compose them,
what the page structure should look like, where data flows — all of this
falls on the developer the moment the template copy-paste runs out.

---

## The blocking gaps (what prevents the goal)

### P0 — The `new-app` skill doesn't exist

This IS the goal. The guided interview → spec → scaffold flow (VP-02 in
`research/vibe-coder-plugin/02-greenfield-guided-flow.md`) is designed but unbuilt.
There is no entry point. A user starting a new project has no path from "I want to
build X" to working scaffolded code.

Without this, users are still doing:

1. Browse Storybook (requires `pnpm storybook` running locally)
2. Guess which components are relevant
3. Manually compose them
4. Discover the wrong patterns only after writing code

### P0 — Templates are silent skeletons

The 5 templates (`registry/templates/`) have the right structure but every placeholder is
mute. The dashboard has `{/* TODO: add content */}`-style holes with no guidance on what
goes there — which hook, which type, which data shape.

After copying a template the user immediately faces: "now what?" and the answer requires
design knowledge the template should have front-loaded.

**What's needed:** Every placeholder replaced with a structured TODO that names
the specific hook/type/pattern. Example:

```tsx
{
  /* WIRE: replace with your KPI data
    shape: Array<{ label: string; value: number; trend?: number }>
    pattern: const { data } = useMyDataHook()  */
}
<MetricGrid items={[]} />;
```

### P1 — No playbooks; composition is guessable only from demos

There's no document that says: "for a dashboard, combine AppShell + MetricGrid + DataTable

- FilterBar in this order and wire them like this." The pattern exists in
  `apps/playground/src/demos/dashboard-demo.tsx` but you have to know to look there,
  understand 300 lines of demo code, and extract the structure yourself.

WP-09 (playbooks) in the enterprise-gap stream is the right solution but isn't built.
A one-page reference per archetype would suffice as a bridge.

### P1 — Discovery requires a running dev server

To see what 57+ components actually look like, a developer must clone the repo and run
`pnpm storybook`. A vibe coder building a demo remotely, or evaluating the library before
adopting it, cannot do this. There is no deployed Storybook, no screenshot gallery,
no visual reference that works without a local install.

The visual propose→preview→pick loop (VP-04) would solve this elegantly but depends
on VP-01 and isn't built.

### P1 — No spec input format

There is no mechanism to express:

> "I want a dashboard with 4 KPI cards, a revenue bar chart, and a deals table"

and receive scaffolded code. The 7-stage interview in the greenfield design captures
exactly this intent, but it doesn't exist as a running skill.

Today the developer must: know component names, know which registry blocks exist,
copy them manually, and compose them by hand. That's the design work they're trying
to avoid.

### P2 — No agent context file in the output

VP-02 plans to include a starter `CLAUDE.md` in the scaffolded app so any subsequent
coding agent session automatically knows: "use brand-ui, use semantic tokens, use the
existing AppShell, don't invent new components." Without this, every session starts
from scratch and the developer must re-explain brand constraints.

---

## What would actually unlock the goal

### Tier 1 — Minimum viable define-to-build

These three together deliver the goal at ~80% fidelity:

1. **A 3-question `new-app` command** (archetype + theme + optional title):
   - Picks the matching template
   - Copies the relevant registry blocks
   - Annotates every wiring point with structured TODOs
   - Adds a starter `CLAUDE.md` for the agent context
   - This is a subset of VP-02 — ship it first

2. **Annotate templates** (no new code, pure documentation):
   - Replace every silent placeholder with a structured TODO
   - Name the hook/type/pattern at each wiring point
   - Time estimate: 1–2 hours per template × 5 templates

3. **One-page playbooks per archetype** (documentation, not code):
   - Dashboard · Data App · AI Assistant · Flow Workspace · Settings
   - Each: 3–4 building blocks + wiring diagram + minimal code example
   - This can ship before any other infrastructure work

### Tier 2 — Full define-to-build experience

4. **VP-02 full 7-stage interview** — captures intent at the right level
   of detail (entities, fields, chart types, per-surface layout)
5. **VP-04 visual feedback loop** — propose → preview → pick for theme/archetype
6. **WP-09 playbooks** as machine-readable composition recipes the plugin uses

---

## Connection to the existing plugin design

| Requirement                 | Covered by                   | Status                                                                                                                                       |
| --------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Guided app creation         | VP-02 `new-app`              | **Built (2026-06-09)** — `skills/brand-ui-new-app/` + `/new-app` (quick + full 7-stage)                                                      |
| Visual preview / pick       | VP-04 visual feedback        | Partial — fidelity ladder wired into the skill (Storybook MCP render > artifact > option preview); the standalone VP-04 loop remains unbuilt |
| Composition recipes         | WP-09 playbooks              | **Built (2026-06-09)** — `docs/playbooks/` (6 archetypes, incl. marketing); machine-readable WP-09 form remains follow-on                    |
| Agent context handoff       | VP-02 scaffolded `CLAUDE.md` | **Built (2026-06-09)** — `skills/brand-ui-new-app/reference/starter-claude-md.md`                                                            |
| Template wiring annotations | (no WP covered this)         | **Built (2026-06-09)** — `WIRE:` convention in all 6 templates (`registry/templates/README.md`)                                              |
| Marketing landing template  | (no WP covered this)         | **Built (2026-06-09)** — `registry/templates/marketing/` + `template-marketing` registry item                                                |
| Deployed visual gallery     | (no WP covers this)          | Gap — static Storybook deploy or screenshot deck; blocked on infrastructure but low-code                                                     |

The remaining gap not covered by any planned work package:

- **A deployed visual gallery** — a static Storybook deploy or screenshot deck; blocked on infrastructure but low-code

---

## What a user actually experiences today (honest walkthrough)

**Task:** build a sales pipeline dashboard for a Qlik demo.

1. `pnpm add @qlik-coe-emea/qlabs-components-ui @qlik-coe-emea/qlabs-components-tokens @qlik-coe-emea/qlabs-components-charts @qlik-coe-emea/qlabs-components-data` ✅
2. Wrap app with `<ThemeProvider defaultTheme="qlik-bright">` ✅
3. Need to know what components exist → must run `pnpm storybook` locally ⚠️
4. Copy `registry/templates/dashboard/page.tsx` → get a silent skeleton ⚠️
5. Try to add a "deals table" → must figure out DataTable + ColumnDef by reading source ⚠️
6. Want a revenue chart → must read ChartFrame docs + pick a chart type manually ⚠️
7. Ship something that looks mostly right but took 3× longer than expected ❌

**What the goal looks like:**

1. Run `npx brand-ui new` → answer 3 questions ✅
2. Get a scaffold with annotated wiring points ✅
3. Fill in data hooks where the TODOs tell me to ✅
4. Ship in 1 session ✅

The delta between those two experiences is exactly VP-02 tier 1 (the minimal `new-app`
command) + annotated templates. That's the highest-leverage build.
