---
TYPE: issue
TITLE: "[ai] Harvest the taste-skill anti-slop catalog into brand-ui-audit (token-translated)"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: WP-15
---

## Summary

Merge the taste-skill's **AI-TELLS** catalog (visual **and** content anti-slop) + its **pre-flight
matrix** into `skills/brand-ui-audit` — the anti-patterns reference, the /20 scorecard, and the
"does this look AI-generated?" verdict — **token-translated** and **register-gated**. The biggest add
is the **content** anti-slop the audit lacks today (the "Jane Doe effect").

## Source

[`../../09-taste-adoption.md`](../../09-taste-adoption.md) (What to TAKE / LEAVE); the taste-skill
SKILL.md §3, §5, §7, §10.

## Severity & impact

**P1.** Sharpens brand-ui's existing AI-slop detector with a richer, battle-tested catalog — directly
raises output quality for both the library and the plugin-generated apps.

## Current state & why the gap exists

`brand-ui-audit` has anti-patterns.md + an "AI-generated?" verdict + a /20 scorecard, but its catalog
is mostly _visual/token_ and has **no content anti-slop** (names/avatars/numbers/brand-names/filler).

## Proposed solution

- **Visual checks (token-translate, don't copy literals):** no pure black → `foreground` token; no
  neon/outer glow → tinted/inset shadow tokens; no oversaturated accent → palette discipline (max 1
  accent, <80% sat, one palette); no oversized H1 → hierarchy by weight/color; perfect alignment →
  spacing scale; "customize shadcn, never default" → use brand variants; no broken Unsplash → reliable
  placeholders. **The existing styling/token rules win** on any conflict.
- **Content checks (new — the high-value add):** flag generic names ("John/Jane Doe"), egg/Lucide
  avatars, predictable fake numbers (`99.99%`, `50%`), slop brand names ("Acme/Nexus/SmartFlow"), and
  AI filler words ("Elevate/Seamless/Unleash/Next-Gen"). Add to anti-patterns + the verdict.
- **Register-gate the opinionated ones:** anti-card / no-3-column-cards = advisory in **brand /
  high-density** register, not a hard ban (would break enterprise admin UIs).
- **Add a "taste / anti-slop" axis** to the /20 scorecard; fold the **pre-flight matrix** into the
  audit (and later the release gate, WP-14).
- Some checks are deterministic (regex on content/markup) → add to the `brand-ui audit` static pass;
  the rest stay in the rendered/LLM critique pass.

## Affected files

- [ ] `skills/brand-ui-audit/reference/anti-patterns.md` (merge, token-translated)
- [ ] `skills/brand-ui-audit/reference/ux-evaluation.md` (scorecard axis + content checks)
- [ ] `skills/brand-ui-audit/SKILL.md` (mention the taste axis + register-gating)
- [ ] `packages/cli` audit (new deterministic content/visual rules where feasible)

## Acceptance criteria

- [ ] The audit flags the taste-skill's visual **and** content slop, each with a `@brand` token / rule
      fix (never a raw hex/font).
- [ ] A "taste / anti-slop" axis is in the /20 scorecard + the AI-generated verdict.
- [ ] Opinionated checks (anti-card, etc.) are register-gated, not hard bans.
- [ ] No conflict with the styling/token rules (they win).

## Test to add

Fixture surfaces that contain slop (a "John Doe" + `99.99%` + a 3-col card row in product register) →
the audit flags them; a clean brand-ui surface → passes.

## Risks / ripple effects

- Don't import literals (hex/fonts) — translate to tokens. Don't over-flag legit enterprise patterns —
  register-gate. Keep content checks advisory where placeholders are intentional (note an allowlist).

## References

- `../../09-taste-adoption.md`; `skills/brand-ui-audit/`; taste-skill §3/§5/§7/§10.
