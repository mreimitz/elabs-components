# Structural design: the Agentic AI Workspace redesign

**Status:** research / diagnosis — _no product code changed._
**Date:** 2026-06-09
**Surface under study:** `scenarios-agentic-ai-workspace--default`
(`packages/ai/src/agentic-workspace.stories.tsx`)
**Method:** 8 read-only specialist finders (root-cause sweep across components,
the token/theme layer, and the scenario composition) + this synthesis. Every
claim cites a `file:line`.

---

## Why this folder exists

A maintainer reviewing the Agentic AI Workspace scenario raised three complaints
and asked for the **root cause of each** (is it a component setting, a theme
problem, or a layout problem?) plus a **holistic concept** that fixes them now
**and** holds long-term — "a solid list of fixes, where, and why there." This
folder is that answer. The explicit instruction was: _do not redesign the
product; keep the three-column information architecture; substantially improve
visual hierarchy, readability, component consistency, and the distinction
between interaction types._

The three complaints:

1. The **right context panel doesn't animate** open/close like the left sidebar.
2. The **produced-assets tree + markdown preview are the loudest text on screen**,
   the tree is in a **different font**, the markdown is shown as **source not
   rendered**, and there's no **drill-in** (click an asset → focused view + a
   back button). _Maybe the panel should be a real `@qlik-coe-emea/qlabs-components-ai` component._
3. The whole scenario reads **flat / chaotic / noisy** — too many interaction
   types share one treatment (white bg + thin border + small font), so user
   posts, agent posts, approvals, steps, tool results, assets, evidence and
   suggestions all blur together. It should feel like a **calm enterprise AI
   workspace, not a debug console styled as a chat app.**

---

## The verdict (honest core diagnosis)

**This is not a scenario-styling problem. It is a missing systemic backbone plus
a missing shared component grammar — the scenario is mostly an innocent witness.**

Three findings settle the systemic-vs-spot-fix question decisively:

- **There is no type scale at all.** `themes.css` defines exactly two typography
  tokens (`--font-sans` in `:root`; `--font-mono` only inside `blueprint`). The
  `@theme inline` bridge maps colour + radius + motion and **nothing** for
  size/line-height/tracking/weight. Component source carries **193 `text-sm` +
  133 `text-xs` = 326 small-text uses** against ~15 uses of anything `text-lg`+.
  The flatness is the aggregate of hundreds of independent `text-sm` choices —
  it _cannot_ be fixed in the scenario. (See [02-systemic-backbone.md](02-systemic-backbone.md).)

- **The "harsh border" and the "border noise" are two different defects on two
  different tokens.** The harsh outline (Share, Deny, suggestion chips, composer)
  is `--input` — the deliberately dark, AA-strong, _form-field_ border rung
  (`oklch(0.65 …)`, pure black in high-contrast) — being borrowed by low-emphasis
  controls via the `outline` button variant. The "everything is the same box" is
  the _subtle_ hairline `--border` applied uniformly so the border channel carries
  zero type information. Neither is fixed by "make the border lighter."
  (See [05-... buttons section in 02](02-systemic-backbone.md) and the grammar.)

- **The differentiation tokens already exist and are orphaned.** Purpose-built
  `--chat-user` / `--chat-assistant` tints are defined in all six themes and wired
  to Tailwind utilities — and have **zero consumers**; `Message` uses `bg-secondary`
  (≈ white) instead. Surface-elevation tokens (`--surface-muted`,
  `--surface-elevated`) exist but are barely used. The channels for a calm grammar
  are tokened — components just don't reach for them.

So the fix is a **token/theme re-encoding + a small set of shared components every
consumer inherits**, exactly the "systemic over additive widget kit" preference in
`.claude/rules/conceptual-framing.md`. Patching the story would "work" on this one
screen and silently re-break in every other app.

### Where the fixes live (the layer the maintainer asked about)

