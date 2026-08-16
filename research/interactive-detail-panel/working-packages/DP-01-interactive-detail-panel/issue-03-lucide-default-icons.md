---
TYPE: issue
TITLE: "[icons] Make Lucide the default icon library — formalize, define the @qlik-coe-emea/qlabs-components-icons boundary, align versions, gate"
LABELS: type:tech-debt, severity:P2, area:icons, area:ui, needs-triage
WP: DP-01
---

## Summary

Adopt **Lucide (`lucide-react`) as brand-ui's default icon library** and make it the documented standard +
the value the **vibe-coder plugin sets for end-users**. This mostly **formalizes what's already true**
(Lucide is the de-facto default today) and closes the loose ends: define the boundary with
`@qlik-coe-emea/qlabs-components-icons`, fix a version split, and add a gate so the default holds without reminders.

> Co-located in **DP-01** at your request (alongside the Card detail panel) — the two are independent
> decisions sharing one working package.

## Source

User decision (2026-06-06): "we will use Lucide icons as a default icon library … also a decision which
the plugin should define for the end-user." Pack: [`../../README.md`](../../README.md).

## Current state (grounded — verified in the repo)

- **Lucide is already the de-facto default.** `lucide-react` is a dependency in `@qlik-coe-emea/qlabs-components-ui`, `@qlik-coe-emea/qlabs-components-ai`,
  `@qlik-coe-emea/qlabs-components-icons`, `@qlik-coe-emea/qlabs-components-editor`, and apps `playground` + `workbench`; **74 source files import it**
  (chevrons, X, search, bell, panel toggles, etc. — exactly the generic-UI glyph role).
- **Version drift:** everything is on `^0.469.0` **except `@qlik-coe-emea/qlabs-components-ai` on `^0.577.0`** — two `lucide-react`
  entries in the lockfile.
- **The boundary is currently mis-emphasized.** `packages/icons/src/index.ts` calls `lucide-react` an
  "OPTIONAL peer fallback" and says prefer a branded icon. That under-states Lucide's real role and
  contradicts "Lucide is the default."
- **No `.claude/rules/icons.md`** exists — the decision isn't written down anywhere enforceable.

So this issue is **formalize + clean up + enforce**, not a migration.

## The decision (of record)

- **Lucide = the default for general UI / utility icons** (navigation, actions, status, affordances).
  Reach for it first.
- **`@qlik-coe-emea/qlabs-components-icons` = brand / product-vocabulary icons + `BrandLogo`** — the monoline set that is part of
  the product's identity or must adapt to brand. Add an icon here only when it's genuinely brand/domain,
  not a generic glyph.
- **No third icon library** (react-icons, Heroicons, Font Awesome, Tabler, …). Lucide + `@qlik-coe-emea/qlabs-components-icons`,
  nothing else.

## Proposed solution

1. **Write it down where guidance lives (enforcement over reminders):**
   - New **`.claude/rules/icons.md`** stating the decision + the boundary + the a11y rules
     (decorative → `aria-hidden`; icon-only control → `aria-label`; ref `accessibility.md`), imported
     from `CLAUDE.md`.
   - Update `CLAUDE.md` (the `@qlik-coe-emea/qlabs-components-icons` package line), `AGENTS.md`, and the
     `skills/brand-ui/SKILL.md` icon-selection guidance to say **Lucide-default / @qlik-coe-emea/qlabs-components-icons-for-brand**.
   - **Fix the `@qlik-coe-emea/qlabs-components-icons` barrel comment** (`packages/icons/src/index.ts`) so it states Lucide is the
     **default** for generic UI icons (not a "fallback"), and `@qlik-coe-emea/qlabs-components-icons` is for brand/product icons.
2. **Align the version:** pick one `lucide-react` version (move `@qlik-coe-emea/qlabs-components-ai` off `^0.577.0` — or move all
   to the chosen latest stable), set it consistently across every `package.json`, `pnpm install`, confirm
   one lockfile entry. Decide dependency-vs-peer policy and apply it uniformly.
