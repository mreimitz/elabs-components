# ADR 0020 — The taste profile: one named object over the shipped dials, and `expressiveness` IS `--decoration`

**Status:** Accepted
**Date:** 2026-08-01
**Issues:** #72 (WP-15 taste adoption), #108 (taste profile), #109 (plugin wiring)

## Context

WP-15 adopted the taste-skill's AI-tells catalog into the deterministic detector
(`packages/cli/lib/audit.mjs`, #107) and the `brand-ui-audit` skill scores a
"taste & anti-slop" axis "against the active taste profile (register × density ×
motion × expressiveness)".

That profile did not exist as an artifact. Three of the four axes shipped as
independent, first-class token dials:

| Axis               | Shipped as                                                           |
| ------------------ | -------------------------------------------------------------------- |
| **density**        | `DensityMode` / `DENSITY_META` / `density.css` (`data-density`)      |
| **motion**         | `MotionPreference` + the `--motion-factor` gate (`data-motion-pref`) |
| **expressiveness** | `DECORATION_LEVELS` (0–10) + `decoration.css` (`data-decoration`)    |
| **register**       | — nothing                                                            |

So "the active taste profile" was prose. Nothing assembled the axes; nothing
exposed them; the audit skill's Setup step told a human to _pick_ the register by
hand, which means two runs over the same code could disagree, and a generated app
had no way to record what it was aiming for.

Two design questions had to be settled before writing any code.

### Q1 — is `expressiveness` a fourth dial?

