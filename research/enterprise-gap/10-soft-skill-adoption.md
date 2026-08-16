# 10 · The "soft-skill" (high-end visual design) — evaluated, NOT adopted (decision record)

> Part of the **enterprise-gap** pack. Assessment of the **soft-skill**
> ([Leonxlnx/taste-skill › soft-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/soft-skill/SKILL.md)),
> the sibling of the taste-skill ([doc 09](./09-taste-adoption.md)). **Read doc 09 first.**
>
> **DECISION (this is a record, not a backlog item): NOT adopted.** The soft-skill is **brand/marketing
> register only** — it is not for App UI, which is brand-ui's purpose. Per `PROJECT.md` marketing is
> "the _occasional_ page," and the existing `@qlik-coe-emea/qlabs-components-marketing` components cover that. Building
> agency-tier marketing tooling into an app-first library is out of scope; **there is no working
> package for it** (the proposed WP-16 was cut). This doc is kept as the _rationale_ so the evaluation
> isn't repeated, and as the starting point **if** marketing/presales-demo polish ever becomes a real
> priority. (The genuinely App-UI-relevant anti-slop content — the "Jane Doe effect", perf guardrails,
> interactive states — lives in **WP-15** / [doc 09](./09-taste-adoption.md), which _is_ adopted.)

## What the soft-skill is (read in full)

"**high-end-visual-design**" / persona "**Vanguard_UI_Architect**" / "Principal UI/UX Architect &
Motion Choreographer (**Awwwards-Tier**)." Its objective, verbatim: engineer "**$150k+ agency-level
digital experiences**." It is the **more extreme, marketing/landing-page** sibling of the taste-skill —
almost pure **brand/creative register**. Sections:

1. **Core directive + "Variance Mandate"** — never the same layout twice; "Apple-esque / Linear-tier."
2. **"Absolute Zero" anti-patterns** — banned fonts (Inter, Roboto, Arial, Open Sans, Helvetica),
   banned icons (thick Lucide/FA/Material), banned borders/shadows (1px solid gray, harsh dark
   `shadow-md`), banned layouts (edge-to-edge sticky navbars, symmetric 3-col grids), banned motion
   (`linear`/`ease-in-out`, instant changes).
3. **Creative Variance Engine** — "roll the dice": a **Vibe archetype** (Ethereal Glass `#050505` /
   Editorial Luxury `#FDFBF7` / Soft Structuralism) + a **Layout archetype** (Asymmetrical Bento /
   Z-Axis Cascade / Editorial Split), each with mobile-collapse rules.
4. **Haptic micro-aesthetics** — the **"Double-Bezel" (Doppelrand)** nested card (outer shell + inner
   core, concentric radii); **island "button-in-button"** CTAs; macro-whitespace (`py-24`–`py-40`);
   **eyebrow tags**.
5. **Motion choreography** — fluid-island nav + hamburger morph, magnetic button physics, scroll
   interpolation (fade-up + blur), custom cubic-beziers, `IntersectionObserver` not scroll listeners.
6. **Performance guardrails** — transform/opacity only, blur on fixed/sticky only, grain on fixed
   pseudo only, z-index discipline. (Same as the taste-skill — good, brand-agnostic.)
7. **Execution protocol** + 8. **Pre-output checklist** ("reads as a $150k agency build").

In one line: **it's the agency/Awwwards marketing-landing aesthetic, dialed to maximum.**

## The critical fit assessment (sharper than doc 09)

**This is a brand-register-ONLY skill — even more so than the taste-skill.** It has essentially **zero
product/app/enterprise guidance**; it's "make a stunning marketing page." For brand-ui's **primary
audience** (dashboards, internal tools, data apps, AI/chat surfaces), almost all of its prescriptions
are **wrong or actively harmful**:

- Mandatory **variance / asymmetry / `-2deg` rotations** → wrecks the scannability/consistency a data
  dashboard needs.
- Mandatory **heavy scroll/entry motion + magnetic physics + glass blur** → accessibility + performance
  - restraint problems for app UI (the opposite of the product register's "calm, earned familiarity").
- **Double-bezel cards everywhere, squircle `rounded-[2rem]`, `py-24`–`py-40` whitespace** → not how a
  dense admin/data UI is built.
- **Banned 1px gray borders** and **banned symmetric grids** → brand-ui's tables/cards _rely_ on
  tokenized hairline borders and grids; this ban is correct for a hero, wrong for a data table.
- **Banned Inter** → brand-ui's product font; **hardcoded hex/fonts** (`#050505`, `#FDFBF7`, Clash
  Display, PP Editorial) → violate "semantic tokens only."

