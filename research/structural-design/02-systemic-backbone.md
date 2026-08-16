# 02 · The systemic backbone (the keystone)

> The single most important idea in this redesign: **most of "flat / chaotic /
> harsh / noisy" is one missing layer — a semantic type scale plus a handful of
> token corrections — not the components and not the scenario.** Build this first;
> every component fix and the scenario itself become calmer for free. This is the
> `conceptual-framing.md` "systemic re-encoding over additive widget kit" move,
> applied literally.

Findings behind this doc: TYPE-1..7, BTN-1..4, MSG-1, ASSET-1.

> **Both halves of this doc are refined and superseded by their integration docs:**
> the type-scale specifics (§1–2) by
> [07-type-system-integration.md](07-type-system-integration.md) (native Tailwind v4
> mechanism, the `Text`/`Heading` API, the 6-re-point migration); the surface /
> separation specifics (§3–4) by
> [08-separation-surface-system.md](08-separation-surface-system.md) (the five
> channels, a token-light convention with **zero new token names + one `--chat-user`
> revalue**, no generic `<Surface>` primitive, free composition with the decoration
> overlay). This doc remains the **index** that frames why both are the keystone; the
> two integration docs are the authority for the concrete design.

---

## 1. The type scale (TYPE-1, TYPE-2) — `token-theme`, P0

### Why this is the root, not a symptom

- `themes.css` defines exactly **two** typography tokens: `--font-sans` in `:root`
  (`themes.css:108`) and `--font-mono` _only_ inside the `blueprint` block
  (`:1153`). The `@theme inline` bridge (`:961-1085`) maps colour + radius + motion
  and **nothing** for font-size, line-height, tracking or weight.
- Component source (excluding stories/tests) uses **`text-sm` ×193 + `text-xs`
  ×133 = 326** small-text utilities, against ~15 uses of anything `text-lg` or
  larger. With no role token to reach for, every author independently defaults to
  `text-sm`. **The flatness is the aggregate of hundreds of independent choices** —
  which is exactly why making the scenario's fonts bigger is a spot-fix that the
  next screen re-flattens.

### The fix: ~7 semantic _roles_ in `:root` + `@theme inline`

Typography is **theme-invariant** (the same scale in light, dark, blueprint…), so
declare it **once in `:root`**, not per theme block. Define _roles_, not raw sizes —
each bundling size + line-height + tracking + weight intent. Tailwind v4 reads
`--text-*` keys and emits matching `text-*` utilities.

| Role token                | ~size                   | Used for                                          |
| ------------------------- | ----------------------- | ------------------------------------------------- |
| `--text-display`          | ~30px / 1.875rem        | page / hero / the one headline KPI value          |
| `--text-title`            | ~20px / 1.25rem         | section + card + dialog titles (one rung for all) |
| `--text-subtitle`         | ~16px / 1rem            | sub-section, prominent body                       |
| `--text-body`             | **= current `text-sm`** | default body — _unchanged so layouts don't shift_ |
| `--text-secondary` (meta) | ~12px / 0.75rem         | metadata, captions, eyebrows                      |
| `--text-kpi`              | ~32-36px                | executive insight-card values                     |
| `--text-code`             | (mono)                  | code / JSON, tied to `--font-mono`                |

> **Critical guardrail:** keep `--text-body == text-sm`. Only the title / display /
> kpi rungs grow. This means the 326 existing `text-sm` sites stay correct and the
> change is non-breaking; hierarchy comes from _raising the title/value rungs_, not
> shrinking body.

Then the migration is **not** 326 edits — re-point the **shared primitives** to the
roles (TYPE-3/4/7): `CardTitle` (currently unsized, `card.tsx:265`), `SectionHeader`
(`text-xl`, `section-header.tsx:30`), `DialogTitle` (`text-lg`, `dialog.tsx:105`),
`MetricCard` value (`text-2xl`, `metric-card.tsx:60`), `MessageResponse`/Message
authorship (`message.tsx:37`), and the new grammar components. The scenario then
reads with hierarchy without touching the story.

### Make it load-bearing (enforcement over reminders)

