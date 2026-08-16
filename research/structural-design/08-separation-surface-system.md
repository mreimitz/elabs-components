# 08 · The separation / surface system — top-down integration (refines [02](02-systemic-backbone.md) §3–4)

> The other half of the systemic backbone, in the same frame as
> [07](07-type-system-integration.md): _how does it blend into the library, how does
> it work, how do humans AND coding agents work with it?_ Where the type scale fixed
> the **SIZE** axis of differentiation, this fixes the **SURFACE / SEPARATION** axis —
> the BTN-4 P0 defect that every interaction type independently wraps itself in
> `rounded border bg-card`, so the border channel carries zero type information and the
> screen reads as a stack of identical rectangles. Routed through
> `brand-ui-design-system-architect`; mechanism claims verified against the tree,
> perceptual claims flagged `needs-render`.

**Headline + honest caveat:** this is **NOT a sixth dial.** The type scale slotted into
the dial family because typography is one orthogonal concern governed by one variable.
Separation is **plural by nature** — a _vocabulary of five channels_ + a _placement
discipline_. The accurate framing is a **token-light layering convention over the
existing surface taxonomy, enforced by a narrow lint** — fuzzier than the type scale,
and the design says so rather than forcing a false dial.

This refinement also **corrects [02 §4](02-systemic-backbone.md)**: the new `-subtle`
status tokens that doc floated are **not needed** (see §B.2).

---

## A. How it blends in — a convention that composes with decoration for free

### A.1 Why it is NOT the sixth dial (avoid false rigor)

The dial family (color / density / decoration / motion / type) shares: one variable,
fanned out, attribute-scoped, identity-default, zero component edits. Separation has
none — there is no single `--separation` number; the channels (fill, rail, elevation,
gap, border) are **categorically different mechanisms**, not points on one axis; and a
region _picks_ a channel by semantic role rather than _inheriting_ a level. Calling it
a dial would be the `conceptual-framing.md` "false rigor" trap. The right name: **the
surface-layering convention** — documented vocabulary over the _existing_ surface/status
tokens, one channel per interaction type, enforced like raw-hex is.

### A.2 What it DOES inherit — composition with the decoration overlay (the real win)

This is what lets it be near-zero-mechanism like the type scale: **every channel is
expressed as `.bg-*` surface classes + `border-*` utilities, and the decoration overlay
already re-encodes exactly those.** Verified end-to-end against `decoration.css`:

| Channel               | Expressed as                                            | What decoration/blueprint does — for free                                                                                                                             | Evidence                                                                                        |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Fill / zone**       | `.bg-surface-muted`, `.bg-chat-user`, `.bg-<status>/10` | the `.bg-surface*`/`.bg-card` grounds get graph-paper gridded under them; the wash sits over the grid as a tint                                                       | `decoration.css:49-69`                                                                          |
| **Left accent rail**  | `border-s-2/-4 border-s-<role>`                         | a border, never a fill — decoration only touches `--tw-shadow` + `.bg-<fill>` classes, **never `border-*`**, so the rail **survives blueprint** as a colored hairline | `decoration.css:100-146`; precedent `state-panel.tsx:18-21` ("survives monochrome / blueprint") |
| **Elevation**         | `.bg-surface-elevated` + `shadow-sm`                    | shadow is **zeroed** at high decoration; separation falls back to blueprint's white hairline + the elevated surface's **lightness lift**                              | `decoration.css:103-122`; `themes.css:447,492,498-500`                                          |
| **Spacing / divider** | `gap-*`, lone `Separator` `border-strong`               | untouched (no fill/shadow); gridded ground shows through the gap, reinforcing the "drawing field"                                                                     | —                                                                                               |
| **Border (sole cue)** | `border` / `border-strong`                              | blueprint **intensifies** borders into white hairlines — the channel decoration most wants                                                                            | `themes.css:491-494`                                                                            |

