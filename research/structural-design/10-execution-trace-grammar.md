# 10 · The agent execution-trace grammar — top-down integration (refines [05](05-execution-traces.md))

> The fourth refinement, in the same frame as [07](07-type-system-integration.md)
> (size axis), [08](08-separation-surface-system.md) (surface axis) and
> [09](09-context-panel-integration.md) (the missing rail). Where 07/08 fixed systemic
> backbones and 09 a single missing component, this fixes a **missing shared contract
> across six already-shipped components** — the largest contributor to "debug console
> styled as a chat." Routed through `brand-ui-design-system-architect`. Mechanism claims
> verified; perceptual claims flagged `needs-render`.

**Headline + honest caveat.** The six trace components don't need to _become_ one
component — that would destroy meaningful distinctions (a proposed plan is not an
executed step). They need to **share two leaf primitives** so one agent run reads as
one author: a token-driven **`StatusBadge`** (the status vocabulary) and a **shared
`Timeline` rail** (the visual spine). This is the **third instance of the exact
"extract a leaf to `@qlik-coe-emea/qlabs-components-ui`, re-point consumers byte-identically, gate the fork"
pattern** that 07 used for `Text`/`Heading` and 09 used for `useCollapsiblePanel`. The
convergence of components onto `AgentTimeline` is real but **smaller than 05 implied**.

This refinement also **corrects [05](05-execution-traces.md)** on three counts (see
"Net" at the end): the status sprawl is **five** idioms not three; the editor `Timeline`
is a **markdown-subpath** surface (so the hoist is a MOVE + re-export); and the
raw-palette bug is **systemic**, not just `tool.tsx`.

---

## A. How it blends in — one grammar from two shared leaves, not one mega-component

### A.1 The defect, re-stated precisely — five status idioms, two hand-rolled rails

| Trace            | Container                              | Status idiom                                            | `file:line`                          |
| ---------------- | -------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| `Tool`           | `Collapsible` + `rounded-md border`    | grey `Badge variant="secondary"` + **raw `-600` icons** | `tool.tsx:22-27,63-68,54-60`         |
| `Plan`           | `Card` (shadow-none)                   | none                                                    | `plan.tsx:45`                        |
| `ChainOfThought` | borderless list + absolute connector   | text-opacity (`complete\|active\|pending`)              | `chain-of-thought.tsx:118-120,93-97` |
| `Task`           | borderless + `border-s-2` content rail | none; `SearchIcon` + bordered file pills                | `task.tsx:62,44,13`                  |
| `Reasoning`      | borderless inline text                 | none (duration)                                         | `reasoning.tsx:130`                  |
| `Checkpoint`     | inline row + `Separator`               | none                                                    | `checkpoint.tsx:13-21`               |

Plus two idioms `05` under-counted, confirmed this session: **`Confirmation`** maps to
`Alert variant` (`confirmation.tsx:72-76`, the 4th); **`test-results.tsx:193-201`** has
its own `statusIcons`/`statusStyles` (the 5th). And `getStatusBadge` is **exported and
consumed by `sandbox.tsx:36`** — so re-pointing it isn't local to `tool.tsx`.

### A.2 The two shared leaves (the "extract to `@qlik-coe-emea/qlabs-components-ui`" pattern — 3rd instance)

```
@qlik-coe-emea/qlabs-components-ui  (the leaves — motion-free; dep-graph legal: ui → ai, ui → editor)
  ├─ StatusBadge        ← THE status vocabulary; built on the existing Badge cva (new wrapper)
  └─ Timeline (moved)   ← THE rail/node/connector spine; the editor's, hoisted (moved, not forked)
@qlik-coe-emea/qlabs-components-ai  (composes the leaves into the agent grammar)
  ├─ AgentTimeline + AgentStep  ← compound rail; converge ChainOfThought + Task steps + inspect-only Tool
  ├─ ToolResultCard             ← elevation channel (08); artifact-as-headline
  └─ Tool                       ← gains progressive disclosure (JSON behind a nested collapsible)
```

