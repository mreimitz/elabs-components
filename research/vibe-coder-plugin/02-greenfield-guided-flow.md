# 02 · Greenfield flow — "describe your app → scaffold it" (guided, with visual feedback)

> Part of the **vibe-coder-plugin** pack. The Cowork experience that takes an internal vibe coder from
> a vague idea to a running, best-practice brand-ui app, guiding them high-level → detail with visual
> feedback at each step. Delivered as a `new-app` skill (working package **VP-02**).

## Design principles

- **Ask first, generate second** (the Lovable/Spec-Kit model): never dump a guess; interview to a
  concrete spec, _then_ scaffold. The single biggest quality lever for non-experts.
- **Staged, high-level → detail** (Spec-Kit shape: _specify → clarify → plan → tasks → implement_).
  Each stage commits one decision and narrows the next.
- **A living spec is the source of truth.** Every answer is written into `app-spec.md`; the scaffold is
  generated _from the spec_, so it's reviewable and re-runnable.
- **Propose → preview → pick → refine at every visual decision.** The user reacts to real options, not
  prose — and brand-ui can show **real components in the chosen theme**, not mockups.
- **The scaffold is born compliant.** It uses brand-ui templates/playbooks/tokens and ships the gates
  - context file, so the user's own agent keeps building on-brand after the wizard ends.

## The stages

Each stage is one or two `AskUserQuestion` rounds (the tool allows 1–4 questions, 2–4 options, optional
multi-select, always an "Other" escape) plus a visual feedback loop where a choice is visual. The flow
is multi-turn by design.

| #   | Stage                  | What it asks                                                                                    | Output into `app-spec.md`                                 | Visual feedback                                                                    |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Intent**             | What are you building? who's it for? rough scale?                                               | purpose, audience, scale                                  | — (text)                                                                           |
| 2   | **Archetype**          | Pick the app shape: dashboard · data/admin app · AI assistant · flow/workspace · portal/landing | archetype → a **playbook** (WP-09) + **template** (WP-13) | **Show the archetypes rendered** (Storybook-MCP / artifact) → pick                 |
| 3   | **Surfaces & nav**     | Which screens/sections? (multi-select common surfaces; add own)                                 | surface list + nav structure (app shell)                  | preview the **app shell + nav** in the chosen archetype                            |
| 4   | **Data & entities**    | What are the main objects + key fields?                                                         | entities → tables/forms/detail views                      | preview a **DataTable/form** stub for the primary entity                           |
| 5   | **Brand & feel**       | Theme (qlik-bright/qlik-dark/light/dark/custom) · density · any brand color                     | theme + density tokens                                    | **render the shell + a sample surface in the chosen theme** (the unique advantage) |
| 6   | **Per-surface detail** | For each surface: columns/filters (table), fields (form), chart types (dashboard), etc.         | per-surface component spec                                | preview each surface; iterate columns/cards live                                   |
| 7   | **Confirm → scaffold** | Review the assembled spec; confirm                                                              | finalized spec                                            | show the **assembled app preview**, then generate                                  |

