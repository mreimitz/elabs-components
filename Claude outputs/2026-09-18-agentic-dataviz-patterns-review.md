# Agentic data-visualization patterns — six Dribbble shots vs brand-ui

Date: 2026-09-18
Sources under review (all by the same designer, "Nizam", published Aug–Sep 2026):

| #   | Shot                                                                | Product       | Domain                                    |
| --- | ------------------------------------------------------------------- | ------------- | ----------------------------------------- |
| 1   | dribbble.com/shots/27704967 — Vero, AI-Powered Revenue Intelligence | Vero (light)  | AI revenue ops — briefing, records, audit |
| 2   | dribbble.com/shots/27686671 — Vero (second post)                    | Vero (dark)   | Same product, dark theme + deck pages     |
| 3   | dribbble.com/shots/27690209 — Rillo, Expense & Receipt Intelligence | Rillo         | AI expense ops — queue, ledger, agents    |
| 4   | dribbble.com/shots/27676712 — Rillo (second post)                   | Rillo         | Same product, analytics + deck pages      |
| 5   | dribbble.com/shots/27657280 — Salach.ai, AI Sales Conversation      | Salach.ai     | Call transcript + coaching                |
| 6   | dribbble.com/shots/27725897 — OrchestrateIQ, AI Agent Management    | OrchestrateIQ | Agent observability — traces, cost        |

Method: every media attachment of the six shots was downloaded at full resolution (73 files, 58 unique after de-duplication) and read screen by screen; every recurring visual device was catalogued, then cross-checked against `packages/ui`, `packages/charts`, the registry (`registry/registry.items.json`, 52 items before this review) and the type scale in `packages/tokens/src/themes.css`. Nine blocks were then built from the catalogue with existing packages only, rendered in Storybook in both reference themes and at narrow widths, and passed through `pnpm check`, `pnpm gen:check`, `tsc`, `eslint` and the Storybook a11y/vitest project (28 stories, all green).

## 1. What these screens are actually doing

The six shots read as one school. Underneath the different palettes (Vero's teal-on-ink, Rillo's black-and-yellow, Salach's coral, OrchestrateIQ's blue) the same nine devices carry almost every screen. In order of how often they appear:

1. **Provenance on every number.** A figure never stands alone: "Stripe · 2 min ago", "Derived from 61 deals · 06:02", "Calibrated model · 06:02", "Every figure below names its source". The third line of a KPI is not a sparkline, it is the source and the freshness.
2. **The fact, then the why, then the evidence.** Every insight is a one-sentence headline, a paragraph explaining what was read and what was left alone, a row of evidence chips (Email thread / Meeting / Invoice / Product event), a confidence, and two actions. A conflict item deliberately carries no confidence: "No verdict — a person decides".
3. **Countable meters instead of percentage bars.** Evidence strength is `|||| 4 of 5`; utilisation is a strip of ticks; spend by provider is a dashed bar. Five discrete facts are drawn as five marks, and the reader can count them.
4. **A ceiling mark on every bar.** Spend-against-limit bars carry a vertical tick at the agent's own limit; the bar keeps growing past it in red. Revenue bars carry a "target $155k" rule. Cost lines carry a "Budget $360/day" dashed rule. A bar without a reference line does not appear anywhere in the six shots.
5. **Signed contribution lists.** "Why the score is 91": one row per signal, a bar whose length is |points| and whose side is the sign, ink for positive and amber for negative, with the signed number printed. "Why it moved" on the automation-rate chart does the same with +18.2 pts / +14.6 pts.
6. **Status as glyph + word, actor as glyph.** Applied / Held / Stopped / Reverted pills all carry an icon; Auto / Review / Hold carry a dot and a word; the audit actor column tells the copilot (sparkle) from a delegated agent (bot glyph) from a person (monogram). Nothing rides on hue alone.
7. **The decision record as the primary object.** "What it did / What it looked at / What rule applied / How confident / How to reverse it" — five labelled rows, the rule in monospace, an honest "Not applicable" where the system declined to state a confidence.
8. **The dial that says where autonomy ends.** Rillo's escalation boundary: a stacked distribution bar of all decisions by evidence rung, a threshold mark, an evidence ladder, and "If you move it" cards that state the trade in the reader's own units (cleared share, queue delta, catches, reviews per catch).
9. **Deck typography inside the product.** The same shots include pitch-deck pages: a 48–56 px semibold headline with −0.02 em tracking, a 20 px grey lede, numbered rule rows, a stat trio of 56 px numbers with 14 px captions, an "Independent" source tag, and a left-rule pull quote. The product screens borrow the discipline (one display line, one lede, then tables) and the deck borrows the product's tokens.