Structurally identical to 07 (`Text`/`Heading` extracted; editor prose re-points) and 09
(`useCollapsiblePanel` extracted; Sidebar re-points byte-identically). **Same playbook,
third application — be consistent.**

### A.3 It composes 07 + 08

- **07 (type):** trace labels `text-body`; timestamps/eyebrows `text-meta`; the `Tool`
  summary is a `text-body` sentence; `ToolResultCard` title is `text-subtitle`. No raw
  `text-sm`/`text-xs` in the new surfaces.
- **08 (surface):** the `AgentTimeline` rail **is** the 08 rail channel
  (`border-s-<role>`, survives blueprint). `ToolResultCard` **is** the 08 elevation
  channel (`bg-surface-elevated shadow-sm`). Inspect-only `Tool` in a timeline drops its
  `rounded-md border` and rides the rail. `StatusBadge`'s quiet visual is the 08
  `bg-<status>/10` wash that escapes the decoration drawn-not-filled rule for free.

### A.4 Honest reuse ledger

Net new: **one wrapper (`StatusBadge`), one moved primitive (`Timeline`), one compound
(`AgentTimeline`), one card (`ToolResultCard`), one API addition (`Tool` disclosure).**
**No new tokens** (08 settled the wash). Everything else is re-pointing. `Badge` already
ships token-driven `success|warning|destructive|info` variants (`badge.tsx:13-16`) that
`getStatusBadge` ignores — `StatusBadge` builds on them, not a parallel `cva`.

---

## B. How it works

### B.1 `StatusBadge` — the canonical status vocabulary (decision 1) · `@qlik-coe-emea/qlabs-components-ui`

A leaf of `AgentTimeline`, `Tool`, `ApprovalCard` ([05](05-execution-traces.md) §5),
`sandbox`, `test-results`. Built on the existing `Badge` cva.

**Canonical enum (7 states) — status as the trace domain models it, not the SDK transport:**
`pending | running | complete | awaiting-approval | denied | failed | skipped`. A
_closed enum_ (the 07 anti-hallucination property): an agent picks by meaning, can't emit
a color or a freeform string.

**Mapping (a) AI-SDK `ToolUIPart` 7-state → canonical** (replaces `tool.tsx:43-51`; SDK enum stays types-only, D6):

| `ToolUIPart["state"]` | →                   |     | `ToolUIPart["state"]` | →          |
| --------------------- | ------------------- | --- | --------------------- | ---------- |
| `input-streaming`     | `pending`           |     | `output-available`    | `complete` |
| `input-available`     | `running`           |     | `output-denied`       | `denied`   |
| `approval-requested`  | `awaiting-approval` |     | `output-error`        | `failed`   |
| `approval-responded`  | `running`           |     |                       |            |

`skipped` has no SDK source — it's an _additional_ agent-step state (a planned step not
run), exposed on `AgentStep`, not the SDK adapter. **Not lossy** (an extra state, not a collapse).

**Mapping (b) Timeline `done|active|pending` → canonical:** `done→complete`,
`active→running`, `pending→pending`. Lossless (the editor only expresses 3 of 7).

**Visual — HYBRID (reconciling 08 "green deliberate / status sparingly"):**

| `Status`                | Visual                                                    | Icon                   |
| ----------------------- | --------------------------------------------------------- | ---------------------- |
| `pending`               | `bg-secondary text-secondary-foreground` (neutral)        | `Circle`               |
| `running`               | wash: `bg-info/10 text-info-text border-info/40`          | `Loader` (motion-safe) |
| `complete`              | wash: `bg-success/10 text-success-text border-success/40` | `CheckCircle`          |
| **`awaiting-approval`** | **fill: `bg-warning text-warning-foreground`**            | `Clock`                |
| `denied`                | `bg-muted text-muted-foreground`                          | `XCircle`              |
| **`failed`**            | **fill: `bg-destructive text-destructive-foreground`**    | `AlertCircle`          |
| `skipped`               | `bg-secondary text-muted-foreground`                      | `MinusCircle`          |

