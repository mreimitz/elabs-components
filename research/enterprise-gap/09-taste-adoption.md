# 09 · Adopting the "taste" skill — anti-slop judgment, token-translated

> Part of the **enterprise-gap** pack. How to adopt the **taste-skill**
> ([Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md))
> into (a) brand-ui's own **quality control** and (b) the **customer plugin** (vibe-coder-plugin) —
> with a critical fit assessment first, because adopting it raw would break brand-ui's core rules.
> Actioned as **WP-15**.

## What the taste-skill is (read in full)

"**design-taste-frontend / High-Agency Frontend Skill**" — an opinionated senior-UI/UX skill that
deliberately **overrides LLM design biases** to produce premium, non-generic frontends. Ten sections:

1. **Three dials** — `DESIGN_VARIANCE` (8), `MOTION_INTENSITY` (6), `VISUAL_DENSITY` (4) as global
   variables driving the rest.
2. **Architecture conventions** — dependency verification, RSC interactivity isolation, Tailwind
   version lock, anti-emoji, `min-h-[100dvh]` not `h-screen`, grid-over-flex-math, Phosphor/Radix icons.
3. **Design-engineering directives (bias correction)** — deterministic typography (ban Inter, ban serif
   on dashboards), color calibration (max 1 accent, <80% saturation, the "**LILA ban**" = no AI
   purple/blue), anti-center layout, anti-card-overuse, mandatory interactive states, form patterns.
4. **Creative proactivity** — liquid glass, magnetic micro-physics, perpetual micro-interactions,
   layout transitions, staggered orchestration.
5. **Performance guardrails** — animate only `transform`/`opacity`, grain on fixed pseudo-elements
   only, z-index restraint.
6. **Dial definitions** — what each 1–10 level means.
7. **AI TELLS (forbidden patterns)** — the richest part: a large **anti-AI-slop catalog** (no neon
   glow, no pure black, no oversaturated accents, no oversized H1, the "**Jane Doe effect**" — generic
   names/avatars/fake numbers/slop brand names/filler words, no 3-column card rows, no broken Unsplash,
   customize shadcn).
8. **Creative arsenal** — a big library of premium patterns (bento, masonry, parallax tilt, spotlight
   card, sticky-scroll stack, kinetic marquee, dock magnification, …).
9. **Motion-engine bento paradigm** — a "Bento 2.0" SaaS-dashboard architecture with perpetual motion.
10. **Pre-flight check** — a final QA matrix.

In one line: **it's an anti-slop, premium-craft, opinionated frontend taste enforcer.**

## The critical fit assessment (read this before adopting anything)

There is a real tension you must resolve deliberately:

|                  | brand-ui                                                                        | taste-skill                                                                              |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Values live as   | **semantic tokens** (no raw hex/font outside `themes.css`)                      | **hardcoded** hex/fonts/classes (`#f9fafb`, `slate-200/50`, `Geist`, `rounded-[2.5rem]`) |
| Default register | **product / restrained** ("earned familiarity", app-first)                      | **creative / brand** (variance 8, motion 6, perpetual animation)                         |
| Type             | a committed brand font (Inter in the Qlik themes)                               | **bans Inter**; prescribes `Geist`/`Satoshi`                                             |
| Color            | committed brand themes (qlik-bright/dark, six themes)                           | bans purple; prescribes emerald/electric-blue                                            |
| Cards            | a first-class `Card` + card grids                                               | **anti-card-overuse**, **no 3-column card rows**                                         |
| Motion           | restrained, tokened, `motion-reduce` + a MotionPreference (system/reduced/full) | **mandatory perpetual/infinite motion** on "every card"                                  |

**Verdict: adopt the skill's _structure and anti-slop judgment_, NOT its hardcoded prescriptions.**
Re-express every useful rule as a **brand-ui token/rule**; reconcile each conflict in brand-ui's favor
or **register-gate** it (product vs brand); never bolt it on raw — raw, it violates "semantic tokens
only," fights the brand, and (worst) breaks accessibility with mandatory motion.

**The good news:** brand-ui already has the bones the taste-skill sharpens —