3. **Import convention:** named imports `from "lucide-react"` (the 74 files already do this — keep it; no
   re-export wrapper, which would only churn). Document the convention in the rule.
4. **Gate it (ties to WP-10 self-maintaining):** an ESLint rule / check that (a) **blocks any icon import
   that isn't `lucide-react` or `@qlik-coe-emea/qlabs-components-icons`**, and (b) **flags `lucide-react` version drift** across
   package.jsons. Wire into the existing hook/CI so the default can't silently erode.
5. **Plugin defines it for the end-user (cross-ref the vibe-coder-plugin stream):** the greenfield
   scaffold installs `lucide-react` (the aligned version) and its agent guidance encodes the
   Lucide-default / @qlik-coe-emea/qlabs-components-icons boundary; brownfield migration flags other icon libraries for
   conversion to Lucide. (Captured here per your "same working package" note; the plugin pack
   [`../../../vibe-coder-plugin/`](../../../vibe-coder-plugin/) consumes it.)

## Affected files

- [ ] `.claude/rules/icons.md` (new) + `CLAUDE.md` (rules import + icons line)
- [ ] `AGENTS.md`, `skills/brand-ui/SKILL.md` (icon-selection guidance)
- [ ] `packages/icons/src/index.ts` (barrel comment: Lucide = default, not "fallback")
- [ ] `packages/{ui,ai,icons,editor}/package.json` + `apps/{playground,workbench}/package.json` (one `lucide-react` version) + lockfile
- [ ] the lint rule / drift check + its hook/CI wiring (WP-10)
- [ ] cross-ref note into the vibe-coder-plugin handover (Lucide as a scaffolded default)

## Acceptance criteria

- [ ] Lucide is documented as the default icon library, with the `@qlik-coe-emea/qlabs-components-icons` boundary, in
      `.claude/rules/icons.md` + `CLAUDE.md` + `AGENTS.md` + `skills/brand-ui/SKILL.md`; the `@qlik-coe-emea/qlabs-components-icons`
      barrel comment no longer calls Lucide a "fallback."
- [ ] **One `lucide-react` version** across all packages/apps (no `0.469` vs `0.577` split); `pnpm install`
      clean; `pnpm typecheck` green after the bump.
- [ ] A gate **fails the build** on (a) a non-Lucide/non-`@qlik-coe-emea/qlabs-components-icons` icon import, or (b) `lucide-react`
      version drift.
- [ ] The vibe-coder plugin scaffolds Lucide as the default + encodes the boundary for end-users
      (cross-ref recorded; implemented in the plugin stream).

## Test to add

Import-allowlist lint fixture (a file importing `react-icons`/`@heroicons` fails the rule; `lucide-react`

- `@qlik-coe-emea/qlabs-components-icons` pass). A version-drift check fixture (mismatched `lucide-react` ranges fail).

## Risks / ripple effects

- **Version bump may rename a few icons** (Lucide occasionally renames/aliases) — run `typecheck` + the
  story/test suite after aligning; the 74 imports mostly use stable names.
- **Don't over-restrict** — the gate must allow the existing 74 `lucide-react` imports + `@qlik-coe-emea/qlabs-components-icons`;
  it only blocks _other_ libraries and drift.
- Keep `@qlik-coe-emea/qlabs-components-icons` first-class for brand icons — this decision sets default emphasis, it does **not**
  deprecate `@qlik-coe-emea/qlabs-components-icons`.

## References

- `packages/icons/src/index.ts` (current barrel comment); `.claude/rules/accessibility.md` (icon a11y),
  `styling-and-tokens.md`; enterprise-gap **WP-10** (self-maintaining gates), **WP-12** (guidance
  consistency); the **vibe-coder-plugin** pack (plugin-defines-defaults).