**But brand-ui has a brand register, and there it's exactly right.** The `@qlik-coe-emea/qlabs-components-marketing` package
(Hero, FeatureGrid, StatsBand, CTASection, LogoStrip, UseCaseCard) and the `brand-ui-audit` skill's
**brand-register bar** ("distinctiveness: committed color, required imagery, ambitious first-load
motion, a POV — _restraint without intent reads as mediocre_") are precisely where this skill belongs.
brand-ui's marketing surfaces are likely thin/generic; this skill is the playbook to elevate them.

**Verdict: adopt it strictly as the brand-register / high-expressiveness content — and keep it OUT of
the product-register audit and the core app packages.** Same rules as doc 09 (token-translate,
a11y-gate motion), applied even more strictly: **register = brand, only.**

## Relationship to doc 09 / WP-15 (compose, don't duplicate)

The soft-skill is **the high-expressiveness, brand-register pole of the taste profile WP-15 already
defines** (`register × density × motion × expressiveness`). So:

- The **adoption mechanism is WP-15's** — the taste profile + the register-gated, token-translated
  anti-slop audit. Don't build a parallel system.
- Its **shared content** (perf guardrails, custom-easing-over-linear, IntersectionObserver-not-scroll-
  listeners, the anti-slop instinct, the variance/expressiveness idea, the icon-weight rule) is already
  covered by WP-15 — reference, don't re-add.
- Its **NEW content** is **brand-register craft + marketing patterns** — **out of scope now (no
  working package; the proposed WP-16 was cut)**; captured below as the starting point _if_
  marketing/presales-demo polish is ever prioritized.

## What's NEW here (beyond doc 09) — captured for the record (not committed)

> The following would only matter **if** marketing becomes a priority. All as **token-driven
> `@qlik-coe-emea/qlabs-components-marketing` patterns + brand-register audit criteria**, never literals:

- **The "Double-Bezel" (Doppelrand) nested surface** — outer shell + inner core with concentric radii
  and an inner highlight. A genuinely premium, reusable pattern → a brand-register surface/Card variant
  (token-driven radii/shadows).
- **Island "button-in-button" CTA** (trailing icon in its own circular wrapper) → a brand-register
  Button/CTA variant.
- **Eyebrow tags** (micro pill above big headings) → a marketing primitive.
- **The Vibe + Layout archetypes** (Ethereal Glass / Editorial Luxury / Soft Structuralism × Bento /
  Z-Cascade / Editorial Split) → **marketing playbooks** (WP-09-style) + the "roll the dice" variance
  becomes options in the plugin's feel stage (at high expressiveness).
- **Scroll-choreography + fluid-island-nav** patterns → brand-register motion playbooks (a11y-gated).
- **The "$150k agency" pre-output checklist** → the **brand-register bar/checklist** in `brand-ui-audit`
  (distinct from the product-register checklist).

## What to LEAVE / RECONCILE (be critical)

Same as doc 09, plus sharper:

- **Hardcoded hex/fonts/classes** (`#050505`, `#FDFBF7`, Clash Display) → tokens, or drop. Non-negotiable.
- **The font + border + symmetric-grid bans are PRODUCT-HOSTILE** → they apply **only** to the brand
  register; they must **never** leak into the product-register audit (a 1px hairline border and a
  symmetric grid are correct, often _required_, in a data table).
- **"Banned Inter"** → keep brand-ui's product font; for marketing, a display font is a brand decision
  (a token), not this skill's specific pick.
- **Mandatory heavy motion** (scroll reveals, magnetic physics, glass) → brand-register + high
  motion-intensity only, **always** `motion-reduce`-safe + respecting `MotionPreference`.
- **The "$150k agency / never the same twice" framing** → aspirational for marketing surfaces; **does
  not apply to internal tools**, which _should_ be consistent and repeatable.

## If marketing ever becomes a priority — how it _would_ be adopted

_(Contingent and uncommitted — there is **no working package** for any of this. Captured so the
evaluation isn't repeated if the priority changes.)_

**A · brand-ui quality control:**

1. **Elevate `@qlik-coe-emea/qlabs-components-marketing`** with the new token-driven patterns: a **double-bezel surface**, an
   **island CTA**, an **eyebrow tag**, and the **vibe/layout archetypes as marketing playbooks** (WP-09
   pattern). Real components, semantic tokens, six-theme-safe, a11y-gated motion.
2. **Add the brand-register bar/checklist** to `skills/brand-ui-audit` (the soft-skill's pre-output
   matrix, token-translated) — **as the brand-register evaluation only.** The audit's existing
   product-vs-brand register split is the gate; this populates the _brand_ side. **Keep these criteria
   out of the product-register audit.**
3. Reuse WP-15's profile: these are the **brand register at high expressiveness** — no separate dial
   system.

**B · the customer plugin:**

- The greenfield **"landing / marketing page" archetype** at **high expressiveness** uses these
  patterns; the **Vibe + Layout archetypes** become the "roll the dice" **variance options** in the
  feel stage (previewed as real brand-ui renders).
- The **curated arsenal** (VP-04 / WP-15) gains the brand-register patterns (double-bezel, island CTA,
  z-cascade, editorial split) — offered **only** when the user is building a brand/marketing surface at
  high expressiveness, never for a dashboard.
- The brownfield `migrate` flow can offer a **"marketing-surface glow-up"** using the brand-register
  audit + patterns.

## Recommendation (decided: NOT adopted)

brand-ui is **app-first**; the soft-skill is **marketing/brand-register only** — so it is **out of
scope**. There is **no working package** for it (the proposed WP-16 was cut). This is consistent with
the project's own scope discipline (the "presentation layer, not an SDK" non-goal): don't build
agency-tier marketing tooling into an app-first component library. The existing 6 `@qlik-coe-emea/qlabs-components-marketing`
components + **WP-15**'s anti-slop bar are sufficient for "the occasional page." If customer-facing
**presales-demo or marketing polish** is ever prioritized, the patterns above are the ready starting
point — revisit then. The genuinely App-UI-relevant kernel from these skills (anti-slop **content**
checks, perf guardrails, interactive states, the density/motion taste profile) is **already adopted in
WP-15** — that's the part that serves dashboards and app UI.

---

_Related: [`09-taste-adoption.md`](./09-taste-adoption.md) + WP-15 (the taste profile this builds on),
`@qlik-coe-emea/qlabs-components-marketing`, `skills/brand-ui-audit` (brand register), WP-09 (playbooks), VP-02/VP-04
([`../vibe-coder-plugin/`](../vibe-coder-plugin/)). Source:
[soft-skill SKILL.md](https://github.com/Leonxlnx/taste-skill/blob/main/skills/soft-skill/SKILL.md)._