**The load-bearing detail — the alpha-wash escapes the drawn-not-filled rule.** The
decoration overlay turns _filled controls_ drawn-not-filled by matching
`[class~="bg-success"]` (`decoration.css:131`). A Tailwind alpha-wash compiles to the
**single class token `bg-success/10`**, which `[class~="bg-success"]` does **not** match
(token inequality). So `Alert`'s `bg-success/10` (`alert.tsx:11-15`) stays a faint tint
in blueprint — it is NOT blanked to transparent-and-hatched, while a _filled_ control
(`bg-primary` button) still correctly gets re-drawn. This is the mechanism that lets
status-subtle zones be a convention, not new tokens (§B.2).

So the inheritance from the dial family is **the composition property** — because
separation uses the same channels decoration re-encodes, blueprint gets a correct
calm-but-drafted version of every treatment automatically, zero per-component blueprint
edits.

### A.3 Relative to the existing surface taxonomy

The repo already ships a four-rung neutral ladder (`--surface`/`--surface-muted`/
`--surface-elevated` + `--card`, `themes.css:163-165`) and a status family (fills +
`-foreground` + `-text`, `:142-154`). This convention **adds almost no tokens** — it
_assigns meaning_ to rungs that exist and _documents_ the implicit ladder. That's why
it's a convention, not a token pile.

---

## B. How it works — the five channels, and the minimal change

### B.1 The channels, formalized

> **Channel #3 (Elevation) is corrected by [§H](#h-addendum--surface-ground-offset-tiering-the-elevation-channel-corrected):** it is mis-centered on shadow; the robust half is **ground offset**, which is a **no-op in light themes today** (`--card == --background == white`). §H recesses the page so the channel works on light too. Read §H before building elevation.

| #   | Channel               | Utilities                                                                                                           | Token basis                                               | Decoration behavior              |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| 1   | **Fill / zone**       | `bg-surface-muted` (neutral), `bg-chat-user` (user), `bg-<status>/10` (+ optional `border-<status>/40`) (attention) | existing `--surface-muted` / `--chat-user` / status fills | gridded ground + tint            |
| 2   | **Accent rail**       | `border-s-2` (quiet) / `border-s-4` (emphatic) + `border-s-<role>`                                                  | role colors (no new token)                                | survives as colored hairline     |
| 3   | **Elevation**         | `bg-surface-elevated shadow-sm`                                                                                     | existing surface-elevated + shadow                        | shadow→hairline + lightness-lift |
| 4   | **Divider / space**   | `gap-*`; lone `Separator` `border-strong`                                                                           | existing `--border-strong`                                | gridded gap; border intensifies  |
| 5   | **Border (sole cue)** | `border` / `border-strong`                                                                                          | existing `--border` / `--border-strong`                   | white hairline                   |

### B.2 The minimal change — ZERO new token names, ONE token-value revalue

This corrects [02 §4](02-systemic-backbone.md). Per-candidate verdict:

- **status-subtle surfaces → DO NOT ADD; use the `bg-<status>/10` alpha-wash.** `Alert`
  already does this (`alert.tsx:11-15`), AA via `text-foreground`/`text-<status>-text`.
  Four named tokens would cost **4 × 6 = 24 parity-gated declarations**
  (`check-theme-parity.mjs:55` — not root-only, so mandatory in every block), each
  AA-validated, **and** break decoration composition unless each is added to the
  drawn-not-filled exclusion list. The wash needs none of that and composes for free (§A.2).
- **accent-rail tokens → DO NOT ADD; reuse role colors.** Every role has a bridged
  `border-<role>` utility (`themes.css:971-1002`), so `border-s-4 border-s-primary`
  works today. The role→meaning map is a _convention_ (§B.3), not a token. Precedent:
  `state-panel.tsx:21`, `task.tsx:62`, `inline-citation` already use rails.
- **elevation token → DO NOT ADD; document the existing ladder.** `--surface-elevated` +
  `shadow-sm` exist; a `--elevation-*` set or `data-elevation` would over-engineer a
  2-rung concern decoration deliberately flattens (§E.6).
- **`--chat-user` revalue → the ONE real change** (a token-VALUE edit, not a new token).
  It's orphaned (zero consumers) and in qlik-bright is byte-identical to `--secondary`
  (`themes.css:790`), ~5% off white — imperceptible.

**Net: zero new token names, zero new `@theme inline` bridge entries** (every utility is
already bridged), **one token-value revalue** in ≤2 themes. The "system" is a rule + a
lint + grammar-component wiring, not tokens.