**Why hybrid, not all-fill or all-wash:** all-fill makes a transcript of completed steps
a wall of saturated badges (violates "green deliberate"); all-wash makes `failed`/
`awaiting-approval` whisper (the APPROVE-1 backwards-prominence defect, from the status
side). So the **two states that must grab a human's eye** get the solid fill; everything
else — **including `complete`** — gets the calm `/10` wash, keeping solid green reserved
for primary actions (08 §B.3 / KPI-5). This fixes the raw-`-600` bug (icon + body now
track all six themes via tokens) and makes status legible by the **badge body**, not a
tiny icon (today the grey body is constant; only the icon differs).

`StatusBadge` exports `statusBadgeVariants`, the `Status` type, and typed mappers
`fromToolState(state)` + `fromTimelineStatus(status)` — so the agent and the editor get a
typed adapter, not a magic string. A `size` axis (`sm|md`) serves the rail node vs inline use.

**Bounded escape hatch (#363).** The 7-state enum stays scoped to "status as the trace
domain models it" — it is NOT grown per consumer. But a domain can genuinely have a state
the 7 don't express (a run engine's `aborted`, `stopped_guardrail`, a distinct "not run"
dash state); forcing that onto the closed enum either lies about severity or collapses
distinct outcomes, and the alternative — a consumer dropping to a raw `<Badge>` + hand-
written token classes — is exactly the raw-color anti-pattern this component exists to
eliminate. So `StatusBadge`'s `status` prop widens to `Status | CustomStatus`, where
`CustomStatus = { label: string; tone: StatusTone; icon?: LucideIcon }` and `StatusTone`
is its OWN closed 5-value set (`neutral | info | success | warning | destructive`) wired
to the same alpha-wash recipes as the canonical calm states. Three constraints keep the
hatch from eroding the anti-hallucination property above:

1. `tone` is reachable **only** through the `CustomStatus` object form (which requires a
   `label`) — it is never an independent prop, so a canonical status can never be
   recolored (`status="failed" tone="success"` is unrepresentable).
2. The hatch is **calm-only** — all five tones render the quiet wash/neutral treatments;
   the solid attention fill stays exclusive to the canonical `awaiting-approval`/`failed`.
3. **No raw color** — `tone` maps to the same semantic tokens the canonical recipes
   already use; nothing new is minted.

Map a custom status once, near the domain that needs it — not per call site. This was NOT
resolved by growing the canonical enum (option B considered and rejected: admitting one
consumer's vocabulary reopens "which states are canonical" per-consumer, forever) nor by
leaving it closed with no hatch (option C: `children` already makes the LABEL freeform
today, so the real remaining gap was narrowly the `tone`, and a bounded hatch closes it
without reopening the enum). See `packages/ui/src/components/status-badge/status-badge.tsx`.

### B.2 The shared `Timeline` rail — the editor's, hoisted (decision 2)

**The TRACE-6 correction:** the editor `Timeline` is exported _only_ from
`@qlik-coe-emea/qlabs-components-editor/markdown` (`markdown/index.ts:45`), consumed by `markdown-preview.tsx:44`
for the `:::timeline` directive — a **markdown-subpath surface**, not a general editor
export. So "don't fork a third timeline" means **two** rails today (editor markdown +
`ChainOfThought`), and the hoist must not break the markdown subpath.

**Decision: MOVE `Timeline` from `packages/editor/src/timeline/` to
`packages/ui/src/components/timeline/`, byte-identical; re-point `@qlik-coe-emea/qlabs-components-editor`'s
`markdown/index.ts:45` to re-export from `@qlik-coe-emea/qlabs-components-ui`.** The ADR-0012 / 09-`useCollapsiblePanel`
model exactly: `@qlik-coe-emea/qlabs-components-ui` owns the canonical primitive; `@qlik-coe-emea/qlabs-components-editor` re-exports for
back-compat.

**Two API shapes, one rail — they do NOT merge** (the array-vs-compound reconciliation):

```
@qlik-coe-emea/qlabs-components-ui  packages/ui/src/components/timeline/
  TimelineRoot     — the <ol>, the connector geometry
  TimelineItem     — one <li>: status node + connector + a slot for children  (compound)
  Timeline (array) — items={TimelineItem[]} convenience over the compound (editor uses this)
```

- The editor's **array `Timeline`** keeps its `items: TimelineItem[]` API (data in, list
  out — correct for a derived markdown list). **Zero API break** — same export, props,
  `<ol>` output; only the import path inside the package moves.
