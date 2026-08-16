---
TYPE: epic (tracking issue)
TITLE: "[ai] WP-15 — Adopt the taste-skill: anti-slop audit + taste profile (token-translated)"
LABELS: type:tech-debt, severity:P1, area:ai, area:tokens, needs-triage
---

## Summary

Harvest the **taste-skill** (anti-AI-slop catalog + dials + pre-flight) into brand-ui's **existing**
audit + rules + token dials, and wire it into the **customer plugin** — **token-translated,
register-gated, and accessibility-safe**. Do **not** install the skill as-is: its hardcoded
hex/font/class prescriptions violate "semantic tokens only," and its mandatory perpetual motion breaks
accessibility. Full analysis + the take/leave decisions: [`../../09-taste-adoption.md`](../../09-taste-adoption.md).

## Why this matters

brand-ui's audit already has a "does this look AI-generated?" verdict, an anti-patterns catalog, a /20
scorecard, and a product-vs-brand register — the taste-skill is a **sharper expression of the same
idea**. The highest-value, lowest-risk takeaway is its **content + visual anti-slop catalog**
(especially the "Jane Doe effect": generic names/avatars/fake numbers/slop brand names/filler words),
which the audit lacks today. The dials map onto brand-ui's existing density/motion/decoration knobs as a
**taste profile**.

## Child issues

- **issue-01-anti-slop-audit** — merge the AI-TELLS catalog (visual **and** content checks) + the
  pre-flight into `brand-ui-audit` (anti-patterns + the AI-generated verdict + the /20 scorecard),
  **token-translated**, with the styling/token rules winning conflicts; register-gated. _(P1)_
- **issue-02-taste-profile** — wire the three dials into the existing token system as a **taste
  profile** (`register × density(WP-06) × motion(MotionPreference) × expressiveness(decoration dial)`);
  the audit judges against the active profile. _(P1)_
- **issue-03-plugin-taste-wiring** — wire the **feel stage** (dials), the **anti-slop bar**, and a
  **curated arsenal** of premium patterns into the vibe-coder-plugin flows (greenfield feel stage +
  visual loop; brownfield taste-scoring). _(P1; depends on the vibe-coder-plugin VPs)_

## Definition of done

- The audit catches the taste-skill's visual **and** content slop (token-translated, register-gated);
  every recommendation references a `@brand` token, never a raw hex/font.
- A "taste profile" exists, backed by the density/motion/decoration tokens; the audit evaluates against
  it; defaults are **restrained** (product register), expressive is opt-in.
- The plugin offers the feel stage + enforces the anti-slop bar + offers curated, token-expressible
  premium patterns.
- No accessibility regression: any motion is `motion-reduce`-safe and respects `MotionPreference`.

## Dependencies

Builds on `skills/brand-ui-audit`, WP-06 (density), the motion tokens/`MotionPreference`, the
decoration dial; feeds WP-14 (release pre-flight) and the vibe-coder-plugin (VP-02/VP-03/VP-04). Pairs
with WP-12 (the taste rules become guidance) and WP-10 (gates).

> **See also — interaction guidelines** ([adoption record](../../12-interaction-guidelines-adoption.md)): this WP absorbs the **micro-typography + content/copy** items (`…`/curly quotes/nbsp/tabular-nums; active voice/Title Case/specific labels/errors-with-fix) into the AI-TELLS catalog + anti-slop audit.