### B.3 The accent-rail role→meaning convention (the one net-new semantics)

Documented in `styling-and-tokens.md`, consumed as `border-s-<n> border-s-<role>`:

| Rail color                      | Meaning                               | Weight | Used by                                                                                             |
| ------------------------------- | ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `border-s-primary` (qlik green) | the _answer_ / completed / favorable  | `-4`   | `AgentMessage` final answer, completed `AgentStep`                                                  |
| `border-s-info`                 | in-progress / informational           | `-2`   | running `AgentStep`                                                                                 |
| `border-s-muted`                | technical / neutral / debug           | `-2`   | `Task`, intermediate steps (matches `inline-citation`)                                              |
| `border-s-border-strong`        | structural attention, hue-independent | `-4`   | `ApprovalCard` (pairs with the status wash; survives monochrome — the `state-panel.tsx:21` pattern) |

Weight (`-2` quiet vs `-4` emphatic) is a capped sub-axis — one focal rail per region.

### B.4 The `--chat-user` revalue — concrete oklch, only 2 themes change

Goal: a perceptible-but-calm tint distinct from `--secondary` AND `--card`, with
`--chat-user-foreground` clearing AA. Method: chroma-lift in-hue, hold lightness calm.

| Theme                                    | current `--chat-user`                     | proposed                    | rationale                                                                                                 |
| ---------------------------------------- | ----------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| **qlik-bright**                          | `oklch(0.95 0.012 252)` (≡ `--secondary`) | **`oklch(0.94 0.035 252)`** | +0.023 chroma → visible cool tint vs near-neutral secondary & white card; L barely drops (stays calm)     |
| **qlik-dark**                            | `oklch(0.3 0.04 252)` (≡ `--secondary`)   | **`oklch(0.34 0.05 252)`**  | +0.04 L lift off card (0.24) and secondary                                                                |
| light / dark / blueprint / high-contrast | —                                         | **keep**                    | already distinct (light/dark), decoration-governed (blueprint), or intentionally hue-free & distinct (HC) |

