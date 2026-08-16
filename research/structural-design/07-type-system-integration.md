# 07 · The type system — top-down integration (refines [02](02-systemic-backbone.md) §1–2)

> Refinement of the systemic backbone in answer to: _"think top-down — how will
> this blend into the library overall? how will it work? how can we make sure
> library users can work with it?"_ Routed through `brand-ui-design-system-architect`
> (token taxonomy + cross-package API is its charter). Every mechanism claim here
> was verified against the repo; the one load-bearing empirical fact is flagged for
> re-confirmation at build time.

The headline: **the type scale is not a bolt-on — it is the missing fifth member of
a dial family the repo already has four times, and it lands as a pure-native
Tailwind v4 feature with no new mechanism.**

---

## A. How it blends in — the fifth systemic dial

The repo already governs four orthogonal concerns with **one shared philosophy**:
_one variable, fanned out, scoped by an attribute, identity-default so adoption is
non-breaking, zero component edits._

| Layer          | Source var          | Scoped by            | Bridge                                                     | Identity default                            |
| -------------- | ------------------- | -------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| **Color**      | `--background`, …   | `[data-theme]`       | `@theme inline` (`themes.css:961`)                         | `:root` = light                             |
| **Density**    | `--spacing`         | `[data-density]`     | overrides Tailwind's global spacing var (`density.css:29`) | `comfortable` = `0.25rem` (pixel-identical) |
| **Decoration** | `--decoration` 0–10 | `[data-decoration]`  | `calc()` fan-out (`themes.css:250-283`)                    | `0` = inert                                 |
| **Motion**     | `--motion-factor`   | `[data-motion-pref]` | derived `--t-*` (`themes.css:1081`)                        | `1` = full                                  |
| **Type (new)** | `--text-*` roles    | `:root` (invariant)  | **native Tailwind `--text-*` keys, plain `@theme`**        | **`--text-body == text-sm`** (no shift)     |

