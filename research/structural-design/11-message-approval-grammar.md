# 11 · The message + approval + evidence + KPI grammar — top-down integration (refines [03](03-component-grammar.md) §1–3, §6–8; [05](05-execution-traces.md) §5)

> The fifth and final refinement, in the frame of [07](07-type-system-integration.md)
> (size), [08](08-separation-surface-system.md) (surface), [09](09-context-panel-integration.md)
> (the missing rail) and [10](10-execution-trace-grammar.md) (the trace grammar): _how does
> it blend in, how does it work, how do humans AND coding agents work with it?_ Routed
> through `brand-ui-design-system-architect`. Mechanism claims verified; perceptual /
> token-value claims flagged `needs-render`. Findings: MSG-1..5, APPROVE-1..5, KPI-1..5.

**Headline.** This is the **lightest cluster of the five**, and the thesis survived the
adversarial pass: it **invents almost nothing.** It is mostly **wiring** the three
backbones the prior docs built — the [07](07-type-system-integration.md) type scale, the
[08](08-separation-surface-system.md) surface channels + the `--chat-user` revalue, the
[10](10-execution-trace-grammar.md) `StatusBadge` — into four interaction types that already
have the right component shape. Genuinely-new surface: **one thin wrapper pair
(`UserMessage`/`AgentMessage`), one slot (`MessageHeader`), one re-skinned chip
(`EvidenceChip`)** — and even those are debatable (the ledger in §A.2). Everything else is
**extend** or **re-skin**. It corrects two grounding facts (see "Net"): `MetricGrid` is
`@qlik-coe-emea/qlabs-components-charts` not `@qlik-coe-emea/qlabs-components-ui`, and the `noopener` lint is genuinely unwired.

---

## A. How it blends in — the cluster that assembles three backbones

### A.1 Each interaction type = a 08 channel + a 07 role + (where status applies) a 10 leaf

| Interaction type       | 08 channel                                                                      | 07 role                                                                | 10 leaf                        | What this cluster adds                                           |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| **User message**       | fill — `bg-chat-user` (revalued)                                                | `text-body`                                                            | —                              | wire `MessageContent`; drop `is-user:dark`; `MessageHeader` slot |
| **Agent answer**       | rail — `border-s-4 border-s-primary`                                            | `MessageResponse` prose scale; KPI band `text-kpi`; footer `text-meta` | —                              | `AgentMessage` wrapper + `emphasis="answer"` rail                |
| **Approval (pending)** | fill+rail+divider — `bg-warning/10 border-s-4 border-s-border-strong shadow-sm` | title `text-subtitle`/`text-title`; consequence `text-body`            | `StatusBadge` (resolved state) | `ApprovalCard` (promote `Confirmation`)                          |
| **Evidence (inline)**  | fill — green chip `bg-success/10 text-success-text`                             | `text-meta`                                                            | —                              | re-skin the `InlineCitation` trigger                             |
| **Evidence (footer)**  | green header + spacing                                                          | `text-meta`/`text-caption`                                             | —                              | structure `Sources` → `SourceList`                               |
| **KPI**                | size/weight (card keeps its border)                                             | `text-kpi` headline                                                    | —                              | `MetricCard` `emphasis` + evidence slot; `MetricGrid` `featured` |

No new token (08 settled the washes, 07 the scale). No new mechanism. The cluster is the
proof the four backbones compose — the integration test made of components.

### A.2 The honest reuse ledger (the adversarial tally)