**Validation (mandatory before merge):** the `themes-contrast` gate proves
`--chat-user-foreground` ≥ 4.5:1 on the new value (ratio); a `brand-ui-visual-ux-reviewer`
six-theme sweep on the real scenario confirms "perceptible-but-calm" (perceptual — a
ratio can't settle it). Token-value edit ⇒ the sweep is required, not optional (Meta #161).

### B.5 Per-theme realization (6 × 5) — the two cells to watch

| Channel                | light grounds (qlik-bright/light/HC) | dark grounds (qlik-dark/dark)               | blueprint (decoration 10)                |
| ---------------------- | ------------------------------------ | ------------------------------------------- | ---------------------------------------- |
| Fill (neutral)         | visible wash vs white card           | lift vs dark card                           | gridded; hairline draws it               |
| Fill (user bubble)     | cool tint (B.4)                      | lifted tint (B.4)                           | gridded blue, hairline-bounded           |
| Fill (attention `/10`) | faint wash + `text-foreground` AA    | faint wash, AA via text                     | tint over grid (escapes drawn-rule)      |
| Rail                   | role hairline                        | brighter role hairline                      | **white-ish role hairline — survives**   |
| Elevation              | card + soft shadow                   | **lightness-lift carries it** (shadow weak) | **shadow→0; hairline + L-lift carry it** |
| Divider                | ≥3:1 rule                            | ≥3:1 rule                                   | white hairline                           |

⚠️ The two cells needing a render (§G): **elevation on dark** (does `--surface-elevated`
lift enough vs `--surface` without the shadow? ΔL only ~0.06) and **elevation on
blueprint** (does hairline + L-lift read as "lifted" with zero shadow?).

---

## C. How users work with it — the decision table + the no-`<Surface>` decision

### C.1 The channel decision table (interaction type → channel → utility/primitive)

| Interaction type   | Channel                                           | Utility (copy-own)                                | Primitive (import/agent)           | Border?                                   |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| User message       | fill (chat-user)                                  | `bg-chat-user text-chat-user-foreground`          | `<Message from="user">` (MSG-1)    | none                                      |
| Agent answer       | rail (primary)                                    | `border-s-4 border-s-primary`                     | `<AgentMessage>`                   | none                                      |
| Approval (pending) | fill + rail (+divider)                            | `bg-warning/10 border-s-4 border-s-border-strong` | `<ApprovalCard>`                   | action-band `border-strong` only          |
| Agent step         | rail (info/muted)                                 | `border-s-2 border-s-info`                        | `<AgentStep>`                      | none                                      |
| Tool result        | elevation                                         | `bg-surface-elevated shadow-sm`                   | `<ToolResultCard>`                 | none                                      |
| KPI                | size/weight ([07](07-type-system-integration.md)) | `text-kpi`                                        | `<MetricCard emphasis="headline">` | the card's own                            |
| Evidence           | fill (green chip)                                 | `bg-success/10 text-success-text`                 | `<EvidenceChip>`                   | none                                      |
| Produced asset     | spacing + sans                                    | `gap-*` (no box)                                  | `<ProducedAssetTree>`              | none                                      |
| Suggestion         | fill (soft pill)                                  | `bg-secondary rounded-full`                       | `<Suggestion>` (BTN-2)             | none                                      |
| Composer           | fill + ring                                       | `bg-surface-muted` + `focus-within` ring          | `<PromptInput>`                    | hairline (redundant w/ footer `border-t`) |
| Generic region     | pick ONE by the test                              | the channel's utility                             | `<Card>` (keeps its border)        | per redundant-boundary test               |

**The one rule a user runs** (extends the redundant-boundary test):

> Pick the channel by the region's SEMANTIC ROLE. Then drop a `border` if the region
> already has a fill, rail, or elevation — UNLESS the border is the only structural cue.
> "If I deleted this line, could a sighted user still tell the regions apart?"

### C.2 Per user type

| User                                         | Reach-for                                                               | Why                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Import (`@qlik-coe-emea/qlabs-components-*`) | grammar component (`<AgentStep>`, `<ApprovalCard>`, `<ToolResultCard>`) | the channel is baked in — can't pick wrong                                                                    |
| Copy-own (registry)                          | the channel utility from C.1                                            | feels like `bg-card`; survives copy-paste                                                                     |
| Coding agent                                 | grammar component                                                       | picks a **semantically named** component via MCP — the anti-hallucination property, via the _name_ not a prop |
| Theme-author                                 | `--chat-user` + surface/status values                                   | re-tints the whole convention in one place                                                                    |
| Theme an element                             | swap the channel utility                                                | `border bg-card` → `bg-surface-muted` (drop border)                                                           |

### C.3 Decision — NO generic `<Surface>` primitive (the crux)

**Do NOT add a generic `<Surface elevation tone>` / `<Panel>`.** Separation is carried
by (a) the doc-03 grammar components owning their channel, (b) the channel utilities for
copy-own, and (c) the lint. This is _deliberately unlike_ the `Text`/`Heading` decision:

1. Type has a true closed enum of 8 roles; separation does not. A `<Surface>` exposing
   `elevation × tone × rail × border` is **boolean-prop proliferation** — the exact
   anti-pattern `component-api.md` forbids ("each boolean doubles the state space").
2. The whole BTN-4 defect is that every type reached for the _same generic box_. A
   generic `<Surface>` is a _better-tokened generic box_ — it re-creates the flatness
   with nicer defaults instead of pushing the _semantic_ choice.
3. The grammar components ALREADY are the right closed enum: `<AgentStep>` _is_ "a rail
   region", `<ToolResultCard>` _is_ "an elevated region". An agent picking between them
   picks the channel **by semantic name** — anti-hallucination via the component name,
   not a `tone` prop. "Explicit variant component over boolean flags," applied literally.
4. `Card` stays the one generic surface (legitimately keeps its border — the
   redundant-boundary default). We need _semantic_ surfaces, which already exist as
   grammar components.

The one concession to copy-own: the **channel utilities** are documented as a named set
in the rule, so a copy-own author reaches for a channel, not a box — the surface-system
parallel to "`text-<role>` for copy-own."

---

## D. Blend-in migration — re-point containers, drop redundant borders, non-breaking

| Component                      | Today                                                            | → channel                                                          | Drop border?                                      |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `Tool` (inspect-only)          | `rounded-md border` (`tool.tsx:24`)                              | rail (`border-s-2 border-s-muted`) once in a timeline              | drop full border in the rail (TRACE-1)            |
| `ToolResultCard` (new)         | —                                                                | elevation (`bg-surface-elevated shadow-sm`)                        | none                                              |
| `Artifact`                     | `rounded-lg border bg-background shadow-sm` (`artifact.tsx:15`)  | elevation                                                          | **drop on light; KEEP under decoration** (Risk 5) |
| `Card`                         | `rounded-lg border bg-card shadow-sm` (`card.tsx:20`)            | **unchanged** — the generic redundant-boundary default             | keep                                              |
| `Alert`/`Confirmation`         | `bg-card` default (`alert.tsx:10`)                               | `ApprovalCard` → `bg-warning/10 border-s-4 border-s-border-strong` | action-band divider only (APPROVE-1)              |
| `ChatShell`                    | `rounded-xl border bg-background` (`chat-shell.tsx:27`)          | keep (outer frame, sole cue)                                       | keep                                              |
| `FileTree`→`ProducedAssetTree` | `rounded-lg border bg-background font-mono` (`file-tree.tsx:69`) | spacing + sans (+ optional `bg-muted/30`)                          | drop border + drop mono (ASSET-1)                 |
| composer (`InputGroup`)        | `border border-input shadow-sm` (`input-group.tsx:18`)           | fill (`bg-surface-muted`) + `focus-within` ring                    | drop (redundant w/ footer `border-t`, BTN-3)      |

**Non-breaking sequencing:** Step 0 — revalue `--chat-user` (2 themes) + land the rule +
the rail map; **zero render change** (no current consumers of `bg-chat-user`), gated by
the sweep. Step 1 — wire channels into the grammar components as they're built (new
states, not changed public output). Step 2 — drop redundant borders in `Artifact`/
composer/`ProducedAssetTree`; each is a visible change → gated by the redundant-boundary
test + the sweep; `Card`/`ChatShell` borders stay. No exports removed; no API break.