Add a "Typography scale" section to `styling-and-tokens.md` and a gate (sibling of
the raw-hex check) that flags **new** raw `text-sm/text-xs` in component source.
Track the small-text count as a regression metric. Per `quality-gates.md`, a
convention ships with its enforcement.

---

## 2. `Text` / `Heading` primitive in `@qlik-coe-emea/qlabs-components-ui` (TYPE-7) — `missing-component`, P1

There is no typography primitive in `@qlik-coe-emea/qlabs-components-ui` — the only `Heading`/`Text` live in
`@qlik-coe-emea/qlabs-components-editor/prose` (markdown-scoped, capped at `text-2xl`, `prose.tsx:30-66`). So
an app author has nothing to import and re-hardcodes `text-sm`. Add `Text` + `Heading`
to `@qlik-coe-emea/qlabs-components-ui` mapping variants onto the role tokens (`Heading` level →
display/title/subtitle; `Text` variant → body/secondary/meta/kpi/code). Have editor's
prose `Heading`/`Text` **re-export or derive from** the `@qlik-coe-emea/qlabs-components-ui` primitive, and
have `markdown-scale.ts` consume the role tokens — so the markdown scale and the app
scale become one source of truth instead of two divergent ones (TYPE-4). Mirrors the
ADR-0012 `MetricCard` precedent (`@qlik-coe-emea/qlabs-components-ui` owns; editor re-exports). Architect-gated.

---

## 3. The two border defects are different — fix them differently

The maintainer's "harsh black-outline buttons" and "everything is a thin-bordered
box" _feel_ like one complaint but trace to **two different tokens**, and conflating
them produces the wrong fix.

### 3a. "Harsh black outline" = `--input` on non-field controls (BTN-1/2/3) — `component-choice`/`component-internal`, P1

- `outline` button = `border border-input bg-background` (`button.tsx:14`).
- `--input` is the deliberately **strong** rung: qlik-bright `oklch(0.65 0.014 252)`
  (= `--border-strong`), ~3.5× the lightness step from white vs the hairline
  `--border` (`oklch(0.9 …)`); **pure black `oklch(0 0 0)` in high-contrast**
  (`themes.css:763,762,760,640`). It is _correct_ for an editable field whose only
  boundary is its outline — and wrong on a fill-less button/chip where the boundary
  is redundant.

> **Do NOT soften the `--input` token** — that breaks form-field AA and the
> high-contrast theme. The fix is at the component layer: stop pointing low-emphasis
> controls at `outline`.

- **Share** (`agentic-workspace.stories.tsx:1024`) → `ghost` (chrome) or `secondary` (soft fill).
- **Deny** (`:787`, APPROVE-2) → `ghost`; only the green Approve carries weight.
- **Suggestion chips** (BTN-2, `suggestion.tsx:27`) → default to a **soft pill**
  (`variant="secondary"` or borderless `bg-secondary rounded-full`). `--secondary`
  is AA-safe in all six themes.
- **Composer** (BTN-3, `prompt-input.tsx:854` → `input-group.tsx:18`) → soft fill +
  ring: `border-border bg-surface-muted shadow-sm`, focus carried by the existing
  `focus-within` ring (`input-group.tsx:23`). The footer already draws a `border-t`
  (`chat-shell.tsx:36`), so the box border is redundant anyway.
- Add a calm **`outline-subtle`** button variant (`border-border` hairline, not
  `border-input`) for the legitimate "outlined but quiet" need, leaving real inputs
  (`Input`/`Textarea`/`Select`/`InputGroup`) on `border-input` untouched.

> **High-contrast caveat (needs-render):** ghost/secondary controls lose their
> black outline in high-contrast where `--input` is pure black. Confirm they keep a
> visible boundary there (may need a `border-strong` fallback _only_ in that theme).

### 3b. "Border noise" = the _subtle_ `--border`, applied uniformly (BTN-4) — `token-theme`, P0