| Layer                                                    | Share | What it covers                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **token-theme** (systemic — every scenario benefits)     | ~30%  | the missing type scale; `--font-mono`/`--font-display` in `:root`; revaluing `--chat-user` (2 themes). _Refined ([08](08-separation-surface-system.md)): the separation channels need **no new tokens** — the `bg-<status>/10` wash + `border-s-<role>` rail + the surface ladder cover them, so this is a convention, not a token pile._ |
| **component-internal** (fix once, all consumers inherit) | ~35%  | `Tool` JSON-by-default; `Confirmation` neutral-while-pending; `MessageContent` ignores chat tokens + forces `text-sm`; `Suggestion` outline default; `CardTitle` unsized; `FileTree` hardcoded mono                                                                                                                                       |
| **missing-component** (a real gap)                       | ~25%  | `ContextPanel`/drill-in; `AgentStep`/`StatusBadge`; `ToolResultCard`; `ProducedAssetTree`/`AssetPreview`; `Text`/`Heading`; a branded markdown renderer for `@qlik-coe-emea/qlabs-components-ai`                                                                                                                                          |
| **component-choice** (wrong component used)              | ~7%   | `FileTree` for documents; `CodeBlock` for markdown; `outline` for cancel; `Task` as a completion summary                                                                                                                                                                                                                                  |
| **scenario-composition** (the only true story fixes)     | ~3%   | conditional-mount rail; five `defaultOpen` traces; KPI #4 bakes its delta into the value; missing `BrandMotionConfig`                                                                                                                                                                                                                     |

The scenario itself contributes **three** border lines and a handful of wiring
slips. Everything else is upstream.

---

## The holistic concept in one picture

Re-encode the existing semantic system into **more channels than just "border"**,
then give each interaction type **one channel**:

```
                 channel it owns                    lives in
user message     filled --chat-user tint + avatar   @qlik-coe-emea/qlabs-components-ai  Message → UserMessage
agent answer     quiet ground + green accent rail    @qlik-coe-emea/qlabs-components-ai  Message → AgentMessage
approval         attention surface + accent rail     @qlik-coe-emea/qlabs-components-ai  Confirmation → ApprovalCard
agent step       timeline rail + StatusBadge         @qlik-coe-emea/qlabs-components-ai  AgentStep (new) + @qlik-coe-emea/qlabs-components-ui StatusBadge
tool result      light elevation, no debug heading   @qlik-coe-emea/qlabs-components-ai  ToolResultCard (new)
KPI              size/weight (headline tier)          @qlik-coe-emea/qlabs-components-ui  MetricCard (+emphasis)
evidence         green-tinted chip                    @qlik-coe-emea/qlabs-components-ai  EvidenceChip (new)
produced asset   sans, no box, type icons             @qlik-coe-emea/qlabs-components-ai  ProducedAssetTree (new)
suggestion       soft neutral pill                    @qlik-coe-emea/qlabs-components-ai  Suggestion (default change)
composer         soft fill + focus ring               @qlik-coe-emea/qlabs-components-ai  PromptInput / CommandComposer
context rail     animated, drill-in, back button      @qlik-coe-emea/qlabs-components-ai  ContextPanel (new)
```

Type hierarchy comes from a **7-role type scale** (display / title / subtitle /
body / meta / kpi / code) declared once in `:root`. Border noise drops because a
fill / rail / elevation / gap now separates regions — borders are kept only where
they're the _only_ structural cue (the `styling-and-tokens.md` redundant-boundary
test). Green stays reserved for primary actions, completed status, evidence and
positive deltas.

---

## How to read this folder