---

## E. The decisions — resolved

1. **New tokens vs convention → CONVENTION; zero new token names; one token-value
   revalue.** status-subtle = the `bg-<status>/10` wash (saves 24 parity declarations +
   decoration special-casing); rail = `border-s-<role>` reusing bridged colors;
   elevation = the documented ladder. Only `--chat-user` changes. (§B.2)
2. **`--chat-user` revalue → qlik-bright `oklch(0.94 0.035 252)` + qlik-dark
   `oklch(0.34 0.05 252)`; keep the other four.** Validate via the contrast gate (ratio)
   - the six-theme sweep (perceptual). (§B.4)
3. **Surface primitive → NO generic `<Surface>`/`<Panel>`.** Channels live in the
   grammar components + channel utilities + the lint. Boolean-prop avoidance;
   agent-legibility via semantic component names. `Card` is the one generic surface. (§C.3)
4. **Blueprint/decoration composition → free and verified.** Channels-as-`.bg-*`+`border`
   ⇒ decoration re-encodes them automatically; the alpha-wash escapes the drawn-not-filled
   rule (token inequality, `decoration.css:131`); rails survive (`border-*` untouched);
   elevation degrades to hairline + lightness-lift. (§A.2, §B.5)
5. **"One channel per region" rule + lint → ship the rule + a NARROW, warn-only,
   self-tested lint** (§F). Honestly scoped.
6. **Elevation → documented LADDER, ad-hoc; NOT a token set or `data-elevation`.** A
   2-rung concern decoration deliberately flattens doesn't justify a tokened dial, and a
   `data-elevation` would imply a continuous axis that doesn't exist + fight the
   shadowless rule.

---

## F. Governance — the rule + an honestly-scoped lint

**Rule (`styling-and-tokens.md`, "Surface separation"):**

> Each region owns ONE _focal_ separation gesture — fill / rail / elevation / a single
> divider. Pick it by semantic role (the channel table). Do not stack a `border` on a
> region that already has a non-default `bg-*` fill, a rail, or `shadow-*` elevation,
> unless the border is the SOLE structural cue (the redundant-boundary test). Note:
> complementary combinations are allowed (a rail _labels_ a filled zone; a divider
> _segments within_ a zone) — the rule forbids a _redundant border_, not every combo.

