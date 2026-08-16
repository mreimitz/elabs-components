# 05 · Agent execution traces + the approval boundary

The execution-trace stack is the single largest contributor to "debug console
styled as a chat app." Root cause: **six trace components were vendored individually
from Vercel AI Elements with no shared contract, so the same agent run renders as six
unrelated idioms** — and the most technical of them (`Tool`) is JSON-first by
construction. Plus the one moment that should dominate (the approval) is the _least_
prominent card on screen.

Findings: TRACE-1..7, APPROVE-1..5, TRACE-5/APPROVE-4 (the status-colour bug).

> **The execution-trace specifics are refined and superseded by
> [10-execution-trace-grammar.md](10-execution-trace-grammar.md)** (the top-down
> grammar: two shared `@qlik-coe-emea/qlabs-components-ui` leaves — a 7-state `StatusBadge` + the editor
> `Timeline` moved to `@qlik-coe-emea/qlabs-components-ui` — composed into `AgentTimeline`/`AgentStep` +
> `ToolResultCard`, with JSON-behind-disclosure as the package default; it corrects
> TRACE-6, finds the status sprawl is five idioms, and adds the gates). The
> **approval boundary** (APPROVE-1..5) is refined separately by
> [11-message-approval-grammar.md](11-message-approval-grammar.md) (`ApprovalCard` =
> enhance `Confirmation` + the `role="group"` a11y correction). This doc remains the
> finding-level register (TRACE-1..7, APPROVE-1..5).

## 1. Six idioms, one run (TRACE-1) — `missing-component`

| Trace            | Container today                       | `file:line`                       |
| ---------------- | ------------------------------------- | --------------------------------- |
| `Tool`           | bordered `rounded-md` box             | `tool.tsx:24`                     |
| `Plan`           | `Card` (shadow-none)                  | `plan.tsx:45`                     |
| `ChainOfThought` | borderless vertical step list         | `chain-of-thought.tsx:52,109-128` |
| `Task`           | borderless block, left-border content | `task.tsx:62`                     |
| `Reasoning`      | borderless inline text                | `reasoning.tsx:130`               |
| `Checkpoint`     | inline row + `Separator`              | `checkpoint.tsx:13-21`            |

Stacked vertically these read as unrelated widgets, not one agent working.

**Fix — one execution grammar:** an **`AgentStep` / `AgentTimeline`** primitive in
`@qlik-coe-emea/qlabs-components-ai` — a single vertical rail with nodes of `icon + name + StatusBadge +
business-readable summary`. Converge `ChainOfThought`, `Task`, and inspect-only
`Tool` calls onto it. Keep `Plan` (a proposed plan ≠ an executed step) and
`Checkpoint` (a divider) distinct, but harmonize their container tokens with the rail.

**Don't fork a third timeline (TRACE-6):** `@qlik-coe-emea/qlabs-components-editor` already ships a `Timeline`
with the identical `done|active|pending` grammar (`editor/src/timeline/timeline.tsx:10-36`),
unreachable across the dep boundary. Hoist a shared rail into `@qlik-coe-emea/qlabs-components-ui` that both
editor's `Timeline` and `@qlik-coe-emea/qlabs-components-ai`'s `AgentStep` build on. **Architect-gated.**

---

## 2. JSON by default → behind disclosure (TRACE-2, TRACE-3)

### The defect

`Tool` is JSON-first **by construction**:

- `ToolInput` always pipes params through `CodeBlock language='json'` (`tool.tsx:111-120`).
- `ToolOutput` `JSON.stringify`s any object and even wraps string output as
  `language='json'` (`tool.tsx:127-156`).
- There is no summary slot and no disclosure gate — the technical payload is the
  default _and only_ view. The scenario shows raw SQL (`agentic-workspace.stories.tsx:713`)
  and `{rows, q3_total…}` as primary transcript content.

### The fix — business-readable by default

- **`Tool` (component-internal):** a `ToolHeader` business summary line ("Searched 3
  filings", "Reconciled 8 rows · +12.4% QoQ") + a nested **"Show technical details"**
  collapsible holding `ToolInput`/`ToolOutput` JSON, **collapsed by default**. Add an
  optional `summary` slot to `ToolContent`.
- **`ToolResultCard` (TRACE-3, new surface):** for tool calls that _produce an
  artifact_ (chart/table/file), present the rendered output as the **headline** on a
  light-elevation card (no muted "Result" debug heading), with params/raw output
  behind the same disclosure. In the scenario, `renderChart` → `ToolResultCard`;
  `searchFilings`/`queryWarehouse` → summarized `Tool`. `ToolResultCard` is the bridge
  where "an agent produced this" becomes "here is the insight."

> JSON-behind-disclosure should be the **package default**, not a per-scenario
> opt-out — every consuming app gets a calm activity log for free.

---

## 3. Status: one vocabulary, and a real bug (TRACE-5 / APPROVE-4) — `missing-component` + theme-safety

Status is represented three incompatible ways: `Tool`'s `getStatusBadge` (always a
grey `secondary` badge with coloured icons, `tool.tsx:43-68`), `ChainOfThought`'s
text-opacity (`chain-of-thought.tsx:93-97`), and `Confirmation`'s `Alert` variant
(`confirmation.tsx:72-96`). `Badge` itself has no status semantics.

**The latent bug:** `getStatusBadge` hardcodes raw Tailwind palette colours —
`text-yellow-600` / `text-blue-600` / `text-green-600` / `text-orange-600` /
`text-red-600` (`tool.tsx:54-60`). This violates the tokens-only rule
(`styling-and-tokens.md`), **won't track the six themes**, and means
completed/error/awaiting differ only by a tiny icon (the grey badge body is constant).