| Doc                                                                | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [00-findings-register.md](00-findings-register.md)                 | The full evidence base — every finding, re-ID'd and deduped, with `file:line`, layer and severity.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [01-root-cause-map.md](01-root-cause-map.md)                       | The master table: each complaint + each design goal → symptom → root cause → layer → where the fix lives. The "analyze every problem and why" deliverable.                                                                                                                                                                                                                                                                                                                                                            |
| [02-systemic-backbone.md](02-systemic-backbone.md)                 | The keystone: the type scale + token additions (the bulk of "flat / chaotic / harsh borders").                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [07-type-system-integration.md](07-type-system-integration.md)     | **Refines 02 §1–2** — the type scale as the fifth systemic dial: native Tailwind v4 mechanism (no `@utility`), the `Text`/`Heading` API, per-user reach-for, the 6-re-point migration, governance, and the render-gated open values. Routed through the design-system architect.                                                                                                                                                                                                                                      |
| [08-separation-surface-system.md](08-separation-surface-system.md) | **Refines 02 §3–4** — the surface/separation system: the five channels (fill / rail / elevation / divider / border), why it's a token-light convention not a sixth dial, **zero new token names + one `--chat-user` revalue**, no generic `<Surface>` primitive, and how it composes with the decoration overlay for free. Architect-routed.                                                                                                                                                                          |
| [03-component-grammar.md](03-component-grammar.md)                 | The 14 interaction-type treatments (current → target → layer → new vs edit).                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [11-message-approval-grammar.md](11-message-approval-grammar.md)   | **Refines 03 §1–3,6–8 + 05 §5** — the message/approval/evidence/KPI grammar, the **lightest** cluster (assembles 07+08+10): `UserMessage`/`AgentMessage` thin preset wrappers + a `cva emphasis="answer"` rail; `ApprovalCard` = enhance `Confirmation` + `role="group"`; `EvidenceChip` re-skin; `MetricCard emphasis`. Corrects `MetricGrid` ownership; files the unguarded `noopener` + `is-user:dark` fixes. Architect-routed.                                                                                    |
| [04-context-panel-and-assets.md](04-context-panel-and-assets.md)   | Complaints 1 & 2: the `ContextPanel` (animation + drill-in + back), `ProducedAssetTree`, `AssetPreview`, and the branded-markdown / prose-primitive question.                                                                                                                                                                                                                                                                                                                                                         |
| [09-context-panel-integration.md](09-context-panel-integration.md) | **Refines 04 §1–3, §6** — the `ContextPanel` component top-down: collapse via an extracted `@qlik-coe-emea/qlabs-components-ui` `useCollapsiblePanel` (Sidebar re-pointed byte-identically), drill-in v1 = CSS `translateX` track behind a v2 `useViewTransition` seam (VT-01 is its proof case, not a blocker), the doc-13 provider + external trigger, mobile `Sheet`, the full drill-in a11y spec, and `InspectorPanel` convergence. Architect-routed.                                                             |
| [05-execution-traces.md](05-execution-traces.md)                   | The unified `AgentStep` + `StatusBadge` + `ToolResultCard` grammar and JSON-behind-disclosure.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [10-execution-trace-grammar.md](10-execution-trace-grammar.md)     | **Refines 05** — the trace grammar top-down: two shared `@qlik-coe-emea/qlabs-components-ui` leaves (a 7-state `StatusBadge` on the existing `Badge` cva with a hybrid wash/fill visual; the editor `Timeline` **moved** to `@qlik-coe-emea/qlabs-components-ui`), composed in `@qlik-coe-emea/qlabs-components-ai` into `AgentTimeline`/`AgentStep` + `ToolResultCard`, with JSON-behind-disclosure as the package default. Corrects TRACE-6, finds the status sprawl is 5 idioms, adds two gates. Architect-routed. |
| [06-phased-plan.md](06-phased-plan.md)                             | The build sequence (Phase 0 → 3), quick wins vs structural, dependency order, and the required gates.                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## Honest scope (what was run vs read vs assumed)

- **Source-verified (Observed):** every `file:line` in these docs was read in the
  current tree. The type-scale counts, the orphaned `--chat-user` tokens, the
  `--input`-vs-`--border` lightness gap, the conditional-mount rail, the
  `CodeBlock`-for-markdown choice, the `FileTree` `font-mono`, the `outline` Deny,
  the `Confirmation` neutral-while-pending path, and the JSON-first `Tool` are all
  read directly.
- **Not run this session (needs-render):** these are _diagnoses from source_, not a
  rendered six-theme sweep. Perceptual magnitudes ("loudest text," "harsh," "blends
  in") and any **`themes.css` token-value edit** must be confirmed by a
  `brand-ui-visual-ux-reviewer` six-theme sweep on this real scenario **before
  building** — token usage never proves theme-safety (`quality-gates.md`). The
  consolidated list is in each doc's "needs-render" note and in
  [06-phased-plan.md](06-phased-plan.md).
- **Process note:** this synthesis was written by the main agent after the 8 finder
  subagents completed; the workflow's dedicated synthesizer agent died on a transient
  socket error, so the merge/dedup was done by hand from the full finder outputs
  (cached at the run transcript). No finding was dropped.
- **No fix was applied.** Per `.claude/rules/issue-workflow.md`, the next step is to
  file these as GitHub issues (`/file-issue`, routed through
  `brand-ui-root-cause-analyst`) and build from the issues — finders report, builders
  fix. Structural/API items (`ContextPanel`, prose-primitive promotion, a shared
  `Timeline`, new subpaths) must route through `brand-ui-design-system-architect`.