- `@qlik-coe-emea/qlabs-components-ui` adds **compound `TimelineRoot`/`TimelineItem`** over the same rail so a
  _composing_ consumer (the AI grammar) can interleave rich children per node. The array
  `Timeline` becomes a thin map over the parts — **one rail, two front doors** (the
  `MetricGrid columns`-vs-`featured` and the 07 `text-<role>`-utility-vs-`<Heading>`
  precedents: one source, two surfaces by consumer need).
- **Status-vocab mismatch resolved:** the node takes the canonical `Status`; the editor's
  array `Timeline` maps `done|active|pending` in via `fromTimelineStatus` at the boundary,
  so the editor's public `TimelineStatus` type is **unchanged**. The node colors are
  identical in intent (`border-success bg-success` etc. → the canonical token map), so the
  editor side is a **visual no-op** — verify on a render (§G.5).
- **Motion-free** (09 constraint): the `@qlik-coe-emea/qlabs-components-ui` rail ships zero animation (the
  connector is a positioned `<span>`); `AgentStep` adds the gated `fade-in`/`slide-in` it
  wants — animation lives in `@qlik-coe-emea/qlabs-components-ai`, not the shared leaf.

### B.3 `AgentTimeline` / `AgentStep` — the convergence (decision 3) · `@qlik-coe-emea/qlabs-components-ai`

```tsx
<AgentTimeline>
  <AgentStep
    icon={Search}
    status="complete"
    name="Searched financial filings"
    summary="3 documents · Q3 10-Q, earnings deck, board pack"
  />
  <AgentStep
    icon={Database}
    status="complete"
    name="Queried finance.revenue"
    summary="8 rows reconciled · 0 variances"
  />
  <AgentStep icon={Calculator} status="running" name="Computing QoQ deltas" />
  <AgentStep icon={PencilLine} status="pending" name="Draft the board note" />
</AgentTimeline>
```

`AgentStep`: `icon?`, `name` (ReactNode), `summary?` (`text-meta`), `status: Status`
(closed enum), `children?` (rich content under the node). Composes the `@qlik-coe-emea/qlabs-components-ui` rail +
`StatusBadge`.

**Converges onto the rail:** `ChainOfThought` (re-pointed to compose `AgentTimeline`
internally — keeps its `BrainIcon` header + `Collapsible` wrapper; `ChainOfThoughtStep`
becomes a thin alias of `AgentStep`, deprecate over one release; the hand-rolled
connector + text-opacity status are deleted); `Task`'s steps (`TaskContent` body becomes
an `AgentTimeline`); inspect-only `Tool` calls (render as an `AgentStep` with the JSON
behind the §B.5 disclosure as `children`).