| Verdict                   | Items                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NEW (3, one marginal)** | `UserMessage`/`AgentMessage` (preset wrapper pair) · `MessageHeader`/`MessageAvatar` (slot, ~15 lines, the only true structural add) · `EvidenceChip` (a re-skin promoted to a name)   |
| **EXTEND (5)**            | `Message`/`MessageContent` internals · `MessageResponse` prose scale · `Confirmation`→`ApprovalCard` · `Sources`→`SourceList` · `MetricCard` emphasis+evidence / `MetricGrid` featured |
| **RE-SKIN (1)**           | `InlineCitation` trigger: grey `secondary` → green wash                                                                                                                                |
| **FIX (file regardless)** | `Source` `rel="noreferrer"`→`noopener noreferrer` · dead `is-user:dark` removal                                                                                                        |
| **STAYS (verify only)**   | `MetricCard` delta-polarity colour system (KPI-5 — correct, don't touch)                                                                                                               |

No item is sprawl: `EvidenceChip` is a re-skin+name; `SourceList`/`UserMessage`/`AgentMessage`
are presets over fixed primitives (the 07/10 "one source, two front doors" precedent); the
only genuine structural addition is `MessageHeader` (a real missing slot).

### A.3 Composes 07+08+10, inherits decoration for free

Every channel here is an 08 channel (`.bg-*` fill, `border-s-<role>` rail, the card's
elevation), so the decoration overlay re-encodes all of them automatically (08 §A.2): the
answer rail survives blueprint as a colored hairline (decoration never touches `border-*`);
the `bg-warning/10`/`bg-success/10` washes stay faint tints (the single class token escapes
the drawn-not-filled rule). No per-component blueprint edits anywhere in this cluster.

---

## B. How it works

### B.1 `Message` internals fix + the `MessageHeader` slot (MSG-1/3/5)

`Message` stays the **low-level primitive** (`from` is correct — it drives alignment + the
`is-user`/`is-assistant` group hooks). Three internal fixes in `message.tsx`:

1. **Wire the chat-user channel (MSG-1):** `message.tsx:38` `group-[.is-user]:bg-secondary …
text-foreground` → `bg-chat-user … text-chat-user-foreground` (the 08 §B.4 revalued tint
   - the AA-validated `--chat-user-foreground`). First consumer of the orphaned token. The
     assistant branch stays bare `text-foreground` — its separation is the **08 rail**, applied
     by `AgentMessage` (§B.2), not `MessageContent`.
2. **Drop the dead `is-user:dark` (MSG-5):** `message.tsx:37` — verified dead (`@custom-variant
dark` matches `[data-theme=dark]`, not a per-bubble flag, `themes.css:85`). Gate-affecting
   noise; remove it.
3. **Real content scale (MSG-3):** `MessageContent`'s blanket `text-sm` → `text-body` (07
   identity, no shift). The substantive scale lives in `MessageResponse`.

**`MessageResponse` prose scale (MSG-3):** today Streamdown + margin-reset only
(`message.tsx:275-285`), so `## heading` inherits ambient body. Add a brand-prose className
mapping the element tree onto 07 roles: `[&_h1]:text-title [&_h2]:text-subtitle
[&_p]:text-body [&_code]:text-code …` — the `@qlik-coe-emea/qlabs-components-ai` analogue of editor's `MarkdownPreview`
mapping, on the existing `streamdown` dep, dovetailing with ASSET-3 (07 §D Phase 3 unifies
them). Keep it a descendant-selector className (not a `components` map) so streaming stays cheap.

**`MessageHeader`/`MessageAvatar` (MSG-2)** — the one genuine structural add. No header/avatar
slot exists today (`message.tsx:34-46`). A small optional part: `MessageHeader` is a `flex
items-center gap-2` row (`text-meta` identity); `MessageAvatar` is a thin preset over the
existing `@qlik-coe-emea/qlabs-components-ui` `Avatar`/`AvatarFallback` sized for inline chat (**not a new avatar**). A
slot, not baked structure (children-over-config).

### B.2 `UserMessage`/`AgentMessage` — thin preset wrappers + the green rail (MSG-1/2/4)

**Preset wrappers (composition), NOT new structure** — `Message` (preset `from`) + a
`MessageHeader` (preset identity). The doc-13 "explicit variant component over boolean":
instead of `<Message from="user" showAvatar label="You">`, write `<UserMessage>`. Zero state,
zero context, zero new DOM idiom — sugar over the fixed primitive (the 07
`text-<role>`-vs-`<Heading>` / 10 `columns`-vs-`featured` precedent).

