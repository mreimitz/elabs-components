# The curated arsenal (premium patterns, register-gated)

The short list of layouts worth reaching for when a surface needs to read as
_designed_ rather than assembled. **Every entry ships today** — each names the
real components that express it (verified against the manifest, not remembered),
so nothing here needs a new component, raw CSS, or a raw colour/size.

Two rules the list exists to enforce:

- **Offer, don't impose.** These are options in the visual loop
  (`visual-loop.md`), surfaced at the register/expressiveness they
  belong to. **Calm/product is the default**; the expressive rows are opt-in.
- **No new components.** If a surface genuinely needs a pattern that isn't here,
  say so and raise it with the design-system maintainers — do not grow a new
  component inside a scaffold, and do not approximate one with arbitrary
  utilities.

## The arsenal

| Pattern                       | Express it with (shipped)                                                                              | Min. register | Min. expressiveness | Motion note                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Bento tile grid**           | `BentoGrid` + `BentoGridItem` (`size` / `span` / `hero`) — `@elabs/components-ui`                      | product       | 0                   | `spotlight` is disabled outright under OS `prefers-reduced-motion` — nothing to add.                   |
| **Spotlight card**            | `BentoGridItem spotlight interactive` — `@elabs/components-ui`                                         | product       | 0                   | as above (cursor-following gradient, reduced-motion-safe by construction).                             |
| **KPI band with a lead tile** | `MetricGrid featured` + `MetricCard emphasis="headline"` — `@elabs/components-charts` / `-ui`          | product       | 0                   | `reveal` staggers on mount and is motion-gated; it defaults to **false** — dashboards opt in.          |
| **Sticky section stack**      | `SectionHeader` (`@elabs/components-ui`) + `sticky top-0` on the header inside a scroll container      | product       | 0                   | Sticky position is not motion. If you add a scroll-linked reveal, it needs a `motion-reduce:` opt-out. |
| **Split hero (text + media)** | `Hero` with the `media` slot — `@elabs/components-marketing`                                           | **brand**     | 0                   | `animate` (default true) is motion-gated. Media needs explicit `width`/`height` (CLS).                 |
| **Stat band**                 | `StatsBand` — `@elabs/components-marketing`                                                            | **brand**     | 0                   | `animate` staggers the blocks; motion-gated. Pair figures with `tabular-nums`.                         |
| **Feature grid**              | `FeatureGrid columns={2\|3\|4}` — `@elabs/components-marketing`                                        | **brand**     | 0                   | `animate` motion-gated. **See the caveat below** — three equal cells is itself a tell.                 |
| **Logo strip**                | `LogoStrip` — `@elabs/components-marketing`                                                            | **brand**     | 0                   | Static. Real logos only — a row of grey rectangles is slop.                                            |
| **Closing CTA**               | `CTASection` — `@elabs/components-marketing`                                                           | **brand**     | 0                   | Static. One primary action; a second is `variant="outline"`.                                           |
| **Drafted / blueprint band**  | `data-decoration="N"` (or `<DecorationProvider>`) + `@elabs/components-blueprint` furniture, sparingly | product       | **6+**              | Ambient texture, no motion. **One focal drafting gesture per region** (blueprint-decoration rule).     |
| **Faded ground band**         | `data-decoration-fade="top\|bottom\|edges\|center"` on the region                                      | product       | **6+**              | No motion. Spends the region's one drafting gesture; never mask the host itself.                       |

Register/expressiveness are **minimums**, not requirements: a `brand` app may use
every product row. A `product` app should not reach for the brand rows without a
reason it can name — that is the whole point of the register.

## Caveats worth stating out loud

- **Three equal feature cards is a register-gated AI tell** (see
  `skills/brand-ui-audit/reference/anti-patterns.md`). Fine in a dense product
  dashboard; on a brand landing page vary the rhythm — reach for **BentoGrid**
  (asymmetric spans) or a split hero instead of a third identical row.
- **Content, not layout, is what usually reads as generated.** A perfect bento
  grid full of "Jane Doe" and "99.99%" still fails the bar — see the blocking
  `brand-ui audit` step in `SKILL.md` → Verify before "done".
- **Expressiveness ≥ 6 is the decoration dial**, not a licence for extra
  ornament: decoration density goes DOWN as information density goes UP, and a
  region gets at most one focal drafting gesture.
- **Motion is honoured, never mandated.** Every animating component above gates
  on the motion dial + OS `prefers-reduced-motion`. A scaffold ships
  `motion: "system"` — which already animates fully for everyone whose OS is
  neutral. It must never ship `motion: "full"`: that value is an informed-consent
  **override** that keeps `--motion-factor: 1` _through_ an OS reduce request (and
  escapes the third-party animation cap), so as an app default it suppresses a
  stated user preference. `full` is reachable only from a motion control the
  person operates themselves (`useMotionPreference()`); `pnpm app-spec:check`
  rejects a spec that defaults to it.