- `skills/brand-ui-audit` already produces a **"does this look AI-generated?" verdict**, an
  **anti-patterns catalog** (`reference/anti-patterns.md`), a **/20 scorecard**, a **9-state
  inventory**, and a **product-vs-brand register**;
- the system already has **dial-shaped knobs**: a **density axis** (WP-06), **motion tokens +
  MotionPreference**, and the **decoration dial** (`--decoration` 0–10).

So this is a **harvest into what exists**, not a new bolt-on. The taste-skill is a richer expression of
brand-ui's own audit philosophy — mine it for content and structure.

## What to TAKE (high value, brand-agnostic — token-translate)

- **The AI TELLS anti-slop catalog (the headline).** Merge into `brand-ui-audit`'s
  `anti-patterns.md` + the "AI-generated?" detector — each rule **token-translated**:
  - "no pure black" → use the `foreground` token, never `#000`; "no neon/outer glow" → tinted/inset
    shadows via tokens; "no oversaturated accent" → token palette discipline (already AA-audited);
    "no oversized H1 / control hierarchy by weight" → typography-token guidance; "perfect
    alignment/spacing" → the spacing scale; "customize shadcn, never default" → use brand variants.
  - The **"Jane Doe effect"** (generic names, egg avatars, `99.99%`/`50%` fake numbers, "Acme/Nexus"
    slop brand names, filler words "Elevate/Seamless/Unleash") — a genuinely valuable, brand-agnostic
    **content anti-slop** check the audit lacks today. Add it.
  - "no broken Unsplash → reliable placeholders" — a concrete asset rule.
- **The three dials → wire to brand-ui's existing dials** (the _concept_, not the values):
  `VISUAL_DENSITY` → the **density axis** (WP-06); `MOTION_INTENSITY` → **motion tokens +
  MotionPreference**; `DESIGN_VARIANCE` → a new **"expressiveness"** knob, kin to the **decoration
  dial** + the register. Together they form a **"taste profile"** = `(register, density, motion,
expressiveness)` — a parameterized, token-backed taste, exactly brand-ui's dial philosophy.
- **Interactive-states mandate** (loading/empty/error/tactile) → reinforces `StatePanel` (WP-13) + the
  audit's 9-state inventory; add the **tactile `:active` feedback** rule (token-gated, motion-safe).
- **Performance guardrails** (animate only `transform`/`opacity`, hw-accel, z-index restraint, grain
  on fixed pseudo-only) → fold into the motion/perf rules (`docs/MOTION_GUIDELINES.md`).
- **Layout best practices** — `min-h-[100dvh]` not `h-screen`; **grid over flex-percentage-math**;
  contain with the max-width tokens. Brand-agnostic; add as rules.
- **Anti-emoji, dependency verification, RSC interactivity isolation** — sensible; add/confirm as rules
  (the RSC `"use client"` boundary already exists in the component rules).
- **The pre-flight matrix** → a **taste checklist** folded into the release gate (WP-14) + the audit.

## What to LEAVE or RECONCILE (be critical — these conflict)

- **Hardcoded hex/fonts/classes** (`#f9fafb`, `slate-200/50`, `rounded-[2.5rem]`, `Geist`/`Satoshi`):
  **reject the literals.** Translate to tokens or drop. This is brand-ui's #1 rule — non-negotiable.
- **"Ban Inter" / prescribe Geist:** brand-ui's font is a **brand token** (Inter in the Qlik themes).
  Keep it. Adopt the _principle_ ("deliberate, not default type") — not the specific ban.