**Lint — feasibility, honest:**

- **Detectable (ship):** same-`className` co-occurrence of `border` (not
  `border-0`/`-transparent`/`-s-*`/`-t`/`-b`) **AND** a non-default fill
  (`bg-surface-muted`/`bg-<status>/10`/`bg-chat-user`/…). A regex over the class string,
  exactly like `validate-component-boundaries.sh:53` does for raw-hex. Ship as a
  PostToolUse warn + a self-tested `scripts/check-separation.mjs` ratchet (baseline count,
  warn-only in registry).
- **NOT reliably detectable (don't pretend):** cross-element regions (border on a
  wrapper, fill on a child) and whether a border is "the sole cue" (inherently
  perceptual). These defer to `brand-ui-visual-ux-reviewer` + `/review-component`.
- **Self-test:** `check-separation.test.mjs` plants `border bg-surface-muted` (must flag)
  and `border bg-card` (legitimate Card default — must NOT flag), locking precision.

Deliberately narrower than the type-scale ratchet — separation is fuzzier (§A.1).

---

## G. Risks / needs-render — adversarial

1. **"One channel per region" is too rigid as first stated.** Real surfaces legitimately
   combine channels — the `ApprovalCard` uses fill + rail + a divider. The rule must be
   **"one _focal_ gesture + no _redundant border_,"** not "one channel total" — else it
   forbids the very ApprovalCard the grammar prescribes. F's wording avoids this; verify
   against the real ApprovalCard render. _(Most-likely-mis-stated point.)_
2. **Elevation is the weakest channel.** Blueprint zeroes the shadow; dark reads it
   faintly — so on 3/6 themes it degrades to "lightness-lift + hairline." **needs-render:**
   confirm `bg-surface-elevated` lifts perceptibly vs `bg-surface` on dark/qlik-dark
   without the shadow (ΔL ~0.06). If not, `ToolResultCard` needs a rail/`border-strong`
   fallback in dark/blueprint — i.e. elevation is **not universal**; prefer rail/fill for
   cross-theme-critical distinctions.
3. **`--chat-user` AA across themes.** Confirm `--chat-user-foreground` ≥ 4.5:1 on the new
   qlik-bright/qlik-dark values via the contrast gate; "calm but distinct" via the sweep.
4. **Alpha-wash faintness on dark/blueprint.** `bg-warning/10` over a dark card or the
   blueprint grid may be near-invisible. **needs-render;** if too faint on dark, bump to
   `/15` on dark grounds (a className tweak, not a token).
5. **The redundant-boundary test gives DIFFERENT answers per theme.** A border redundant
   on light may be the _sole cue_ under decoration (shadow zeroed). So for `Artifact`,
   **keep the border** (harmless on light where it's redundant; load-bearing in blueprint)
   rather than dropping it globally. The rule must note: a border that's redundant on
   light but sole-cue under decoration is KEPT. **needs-render on blueprint.**
6. **Lint false-positives.** `border bg-surface-muted` is usually redundant but not always
   (nested same-fill regions) — hence warn-only, ratcheted, never hard-block.

---

## H. Addendum — surface ground-offset tiering (the elevation channel, corrected)

> Maintainer feedback (2026-06-09): _"I don't see a concept of background colors on cards —
> in the chat and everywhere; the split detail-panel has both sides white. Why not a darker
> offset + drop-shadow to give structure?"_ Correctly diagnosed, this is a **light-theme
> token-VALUE asymmetry**, and it corrects this doc's weakest channel (#3, elevation).
> Architect-resolved; the channel #3 framing in §B.1/B.5 is **superseded by this section.**

### H.1 The finding (verified)

In all three light themes, the top of the neutral ladder is **collapsed onto pure white**:
`--background == --card == --surface-elevated == oklch(1 0 0)` (`:root` `themes.css:110/113/165`;
qlik-bright `:719/722/772`; HC `:600/603/647`). So a `Card` on the page has **ΔL = 0** — the
only cue is the border (the BTN-4 defect, from the elevation side), and **`--surface-elevated`
is a functional no-op on light.** Meanwhile the **dark themes already tier**: `--card` sits
+0.04 L above `--background` (qlik-dark `0.24/0.20` `:846/843`; dark `0.22/0.18`; blueprint
`0.385/0.36`). `SplitPanel` sets no per-pane ground (`split-panel.tsx:49-53`) → both panes
inherit the ambient white. So the maintainer's concept **already ships on dark; light never
got it.**

### H.2 The re-frame

Channel #3 is mis-centered on **shadow** (which the decoration overlay zeroes and dark reads
faintly — §G.2). The robust half is **ground offset** (the L-delta survives blueprint + dark);
**shadow is a light-only enhancement.** Re-state channel #3 as: **Elevation = ground offset
(always) + `shadow-sm` (light enhancement).**

