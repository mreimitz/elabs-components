# ADR 0027 — The `--ring` focus-indicator contract

- Status: Accepted, **partially superseded 2026-08-16** (see Amendment)
- Date: 2026-08-10

## Amendment (2026-08-16) — the reference themes now alias `--ring: var(--primary)`

**Clauses 1 and 3 of the Decision below no longer describe what ships**, and the
section "Why not simply `--primary`" argues against the value the reference
themes now carry. Read this amendment before acting on anything further down.

**What changed.** Both reference themes declare `--ring: var(--primary)` — the
focus indicator is the brand plate itself, by explicit maintainer decision, taken
with the cost below stated and accepted. `:root` is deliberately NOT aliased and
keeps an independent, compliant ring.

**The cost, plainly.** In the `light` theme the lime plate measures **1.23–1.42:1**
against the five mark surfaces. A keyboard user cannot see where focus is. This
fails **WCAG 2.4.7 (Focus Visible)** and **1.4.11 (Non-text Contrast)**. The `dark`
theme renders the same token at 10.26–12.46:1 and is unaffected. This is a known,
signed-off regression, not an oversight — do not "discover" it and quietly deepen
the token back.

**What was removed to let it land**, so that nothing warns you:

| Guard                                    | Where                     | State                                                                                      |
| ---------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `(--ring, --primary)`                    | `MUST_DIFFER`             | deleted — the pair the alias intentionally breaks                                          |
| `(--ring, --chart-1)`                    | `MUST_DIFFER`             | deleted — with the alias it IS `(--primary, --chart-1)`, a pair this repo declines to gate |
| `ring ≥ 3:1 on every mark surface`       | `themes-contrast.test.ts` | exempted for `light` only; still asserted for `dark` and `root`                            |
| `--ring is … a distinct rung` (clause 3) | `themes-contrast.test.ts` | deleted — it demanded separation from the token the ring now aliases                       |