**Fix — a token-driven `StatusBadge` in `@qlik-coe-emea/qlabs-components-ui`** mapping semantic status
(pending / running / complete / awaiting-approval / denied / failed / skipped) →
`Badge` variant + icon via `success`/`warning`/`destructive`/`info`/`secondary` + the
status-subtle surfaces (TYPE-6). Re-point `Tool`, `ChainOfThought`, and
`Confirmation`. This is where "green = done/approved" is decided once.

> **File the raw-colour theme-safety bug as its own issue regardless of the
> redesign** — it's a standalone tokens-only violation (`needs-render`: confirm on
> blueprint/high-contrast that the `-600` icons render off-token).

---

## 4. Scenario density (TRACE-4) — `scenario-composition`

Five traces are `defaultOpen` simultaneously — Plan (`:620`), ChainOfThought (`:650`),
Tool#1 (`:682`), Tool#3 chart (`:726`), Task (`:804`) — plus Reasoning auto-opens;
only Tool#2 is collapsed. Two raw-JSON blocks dump at once → a wall.

Compounded by component defaults that lean open: `Task` defaults `defaultOpen=true`
(`task.tsx:32`), `Reasoning` auto-opens from duration (`reasoning.tsx:65`).

**Fix:** once TRACE-1/2 give traces a calm collapsed-summary state, default-open
**only** the chart (`ToolResultCard`) and the final summary; collapse Reasoning,
ChainOfThought detail, and inspect-only tools to their one-line summary. Reconsider
`Task`'s open-by-default at the component layer. Pair an opinionated "transcript
density" with the `AgentStep` grammar so the calm default ("collapsed summaries, one
focal expansion") doesn't need five hand-tuned `defaultOpen` flags per scenario.

`Task` itself (TRACE-7) is misused as a completion summary while wearing a search
idiom (default `SearchIcon` `task.tsx:44`, bordered file pills `:10-20`) — route the
"what got done" recap to the `ToolResultCard`/run-summary surface, or at minimum drop
the search icon + bordered pills and cross-link the produced-asset tree.

---

## 5. The approval is the LEAST prominent card — exactly backwards (APPROVE-1/2/3) {#approval}

The maintainer's intent — "approval requests must read as control boundaries more
important than normal chat" — is contradicted **at the component layer**.

### Why (APPROVE-1, P0)

`Confirmation` derives its tone from `resolvedVariant`, which is `undefined` until the
decision is _resolved_ (`confirmation.tsx:72-76`). In the `approval-requested` state —
the moment that demands attention — `Alert` falls back to its `default` variant
(`bg-card` + base `rounded-lg border`, `alert.tsx:6,10`), the **same kind** of
treatment as the `Tool` card above (`tool.tsx:24`). **Colour and elevation arrive
only after the user has already decided.** That is the #1 driver of "I can't tell an
approval from an execution step," and it's component-internal — fix once.

### The `ApprovalCard` treatment

1. **Pending container (APPROVE-1):** an attention surface — status-subtle tint +
   **brand left accent rail** + `border-border-strong` + `shadow-sm` — so it lifts
   above the flat trace cards. Keep the resolved success/destructive tint (it works).
2. **Button grammar (APPROVE-2):** Deny = `ghost` (or subtle-destructive), **never
   `outline`** (the `border-input` black-outline bug, §[02-3a](02-systemic-backbone.md));
   Approve = filled green default (already correct, `button.tsx:11,27`). Encode the
   pairing _inside_ the card so consumers can't re-introduce `outline`.
3. **Three zones (APPROVE-3):** question (up the type scale) → a
   **`ConfirmationDescription`/consequence** slot ("Posts the final note to #finance;
   visible to 42 people") → a **visually separated action band** (a `border-strong`
   divider or tinted footer). Mirror the `AlertDialog` title/description/footer
   convention already in `@qlik-coe-emea/qlabs-components-ui`.

Promote this into a first-class **`ApprovalCard`** so every consumer gets the boundary
treatment — the difference between "a step ran" and "a human must decide" is then
encoded in the component layer where it can't drift back.

### `Checkpoint` is a lighter control sibling (APPROVE-5)

The restore trigger is `text-muted-foreground` + `ghost` (`checkpoint.tsx:15,35-37`)
— it changes agent state but reads weaker than body text. Make it _read_ as
actionable (leading icon + non-muted label, subtle hover) **without** escalating to
the approval treatment (budget: one focal control gesture per region — `ApprovalCard`
owns that).

---

## 6. Build order within this cluster

```
StatusBadge (@qlik-coe-emea/qlabs-components-ui, + status-subtle tokens)        ← leaf dep of everything; also fixes the raw-colour bug
   └─► shared Timeline rail (@qlik-coe-emea/qlabs-components-ui, architect)
          └─► AgentStep / AgentTimeline (@qlik-coe-emea/qlabs-components-ai)     ← converge ChainOfThought, Task, inspect tools
   └─► Tool "Show technical details" disclosure
          └─► ToolResultCard (@qlik-coe-emea/qlabs-components-ai)                ← chart/table/file as headline
   └─► ApprovalCard (promote Confirmation)              ← pending treatment + button grammar + 3 zones
Scenario re-wire (defaultOpen, Task→run-summary)        ← last, once components support calm defaults
```

`StatusBadge` first — it's a dependency of `AgentStep`, `Tool`, and `ApprovalCard`,
and it independently fixes the theme-safety bug. Scenario re-wiring last.