### H.3 The decision — Option C-asymmetric (recess the page + one `SplitPanel` axis)

1. **Recess the page ground (the systemic 80%, token-value edit).** In the light themes only:
   `--background` → `oklch(0.985 …)`, `--surface` → `oklch(0.978 …)` (keep the ladder
   monotonic); **`--card`/`--surface-elevated`/`--popover` stay pure white.** Every white
   card/panel then rises off a recessed page for free — dark-symmetric, zero per-component
   work — and **`--surface-elevated`'s no-op is fixed by recessing below it** (no value change
   to that token). **`light` == `:root`** (theme-types.ts:5 — no separate block), so editing
   `:root` + `qlik-bright` covers all three light themes. **`high-contrast` stays
   `oklch(1 0 0)`** — borders are its sole cue by design; a 1.5% recess is invisible + off-brief.
2. **Document the directional ladder** (the thin convention): inset/well regions →
   `bg-surface-muted` (recessed); raised/content regions → `bg-card` + `shadow-sm`; page →
   `bg-background` (now recessed). The split detail-panel = recessed list + raised detail card.
3. **Add a `cva tone` axis to `SplitPanel`** (`startTone`/`endTone`: `plain | muted | card`,
   default `plain` → non-breaking). The maintainer's ask = `<SplitPanel startTone="muted"