**What still holds.** Clause 1 (hue family) is kept and still asserted: #334's
failure mode was a maintainer walking the ring out of the palette entirely while
every other gate stayed green, and that is still worth preventing. Clause 4
(`--sidebar-ring: var(--ring)`) is unchanged. Two new assertions replace what was
lost — the `light` exemption fails if that theme's ring ever _clears_ 3:1 (so the
exemption cannot outlive the decision), and a structural check requires the token
to be the `var(--primary)` mirror rather than a hand-copied literal (#385).

**The compliant repair, if this is revisited.** A **compound indicator**: keep the
lime and add a dark contour layer so one edge of the ring clears 3:1 against both
the lime and the page. That is a sweep of every `focus-visible:ring-ring` call
site behind a shared utility — an implementation change, not a token change. It is
the only known way to have both the brand colour and a visible focus indicator on
a near-white canvas; deepening the token is the other way, and it is the thing
this amendment decided against.

## Context

`--ring` is the one identity-adjacent token in the system that shipped with no
stated contract. Every other token in its tier is unambiguously one thing or
the other — `--primary`/`--chart-1..5` are declared brand, `--border`/`--muted`/
`--input` are declared neutral machinery — but nothing in `themes.css`,
`theming.md`, `styling-and-tokens.md`, ADR 0003 or `packages/tokens/README.md`
ever said which `--ring` was. #334 found `--ring` byte-identical to `--info` in
both reference themes (a focus ring reading as an "Info/Running" chip) and moved it
to a dedicated blue to satisfy distinctness. That fix was correct on its own
terms — but distinctness is satisfiable by leaving the brand palette entirely,
which is the cheapest move available when nothing says a replacement has to
stay in-family. Nothing pushed back, because there was no contract to push
back with. The `--ring` declaring comment in each theme block of `themes.css`
recorded only a negative — "BLUE focus ring — distinct from the green brand AND
(#334) from `--info`" — never a positive statement of what `--ring` _is_. (That
comment is superseded: this ADR's companion value change, issue #427 Part B,
rewrote it in place to the brand-derived rationale quoted in "Decision" below —
so the sentence above is describing history, not something you can still find
verbatim at either theme's `--ring` declaration.)

The absence is not merely untidy. The system's own promise
(`.claude/rules/design-system.md`) is _"Re-branding is a token change, not a
component change."_ A token with no declared contract cannot be re-branded
safely: a consumer cannot see that it is gated against four other roles, cannot
see the WCAG 1.4.11 surface obligations, and has no documented list of what a
replacement must satisfy. A downstream consumer on
`@elabs-ai/components-tokens` 3.0.0 hit exactly this: they shipped a
private per-theme override aliasing `--ring` to `--primary-text` because there
was no supported alternative — and that value measures **ΔE 0.0432 vs
`--success`** (below the 0.05 floor `pnpm roles:check` enforces) and is
byte-identical to `--primary-text`, which the existing
`themes-contrast.test.ts` "not byte-identical" assertion would already have
caught had it applied to a consumer's fork. A documented contract without the
numbers would not have saved them; the numbers are why this ADR exists.

Two facts change the shape of the fix. First, **`:root` (the neutral fallback)
already follows the convention this ADR states**: `--ring: oklch(0.45 0.21 264)`
is the same 264° hue family as `--primary: oklch(0.55 0.18 264)`, at a clearly
different lightness/chroma rung (ΔE 0.1044). The two shipping themes are the
outliers, not `:root`. Second, **`--ring` carries no contrast assertion
anywhere in the test suite** — `themes-contrast.test.ts`'s `MARK_TONES` is
`["--warning", "--success", "--info", "--destructive"]`, and the ring is absent
— so the 5.36:1 / 8.87:1 figures the old comment quoted were never a locked
guarantee, only a comment.

## Decision

**`--ring` is brand-derived: the same hue family as `--primary`, at a rung
deliberately distinct from every role that can share the screen with it.** The
contract, stated once here and linked (not restated) everywhere else:

> `--ring` is the **focus indicator**: a graphical mark, brand-derived, distinct
> from every role it can co-occur with. A theme's `--ring` must satisfy all of:
>
> 1. **Brand family** — within ~20° of that theme's `--primary` hue, at a
>    clearly different lightness/chroma rung (never an alias).
> 2. **1.4.11 (≥3:1)** against `--background`, `--card`, `--surface-muted`,
>    `--muted` and `--secondary` — a focus ring lands on all five.
> 3. **Distinctness (ΔE ≥ 0.05 OKLab)** from `--primary`, `--chart-1`,
>    `--accent-foreground` (`MUST_DIFFER`), `--info` (`ROLE_PAIRS`) and
>    `--success` (new row, Part C).
> 4. **`--sidebar-ring: var(--ring)`** is the sanctioned mirror — an override
>    reaches sidebar focus automatically. Never re-declare it with a literal.
> 5. **Overriding it is supported**, in a `[data-theme="…"]`-scoped block,
>    provided (1)–(3) still hold. Verify with `pnpm roles:check` and
>    `pnpm --filter @elabs-ai/components-tokens test`. **Prefer
>    forking the theme (`/new-theme`) over patching one token.**
> 6. `:root`'s blue ring is **not** an exception — `:root`'s `--primary` is a
>    blue (264°) and its ring is the same hue at a distinct rung (ΔE 0.1044).
>    It already satisfies this contract.

The companion token-value change (issue #427 Part B) retunes light and
dark's `--ring` to satisfy clause 1 — the analysis behind that issue
recommends hue 140 (`oklch(0.40 0.13 140)` bright / `oklch(0.89 0.20 140)`
dark), 13° off the brand green with real margin against every gated partner.
This ADR is the contract those values are accountable to, not a record of the
exact literals — a future retune inside the same hue family is a value change,
not a contract change.

### Why not simply `--primary`

> **Superseded 2026-08-16 — the reference themes now do exactly this.** The
> reasoning below is why the original contract forbade it, and it is still an
> accurate description of what aliasing costs; it is no longer a description of
> what ships. See the Amendment at the top.

`(--ring, --primary)` is a row in `scripts/check-role-distinctness.mjs`'s
`MUST_DIFFER` array, for a reason stated in the gate's own comment there:
_"A focus ring must never read as the primary action: 'this is
focused' and 'this is the default button' are different messages on the same
screen."_ Aliasing the ring to `--primary` would mean every default button
already looks "focused" at rest, and a genuinely focused primary button would
gain no visible signal at all. The contract's clause 1 (same hue family) plus
clause 3 (distinct rung, ΔE ≥ 0.05 from `--primary` itself) is exactly the
shape that keeps the ring legibly related to the brand without collapsing into
it.

### Why not neutral / ink

A hue-free ring (mirroring the paused `blueprint` theme's white ring) was
considered and rejected: in dark, `--accent-foreground` is
`oklch(0.95 0.006 90)` — a near-white — and `(--accent-foreground, --ring)` is
also a `MUST_DIFFER` pair. A near-white green candidate at, for example,
`oklch(0.93 0.05 153)` measures **ΔE 0.0516** against it — barely over the
floor and with no margin to spare, and a genuinely neutral/ink candidate would
land closer still. Blueprint can use a hue-free ring because it is monochrome
by contract (`MUST_DIFFER` exempts it, see `.claude/rules/theming.md` "Roles
that co-occur"); dark is polychrome, so the same choice collides with its
own hover/selected ink. A neutral ring also does not answer the ask — the
consumer wanted the ring to read as on-brand, not as absent of brand.

### Why `:root`'s blue ring is not an exception

`:root` is the neutral light fallback, not a branded theme — but it already
demonstrates the contract, not an exception to it. Its `--primary` is a blue
(264° hue), and its `--ring` (`oklch(0.45 0.21 264)`) is the **same** 264°
family at a distinct lightness/chroma rung from `--primary`
(`oklch(0.55 0.18 264)`), ΔE 0.1044 — comfortably clearing both clause 1 (0°
hue gap, well inside ~20°) and clause 3 (0.1044 ≥ 0.05). `:root` never had a
"which family" problem; it had `--primary` = blue, so a blue ring was always
in-family. The two reference themes broke the pattern that `:root` was already
following, which is why this ADR describes the fix as **restoring** a
convention, not inventing one.

### The declined `(--ring, --info-text)` pair

Today's dark ring measures **ΔE 0.0458** from `--info-text`
(`oklch(0.74 0.12 245)`) — below the 0.05 floor — and no gate has ever caught
it, because `MUST_DIFFER`/`ROLE_PAIRS` carry no row for the `-text` rung. This
ADR records that as a **knowingly-declined** pair, not an oversight to close
later: a 2px stroke that traces a control's own outline while `:focus-visible`
is active, and moves with the keyboard, is a different perceptual **channel**
from a static word of coloured text — the same reasoning
`check-role-distinctness.mjs`'s `EXEMPTIONS` comment already uses to justify
dropping `(--primary, --chart-1)` from `MUST_DIFFER`. `--primary-text` and
`--success-text` get the identical treatment (declined, advisory only, `#416`
below) for the same reason. Recording the decision here is what stops a future
maintainer from "helpfully" adding the row and red-lining CI over a pairing
this ADR has already reasoned about.

### The `--chart-1` coupling

`(--ring, --chart-1)` is a row in `scripts/check-role-distinctness.mjs`'s
`MUST_DIFFER` array. `charts-contrast.test.ts` does not
reference `--ring` today, so the two test files are not directly coupled — but
the gate is: a future chart-ramp retune that moves `--chart-1` must re-run
`pnpm roles:check` and confirm it still clears the floor against `--ring`, and
a future `--ring` retune must do the same in reverse. Neither side owns the
other; both are obligated to re-check.

### Ordering with #416

#416 (open at the time of writing) proposes retuning `--success-text`. Both
issues touch the green-family cluster in light/dark, so whichever
lands second must **re-run `pnpm roles:check` and re-measure
`(--ring, --success-text)`** using the reproduction method in issue #427 (the
repo's own `oklabDistance` + `contrast()`, verified there to reproduce
`themes.css`'s own quoted figures exactly). The recommended ring hue (140) was
chosen partly for robustness to either ordering — analysis in #427 shows it
clears the floor against both today's `--success-text` and #416's proposed
value — but that robustness is a property of the specific hue chosen, not of
the contract in general. A future ring retune that drifts back toward
146–160° in light is not automatically safe against a concurrent
`--success-text` change; this rule is why the re-check is mandatory rather than
assumed.

## Alternatives considered

- **Document `--ring` as consumer-set and stop there.** Rejected as a
  substitute (mandatory as a complement — clause 5 above). A default theme
  that needs a consumer override to look on-brand has shipped the wrong
  default, and publishing the constraint list without retuning the shipped
  value exports the hardest part of the decision — the four-role distinctness
  arithmetic across two themes — to consumers who have neither the gate nor
  the palette in front of them. The one consumer who tried proved the failure
  mode: their override breaches the floor this ADR now states in writing.
- **Neutral / ink ring.** Rejected — see "Why not neutral / ink" above.
- **Leave the contract unwritten and only retune the value.** Rejected as
  incomplete: it repeats the exact failure mode #334 left behind — a value fix
  with no governance behind it can be walked out of the palette again by the
  next maintainer resolving the next distinctness collision, with every gate
  green. The governance half is the primary root cause; the value is
  downstream of it.
- **Add `(--ring, --info-text)` / `(--ring, --success-text)` / `(--ring, --primary-text)`
  to `MUST_DIFFER`.** Rejected — different channel (see above). Recorded here
  so it is a considered-and-declined decision, not a gap.

## Consequences

- **Every focusable control in both shipping themes changes colour** once the
  companion value change lands — 100 `ring-ring` call sites across 9 packages
  measured in issue #427, plus every sidebar focus reached through
  `--sidebar-ring: var(--ring)`. No component changes; the fix is token-only.
  This is a `themes.css` token-**value** edit, so it requires the Meta #161
  observed visual sweep (three real, unmodified app screens, both shipping
  themes, tabbing to put a genuine focus ring on screen) before merge — this
  ADR records the contract the sweep judges against, it is not the sweep
  itself.
- **`--sidebar-ring: var(--ring)` must survive as a `var()` mirror.**
  Re-declaring it with a literal would break the sanctioned intentional-mirror
  pattern (`.claude/rules/theming.md`) and let the two drift apart the next
  time either is retuned.
- **`:root` is unaffected.** It already satisfies the contract (see above) and
  needs no change. The `blueprint` theme, at the time of this ADR paused and
  excluded from `MUST_DIFFER`/`ROLE_PAIRS` evaluation as monochrome-by-contract,
  was itself fully removed six days later (`CHANGELOG.md` "The blueprint theme
  and its drawing package are gone", `v4.0.0`) — no value was ever proposed for
  it here or anywhere in issue #427, and the question is now moot.
- **A consumer with a local `--ring` override keeps working**, but the
  `CHANGELOG.md` entry for the companion change tells them the patch can be
  dropped once they upgrade.
- **Overriding `--ring` is now a supported path**, not a private fork: clause
  5 states the recipe (`[data-theme="…"]`-scoped block, the three constraints,
  two verification commands) in `packages/tokens/README.md`. The `/new-theme`
  preference exists because a single-token patch inherits none of a forked
  theme's own review; forking makes the override visible and testable the same
  way a shipped theme is.

## References

- `.claude/rules/theming.md` — "Distinct roles, distinct values"; "Roles that
  co-occur must stay PERCEPTIBLY apart (`pnpm roles:check`)"; "An INTENTIONAL
  mirror is declared with `var()`".
- `.claude/rules/styling-and-tokens.md` — the three-rung status doctrine; the
  1.4.11 decision test.
- `.claude/rules/quality-gates.md` — Meta #161 (a token-value edit requires an
  observed visual sweep); "Enforcement over reminders".
- `.claude/rules/design-system.md` — "Re-branding is a token change, not a
  component change" — the promise this ADR restores for `--ring`.
- `scripts/check-role-distinctness.mjs` — the `MUST_DIFFER` array (the
  `(--ring, --primary)`, `(--ring, --chart-1)`, `(--accent-foreground, --ring)`
  and `(--ring, --success)` rows), the `ROLE_SEPARATION_DELTA_E` constant, the
  `EXEMPTIONS` comment's channel-exemption reasoning, the `oklabDistance`
  function.
- `packages/tokens/src/themes-contrast.test.ts` — the `ROLE_PAIRS` array (the
  `(--ring, --info)` row), `MARK_SURFACES`, `MARK_TONES`, and the
  `it.each(ROLE_PAIRS)("%s is not byte-identical to %s", …)` lock.
- `docs/ADR/0003-theming-model.md` — the theming model this ADR extends.
- `docs/ADR/0010-border-strong-token.md` — the closest prior art: a token-rung
  decision with a WCAG dimension and a maintainer amendment.
- **#334** (closed) — created today's blue ring; the decision this ADR amends,
  not reverses.
- **#416** (open at time of writing) — `--success-text` retune; see "Ordering
  with #416" above.
- **#427** — the issue this ADR resolves the governance half of. Its RCA,
  measured figures and reproduction method are the evidentiary record; this
  ADR is the durable statement extracted from it.

**A note on citing line numbers in this ADR:** the References above name
symbols, not lines, on purpose. The first version of this ADR cited exact
`file:line` locations throughout; once this ADR's own companion value change
(issue #427 Part B) landed in the same merge, a sibling edit to
`check-role-distinctness.mjs` (new `MUST_DIFFER` rows inserted above the
`(--ring, --primary)`/`(--ring, --chart-1)` pairs) and `themes-contrast.test.ts`
(new assertions inserted above the byte-inequality lock) shifted several of
those citations without touching the symbols the lines named, and the rewritten
`themes.css` comments made two direct quotes unfindable at their cited
location. The remaining citations (`MARK_TONES`, `MARK_SURFACES`, `ROLE_PAIRS`)
had NOT drifted at the time of this note, but the same class of sibling edit
could move them next — so every citation in this ADR now anchors on a symbol
name (an exported constant, an array literal, a named `it(...)` block) rather
than a line number, uniformly, rather than leaving a mix of "still correct
today" and "already wrong" numbers for the next reader to sort out. Where a
specific line was quoted verbatim (the pre-#427 `themes.css` comment, "Context"
above) it is marked as historical rather than as a live pointer.