**Stays distinct — by speech-act, not accident:** `Plan` (a _proposed_ plan ≠ an executed
step; its steps have no status — keep as a `Card`, harmonize tokens); `Checkpoint` (a
_divider/restore-point_, not a step — keep the `Separator` + control); `Reasoning`
(_inline thinking prose_ — keep the collapsible; can appear as an `AgentStep`'s children
"Reasoned for 8s" but isn't a rail node). The unification is at the **vocabulary** layer
(one `Status`, one type scale, one rail visual), not the **component** layer — so the
transcript reads as one author while staying semantically honest.

### B.4 `ToolResultCard` — the elevation channel (decision 4) · `@qlik-coe-emea/qlabs-components-ai`

**A separate component, NOT a `Tool` variant.** `Tool` owns the rail/inspect idiom (a step
that ran); `ToolResultCard` owns the elevation idiom (08) — an artifact the agent
_produced_, presented as the headline. Different channels, different speech acts; a
`variant` on `Tool` would be the behavioural-mode-flag anti-pattern `component-api.md`
forbids. Two components → an agent picks by **name** (08 §C.3).

```tsx
<ToolResultCard title="Revenue by region — Q3 vs Q2"  summary="Total $48.2M · +12.4% QoQ"
                status="complete" details={<ToolDetails input={…} output={…} />}>
  <AutoChart spec={…} />   {/* the produced artifact IS the headline */}
</ToolResultCard>
```

Visual: `bg-surface-elevated shadow-sm rounded-lg`, **no** muted uppercase "Result"
heading (deletes the `tool.tsx:142` idiom). **Presentational, hosts any node** — it does
NOT import `@qlik-coe-emea/qlabs-components-charts`/`@qlik-coe-emea/qlabs-components-data` (sibling dep, forbidden — the same "charts → ui
only" resolution `ChartFrame` uses); the consumer passes a `<ChartFrame>`/`<DataTable>`/
`<Table>` as `children`. Types-only `ai` (`status` via `fromToolState`).

### B.5 `Tool` progressive disclosure (decision 5) — JSON behind disclosure, as the package default

- `ToolHeader` gains an optional **`summary`** prop (a business line: "Searched 3
  filings", "Reconciled 8 rows · +12.4% QoQ") beside the name + `StatusBadge`.
- `ToolContent` gains a nested **`ToolDetails`**: a second `Collapsible` labelled "Show
  technical details", **collapsed by default**, holding `ToolInput`/`ToolOutput`.
- `ToolInput`/`ToolOutput` keep their JSON (the technical view by definition) but live
  _inside_ `ToolDetails`. The "bare React element under a muted Result heading" path
  (`tool.tsx:132-153`) is **removed** — a rich output goes through `ToolResultCard`.

```tsx
<Tool>
  <ToolHeader type="tool-searchFilings" state="output-available" summary="3 documents found" />
  <ToolContent>
    <ToolDetails>                       {/* collapsed by default */}
      <ToolInput input={…} /><ToolOutput output={…} errorText={…} />
    </ToolDetails>
  </ToolContent>
</Tool>
```

**JSON-behind-disclosure is the package default** — the single highest-leverage change for
"calm log, not debug console," inherited by every consumer. `ToolHeader` falls back to the
derived tool name when `summary` is absent (never worse than today).

### B.6–7 `Task` cleanup + density defaults (decision 6)

`Task` body → `AgentTimeline`; drop the default `SearchIcon` (`task.tsx:44`) and the
bordered `TaskItemFile` pills (`:10-20`, cross-link the `ProducedAssetTree` from 09
instead); `Task.defaultOpen` **`true`→`false`** (`task.tsx:32`). `Reasoning`'s existing
auto-close (`reasoning.tsx:104-113`) already collapses it in a settled transcript — no
change. `ChainOfThought.defaultOpen` stays `false`. The scenario then default-opens **only**
the chart `ToolResultCard` + the final answer — two focal surfaces instead of five.

---

## C. How users work with it

| User         | Reach-for                                                                              | Why                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import       | `<AgentTimeline>`/`<AgentStep>`, `<ToolResultCard>`, `<StatusBadge>`                   | status + rail baked in; can't emit a `-600` color or grey-on-grey                                                                                     |
| Copy-own     | the components, or the 08 channel utilities (`border-s-<role>`, `bg-surface-elevated`) | survives copy-paste; channel documented                                                                                                               |
| Coding agent | the **semantically named** components + the **closed `Status` enum**                   | picks `AgentStep` (a step) vs `ToolResultCard` (an artifact) by meaning; reads `status` via MCP — can't hallucinate a color, a px, or JSON-as-content |
| Theme-author | nothing trace-specific                                                                 | `StatusBadge` renders status tokens + the type scale + the rail channel                                                                               |

**Agent-legibility (the crux):** the _current_ state is the worst case for an agent — six
idioms, five status representations, a raw-color escape hatch, JSON as default content. The
fix makes the right choice the only legible one: `get-documentation` returns a **closed
`Status` enum** (can't write `text-green-600`); the **component names ARE the routing**
(`AgentStep` vs `ToolResultCard` carries the channel choice, no `variant` to get wrong);
**JSON-behind-disclosure is the default** (an agent must opt in to dump raw JSON); and
`fromToolState`/`fromTimelineStatus` are typed mappers (the 7-state machine maps once,
correctly).

---

## D. Blend-in migration

| Component                                                            | Action                                                                            | Breaking?                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `StatusBadge` (`@qlik-coe-emea/qlabs-components-ui`)                 | **new** leaf; barrel export                                                       | No                                                                       |
| `Timeline` (editor → `@qlik-coe-emea/qlabs-components-ui`)           | **moved** byte-identical; editor `markdown/index.ts:45` re-exports                | No                                                                       |
| `TimelineRoot`/`TimelineItem` (`@qlik-coe-emea/qlabs-components-ui`) | **new** compound over the same rail; array `Timeline` becomes a map               | No (array API unchanged)                                                 |
| `AgentTimeline`/`AgentStep` (`@qlik-coe-emea/qlabs-components-ai`)   | **new** compound                                                                  | No                                                                       |
| `ToolResultCard` (`@qlik-coe-emea/qlabs-components-ai`)              | **new**; elevation channel                                                        | No                                                                       |
| `Tool`                                                               | **API addition** (`summary`, `ToolDetails`); JSON moves inside, default collapsed | Additive API; default _appearance_ changes (calmer) — gated by the sweep |
| `getStatusBadge` (`tool.tsx`)                                        | **re-point** to `StatusBadge` internally; `sandbox.tsx:36` unaffected             | No (same signature)                                                      |
| `ChainOfThought`                                                     | **re-point** body to `AgentTimeline`; `ChainOfThoughtStep`→alias, deprecate       | No (props mapped)                                                        |
| `Task`                                                               | body → `AgentTimeline`; drop `SearchIcon`/pills; `defaultOpen` `true`→`false`     | Default change (visible); API unchanged                                  |
| `test-results.tsx:193-201`                                           | **re-point** local status idiom to `StatusBadge` (5th idiom)                      | No                                                                       |
| `Confirmation`→`ApprovalCard`                                        | **re-point** the status line to `StatusBadge` (05 §5 owns the rest)               | No                                                                       |
| `Plan`/`Checkpoint`/`Reasoning`                                      | **stay distinct**; harmonize container tokens                                     | No                                                                       |

**Order (refines [05](05-execution-traces.md) §6):**

```
1. StatusBadge (@qlik-coe-emea/qlabs-components-ui)              ← leaf of everything; fixes the raw-600 bug standalone
2. Timeline MOVE to @qlik-coe-emea/qlabs-components-ui + compound parts; editor markdown re-points (byte-identical, gated)
3. AgentTimeline/AgentStep (@qlik-coe-emea/qlabs-components-ai)  ← on 1+2; converge ChainOfThought + Task steps + inspect Tool
4. Tool summary + ToolDetails           ← package-default JSON-behind-disclosure
5. ToolResultCard (@qlik-coe-emea/qlabs-components-ai)           ← on 1; chart/table/file headline
6. Re-point test-results / sandbox / Confirmation→ApprovalCard to StatusBadge
7. Scenario re-wire (defaultOpen, Task→summary, ChainOfThought→AgentTimeline) ← last
```

**Scenario re-wire** (`agentic-workspace.stories.tsx`): `ChainOfThought` (`:650-679`)→
`AgentTimeline`, drop `defaultOpen`; Tool#1/#2 (`:682-721`)→ `Tool` with `summary`, JSON in
`ToolDetails`, drop Tool#1 `defaultOpen`; Tool#3 `renderChart` (`:726-775`)→ **`ToolResultCard`**
hosting `<ChartFrame>`/`<AutoChart>` (stays `defaultOpen`); `Task` (`:804-828`)→ run-summary
or `AgentTimeline` body, no pills, drop `defaultOpen`; final answer stays open. **Two** focal
open surfaces (chart + answer) instead of five.

---

## E. The decisions — resolved

1. **`StatusBadge` → a 7-state canonical enum in `@qlik-coe-emea/qlabs-components-ui`, on the existing `Badge` cva,
   HYBRID visual** (wash for calm incl. `complete`; solid fill only for `awaiting-approval`
   - `failed`). Typed `fromToolState`/`fromTimelineStatus`. Fixes the raw-`-600` bug. (§B.1)
2. **Timeline → MOVE to `@qlik-coe-emea/qlabs-components-ui` byte-identical; editor `markdown/index.ts` re-exports;
   add compound parts; array API unchanged.** (The surprise: it's a markdown-subpath
   surface — TRACE-6 correction.) Node takes canonical `Status`; editor maps its 3-state in.
   Motion-free. (§B.2)
3. **`AgentTimeline`/`AgentStep` → new `@qlik-coe-emea/qlabs-components-ai` compound on the rail + `StatusBadge`.**
   Converge `ChainOfThought` + `Task` steps + inspect-only `Tool`; keep `Plan`/`Checkpoint`/
   `Reasoning` distinct by speech-act. (§B.3)
4. **`ToolResultCard` → separate `@qlik-coe-emea/qlabs-components-ai` component (NOT a `Tool` variant).** Elevation
   channel; hosts artifacts as `children`; no `@qlik-coe-emea/qlabs-components-charts`/`@qlik-coe-emea/qlabs-components-data` import. (§B.4)
5. **`Tool` → `ToolHeader.summary` + a default-collapsed `ToolDetails`; JSON-behind-disclosure
   is the package default.** (§B.5)
6. **Density + `Task` → default-open only chart + answer; `Task.defaultOpen` `true`→`false`;
   drop `Task`'s `SearchIcon`+pills, cross-link the asset tree.** (§B.6–7)
7. **Governance → file the raw-palette bug standalone; extend the boundary hook to catch raw
   Tailwind palette; add a `check-timeline-fork.mjs` + a `palette:check` gate.** (§F)

---

## F. Governance / dependencies

**Hard order:** `StatusBadge` (#1) + the moved `Timeline` (#2) land first — `AgentTimeline`,
`Tool`, `ToolResultCard`, `ApprovalCard` all depend on `StatusBadge`. Architect-gated (new
`@qlik-coe-emea/qlabs-components-ui` primitive + a moved public surface + a new `Tool` API).

**File the raw-palette theme-safety bug standalone NOW.** It's **broader than `tool.tsx`** —
`schema-display.tsx:44-91`, `commit.tsx:240` also use raw palette; `terminal.tsx` is likely a
_deliberate_ dark-IDE surface (verify — may warrant a documented exception, not a fix).
Headline the `tool.tsx:54-60` status icons (the redesign fixes them via `StatusBadge`); note
the siblings as follow-ups. **needs-render:** confirm the `-600` icons render off-token on
blueprint/high-contrast.

**Extend the boundary hook (enforcement-over-reminders).** Verified:
`validate-component-boundaries.sh:53` matches only `#hex` — `text-yellow-600` is **not
caught**. Add a sibling check (same `tokens`/stories/tests exemptions) flagging
`(text|bg|border|ring)-(red|green|blue|yellow|orange|amber|emerald|sky|rose|violet|slate|gray|zinc|neutral|stone)-[0-9]{2,3}`,
and promote to a self-tested **`pnpm palette:check`** CI gate with a baseline ratchet
(existing violations grandfathered; new ones fail) + a self-test (`text-blue-600` must flag,
`text-info` must not). The **status analogue** of 07's `text-scale:check` + 08's
`check-separation.mjs`.

**Fork-prevention gate (the 09 `check-collapse-fork.mjs` analogue).**
`scripts/check-timeline-fork.mjs` (warn-only, self-tested) flags a new file that hand-rolls a
rail+node (heuristic: an absolutely-positioned `w-px` connector + a status-keyed node `cn`
map — the `chain-of-thought.tsx:118-120` signature) without importing the `@qlik-coe-emea/qlabs-components-ui`
`Timeline`/`TimelineItem`. Self-test plants a hand-rolled rail (must flag) + a `TimelineItem`
consumer (must not). So a fourth rail can't appear.

---

## G. Risks / needs-render — adversarial

1. **Does forcing six idioms into one grammar lose distinctions?** Deliberately **no** — the
   design doesn't force all six onto the rail; only sequenced status-bearing steps converge.
   `Plan`/`Checkpoint`/`Reasoning` stay distinct by speech-act (proposal / marker / prose).
   The unification is the **vocabulary** (one `Status`, type scale, rail visual), not the
   component. Forcing a _proposed plan_ and an _executed step_ into one component would be the
   mode-flag anti-pattern. **needs-render:** confirm a `Plan` `Card` + `AgentTimeline` +
   `Checkpoint` + `Reasoning` read as one calm transcript on the real scenario, six themes.
2. **Is the AI-SDK 7-state → canonical mapping lossy?** Two cells to watch:
   `approval-responded → running` collapses "human answered, resumes" into `running`;
   `input-streaming → pending` vs `input-available → running`. No two _distinct_ SDK states
   that need telling apart collapse into one. **needs-render** the `approval-responded`
   transition in the approval flow.
3. **Does JSON-behind-disclosure hide what power users need?** The JSON is one expand away,
   never deleted; the risk is a _missing summary_ — mitigated by the tool-name fallback.
   **needs-render:** a summary-less `Tool` still reads fine collapsed.
4. **HYBRID status visual across six themes (token-VALUE-adjacent → six-theme sweep required,
   Meta #161).** The two fills (`bg-warning`/`bg-destructive`) must clear AA foreground in all
   six; the `/10` washes may be too faint on dark/blueprint (08 §G.4). Confirm `complete`'s
   wash reads distinct from `pending`'s neutral and the two fills read more prominent than the
   washes. If a wash is too faint on dark, bump to `/15` on dark grounds (a className tweak, 08
   precedent — not a token).
5. **The `Timeline` move risks the markdown WYSIWYG.** `markdown-preview.test.tsx:53` locks the
   `:::timeline`→`Timeline` mapping; the move changes the import + the node's color source
   (local `NODE_STYLE` → canonical map, intended-identical). **needs-render:** the
   Source→Split→Preview transition after the move, six themes; keep the test green.
6. **`memo` + compound interplay.** `ChainOfThought` parts are `memo`'d
   (`chain-of-thought.tsx:33,62,99`); keep `AgentStep` `memo`'d to avoid a long-transcript perf
   regression (interaction-guidelines >50-row rule). **needs-render** a 50+-step `AgentTimeline`.

---

## Net: what this adds vs [05](05-execution-traces.md)

- **Corrects TRACE-6** — editor `Timeline` is a _markdown-subpath_ surface, so the hoist is a
  MOVE + a `markdown/index.ts` re-point (not a generic editor re-export); the array-vs-compound
  mismatch resolves to _one rail, two front doors_ (not a merge).
- Pins the **canonical 7-state `Status` enum** + two typed mappers, and resolves the **HYBRID
  visual** (washes for calm incl. `complete`; fills only for the two attention states — green
  stays deliberate per 08).
- Keeps `ToolResultCard` a **separate component** (anti-boolean-prop), and makes
  **JSON-behind-disclosure the package default** (`ToolHeader.summary` + `ToolDetails`).
- Discovers the status sprawl is **five idioms** (adds `test-results.tsx`, `sandbox.tsx`) and
  the raw-palette bug is **systemic** (adds `schema-display`/`commit`/`terminal`).
- Extends the boundary hook + adds **`check-timeline-fork.mjs`** (the 09 analogue) and a
  **`palette:check`** ratchet (the 07/08 analogue).

Supersedes the execution-trace specifics in [05](05-execution-traces.md);
[05](05-execution-traces.md) remains the finding-level register (TRACE-1..7).