endTone="card">`. **No** `tone` prop on chat/inspector (composition, per §C.3); **no new
   tokens**; **no generic `<Surface>`.** `InspectorPanel`'s `bg-surface` (`inspector-panel.tsx:37`)
   → consider `bg-card` for a raised detail (a #193 builder call).

### H.4 Composition (verified safe)

- **Decoration grid:** unaffected — the grid ink is `--foreground`-alpha, not surface-L
  (`themes.css:258`), and the light themes ship `--decoration: 0` (the recess is a plain-theme
  change). Dark/blueprint blocks are **not edited.**
- **Contrast gate:** direction-safe — `themes-contrast` asserts text/non-text ratios on
  `--background`; recessing (darkening) a light surface strictly **increases** dark-text
  contrast (`themes-contrast.test.ts:64`). No token re-tune needed.
- **`/10` washes + `bg-chat-user`:** reinforced — a wash/tinted bubble on a recessed page reads
  as a lifted surface. Land the recess in the **same #187 PR** as the `--chat-user` revalue
  (B.4) so one sweep judges them together.
- **Charts:** `--chart-background = var(--card)` (white, unchanged); but `--chart-ring-background
= var(--background)` (`themes.css:221`) gains a faint 1.5% tint on a ring-chart hole — almost
  certainly imperceptible; re-point to `var(--card)` only if a render shows it matters.

### H.5 Where it lands + risks

**Lands in #187** (the recess, co-located with `--chat-user`), **#194** (the recess _enables_
the redundant-border drop on light — dependency), **#193** (consume the ladder for the detail
panel + the `SplitPanel tone` axis). **Biggest sweep of the redesign** (recessing `--background`
is a visible change on every light screen) → a `brand-ui-visual-ux-reviewer` six-theme sweep on
real `scenarios-*` screens before merge. **needs-render:** does ΔL 0.015 actually read as
structure (deepen to ≤0.025 if faint; never >0.03 or the page reads "dirty"); the ring-chart
hole tint; the `--chat-user` bubble still lifting on the recessed page.

### H.6 Render-verified (2026-06-09, branch `feat/surface-ground-offset-tiering`, six-theme sweep)

Implemented at ΔL 0.015 and swept by `brand-ui-visual-ux-reviewer` across all six themes on
`scenarios-agentic-ai-workspace--default` + `layout-splitpanel--tiered`. Result:

- **Recess works.** Cards/panels lift off the recessed page in qlik-bright (**just-right**) and
  light (**present, at the faint edge — acceptable; deepen `--background` to `oklch(0.978 …)` /
  ΔL ≈ 0.022 only if stakeholders report it's too subtle**). Nothing muddied; charts/canvas clean.
- **Dark/qlik-dark/blueprint/high-contrast visually unchanged** (the recess is light-only) — no
  regression. `themes-contrast` stayed green (recessing a light surface only raises text contrast).
- **⚠️ The `muted` "recessed well" is LIGHT-ONLY (the render's key finding).** In dark themes
  `--surface-muted` is _lighter_ than `--card` (qlik-dark `0.27`>`0.24`; dark `0.25`>`0.22`), so
  `startTone="muted" endTone="card"` **inverts** (the "well" reads raised, the "card" recessed),
  and `shadow-sm` is invisible on dark. Root cause: **dark-mode layering only goes UP — there is
  no surface below the page ground.** So the robust cross-theme tier is **`card` (raised)**, which
  is lighter than the ground in _every_ theme; `muted` is a light-theme well only. **Resolution:**
  the `SplitPanel` `tone` JSDoc documents this, and the `Tiered` story uses the robust **raised
  detail card on a `plain` list** (correct in all six themes). This corrects §H.3 point 2: prefer
  raising the focus pane with `card` over recessing the other with `muted`.

### H.7 Second pass — the recess wasn't visible on the real detail surfaces (maintainer feedback)

The maintainer correctly observed that the ΔL 0.015 recess + an opt-in `SplitPanel` axis **did not
change the surfaces they actually look at** — the `ChartFrame` expand modal and the `Card`
detail-panel were still flat white-on-white (neither used the tiering; the recess alone was too
faint). Two corrections, re-verified by a six-theme sweep:

- **Deepened the recess to `oklch(0.978 …)` (ΔL ≈ 0.022)** in both light blocks — cards now read as
  lifted off a faint-grey field. (`themes-contrast` still green.)
- **`bg-background` is the robust "field below a card," NOT `bg-surface-muted`** (which inverts in
  dark, §H.6). Applied it directly: `ChartFrame`'s expand modal body is now a recessed `bg-background`
  field with the chart floated as a raised `bg-card` + `shadow-md` card and the detail receding;
  the `Card` detail panel half now uses `bg-background` so it recedes below the white card. **Render
  confirms structure reads in qlik-bright AND dark (correct polarity, not inverted), layout intact.**
- **Lesson:** ship the tiering _applied to the real surfaces_, not just the token + an opt-in prop;
  in light themes the **shadow does the load-bearing lift** (the 1.5–2% ground offset alone is too
  subtle), so a raised card needs `shadow-md`, not `shadow-sm`.

---

## Net: what this adds vs [02 §3–4](02-systemic-backbone.md)

- **Zero new token names** (02 floated `-subtle` ×4 + rail + elevation tokens) — replaced
  by the `bg-<status>/10` wash convention, role-color rails, and a documented elevation ladder.
- **One token-value revalue** (`--chat-user` in qlik-bright + qlik-dark only) — narrowed
  from 02's "all themes."
- **No generic `<Surface>` primitive** — explicit-component-per-role (anti boolean-prop);
  agent-legibility via semantic component names.
- **A narrow, warn-only, self-tested lint** + the reviewer for the perceptual/cross-element
  judgment — honestly scoped, not a pretend-complete static rule.
- **Composition-with-decoration made explicit and verified** — channels are `.bg-*`+`border`
  precisely so blueprint re-encodes them free; the alpha-wash's token-inequality escape
  from the drawn-not-filled rule is the load-bearing detail.

Supersedes the separation/surface specifics in [02 §3–4](02-systemic-backbone.md);
[02](02-systemic-backbone.md) remains the index, with the type scale refined by
[07](07-type-system-integration.md) and the surface system by this doc.