What is _not_ there is as telling: no donuts, no gauges, no gradient area charts except OrchestrateIQ's one hero chart, no dashboards of six unrelated tiles, no colour-coded everything. Charts are rare and small; tables, lists and single big numbers do most of the work. Colour is reserved for three meanings — AI-derived (teal/blue), needs a person (amber), blocked (red) — and grey ink does the rest.

## 2. Coverage map: device → brand-ui today → what this review adds

| Device (§1)                                  | brand-ui before                                                                           | Gap                                                                     | Shipped now                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Provenance line on a KPI                     | `KpiAsOf` (one footnote per card), `MetricCard.description`                               | no per-figure source · freshness rung; no "derived from N" form         | `ProvenanceLine` (parts) + `kpi-provenance-strip-01`  |
| Insight feed w/ evidence + confidence        | `Timeline`, `StatList` transaction feed, ai `Sources`/`Reasoning` (chat-scoped)           | no numbered fact/why/evidence/actions item; no "no verdict" state       | `insight-feed-01` (+ Needs a person, Derivation load) |
| Evidence chip                                | `Badge`, `StatusBadge` (both carry tone)                                                  | a chip that is a pointer at a document kind, tone-free                  | `EvidenceChip` (parts)                                |
| Countable evidence meter                     | `UnitStack` (SVG mark, chart-scoped), `Rating`                                            | an inline HTML `n of m` tick meter with an accessible name              | `EvidenceMeter` (parts)                               |
| Confidence meter                             | `Progress` (block-level, `role=progressbar`), `BoundedNumber`                             | a word-sized `role=meter` with the % printed                            | `ConfidenceBar` (parts)                               |
| Actor by glyph                               | `Avatar`, `NavUser`                                                                       | copilot / agent / person as one component                               | `ActorAvatar` (parts)                                 |
| Per-field provenance record                  | `Descriptions`, `FieldRow`, `KeyValueEditor`                                              | derived / pinned / conflict / empty states on a field                   | `provenance-record-01`                                |
| Signed contribution list                     | `infographic-variance-bridge-01` (cumulative), `BarChart` negatives (no zero-line labels) | ranked independent contributions to one score                           | `score-explanation-01`                                |
| Bar with a ceiling mark                      | `Progress.marker`, `BulletChart.target`                                                   | the "$612 of $500" over-limit row with band badge + action              | `spend-against-limit-01` (+ autonomy bands)           |
| Escalation boundary                          | —                                                                                         | the whole surface                                                       | `escalation-boundary-01`                              |
| Decision record                              | `Descriptions`, `ChangeReview`, `ConfirmDialog`                                           | the five-question record + checks + proposal                            | `decision-record-01`                                  |
| Audit table                                  | `Table`, `DataTable`, `StatusBadge`                                                       | actor-by-glyph column + result vocabulary mapped once                   | `audit-log-01`                                        |
| Execution waterfall                          | `Gantt` (sub-second modes exist, #360)                                                    | the composed trace view: stat strip + waterfall + context chain         | `agent-trace-waterfall-01`                            |
| Side-by-side verdict (Keep / Cancel)         | `infographic-before-after-01`, `Card`                                                     | two coloured verdict cards + ticked utilisation + "if you cancel" stats | not built — see §4                                    |
| Handoff inspector                            | flow `FlowEdge`, ai `AgentStep`                                                           | a path with a metric pill mid-arrow + context comparison table          | not built — see §4                                    |
| Transcript + objection scoring               | ai `Conversation`/`Message`, `Rating`                                                     | objection score bars, "jump to moment" quote cards, audio scrubber      | not built — see §4                                    |
| Live agent map                               | flow `FlowCanvas`/`FlowNode` (health `tone` exists)                                       | edge annotations ("17-cycle loop", "auth_scope missing")                | not built — see §4                                    |
| Cost line with budget rule + previous period | `LineChart`/`AreaChart` + `chart-stat-flow`, reference lines                              | nothing missing in the engine; a block would be composition only        | not built (low novelty)                               |

All nine shipped blocks are `registry:block` items in one new category, `agent-ops`, sharing one item of parts (`agent-ops-parts`) and one fictional dataset ("Atlas", the AI-ops copilot of the existing Acme Logistics world, so numbers line up with `kpi-card-parts`). Storybook path: **Patterns → Blocks → Agent Ops**. Install: `npx shadcn add <item>`; each pulls `agent-ops-parts`.

Every block was built with `@elabs-ai/components-ui` and `@elabs-ai/components-charts` only. Nothing new was added to a package. That is the finding of the gap analysis: **the primitives are there; what was missing was the vocabulary** — the same conclusion as the lieflat review (`2026-09-04-lieflat-charts-gap-analysis.md`), one layer up.

## 3. What the real runtime caught that the static gates did not

Worth recording because it is exactly why "green typecheck" is not "done":

- Three stories used `args` without a `component` annotation in `meta`. `tsc`, `eslint` and all 85 `pnpm check` rules passed; the stories threw "component annotation is missing" the moment Storybook rendered them.
- `insight-feed-01` put `@container` and the container-queried grid on the **same** element. An element cannot answer a query about its own size, so the two-column layout silently never fired at any width. Fixed with a wrapper; `kpi-provenance-strip-01`'s grid worked only because `Card` was the container and the grid its child.
- axe (the blocking a11y project) failed `kpi-provenance-strip-01`: a `<p>` (the provenance line) as a third child of a `<dl>` group is invalid — it is now a second `<dd>`, which is also semantically right. It failed `decision-record-01` on heading order: `AlertTitle` defaults to `h5` under an `h3`; `as="h4"` fixes it and the `as` prop already existed for this reason (#329).
- The provenance line first rendered "Derived from 61 open orders · CRM, 4h ago" and truncated. A derivation should name the **run** ("06:02"), not the elapsed time; a live feed should name the elapsed time ("2 min ago"). `ProvenanceLine` now picks the form by whether `derivedFrom` is set.

## 4. Gaps: what could not be built well with today's components

Ordered by how much the six shots lean on them.

1. **A `Meter` primitive (ui).** Three blocks needed a _word-sized_ inline quantity — confidence 0–1, spend vs ceiling, share of decisions — with `role="meter"`, an accessible value text and an optional reference mark. `Progress` is a block-level `progressbar` (semantically "loading"), `BulletChart` is a chart (SVG, chart a11y seam, `charts` dependency). The blocks hand-roll `<span role="meter">` three times. Recommendation: `Meter` in `packages/ui` with `value`, `max`, `marker?`, `tone?` (`neutral | success | warning | destructive`), `size` (`xs` 4 px · `sm` 8 px), `label`. `ConfidenceBar` and the spend bar then become one-liners.
2. **A `TickStrip` / discrete unit meter (ui).** `EvidenceMeter` ("|||| 4 of 5") and Rillo's dashed utilisation bars are the same thing: `n` of `m` discrete cells, coloured by tone. `UnitStack` exists but is an SVG chart mark. An HTML `TickStrip` (`count`, `of`, `tone`, `label`) would serve evidence meters, seat utilisation, verified-document counts and the sidebar "automation rate" bar.
3. **A `Chip` that is not a badge (ui).** `EvidenceChip` is a pointer at a document kind — icon + label, no tone. `Badge` and `StatusBadge` both mean "a state". A neutral `Chip` (optionally interactive, optionally removable — the same thing `FilterBar` renders for active filters) would remove a hand-rolled class string from the parts item and de-duplicate `data`'s filter chips.
4. **An `ActorAvatar` in `ui` (or `ai`).** "Who acted" — copilot / agent / person by glyph — appears in the audit log, the insight feed, the handoff inspector and the ai package's own `Message`. It belongs in the library, not a registry part.
5. **`Descriptions` label width.** The default `w-1/3` label column is far too wide for a five-row record with 12-character labels (the decision record wasted a third of its card). A `labelWidth` prop (`"1/3" | "1/4" | "auto" | "<rem>"`) is a one-line change; the block currently reaches in with `[&>div>dt]:w-40`.
6. **Reference-line labels on `BarChart`/`LineChart`.** Vero labels its target rule inline ("target $155k") and its last point ("$164k"); the engine has reference lines and `showLastValue` on `Sparkline` but no inline label on a `LineChart` reference line. Small, high-taste addition.
7. **Signed horizontal bar list as a chart family.** `score-explanation-01` hand-rolls its bars in HTML because `BarChart` with negatives has no zero-line marker, no value-at-end labels and no per-sign tone. A `ContributionChart` (or a `signed` mode on horizontal `BarChart`) would let this and the "why it moved" list share one engine.
8. **Not built, for scope:** the side-by-side verdict cards (Keep / Cancel), the handoff inspector (path with a metric pill on the arrow + context comparison table), the transcript-with-objection-scores surface (needs an audio scrubber and "jump to moment" quotes), the live agent map (needs `FlowEdge` annotations: a labelled badge on an edge for "17-cycle loop"). All four are compositions of existing pieces except the two engine features named (edge labels in `flow`; a scrubber in `ai` or `viewer`).

## 5. Typography — what the shots do, and what to change

Measured from the 1440-wide product frames (Inter throughout; numbers are CSS px at 1×):

| Role in the shots           | Size / leading / weight / tracking | brand-ui role today                | Verdict                                                                                                     |
| --------------------------- | ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Page title ("Briefing")     | 28–30 / 36 / 600 / −0.02 em        | `display` 30 / 36 / 600 / −0.02 em | identical — keep                                                                                            |
| KPI value ("$164,200")      | 32–34 / 36 / 500–600 / −0.02 em    | `kpi` 32 / 36 / 600 / −0.02 em     | identical; the shots use 500 on light, 600 on dark — keep 600                                               |
| Tile value ("14,332", "8")  | 24–26 / 28 / 600                   | — (`subtitle` is 16, `kpi` is 32)  | **gap: a `kpi-sm` rung, 24 / 28 / 600 / −0.015 em**                                                         |
| Section / card title        | 16 / 24 / 600                      | `subtitle` 16 / 24 / 600           | identical — keep                                                                                            |
| Body / explanation          | 14 / 20 / 400                      | `body` 14 / 20 / 400               | identical                                                                                                   |
| Secondary / provenance line | 13 / 18 / 400 muted                | `caption` 13 / 18 / 400            | identical                                                                                                   |
| Column header / eyebrow     | 11 / 16 / 500 / +0.06 em uppercase | `meta` 12 / 16 / 500 / +0.01 em    | **gap: an `eyebrow` rung** — uppercase +0.06 em; the blocks add `uppercase tracking-wide` to `meta` by hand |
| Monospace IDs, times, rules | 12–13 / 18 / 400 mono              | `code` 13 / 22 / 400               | leading 22 is a prose rung; a **`mono-inline`** leading of 18 fits table cells                              |
| Deck headline               | 48–56 / 56–60 / 600 / −0.025 em    | — (`display` is 30)                | **gap: `display-lg`** for deck pages, the home site hero (RM-089…) and `marketing` `Hero`                   |
| Deck lede                   | 20 / 30 / 400 muted                | `title` is 20 / 28 / 600           | a 400-weight 20 px lede is a **`lead`** rung, not a bold title                                              |
| Deck stat trio              | 56 / 56 / 600 + 14 / 20 caption    | —                                  | covered by `display-lg` + `body`                                                                            |

Concrete proposals, all additive (no existing rung changes, so no render shift):

1. Add four rungs to the type scale in `themes.css` § TYPE SCALE BASE and `density.css`: `kpi-sm` (1.5 rem / 1.75 rem / 600 / −0.015 em), `eyebrow` (0.6875 rem / 1 rem / 500 / +0.06 em — pair with `uppercase` at the call site, as `chart-source` already does), `display-lg` (3.25 rem / 3.5 rem / 600 / −0.025 em), `lead` (1.25 rem / 1.875 rem / 400 / −0.006 em). Keep the enumerated eight in `density-type-scale.test.ts` and register these as companions the way `chart-value`/`chart-source` are.
2. Retune `code`'s leading for inline use: either a `code-inline` companion at 1.125 rem leading or have `Table` cells reset leading. Every monospace timestamp column in the audit log, decision record and trace currently inherits 22 px leading inside 20 px rows.
3. Make `tabular-nums` part of the `kpi`, `kpi-sm` and `code` roles' documentation as mandatory pairing (it already is for `kpi`), and add the pairing to the `text-scale` rule's doc string so an agent reaching for `text-kpi` gets told.
4. Weight discipline the shots keep and the blocks now follow: **at most two weights per surface** — 600 for the display/title/kpi rungs, 400 for everything else. Semibold body copy appears nowhere in 58 screens. The `SectionHeader` and `CardTitle` defaults already agree; the marketing package's 700 headings are the outlier.
5. Numbers in running text are `tabular-nums` but not bold ("reduced by $58,000"). The blocks follow this; it is worth a line in `conventions.md` § Micro-typography.

## 6. Themes and tokens — what the shots suggest

1. **A provenance/AI tone.** Vero and Rillo reserve one hue (teal, later blue) for "the machine derived this": the sparkle actor chip, the "Ask vero" button, the numbered insight chip, "rillo recommends". brand-ui has `info`, `chat-assistant` and `accent` but no token that _means_ "AI-derived". The nine blocks use `info` for this, which works, but a named `--ai` / `--ai-foreground` / `--ai-text` triple (aliased to `info` in the reference themes, free to diverge in a brand theme) would let the qlik theme colour AI provenance in Qlik's own accent without recolouring every info alert. This is the one new token family the review recommends.
2. **The amber "needs a person" rung is load-bearing.** Every "held", "review", "no verdict", "pinned by a person overrides derivation" reads in `warning`. The blocks map `held → warning`, `stopped → destructive` deliberately (a held run is not a failure) and the mapping should be written into `StatusBadge`'s docs as the recommended vocabulary for agent products: `applied → success`, `held → warning`, `stopped → destructive`, `reverted → neutral`.
3. **Ink-first neutral scale.** The shots draw bars, marks and the "auto" side of the distribution in `foreground`, not in a chart series colour, and use opacity steps (0.45 → 1.0) for a within-side ladder. brand-ui's rule "series tokens are a ramp, full-density ink is the neutral wire rung" already says this; the blocks follow it. A `--foreground-2/3/4` ladder exists — the escalation bar could use it instead of opacity, which would also survive the decoration dial.
4. **Dark theme parity was free.** All nine blocks were screenshotted in `dark` with no per-block work because every colour is a semantic token. The one thing to watch is the `bg-warning/5` row wash on the evidence ladder, which reads slightly warm on dark; a `--warning-wash` token at fixed contrast would be more controllable than an alpha.
5. **Density.** The shots' "Compact / Comfortable / Spacious" switch in Rillo's ledger is exactly `data-density`. Worth a story that renders the audit log at all three, as a demo of the dial on a data-dense block.

## 7. Suggested follow-ups (roadmap candidates)

1. `Meter`, `TickStrip`, `Chip`, `ActorAvatar` in `packages/ui` (§4 1–4) — then promote `agent-ops-parts` to thin re-exports.
2. Type-scale rungs `kpi-sm`, `eyebrow`, `display-lg`, `lead` + `code` inline leading (§5) — the display-lg/lead pair is also what the `apps/home` site (RM-089…106) will need for its hero.
3. `--ai` token family (§6 1), aliased to `info` in the reference themes.
4. `Descriptions.labelWidth` (§4 5) and reference-line labels on `LineChart` (§4 6).
5. Second wave of blocks from the same catalogue: side-by-side verdict, handoff inspector, subscription finding cards, "automation rate over time with policy markers" (uses `infographic-annotated-trend-01`'s machinery), quiet-accounts table with a silence column.
6. A2UI: `insight-feed`, `decision-record` and `kpi-provenance-strip` are natural catalog entries — an agent emits facts + evidence + confidence, the block derives the rest — which is the adapter-binding pattern already adopted for charts.