- **"LILA ban" / prescribe emerald/electric-blue:** brand-ui has **committed brand palettes**; the
  colors are the brand's, not the skill's. Adopt the _discipline_ (max 1 accent, <80% saturation,
  neutral base, one palette per output) as token/audit guidance — not the specific hues. (Note: the
  audit already caught the brand green at 3.61:1 — the discipline is welcome; the prescription isn't.)
- **Anti-card / no-3-column-cards:** do **not** hard-ban (would break legitimate enterprise admin
  UIs). Make it an **advisory anti-pattern in the brand / high-density register**, register-gated.
- **Mandatory perpetual/infinite motion ("every card loops"):** this is an **accessibility red line**
  and conflicts with the product-register restraint. Adopt **only** at high `MOTION_INTENSITY` /
  brand register, **always** with a `motion-reduce:` neutralizer and respecting the `MotionPreference`
  (system/reduced/full). Default product UI stays calm.
- **Heavy motion libs (Framer Motion / GSAP / ThreeJS):** free (OK on no-paid-deps) but heavy and
  creative. Map motion intensity to **brand-ui motion tokens** for app UI; reserve the libs for
  **brand/marketing surfaces**, isolated client leaves — not the core component packages.
- **Default dials (variance 8 / motion 6):** too expressive for brand-ui's **product default**.
  brand-ui's baseline should be **low variance/motion (restrained)**; high values are an explicit,
  register-gated opt-in.

## Adoption A — into brand-ui's quality control (the repo)

1. **Merge the anti-slop catalog** into `skills/brand-ui-audit/reference/anti-patterns.md`,
   **token-translated**, and add a **"taste / anti-slop" axis** to the /20 scorecard and the
   "does this look AI-generated?" verdict (incl. the new **content** checks — names/avatars/numbers/
   brand-names/filler). The existing **styling/token rules win** on any conflict.
2. **Add the brand-agnostic rules** (`.claude/rules/`): performance/motion (transform/opacity, perf
   guardrails), layout (`100dvh`, grid-over-flex-math), anti-emoji, asset placeholders — all
   **deferring to** the token/styling rules.
3. **Wire the dials** into the existing token system as a **taste profile** (`register × density ×
motion × expressiveness`), reusing the density axis (WP-06), motion tokens, and the decoration dial.
   The audit evaluates against the _active profile_ (e.g. a dashboard at product/low-motion is judged
   differently than a marketing page at brand/high-motion).
4. **Register-gate everything:** product (default) = restrained; brand (`@qlik-coe-emea/qlabs-components-marketing`,
   landing) = expressive. (The audit already has this register split — extend it.)
5. **Fold the pre-flight** into the **release gate** (WP-14) and the audit, as a taste checklist.

## Adoption B — into the customer plugin (vibe-coder-plugin)

- **The dials become the "feel" stage** of the greenfield `new-app` flow (doc 02, stage 5 + a new
  _expressiveness_ choice): the user picks **register + density + motion + expressiveness** → mapped to
  brand-ui **tokens/themes** (never hardcoded values). One slider set, token-backed.
- **The anti-slop catalog + pre-flight become the quality bar** the scaffold and the **visual-feedback
  loop** enforce — the "does this look AI-generated?" gate runs on generated output so vibe-coded apps
  don't ship generic AI slop (incl. the content checks: no "John Doe", no `99.99%`, no "Acme").
- **The creative arsenal becomes curated visual options** in the propose→preview→pick loop (doc 02 /
  VP-04) — but **only the patterns expressible with brand-ui components + tokens** (bento grid, split
  hero, spotlight card, sticky-scroll stack…), register- and motion-gated, previewed as **real
  brand-ui renders** (the Storybook-MCP advantage).
- **The brownfield `migrate` flow** uses the same anti-slop audit to **score the existing app** and
  propose **taste upgrades** alongside the component migration.

## Recommendation

**Do not install the taste-skill as-is.** Adopt it as **WP-15**: harvest its anti-slop catalog +
dials + pre-flight into brand-ui's **existing audit + rules**, _token-translated, register-gated, and
accessibility-safe_, then wire the **taste profile + anti-slop bar + curated arsenal** into the plugin
flows. It is a **sharpening of brand-ui's own audit philosophy**, not a replacement — and its
hardcoded, creative-register prescriptions must be reconciled with brand-ui's token system and
product-register default. The single highest-value, lowest-risk takeaway is the **content + visual
anti-slop catalog** (especially the "Jane Doe effect"), which brand-ui's audit lacks today.

---

\*Related: `skills/brand-ui-audit` (the home for the catalog), WP-06 (density), `docs/MOTION_GUIDELINES.md`

- MotionPreference (motion), the decoration dial (expressiveness), WP-14 (release pre-flight), WP-02
  (greenfield feel stage) + VP-04 (visual loop) in [`../vibe-coder-plugin/`](../vibe-coder-plugin/).
  Source: [taste-skill SKILL.md](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md).\*
