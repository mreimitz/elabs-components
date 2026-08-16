---
TYPE: issue
TITLE: "[tokens] Taste profile — wire the taste-skill dials into brand-ui's token dials"
LABELS: type:tech-debt, severity:P1, area:tokens, area:ai, needs-triage
WP: WP-15
---

## Summary

Adopt the taste-skill's three dials as a **token-backed "taste profile"** rather than hardcoded global
variables: map `VISUAL_DENSITY` → brand-ui's **density axis**, `MOTION_INTENSITY` → **motion tokens +
`MotionPreference`**, and `DESIGN_VARIANCE` → a new **"expressiveness"** knob kin to the **decoration
dial** — all gated by **register** (product vs brand). One coherent, parameterized taste, expressed in
tokens.

## Source

[`../../09-taste-adoption.md`](../../09-taste-adoption.md) (the dials → existing dials mapping).

## Severity & impact

**P1.** Turns the taste-skill's "global variables" into something brand-ui-native and reusable: the
audit can judge against the active profile, and the plugin can let a user pick a feel — without ever
hardcoding values.

## Current state & why the gap exists

brand-ui already has dial-shaped knobs (density WP-06, motion tokens + MotionPreference, the decoration
dial 0–10) but no unified "taste profile" that ties them together, and no "expressiveness" axis.

## Proposed solution

- Define a **taste profile** = `{ register: product|brand, density: 1–10, motion: 1–10,
expressiveness: 1–10 }`, each axis backed by existing tokens:
  - **density** → the WP-06 density axis (comfortable…cockpit).
  - **motion** → motion-duration/easing tokens + `MotionPreference` (system/reduced/full);
    high motion **always** ships `motion-reduce:` neutralizers.
  - **expressiveness** → relate to the decoration dial (`--decoration`) + layout variance guidance
    (asymmetry, hero patterns) — token/rule-driven, not hardcoded classes.
- Set **restrained defaults** (product register, low motion/variance) — the opposite of the
  taste-skill's creative defaults (variance 8/motion 6), which suit brand register only.
- Expose the active profile to the audit (issue-01 judges against it) and to the plugin (issue-03).
- Document the profile in the guidance (WP-12) so agents pick it correctly.

## Affected files

- [ ] `packages/tokens/*` (expressiveness axis if needed; profile resolution) — reuse density/motion/decoration
- [ ] `skills/brand-ui-audit` (read the active profile)
- [ ] `.claude/rules` / WP-12 guidance (document the profile + restrained defaults)

## Acceptance criteria

- [ ] A taste profile (`register × density × motion × expressiveness`) exists, fully token-backed.
- [ ] Defaults are restrained (product/low); expressive is an explicit opt-in.
- [ ] High motion is `motion-reduce`-safe and respects `MotionPreference` (no a11y regression).
- [ ] The audit evaluates against the active profile.

## Test to add

Render a surface at two profiles (product/calm vs brand/expressive) across six themes; assert tokens
change appropriately and reduced-motion is honored.

## Risks / ripple effects

- Don't reintroduce raw values — every axis resolves to tokens. Keep the default calm so product UIs
  aren't over-animated.

## References

- `../../09-taste-adoption.md`; WP-06 (density), `docs/MOTION_GUIDELINES.md` + MotionPreference,
  the decoration dial (`.claude/rules/blueprint-decoration.md`); WP-12 (guidance).