> **Amended 2026-08-02 (#340):** the Type row's "scoped by `:root` (invariant)" is no
> longer true — type is scoped by `[data-density]` too, via `--type-factor`. See §E.4,
> which records the superseded decision and what replaced it. The identity default is
> unchanged.

Type is the **purest** fit of the five: density had to hijack `--spacing`, decoration
needed `calc`, motion needed a derived gate — **type needs no mechanism invention at
all**, because Tailwind v4 has first-class `--text-*` support. We declare role keys;
Tailwind emits `text-<role>` utilities. The library doesn't learn a new pattern; it
gains the one member of an existing pattern that was missing.

**The identity-default discipline** (what makes all five non-breaking) applies here as
the rule **`--text-body == text-sm`**: the 326 existing `text-sm` sites render
unchanged on day one. Hierarchy comes from _raising_ the title/display/kpi rungs,
never from shrinking body — the exact analogue of `comfortable == 0.25rem`.

**The real structural win — unification.** Today "what size is a heading?" is encoded
in **three** places that can drift: editor prose `HEADING_SIZE` (`prose.tsx:17-24`),
`markdown-scale.ts` (`:27-43`, the same rems re-hardcoded for the Milkdown WYSIWYG,
kept honest only by a drift test), and the ambient `text-sm`-everywhere default. The
role tokens become the **one source**; all three derive from it. One source → three
consumers, instead of three sources pretending to agree.

---

## B. How it works — verified mechanism, tokens, primitive

### B.1 The mechanism (verified — this corrects the original concept)

The original backbone sketch assumed Tailwind's `--text-*` keys only pair
size + line-height, so we'd need `@utility` to bundle weight + tracking. **That is
false in this repo's Tailwind v4.3.0.** Compiling a role through the installed engine
emits a single, composable rule from the companion keys:

```css
/* from --text-title + --text-title--line-height / --font-weight / --letter-spacing */
.text-title {
  font-size: var(--text-title);
  line-height: var(--tw-leading, var(--text-title--line-height));
  letter-spacing: var(--tw-tracking, var(--text-title--letter-spacing));
  font-weight: var(--tw-font-weight, var(--text-title--font-weight));
}
```

Two consequences:

1. **`text-title` is the full bundle** — size + leading + weight + tracking in one class.
2. **It stays composable** — each companion is `var(--tw-*, …)`-wrapped, so
   `text-body leading-loose` still lets `leading-loose` win. A hand-rolled
   `@utility text-title { … }` would emit _flat_ declarations that `leading-*`/`font-*`
   could **not** override — strictly worse. **Native `--text-*` is the right
   mechanism; `@utility` would be a regression.**

> ⚠️ **Load-bearing fact to re-confirm at build time.** This is the one claim the
> whole "no `@utility`" simplification rests on. The architect verified it by
> compiling through `tailwindcss@4.3.0`; re-confirm on the pinned version before
> building (a one-line compile test), and pin/guard the Tailwind version so a minor
> bump can't silently drop the `--font-weight`/`--letter-spacing` companions.

Use **plain `@theme`** (not `@theme inline`): type is theme-invariant, like the easing
curves at `themes.css:1092`. `inline` is only for values that change per `[data-theme]`.

### B.2 The role tokens (declared in `:root` / a plain `@theme` block)

Eight roles (the architect added `caption` between body and meta — a 13px supporting-
body rung the 7-role sketch lacked). Each carries all four dimensions:

| Role       | size                | leading   | weight | tracking | for                                   |
| ---------- | ------------------- | --------- | ------ | -------- | ------------------------------------- |
| `display`  | 30px (1.875rem)     | 2.25rem   | 600    | −0.02em  | page / hero headline                  |
| `title`    | 20px (1.25rem)      | 1.75rem   | 600    | −0.014em | section / card / dialog titles        |
| `subtitle` | 16px (1rem)         | 1.5rem    | 600    | −0.006em | sub-section, prominent body           |
| `body`     | **14px (0.875rem)** | 1.375rem¹ | 400    | 0        | **default body == `text-sm`**         |
| `caption`  | 13px (0.8125rem)    | 1.125rem  | 400    | 0        | secondary / supporting body           |
| `meta`     | 12px (0.75rem)      | 1rem      | 500    | +0.01em  | metadata / eyebrow / timestamp        |
| `kpi`      | 32px (2rem)         | 2.25rem   | 600    | −0.02em  | executive metric values               |
| `code`     | 13px (0.8125rem)    | 1.375rem  | 400    | 0        | inline / block code (+ `--font-mono`) |

¹ See Risk 1 — body leading is the one value that isn't truly byte-identical to
today's bare `text-sm` and must be settled on a render.

**Scale-ratio rationale — snap to Tailwind's steps, don't impose a geometric ratio.**
`body 14 → subtitle 16 → title 20 → display 30` are _exactly_ Tailwind's
`sm/base/xl/3xl` rems. So re-pointing `SectionHeader`'s `text-xl` → `title` is a
**visual no-op** — the rung _is_ `text-xl`. This is what makes the migration safe:
most re-points change _which token is referenced_, not the rendered size. The only
intentional new rung is `kpi 32px` (Tailwind has no 32px) so KPI values out-rank a
page title. **Leading is tuned per role** (body looser for reading; titles tighter so
multi-line headings don't sprawl) — the dimension Tailwind's numeric scale gets wrong
for app UI, and a core reason roles beat raw numerics.

### B.3 The `Text` / `Heading` primitives (`@qlik-coe-emea/qlabs-components-ui`)

Per `component-api.md`: `cva` variant axis, `forwardRef`, `className` merged last,
`...props` spread, exported types, `asChild` via Radix `Slot` (so a `Heading` can _be_
a `DialogTitle`). They map **semantic intent → role**:

- **`Heading`** — `level` (1–6) drives the tag **and** the default size; `size`
  (`display | title | subtitle`) can override so a visually-small `h2` stays an `<h2>`.
  Keeps the a11y heading order orthogonal to the visual rung (doc-13 "explicit variant
  over boolean"). `text-balance` on by default.
- **`Text`** — `variant` (`lead | body | caption | meta | kpi | code`) + `tone`
  (`default | muted | primary`); `as` (`p|span|div`) or `asChild`. `variant="kpi"`
  bundles `tabular-nums` so the numeric-column rule is free and unforgettable.

Exported from `packages/ui/src/index.ts`. Full proposed source is in the architect's
return (cva + forwardRef + Slot); it lives at the proposed path
`packages/ui/src/components/typography/typography.tsx`.

---

## C. How users work with it — the hybrid, resolved per user type

**The answer is HYBRID** (decision 2): tokens are truth, `text-<role>` utilities are
the everyday surface, primitives are the semantic/agent surface. This mirrors exactly
how _color_ already works in this repo (`<Badge>` for import, `bg-card` for copy-own,
`--card` for theming) — so it's not a new split to learn.

| User                                             | Default reach-for                      | Why                                                                         | Example                                                                                     |
| ------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Import** (`@qlik-coe-emea/qlabs-components-*`) | `<Heading>` / `<Text>`                 | self-documenting, correct tag, picks the role                               | `<Heading level={2}>Pipelines</Heading>` · `<Text variant="caption">Updated 2m ago</Text>`  |
| **Copy-own** (registry)                          | `text-<role>` utility                  | feels like `bg-card`; no import; survives copy-paste                        | `<h2 className="text-title">…</h2>`                                                         |
| **Coding agent**                                 | `<Heading>` / `<Text>`                 | reads a **closed enum** via Storybook MCP — picks a role, can't invent a px | discovers `size: display\|title\|subtitle`, `variant: lead\|body\|caption\|meta\|kpi\|code` |
| **Theme-author**                                 | `--text-*` values (+ `--font-display`) | re-tunes the whole system in one place, never a component                   | override `--text-display`; set a brand display font                                         |
| **Theme an existing element**                    | `text-<role>` utility                  | one class swaps the rung, composes with `leading-*`/`font-*`                | `class="text-sm"` → `text-body` (no-op) or `text-title`                                     |

### The agent-legibility story (why this is the crux of "can users work with it")

Coding agents are the highest-volume author in this repo, and the **root cause of the
326-site flatness is an agent dynamic**: with no role to reach for and no type
vocabulary in any prop surface, an agent defaults to `text-sm`. The fix makes the
right choice the _only legible_ choice:

- `get-documentation` on `Heading`/`Text` returns a **closed enum** — the agent
  cannot hallucinate `text-[19px]` because the API offers _roles_, not freeform sizes.
  Same anti-hallucination property color tokens already have.
- The role **names are the docs**: `kpi`, `meta`, `caption`, `display` say _when_ to
  use each without reading source. `text-sm` says nothing about intent.
- `Text variant="kpi"` ships `tabular-nums` — the agent gets the interaction rule for
  free and can't forget it.

---

## D. The blend-in migration — 6 re-points, not 326 edits

Non-breaking and incremental by construction:

- **Phase 0 — land the tokens (zero render change).** Add the `@theme` type block.
  Because `--text-body == text-sm`, nothing shifts; the `text-<role>` utilities exist
  but nothing uses them yet. (The density-`comfortable` move: ship at identity first.)
- **Phase 1 — add `Heading`/`Text` (pure addition).** Nothing imports them yet.
- **Phase 2 — re-point ~6 shared primitives (the leverage).** Six one-line edits, each
  fixing hundreds of instances:

  | Primitive                                 | Today                 | →                            | Net change                                     |
  | ----------------------------------------- | --------------------- | ---------------------------- | ---------------------------------------------- |
  | `CardTitle` (`card.tsx:265`, unsized)     | inherits `text-sm`    | `text-title`                 | **the big win** — every card gets a real title |
  | `SectionHeader` (`section-header.tsx:30`) | `text-xl`             | `text-title`                 | none (title == 20px == text-xl)                |
  | `DialogTitle` (`dialog.tsx:105`)          | `text-lg`             | `text-title`                 | +1px (intentional consistency)                 |
  | `MetricCard` value (`metric-card.tsx:60`) | `text-2xl`            | `text-kpi`                   | +8px (KPIs out-rank titles)                    |
  | `Message` authorship (`message.tsx:37`)   | `text-sm`             | `text-body`                  | none (identity)                                |
  | eyebrow / `CardDescription`               | `text-xs` / `text-sm` | `text-meta` / `text-caption` | minor, intentional                             |

  The 326 raw call-sites are **left alone** (already correct: body == sm); they're
  cleaned up opportunistically as the gate (§F) nudges new code.

- **Phase 3 — unify the parallel scales.** Re-point editor prose `HEADING_SIZE` to
  roles (editor already imports `@qlik-coe-emea/qlabs-components-ui/lib/cn`, so `ui → editor` consumption is
  in-charter and dep-graph-legal); make `markdown-scale.ts` _read_ the role rems
  instead of re-hardcoding them (the Milkdown CSS side stays a derived seam, kept
  honest by the existing `markdown-scale.test.ts`). The ADR-0012 `MetricCard` model:
  `@qlik-coe-emea/qlabs-components-ui` owns the canonical scale, `@qlik-coe-emea/qlabs-components-editor` derives.

---

## E. The decisions — resolved

1. **Numeric scale relationship → roles are the API, numeric is the lint-governed
   escape hatch, `--text-body == text-sm`.** Not "alongside" (two vocabularies invite
   the agent to keep choosing `text-sm`); not "retune the numeric scale" (shifts all
   326 sites + breaks `markdown-scale`'s mirror assumption). Only this option is
   simultaneously non-breaking, agent-legible, and convergent.
2. **Primary surface → HYBRID** (per-user table in §C). Mirrors how color already works.
3. **Bundling → native `--text-<role>` companion keys, NOT `@utility`** (§B.1, verified).
   The most important correction to the original concept.
4. ~~**Density / responsive → fixed rem in v1; type is NOT density-aware.**~~
   **SUPERSEDED 2026-08-02 by the maintainer decision on [#340](https://github.com/Qlik-CoE-EMEA/qlabs-components/issues/340)
   — density owns type; the reserved sixth dial is withdrawn.** The `clamp()`/fluid
   half of this decision still stands.

   > **The original decision, kept for the record:** _"Density / responsive → fixed rem
   > in v1; type is NOT density-aware. Coupling type to `[data-density]` would shrink
   > text in compact tables (you want tighter spacing, same readable text) — keep the
   > dials orthogonal. No `clamp()` fluid type in v1 (app UI lives in panels, not
   > full-viewport heroes). **Seams named, not built:** `--text-display` is the only role
   > a future fluid pass would touch (it can become a `clamp()` without changing any
   > consumer); a future 'reading density' would be a separate `[data-type-scale]`
   > attribute multiplying role rems via `calc()` — a sixth dial, not a hijack of
   > density. Reserve the name; defer."_

   **What replaced it.** §E.4's premise — that a compact table wants tighter spacing
   around the _same_ text — did not survive contact with real consumers: the operator
   console behind #340 re-declared 11 role tokens and 8 raw steps in its own stylesheet
   to get the whole surface to scale together, and the maintainer agreed the surface
   should scale as one. So density now scales type **directly** (not behind a second
   opt-in attribute, and not off by default):
   - `--type-factor` in `density.css` multiplies every role's size and line-height —
     compact `0.9375` (15/16), comfortable `1`, spacious `1.0625` (17/16). Weight and
     tracking are not rescaled.
   - Type deliberately moves at roughly **half** spacing's rate (±6.25% vs ~11–12%),
     capped by a **legibility floor**: body never below 13px, no role below 11px.
   - `comfortable` (and no attribute) stays the exact identity, so the "no render shift
     on existing screens" acceptance criterion in §G.1 still holds for every screen that
     does not opt into a density.
   - The `[data-type-scale]` name reserved above is **withdrawn** — there is no sixth
     dial. Per `theming.md`'s taste-profile rule ("never mint a second knob"), a reading
     -density request is answered by `data-density`.
   - Mechanically this is NOT the `calc()`-on-role-rems shape sketched above: the roles
     alias a separate unscaled base layer (`--type-size-*` / `--type-leading-*` in
     themes.css) which the density blocks multiply, because `[data-density]` routinely
     lands on `:root` itself and a self-referential role would be a custom-property cycle.

5. **Theme-author seam → YES, add `--font-display` (identity-default sibling of
   `--font-mono`).** `--font-display: var(--font-sans)` in `:root` (so it ships dark /
   non-breaking); bridge to a `font-display` utility; `Heading` display/title apply it.
   A brand sets `--font-display: "Source Serif", …` and every headline re-skins, body
   untouched. Generalizes the blueprint `--font-mono` precedent; without it a brand
   display font would require editing `Heading` source (a closed abstraction the rules
   forbid). Add to the theme-parity allowlist as root machinery.
6. **Governance → a self-tested `pnpm text-scale:check` ratchet + a rule + a hook** (§F).

---

## F. Governance — ships with its teeth

Per `quality-gates.md` "a convention ships with its enforcement" + `enforcement-over-reminders`:

- **`scripts/check-text-scale.mjs` → `pnpm text-scale:check`** (self-tested, sibling of
  `check-charts-reuse`). In `packages/*/src/**/*.tsx` (excl. stories/tests), flag raw
  font-size utilities (`text-xs|sm|base|lg|…`, arbitrary `text-[…]`) that aren't a role:
  - **Regression ratchet:** snapshot the current 326 count into a baseline; **fail if
    it goes up** (new flatness), celebrate when it drops. Governs a large existing
    surface honestly without a 326-file rewrite (a coverage-ratchet for type).
  - **Hard-block** raw `text-*` in **new** files under `packages/ui/src/components/`.
  - **Warn (don't block)** in registry blocks — copy-own is _expected_ to diverge; the
    role vocabulary ships as the default, but a downstream team that copies it owns it.
  - Ship `check-text-scale.test.mjs` (`node --test`) planting a `text-[17px]` fixture
    so the gate can't silently rot.
- **Parity check:** assert every role has its three companion keys (a missing
  `--text-title--font-weight` silently drops to Tailwind's default weight — a quiet
  defect). Fold into the theme-parity gate.
- **`styling-and-tokens.md` "Typography scale" rule:** _"Type is a role, not a size.
  Reach for a role — the `<Heading>`/`<Text>` primitive or the `text-<role>` utility —
  never a raw `text-sm`/`text-xl`/`text-[17px]` in component source. `--text-body ==
text-sm` by design. New raw font-size utilities fail `pnpm text-scale:check`."_
- **`PostToolUse` hook** (warn, sibling of the raw-hex boundary hook): nudge when a
  `.tsx` write adds a raw `text-sm/xs` in `packages/*/src`.

---

## G. Risks / what to verify on a real render (be adversarial)

1. **Body leading is the one non-identity value (most likely to be wrong).** Today's
   bare `text-sm` leading is `~1.43`; the proposed `--text-body--line-height` is `~1.57`
   for readability. Re-pointing body to `text-body` will **loosen spacing in dense
   transcripts and tables** — exactly the dense surfaces the budget says to keep tight.
   **Verify** on `scenarios-agentic-ai-workspace--default` + a dense `DataTable`, six
   themes. _Mitigation:_ set `--text-body--line-height: 1.25rem` (true identity) and
   loosen only `prose`/`MarkdownPreview` where reading measure matters. **This is a
   judgment call a token value can't settle on paper.**
2. **`CardTitle` re-point could over-correct.** Unsized→`text-title` (20px) is the
   intended win, but on a dense dashboard of small cards 20px titles may dominate. The
   token makes it one knob to dial back (maybe `subtitle` for compact cards) — but
   render it before declaring it. `brand-ui-visual-ux-reviewer`, real scenario.
3. **Editor unification can regress the markdown WYSIWYG.** `markdown-scale.test.ts`
   asserts byte-equal rems; re-pointing prose keeps it green only because the role rems
   _match_ the current markdown rems (by design). Verify the Source→Split→Preview
   transition (issue #18) after unification.
4. **Blueprint + negative tracking.** Display/title tracking (`-0.02em`) is tuned for
   Inter; on IBM Plex Mono (blueprint, `themes.css:1151`) it may pinch. Blueprint can
   override `--text-display--letter-spacing: 0` in its block if a render shows it.
5. **`--font-display` fallback chain.** Identity-default works only if `Heading`
   applies `font-display` and the var resolves to the sans when a theme sets only
   `--font-sans`. Add to the parity allowlist; verify a heading renders in Inter (not a
   fallback) in all six themes.
6. **Lint aggressiveness vs copy-own.** The ratchet won't flag the existing 326 (only
   _new_ flatness); registry blocks **warn, not block**, to respect copy-own ownership.
   Hard-block scoped to `packages/ui/src/components/` only.

---

## Net: what changes vs the original [02](02-systemic-backbone.md)

- **No `@utility`** — native `--text-*` companion keys carry all four dimensions and
  stay composable (the big mechanism correction).
- **8 roles** (added `caption`), declared via plain `@theme` (not `@theme inline`).
- **`--font-display`** added as the theme-author seam (sibling of `--font-mono`).
- The scale **snaps to Tailwind's steps** so 4 of the 6 re-points are visual no-ops.
- A concrete **ratchet gate + rule + hook**, and **two render-gated open values**
  (body leading; `CardTitle` rung) that must be settled by a six-theme
  `brand-ui-visual-ux-reviewer` sweep before merge.

This refinement supersedes the type-scale specifics in [02 §1–2](02-systemic-backbone.md);
[02](02-systemic-backbone.md) remains the authority for the non-type backbone (border
defects, zone/rail/badge tokens, `--chat-user`).