No. `--decoration` (0–10) already encodes exactly this: hue-independent
"how much drafting texture / how expressive is this surface", 0 = plain themed
UI, 10 = full reprographic. Epic #72's own axis list writes it as
`expressiveness(decoration dial)`. Minting `--expressiveness` would have created
two knobs for one concept — the precise failure `.claude/rules/conceptual-framing.md`
warns about ("prefer a systemic re-encoding of an existing dial over additive
parts").

### Q2 — does `register` get a CSS variable?

No. The register is a **judgment** setting ("which bar is this surface judged
against"), not a visual one. Nothing in `themes.css` should key off it — a brand
surface is not a different theme, it is the same tokens held to a different
standard. Giving it CSS would invite components to fork behaviour on it.

## Decision

1. **`TasteProfile` is one object over the axes that already exist** —
   `{ register, density, motion, expressiveness }` in
   `packages/tokens/src/theme-types.ts`, with `DEFAULT_TASTE_PROFILE` =
   **product / comfortable / system / 0**. Restrained is the default;
   expressive is opt-in.

2. **`expressiveness` IS the decoration dial.** `TasteProfile.expressiveness` is
   typed `DecorationLevel` and is populated from `effectiveDecoration`. There is
   **no** `--expressiveness` CSS variable and there never will be — set it with
   `useDecoration().setDecoration` / `data-decoration` / `<DecorationProvider>`.

3. **`register` is the one new axis, and it has no CSS.** `TASTE_REGISTERS =
["product", "brand"]`, `DEFAULT_TASTE_REGISTER = "product"`. `ThemeProvider`
   owns it (`defaultRegister`, `setRegister`, persisted under
   `brand-ui-taste-register`) and writes `data-register` on the root **purely as an
   inspectable seam** — an audit or agent can read the active register off the DOM.
   Because no stylesheet keys off it, the attribute is written for both values
   (unlike `data-density`/`data-decoration`, which omit their identity value to
   avoid a first-paint flash — there is nothing here to flash).

4. **The profile is machine-readable, so tooling reads it instead of asking.**
   - `brand-ui.manifest.json` carries a `taste` block (vocabulary + defaults),
     parsed out of `theme-types.ts` so it cannot drift from the types.
   - `brand-ui info [--json]` reports the **resolved active profile**: those
     defaults, overridden by an optional project-root `brand-ui.config.json`
     `taste` key. Invalid values degrade to the default and are reported — a typo
     must never break the audit.
   - `brand-ui audit` judges severities against that register (below), and
     `mcp__brand-ui__info` / `mcp__brand-ui__audit` expose the same.

5. **Register gating only ever SOFTENS, and only the tells that are genuinely a
   register call.** In the `brand` register, `over-round`, `side-stripe` and
   `bounce-easing` drop from blocking to advisory (a marketing hero is allowed to
   be expressive). Nothing a repo rule bans outright — raw color, `gradient-text`,
   sub-12px text, custom cursors — is negotiable, and **content slop is slop in
   both registers**. The perceptual register-gated tells (3-equal-cards,
   anti-card-overuse) stay in the skill's rendered pass; a regex cannot read them
   honestly.

6. **The motion axis is asymmetric: a PROJECT-declared profile may not say
   `"full"`.** `MotionPreference` has three values, but they are not
   interchangeable settings on one scale. Per the precedence table
   (`docs/MOTION_GUIDELINES.md`; rules at the end of `themes.css`),
   `[data-motion-pref="full"]` is the only state that holds `--motion-factor: 1`
   through an OS `prefers-reduced-motion: reduce` request, and the third-party
   animation backstop is scoped `:not([data-motion-pref="full"])` — i.e. `full` is
   an **informed-consent override of a stated accessibility preference**. Consent
   belongs to the person, not to the app: a `taste.motion` a spec/scaffold/config
   declares is `system` (the default — full motion whenever the OS is neutral) or
   `reduced`. `full` stays reachable only through `useMotionPreference()`, a
   control the user operates for themselves. Enforced by the app-spec schema's
   `taste.motion` enum (`pnpm app-spec:check`); the runtime type keeps all three
   values because the user-facing control needs the third.

7. **The active config is resolved NEAREST-FIRST from the subject being judged.**
   `tasteSearchDirs({ target, cwd, root })` searches the audited path's own
   ancestors, then the cwd, then the monorepo root, in ascending precedence — so
   `brand-ui audit <generated-app>` run from anywhere judges that app against the
   `brand-ui.config.json` the scaffold wrote beside it, not against the host
   repo's. (The first cut consulted only cwd + root and let root win, which meant
   the generated config was ignored for exactly the invocation the new-app skill
   prescribes.)

8. **The anti-slop bar is an exit code, not a paragraph.** `brand-ui audit
--strict` exits 1 on any blocking style finding or any content slop, and the
   headline counts content slop in its own bucket ("N style issue(s), M
   content-slop (blocking), K advisory") rather than folding it into "advisory".
   Non-strict runs still exit 0 — the audit stays a read-only reporter by default,
   and `--strict` is what the generated app's `audit:brand-ui` script and the
   new-app "Verify before done" step invoke. Per
   `.claude/rules/quality-gates.md` ("Enforcement over reminders"), a bar the
   skills call blocking has to be able to FAIL.

## Consequences

**Positive**

- "The active taste profile" is now data the tooling reads (#72 AC4), not a
  question a human answers differently each run.
- No new CSS dial, no new token, no theme-parity work: `pnpm theme-parity:check`
  is untouched because nothing was added to `themes.css`.
- Zero visual change to any existing screen — every default is the value already
  in force.
- A scaffolded app can record its intended feel in `brand-ui.config.json` and in
  `<ThemeProvider defaultRegister=… defaultDensity=… >`, and the audit that runs
  over it will judge it against exactly that.

**Negative / accepted**

- `register` is persisted per-browser like the other dials, so a user could flip
  the register of an app that never offers UI for it. Harmless — nothing renders
  differently — but it means the DOM attribute is a hint, not an authority; the
  authority for CI purposes is `brand-ui.config.json`.
- Two ways to spell the same dial (`expressiveness` in the profile,
  `decoration` in the dial API). Mitigated by the TSDoc on both, this ADR, and the
  `expressivenessDial: "--decoration"` field carried in the manifest.

## Alternatives considered

- **A fourth `--expressiveness` CSS variable.** Rejected per Q1: two knobs, one
  concept; guaranteed drift between `data-decoration` and `data-expressiveness`.
- **A separate `TasteProvider`.** Rejected: three of the four axes already live in
  `ThemeProvider`'s state, so a second provider would have to mirror them and
  could desynchronize. The profile is derived, not stored.
- **A `taste` key in `package.json`.** Rejected: `brand-ui.config.json` keeps the
  door open for other CLI configuration and avoids polluting a published manifest.

## References

- `packages/tokens/src/theme-types.ts` — `TASTE_REGISTERS`, `TasteProfile`, `DEFAULT_TASTE_PROFILE`
- `packages/tokens/src/theme-provider.tsx` — `useTasteProfile()`, `data-register`
- `packages/cli/lib/core.mjs` — `parseTaste`, `resolveTasteProfile`, `tasteSearchDirs`
- `skills/brand-ui-new-app/reference/app-spec.schema.json` — `taste.motion` (no `"full"`)
- `packages/cli/lib/audit.mjs` — `brandTolerant` rules + `scanText({ register })`
- `.claude/rules/theming.md` — the taste-profile section
- ADR [0003](./0003-theming-model.md) (theming model), ADR [0005](./0005-motion-system.md) (motion)