Stages 2–6 each run the feedback loop below. Stage 6 can be skipped ("scaffold with sensible
defaults, I'll refine in code") for speed — the spec records the defaults used.

## The visual interaction feedback loop (propose → preview → pick → refine)

This is the mechanism the user asked for. At each visual decision:

1. **Propose** 2–4 concrete options (e.g. three dashboard layouts; three nav patterns; the six themes).
2. **Preview** them as _real rendered brand-ui_, in priority order of fidelity:
   - **Storybook MCP** (`mcp__storybook__preview-stories`, `globals=theme:<slug>`) renders the real
     component/playbook **in the user's chosen theme** — brand-ui's standout advantage over tools that
     show generic mockups. (Needs the Storybook dev server; the skill starts it.)
   - **A generated artifact / HTML preview** of the assembled screen (a self-contained file the user
     opens) when a composed, multi-component preview is needed.
   - **`AskUserQuestion` option previews** for quick A/B/C choices where a thumbnail/snippet suffices.
3. **Pick** via `AskUserQuestion` (the choice writes to the spec).
4. **Refine** — "make the cards bigger / add a filter / swap to dark" → re-render → re-confirm. Loop
   until the user is happy, then move to the next stage.

Fidelity ladder (use the highest that's available): **real Storybook render > generated artifact
preview > option thumbnail/snippet > text description.** Never advance a visual decision on text alone
if a render is available.

> **Honest caveats:** `AskUserQuestion` is ≤4 questions/round, so stages are multi-turn; the Storybook
> render path needs the dev server running (the skill manages it, else fall back to static screenshots);
> and **plugin-owned inline widgets are not a documented API** — rely on Storybook renders + artifacts.

## What gets scaffolded (the output)

Two artifacts, both generated _from the spec_:

**A. `app-spec.md`** — a Spec-Kit-style living spec: purpose, audience, archetype, surfaces + nav,
entities + fields, theme + density, per-surface component choices, and acceptance criteria. Reviewable,
versionable, and the input the scaffold (and the user's later agent) reads.

**B. A best-practice brand-ui app** — assembled from the substrate, not hand-written:

- brand-ui wired at the root: `@qlik-coe-emea/qlabs-components-tokens` styles + `<ThemeProvider defaultTheme=…>` in the chosen
  theme; semantic-tokens-only enforced.
- The chosen **template** (WP-13) as the skeleton + **playbooks** (WP-09) assembling the surfaces
  (dashboard = `MetricGrid`+`DataTable`+`ChartCard`; data app = `DataTable`+filters+states; AI app =
  `ChatShell`+AI elements; etc.) — real components, correct composition, on the first try.
- App shell + nav from stage 3; entity tables/forms/detail views stubbed from stage 4; charts from the
  WP-05 set; states (`StatePanel`) wired.
- **The agent-context handoff:** a `CLAUDE.md`/`AGENTS.md` + the generated **context file** (WP-03/E7)
  in the new repo, so when the vibe coder keeps building (in Cowork or Code), _their_ agent already
  knows brand-ui's components, props, tokens, playbooks, and the "how & when to use what" decisions
  (WP-12). This is what makes the experience compound instead of ending at scaffold.
- **Born compliant:** the WP-10 gates (manifest/registration/stale-checks) + quality gates are wired,
  so subsequent additions stay token-driven, storied, tested, and theme-safe without reminders.

## "Best practices in repo scaffolding" — concretely

The scaffold encodes the brand-ui rules so the user doesn't have to know them:

- semantic tokens only (no raw hex); one-way dependency graph; `forwardRef`/`cn`/`cva` conventions
  in any generated component; six-theme safety; accessibility baseline; the two consumption modes
  (import stable primitives, copy-own registry blocks); the context file + gates so their agent stays
  on-brand. (These come from the enterprise-gap rules + WP-12 guidance — the scaffold _applies_ them.)

## Where it runs

**Cowork-first** (workspace files + shell + subagents + the conversational/visual canvas). The same
`new-app` skill works in Claude Code for devs who prefer the terminal; in plain chat it degrades to
"here's the spec + commands to run yourself" (no file scaffolding).

## Sketch of the skill

`new-app` (SKILL.md): orchestrates the stages; calls `AskUserQuestion` per stage; drives the
Storybook-MCP / artifact previews; writes `app-spec.md`; then invokes `@qlik-coe-emea/qlabs-components-cli` scaffold functions
(doc 04) that lay down the template + playbooks + theme + context + gates. A `scaffold-builder`
subagent does the file generation; the existing `brand-ui-audit` runs a final cross-theme check before
"done."

---

_Related: WP-09 playbooks, WP-13 templates, WP-05 widgets, WP-03 context, WP-10 gates, WP-12 guidance
(all in [`../enterprise-gap/`](../enterprise-gap/)). Sources:
[`_research/plugin-and-dx-notes.md`](./_research/plugin-and-dx-notes.md) (Spec Kit, Lovable/v0/Bolt
intake, AskUserQuestion, visual-feedback patterns)._
