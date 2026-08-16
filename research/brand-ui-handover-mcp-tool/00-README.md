# brand-ui upstream handover pack

**For the repo owner — read this file, then hand over one batch at a time.**

Six batch prompts, each **self-contained** (no links out, every claim inlined) and sized to roughly one
coding-agent session in the **brand-ui monorepo** (`mreimitz/qlabs-components`). They come from ~9 months
of building a dense operator app (MCP Token Footprint) under a hard "every visible element is `@brand/*`"
rule — so every item is a place that rule couldn't be honoured, or was honoured only by building a
wrapper the library should own.

**70 issues.** All claims re-verified against **brand-ui v1.9.0 source** on 2026-08-01 (the tarballs in
`vendor/brand/` ship full `src/`, so line numbers below point at real upstream files).

---

## How to hand over

Paste **one batch file's contents** into a fresh coding-agent session running in the brand-ui monorepo.
Don't paste two at once — they touch different packages and the dedupe/quality gates differ.

### Run order (matters)

| #     | Batch                                              | Package                        | Why this position                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | [`01-tokens-and-type.md`](./01-tokens-and-type.md) | `@brand/tokens`                | **First.** Contrast, semantic-token collisions, the missing elevation ramp and the type scale change _every screenshot in every other batch_. Doing these later means re-reviewing everything.                                                                                                                                                                                          |
| **2** | [`02-ai-composer.md`](./02-ai-composer.md)         | `@brand/ai`                    | Independent of batch 1 — **can run in parallel**. Contains the single worst shipped defect (the stop button cannot render).                                                                                                                                                                                                                                                             |
| **3** | [`03-api-seams.md`](./03-api-seams.md)             | `@brand/ui`                    | Mechanical and low-risk (add `as`, add `title`, add `max-w`, open a closed props interface). 13 issues, high volume, small diffs. Best value-per-hour in the pack.                                                                                                                                                                                                                      |
| **4** | [`04-data-and-charts.md`](./04-data-and-charts.md) | `@brand/data`, `@brand/charts` | Bigger API surface changes (pinning, row clicks, chart click handlers, a non-time x-scale). Needs design judgement.                                                                                                                                                                                                                                                                     |
| **5** | [`05-new-components.md`](./05-new-components.md)   | `@brand/ui`                    | Net-new components: `ViewToolbar`, `IconButton`, dialog tiers, the form kit. Largest design surface — do it once the token/API foundations are settled.                                                                                                                                                                                                                                 |
| **6** | `brand-ui-upstream-prompt.md`                      | `@brand/ai`                    | **Already written and already handover-ready** — it lives at `roadmap/assistant-hub/brand-ui-upstream-prompt.md` in this repo and was authored _for_ the brand-ui monorepo (no cross-repo links). Copy it over verbatim. Covers the 7 model-emittable message components (`MessageForm`, `MessageTable`, part-grouping, edit-in-place, feedback, quote toolbar, streaming suggestions). |

Batches 1 and 2 can run concurrently. 3 → 4 → 5 are best sequential; 5 assumes 1 and 3 have landed.

---

## Shared preamble — prepend this to every batch

> Each batch file already opens with this. Repeated here so you know what the agent is being told.