Every interaction type independently wraps itself in `rounded border bg-background/card`
— `Tool` (`tool.tsx:24`), `Artifact` (`artifact.tsx:15`), `FileTree` (`file-tree.tsx:69`),
`Task` (`task.tsx:13`), `Alert` (`alert.tsx:6`), `Card` (`card.tsx:20`), `ChatShell`
(`chat-shell.tsx:27`) — all resolving to the **subtle** `--border` hairline via the
global `@layer base * { border-color: var(--color-border) }` (`themes.css:1107`).

> The border is _not_ harsh here — it is **undifferentiated**. The border channel
> carries zero type information, so the screen is a stack of identical rectangles.
> "Make the border lighter" is the wrong fix; it's already the hairline.

The fix is to **encode interaction type in a channel other than border**, then drop
borders where a fill / gap / elevation already separates the region (the
`styling-and-tokens.md` redundant-boundary test: _"if I deleted this line, could a
sighted user still tell the regions apart?"_ Yes → drop it). See §4 for the channels.
Long-term: codify a "one separation channel per region" rule (border XOR fill XOR
elevation XOR gap) + a review/lint heuristic that flags a `border` on a surface that
already has a non-default `bg-*` and a sibling gap.

---

## 4. The grammar's non-colour channel tokens (TYPE-6, MSG-1) — `token-theme`, P1

For each interaction type to own a channel (§[03](03-component-grammar.md)), the
channels must be **tokened**. Audit:

**HAVE but unused:**

- `--chat-user` / `--chat-assistant` tints — defined in all six themes, bridged to
  `bg-chat-*` (`themes.css:189-192,1030-1033`), **zero consumers**; `Message` uses
  `bg-secondary` (`message.tsx:38`). _And_ in qlik-bright `--chat-user` is set equal
  to `--secondary` (`:790`), so it must be **revalued** to a perceptibly stronger
  tint, not merely adopted.
- `--surface` / `--surface-muted` / `--surface-elevated` — exist; `bg-surface-elevated`
  used ~4×, `shadow-sm` ~21× across all component source. The "light elevation zone
  instead of a border" channel is tokened but barely used.

**MISSING (add to every theme block — theme-parity-gated):**

- **status-subtle surfaces** — `--success-subtle` / `--warning-subtle` /
  `--info-subtle` / `--destructive-subtle` (low-chroma tints, AA for their `-text`
  ink). Today only the `--success`/etc. **fills** + `-text` variants exist
  (`themes.css:142-154`). Needed by `StatusBadge` and `EvidenceChip`.
- **accent-rail roles** — for a left rail on `AgentStep` / `ApprovalCard` / the agent
  answer: reuse `--primary` (completed/positive), `--info` (in-progress), `--muted`
  (technical/debug). A rail replaces a full border.
- **an elevation ladder** documented as the sanctioned border-replacement:
  `surface → surface-muted → surface-elevated + shadow-sm`.

**Plus** `--font-mono` in `:root` (TYPE-5) so `font-mono` is intentional in every
theme instead of falling back to a clashing system stack — half of the
"different-font" complaint.

> **Every token-VALUE edit in this section (revaluing `--chat-user`, adding subtle
> surfaces) requires a `brand-ui-visual-ux-reviewer` six-theme sweep on the real
> scenario before merge** — the contrast gates prove ratios, not that recoloured
> surfaces still read well (`quality-gates.md`, Theme-safe).

---

## 5. Why the backbone comes first (dependency order)

```
type-scale tokens (TYPE-1) ──► Text/Heading primitive (TYPE-7) ──► re-point CardTitle/SectionHeader/MetricCard/Message (TYPE-3/4, MSG-3)
zone/rail/badge tokens (TYPE-6) ─────────────────────────────────► AgentStep / ApprovalCard / ToolResultCard / EvidenceChip own their channels
StatusBadge tokens (status-subtle) ──► StatusBadge primitive ────► Tool / ChainOfThought / Confirmation status converge
--chat-user revalue (MSG-1) ─────────► Message / UserMessage / AgentMessage
outline-subtle variant (BTN-1) ──────► Suggestion soft pill, Share/Deny, composer
```

Every arrow points _away_ from a token toward components and the scenario. Build the
left column (Phase 0) and the right columns get calmer for free. Sequence in
[06-phased-plan.md](06-phased-plan.md).