**The answer structure + green rail — COMPOSED, not baked (the anti-rigidity decision):**

```tsx
<AgentMessage emphasis="answer">      {/* emphasis drives the rail; default = no rail */}
  <MessageHeader><MessageAvatar src={atlas} /><span className="text-meta">Atlas</span></MessageHeader>
  <MessageContent>
    <MetricGrid featured={0}>… <MetricCard emphasis="headline" … /></MetricGrid>   {/* optional */}
    <MessageResponse>{markdown}</MessageResponse>                                   {/* prose, real scale */}
    <SourceList sources={…} />                                                      {/* grounding footer */}
  </MessageContent>
  <MessageActions>…</MessageActions>
</AgentMessage>
```

- **"Final answer" is a `cva` VISUAL axis, not a behavioural mode:** `emphasis:
"default" | "answer"`. `"answer"` applies the 08 green left rail (`border-s-4
border-s-primary ps-4`); `"default"` (intermediate assistant turns) has **no rail**. A
  visual axis dialed, not a fork — and NOT a separate `FinalAnswerMessage` (a one-class delta
  = sprawl; contrast 10's `ToolResultCard`-vs-`Tool`, which were different _channels +
  speech-acts_).
- **KPI band / prose / footer are children, not baked layout.** `AgentMessage` provides the
  container + channel; the consumer composes `MetricGrid` + `MessageResponse` + `SourceList`.
  This keeps it honest for the 99% of answers that are just prose, and `MessageResponse` +
  `MessageActions` (already in `message.tsx`) drop in unchanged.

### B.3 `ApprovalCard` — promote `Confirmation` in place (APPROVE-1/2/3)

**Enhance `Confirmation` and ALIAS `ApprovalCard`; do NOT build a clean new component.**
`Confirmation` is already the right shape (built on `Alert`, which ships the 08 washes in
`alertVariants`; owns the SDK-state compound, `confirmation.tsx:109-179`). The P0 is a
two-line prominence bug, not a wrong shape. Four fixes:

1. **Pending attention treatment (APPROVE-1, the P0):** today `resolvedVariant` is computed
   only for resolved states (`confirmation.tsx:72-76`), so `approval-requested` falls through
   to `Alert` `default` = `bg-card` — least prominent when it must dominate. Fix: in
   `approval-requested`, render `Alert variant="warning"` (the existing `bg-warning/10
border-warning/50` wash) **plus** `border-s-4 border-s-border-strong shadow-sm`.
   `border-border-strong` is the **hue-independent** structural rail (survives
   monochrome/blueprint where a colored rail washes out — the `state-panel.tsx:21` precedent).
   Reads as: faint amber zone + strong structural rail + lift.