```
You are working in the brand-ui monorepo (packages/{ui,data,ai,charts,flow,tokens,editor,…},
registry/blocks, Storybook).

Before writing any code, read this repo's own contribution docs and follow its maintainer workflow
(the `brand-ui-component` skill if available: dedupe gate → component API rules → quality gates →
manifest regeneration). Everything in this brief SUPPLEMENTS — never overrides — the repo's own rules.

MANDATORY, EVERY ITEM:
1. DEDUPE GATE FIRST. Verify the gap still exists at HEAD before changing anything. This brief was
   verified against v1.9.0; HEAD may have moved. Record a dedupe verdict per item. If an item is
   already fixed, say so and move on — do not invent work.
2. NON-BREAKING BY DEFAULT. These are all additive: a new optional prop, a new export, a token that
   didn't exist. If an item genuinely cannot be done without a breaking change, STOP and report it
   rather than shipping the break.
3. TOKENS ONLY. No raw hex/rgb/hsl in any component. Everything from @brand/tokens. Correct in every
   shipped theme, verified by looking, not assumed.
4. A11Y IS PART OF ACCEPTANCE, not a follow-up: keyboard operability, visible focus, labels/roles,
   focus management, and correct semantics (a heading is an <h*>, a mixed checkbox looks mixed).
5. DELIVERABLES PER ITEM: implementation · stories covering the states named in the item · docs page ·
   exported types · tests per repo convention · manifest regeneration.
6. HONEST REPORTING. Per item, state (a) what shipped, (b) what you deliberately left out, (c) what you
   did NOT verify. Do not report "done" for something you did not run.
7. DO NOT SILENTLY EXPAND SCOPE. If a locked design choice in this brief looks wrong for the library,
   stop and report the conflict instead of improvising around it.

Each item below gives: SYMPTOM (what the consuming app hit) · UPSTREAM (the file/line at v1.9.0) ·
CURRENT (the actual shipped code) · FIX (the ask) · ACCEPTANCE (how to know it's done).
```

---

## Source-path map

The brief cites paths as they exist inside the published tarball's `src/`, which mirror the monorepo:

| Brief cites                                       | Monorepo                                       |
| ------------------------------------------------- | ---------------------------------------------- |
| `ui/src/components/<name>/<name>.tsx`             | `packages/ui/src/components/<name>/<name>.tsx` |
| `data/src/data-table/data-table.tsx`              | `packages/data/src/data-table/data-table.tsx`  |
| `ai/src/composer.tsx`, `ai/src/prompt-input.tsx`  | `packages/ai/src/…`                            |
| `charts/src/charts/<name>.tsx`                    | `packages/charts/src/charts/<name>.tsx`        |
| `tokens/src/themes.css`, `tokens/src/density.css` | `packages/tokens/src/…`                        |

If the monorepo's layout differs, the agent should locate by filename — the component names are stable.

---

## Do NOT file these

Chased and rejected during this project. Re-raising them wastes a session.

**Already fixed in v1.9.0** — we verified these on 2026-08-01 and they are _closed_. Our app still
carries dead workarounds for them (a separate cleanup task on our side, not brand-ui's):

- `FlowNode` hardcoding top/bottom handles — **fixed**: v1.9.0 takes a `handles?: FlowNodeHandles`
  config for all four sides (`FLOW_ALL_SIDE_HANDLES`) and honors `sourcePosition`/`targetPosition`
  (`flow/src/flow-node/flow-node.tsx:15-110`).
- No smoothstep edge — **fixed**: `flow/src/flow-edge/` and `flow/src/flow-smart-edge/` both ship.
- No flow group/lane primitive — **fixed**: `flow/src/flow-group-node/` ships.

**Rejected on the merits** (from our own design review — these are taste, not defects): raising
`active:scale`, icon-size normalization, concentric radius math, `text-base sm:text-sm`, and
logical-property conversion.

**Working well — do not regress:** `Charts/AutoChart` and `AI/ChangeReview` are explicitly the _quality
bar_ the batch-6 components should match (spec-driven, never-throws, controlled+uncontrolled, per-part
override renderers). `@brand/ui` `Tree` is the right answer for file explorers. The `-text` on-tint
tokens exist and pass contrast — batch 1 must not disturb them.

---

## One caveat to pass on

Measured values (contrast ratios, character counts, column counts, control heights) come from audits run
against our app during 2026-06/07, not from a re-measurement today. The _code_ claims are all re-verified
at v1.9.0; the _numbers_ should be treated as "this is what it measured when we hit it". Each item's
ACCEPTANCE is written so the agent re-measures rather than trusting our figure.