2. **Three-zone structure (APPROVE-3):** `ConfirmationTitle` → an `AlertTitle` at `text-subtitle`/
   `text-title` (the question must out-rank surrounding `text-body`); new
   `ConfirmationDescription` consequence slot (`text-body text-muted-foreground`, "Posts the
   final note to #finance; visible to 42 people"); `ConfirmationActions` → a separated band
   (`border-t border-border-strong pt-3` — the sole cue between consequence and buttons, so
   `border-strong` is correct).
3. **Button grammar, `outline`-proof (APPROVE-2):** role-named parts — `ConfirmationApprove`
   (presets `variant="default"`, filled green) + `ConfirmationDeny` (presets `variant="ghost"`,
   never `outline`). Keep generic `ConfirmationAction` for escape hatches, but the scenario +
   docs steer to the pair so a consumer **can't pass `outline`** on the primary path.
4. **`StatusBadge` for the resolved state (10 reconciliation):** replace the hand-rolled
   `CircleCheck`/`CircleX` (`confirmation.tsx:85-96`) with `StatusBadge status="complete"`
   (approved) / `status="denied"` — the resolved approval speaks the same vocabulary as every
   `AgentStep`.

**a11y (the role correction):** `Alert` is unconditionally `role="alert"` (`alert.tsx:27`) —
wrong for a **pending decision containing focusable controls** (an assertive live region with
buttons inside is an AT anti-pattern). Pending = a **labelled region** (`role="group"` +
`aria-labelledby` → `ConfirmationTitle`), not `role="alert"`. This needs a small `@qlik-coe-emea/qlabs-components-ui`
extend: `Alert` accepts a `role` override (default `"alert"`). Don't auto-focus in a
transcript (interaction-guidelines `autoFocus` sparingly). **`Checkpoint` stays the lighter
control sibling** (APPROVE-5; its polish is local — don't escalate it to the approval treatment).

`ApprovalCard` (+ `ApprovalCardTitle`/`Description`/`Approve`/`Deny`) is the promoted,
semantically-named alias; `Confirmation`\* stays exported (non-breaking). New code reaches for
`ApprovalCard`.

### B.4 `EvidenceChip` + `SourceList` — re-skin and structure (MSG-4, KPI-3)

**`EvidenceChip` = re-skin the `InlineCitation` trigger.** The HoverCard + carousel machinery
(`inline-citation.tsx`) works; only the trigger visual is off-grammar — a grey `Badge
variant="secondary"` (`:40`). Re-skin `InlineCitationCardTrigger` to the 08 green evidence
wash (`bg-success/10 text-success-text border-success/40` + a `BadgeCheck` leading icon), and
export **`EvidenceChip`** as a thin wrapper presetting it. A re-skin promoted to a name —
reuses the carousel wholesale, not a new primitive.

**`SourceList` = light structuring of `Sources`** (already green: `text-primary text-xs`,
`sources.tsx:11`). Not a new component — re-point the scale (`text-xs`→`text-meta`, names
`text-caption`); the **`noopener` fix** (`Source` uses `rel="noreferrer"` only, `sources.tsx:45`
→ `rel="noopener noreferrer"`; and merge `className` via `cn`); and a `SourceList` preset (a
green header "Grounded in N sources" + the named list). Sugar over the fixed primitive.

| Surface        | Where                                                          | Built on                     |
| -------------- | -------------------------------------------------------------- | ---------------------------- |
| `EvidenceChip` | inline, anchored to a claim (or a `MetricCard` evidence slot)  | re-skinned `InlineCitation*` |
| `SourceList`   | the per-answer grounding footer (reused in `ContextPanel`, 09) | structured `Sources`         |

### B.5 `MetricCard` emphasis + evidence slot; `MetricGrid` featured (KPI-1/2/3/5)

**All EXTEND** — with the ownership correction: `MetricCard` is `@qlik-coe-emea/qlabs-components-ui` (ADR-0012), but
**`MetricGrid` is `@qlik-coe-emea/qlabs-components-charts`** (`metric-grid.tsx:21`, re-exported `charts/src/index.ts:26`)
— there is no `MetricGrid` in `@qlik-coe-emea/qlabs-components-ui`.

- **`emphasis` axis on `MetricCard` (KPI-1):** add a `cva` `emphasis: "default" | "headline"`.
  `default` ≈ today (value `text-2xl`, `p-5`); `headline` → `text-kpi` (~32px, 07) + more
  padding. **Size/weight/space only — KPI-5: no hue.** The polarity colour system
  (`metric-card.tsx:36-50`) is untouched (verified correct).
- **Evidence footer slot (KPI-3):** an optional `evidence?: ReactNode` rendered as a subdued
  footer (`text-meta text-muted-foreground`), default content an `EvidenceChip` — connects the
  cited figure to its source, removing the detached citation `<p>` below the grid.
- **`MetricGrid` `featured`/`colSpan` (KPI-2, in `@qlik-coe-emea/qlabs-components-charts`):** one tile spans wider.
  Composes with `emphasis`: `<MetricGrid featured={0}>` spans the first child, which is
  `<MetricCard emphasis="headline">`. The `MetricCard` half is `@qlik-coe-emea/qlabs-components-ui`; the `MetricGrid`
  half is `@qlik-coe-emea/qlabs-components-charts` — the `charts → ui` edge is legal, no new dependency.

---

## C. How users work with it

| User         | Reach-for                                                                                                                                        | Why                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Import       | `<UserMessage>` / `<AgentMessage emphasis="answer">` / `<ApprovalCard>` / `<EvidenceChip>` / `<SourceList>` / `<MetricCard emphasis="headline">` | the channel + scale + identity baked in; named front doors                                                                |
| Copy-own     | the 08 channel utilities + the 07 role utilities directly                                                                                        | `bg-chat-user … rounded-lg`; `border-s-4 border-s-primary ps-4`; `bg-success/10 text-success-text rounded-full`           |
| Coding agent | the wrappers + the closed enums                                                                                                                  | `from`, `AgentMessage.emphasis`, `MetricCard.emphasis`, `StatusBadge.status` — can't emit a px, a hue, or a freeform mode |
| Theme-author | nothing cluster-specific                                                                                                                         | `--chat-user` re-tints every user bubble; `--primary` every answer rail + evidence; `--text-kpi` every headline metric    |

**Agent-legibility (the crux):** the _current_ state is the worst case — `Message`'s only
differentiator is `from` (alignment), the approval's prominence is _inverted_, evidence is an
indistinguishable grey badge, KPIs are equal-weight. The fix: `from` stays the low-level
closed enum; `UserMessage`/`AgentMessage` are the **named** front doors (pick "this is a user
turn" by name, not by remembering `bg-chat-user` + align + avatar); `emphasis="answer"` is a
closed `cva` axis (can't invent a rail color/width); the resolved `ApprovalCard` shares the 10
`StatusBadge` 7-state enum; and **green is reserved for evidence/answer/favourable** so the
agent learns one rule (`green = grounded/done/good`).

---

## D. Blend-in migration — non-breaking, depends on 07+08+10

| Component                                                                                            | Action                                                              | Breaking?                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Message`/`MessageContent`                                                                           | wire `bg-chat-user`; drop `is-user:dark`; `text-sm`→`text-body`     | No (visible recolor; gated by sweep)                       |
| `MessageResponse`                                                                                    | add prose-scale className                                           | No (additive; visible)                                     |
| `MessageHeader`/`MessageAvatar`, `UserMessage`/`AgentMessage` (`@qlik-coe-emea/qlabs-components-ai`) | **new** slot + preset wrappers                                      | No                                                         |
| `Confirmation`→`ApprovalCard` (`@qlik-coe-emea/qlabs-components-ai`)                                 | pending treatment + 3 zones + button grammar + `StatusBadge`; alias | Additive API; pending appearance changes (the fix) — gated |
| `Alert` (`@qlik-coe-emea/qlabs-components-ui`)                                                       | accept a `role` override (default `"alert"`)                        | No                                                         |
| `InlineCitationCardTrigger` (`@qlik-coe-emea/qlabs-components-ai`)                                   | re-skin → green wash; export `EvidenceChip`                         | No (visible recolor)                                       |
| `Sources`/`Source` (`@qlik-coe-emea/qlabs-components-ai`)                                            | `noopener` fix; scale re-point; merge `cn`; export `SourceList`     | No (the `noopener` is a fix)                               |
| `MetricCard` (`@qlik-coe-emea/qlabs-components-ui`)                                                  | `cva emphasis` + `evidence` slot (`default` byte-identical)         | No (additive)                                              |
| `MetricGrid` (`@qlik-coe-emea/qlabs-components-charts`)                                              | `featured`/`colSpan`                                                | No (additive)                                              |

**Order:** (1) land 07/08/10 deps; (2) `Message` internals + `MessageResponse` scale (gated
sweep — consumes a token-value edit, Meta #161); (3) `MessageHeader` + the wrappers; (4)
`Confirmation`→`ApprovalCard` + the `Alert` `role` override; (5) `EvidenceChip` re-skin +
`SourceList` + `noopener`; (6) `MetricCard`/`MetricGrid`; (7) scenario re-wire last.

**Scenario re-wire** (`agentic-workspace.stories.tsx`): user turns → `<UserMessage>`; the final
answer (`:839-943`) → `<AgentMessage emphasis="answer">` with `<MetricGrid featured={0}>` +
headline `<MetricCard>`, `<MessageResponse>`, `<SourceList>` — replacing the flat block + the
detached citation `<p>` (`:875-914`); the approval (`:782-787`) → `<ApprovalCard>` with the
question/consequence/`Approve`/`Deny`; the KPIs → `emphasis="headline"` + **KPI-4's pure story
fix** (`value="+18%"` → real value + `delta`/`deltaDirection="up"`, `:867-872`); the inline
citation → `<EvidenceChip>`.

---

## E. The decisions — resolved

1. **`UserMessage`/`AgentMessage` → thin preset wrappers; `Message` stays the primitive.** The
   named grammar survives the explicit-variant-vs-boolean rule because the wrappers preset a
   _multi-part composition_, not a single boolean. `Message` internals are fixed regardless.
2. **"Final answer" → a `cva` visual axis (`emphasis="answer"`, the green rail); the
   KPI/prose/footer is COMPOSED children, not baked.** Anti-rigidity; honest for plain-prose answers.
3. **`ApprovalCard` → enhance `Confirmation` + alias.** Pending = `warning` wash + `border-s-4
border-s-border-strong shadow-sm`; three zones; role-named `Approve`/`Deny`; `StatusBadge`
   resolved; **`role="group"` not `alert`** (needs an `Alert` `role`-override). `Checkpoint`
   stays the lighter sibling.
4. **`EvidenceChip` → re-skin the `InlineCitation` trigger; `SourceList` → structure `Sources`.**
   Minimize new surface; neither a new primitive.
5. **`MetricCard` extended (`emphasis` + evidence slot, `@qlik-coe-emea/qlabs-components-ui`); `MetricGrid` `featured`
   (`@qlik-coe-emea/qlabs-components-charts`).** All extend; KPI-5 colour system untouched. Ownership split corrected.
6. **The ledger:** 3 new (one marginal), 5 extend, 1 re-skin, 2 fixes. No item is sprawl.
7. **Governance:** the 07/08/10 gates cover the scale/surface/status choices — no new
   cluster-specific gate. Two real fixes to file: `noopener` (+ wire the lint) and `is-user:dark`.

---

## F. Governance / dependencies

**Hard order:** lands **after** 07 (scale + `Heading`/`Text`), 08 (`--chat-user` revalue + the
rule), 10 (`StatusBadge`). Pure consumption — no prior leaf is forked. **Architect-gated** for:
the `ApprovalCard` alias + new parts (`ConfirmationDescription`/`Approve`/`Deny`), the `Alert`
`role`-override, the `MetricCard` `cva` axis + `evidence` slot, the `MetricGrid` axis, and the
new `@qlik-coe-emea/qlabs-components-ai` exports.

**The `noopener` fix (file regardless).** `Source` (`sources.tsx:45`) uses `rel="noreferrer"`
only. **Verified the lint does NOT catch it:** `packages/eslint-config/react.js:24-29` spreads
only `reactHooks.configs.recommended.rules` — neither `eslint-plugin-jsx-a11y` nor
`react/jsx-no-target-blank` is wired, so the WP-10 interaction gate is **aspirational, not
active.** Two-part fix: (1) `sources.tsx:45` → `rel="noopener noreferrer"` (+ merge `className`
via `cn`); (2) **wire `react/jsx-no-target-blank` (or `eslint-plugin-jsx-a11y`)** into
`react.js` so it can't recur (enforcement-over-reminders). Grep first — likely not the only
`target="_blank"` without `noopener` in the AI Elements ports.

**The `is-user:dark` dead-class.** Remove it (`message.tsx:37`). Worth a small grep gate
(`scripts/check-vendored-leftovers.mjs`, warn-only, self-tested) for known dead AI-Element
idioms so a re-vendor can't re-introduce them — the 10 `check-timeline-fork.mjs` pattern. Low
priority (one occurrence), but it's the port-boundary application of "ships with its teeth."

**No new tokens / `@theme inline` entries** — every utility this cluster uses
(`bg-chat-user`, `text-chat-user-foreground`, `border-s-primary`, `bg-warning/10`,
`border-border-strong`, `bg-success/10`, `text-success-text`, `text-kpi`/`-body`/`-subtitle`/
`-meta`) is already bridged by 07/08.

---

## G. Risks / needs-render — adversarial

1. **The green rail clipped by `overflow-hidden`.** `MessageContent` is `overflow-hidden`
   (`message.tsx:37`); the `border-s-4` rail must sit on `AgentMessage`/a rail wrapper _outside_
   the clipping content, or it's clipped. **needs-render — most-likely-mis-built detail.**
2. **Too much green in one answer (the sharpest catch).** The final answer can carry the green
   rail + a green `EvidenceChip` + a green `bg-primary` action + a green favourable delta —
   four greens. They're at four _different_ ink weights (hairline rail / `/10` wash / solid
   button / text-only delta), which _may_ read as a deliberate gradient — but this is exactly a
   perceptual claim a token argument can't settle. **`brand-ui-visual-ux-reviewer` six-theme
   sweep on the real answer, required before merge.** Cheapest dial-back: rail `border-s-4`→`-2`,
   or a neutral evidence chip when the answer already has a rail.
3. **`--chat-user` revalue AA (inherited from 08).** `Message` is the first consumer, so this
   is where the revalue first renders. `themes-contrast` proves the ratio; the sweep proves
   "perceptible-but-calm." **needs-render + contrast gate.**
4. **`ApprovalCard` role/aria.** `role="group"` + `aria-labelledby` for pending (vs `alert`)
   needs a **screen-reader pass**, not just axe; the `Alert` `role`-override must not break the
   `role="alert"` default elsewhere; confirm the `awaiting-approval` solid-`bg-warning`
   `StatusBadge` doesn't double up loudly with the card's own `bg-warning/10` zone (fill-on-wash).
5. **Prose-scale leading in dense transcripts (inherited from 07).** `[&_p]:text-body` loosens
   leading if `--text-body--line-height` isn't true identity; compounds in long chats.
   **needs-render;** mitigation is 07's (identity body leading, loosen only the answer prose).
6. **`emphasis="headline"` `text-kpi` (~32px) dominating a 4-up band.** Intended, but may
   overwhelm a compact band; one-knob dial-back (`headline`→`default`) — render before declaring.

---

## Net: what this adds vs [03](03-component-grammar.md) §1–3,6–8 / [05](05-execution-traces.md) §5

- **Confirms the lightest-cluster thesis** — 3 new (one marginal), 5 extend, 1 re-skin, 2
  fixes; no new token/mechanism/gate. The integration test of the four backbones.
- **`UserMessage`/`AgentMessage` = thin preset wrappers**; `AgentMessage emphasis` = a `cva`
  visual axis; the answer structure = composed children (anti-rigidity).
- **`ApprovalCard` = enhance `Confirmation` + alias** (the P0 is a two-line prominence bug),
  with the three zones, `outline`-proof role-named buttons, `StatusBadge` resolved, and the
  **`role="group"`-not-`alert`** correction (needs a small `Alert` `role`-override).
- **`EvidenceChip` = re-skin**; **`SourceList` = structuring** — neither a new primitive.
- **Corrects two facts:** `MetricGrid` is `@qlik-coe-emea/qlabs-components-charts` (the `featured` axis lives there);
  the `noopener` nit is genuinely unguarded (no jsx-a11y in `react.js`) — fix `sources.tsx:45`
  _and_ wire `react/jsx-no-target-blank`.
- **Two fixes to file regardless:** `noopener` (+ the lint) and `is-user:dark`.

Supersedes the message/approval/evidence/KPI specifics in
[03](03-component-grammar.md) §1–3,6–8 and the approval boundary in
[05](05-execution-traces.md) §5; those remain the finding-level register (MSG/APPROVE/KPI).
