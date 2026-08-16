# Scenario 06 — Presales Demo / Marketing Landing Page

**Archetype:** Marketing / Demo
**User type:** Presales engineer or solutions architect building a client-facing pitch page

---

## What's needed

A polished, standalone landing page for a product pitch or presales demo. The page
should communicate capability, social proof, and a clear call to action — all without
requiring design expertise. It must work as both a standalone URL and as a section
within a larger demo app. Token-driven so it adapts to any client's brand color via a
theme swap.

**Components required:**

- `@qlik-coe-emea/qlabs-components-marketing` package:
  - `Hero` — headline, sub-headline, two CTAs (primary + secondary), optional screenshot
  - `StatsBand` — 3–4 impact numbers with labels (customers, queries/day, time saved)
  - `FeatureGrid` — 6 capability highlights (icon + title + 1-line description)
  - `UseCaseCard` (×3) — industry-specific use case cards
  - `CTASection` — closing headline + primary CTA
  - `LogoStrip` — "Trusted by" customer logo row
- `@qlik-coe-emea/qlabs-components-ui`:
  - `NavigationMenu` — top bar with logo, nav links, and a CTA button
  - `Badge` — "New" / "Beta" feature labels in the feature grid
  - `Card` — testimonial cards
  - `Button` — primary + secondary CTAs

---

## How the user would define requirements

Ideal intake:

> "Build a presales landing page for a Qlik Sense pitch.
>
> Top: a sticky navigation bar with the Qlik logo on the left, three nav links
> (Platform / Solutions / Resources), and a 'Book a demo' button on the right.
>
> Hero section: headline 'Intelligent Analytics for Every Decision', subheading
> 'Qlik gives your team AI-powered insights at the speed of thought.' Two buttons:
> 'See the Platform' (primary) and 'Book a Demo' (secondary). A product screenshot
> on the right side.
>
> Stats band: 3 numbers — '38,000+ customers', '100B+ queries/month', '60% faster insights'.
>
> Features grid: 6 cards — AI-Powered Analytics, Real-Time Data Integration,
> Governed Self-Service, Natural Language Queries, Embedded Analytics, Cloud & On-Prem.
> Each with a Lucide icon, a short title, and a 1-2 sentence description.
>
> Three use case cards: Retail, Financial Services, Manufacturing — each with an
> industry summary and a 'Learn more' link.
>
> Logo strip: 8 customer logos (I'll drop the SVGs in later).
>
> Closing CTA: 'Ready to see Qlik in action?' + 'Schedule a Demo' button.
>
> Use qlik-bright theme."

**Key decisions the user SHOULD be asked:**

- Theme (qlik-bright for Qlik pitch vs. client brand color)
- CTA labels and targets (demo form URL, contact form, etc.)
- Number of features + their icons (Lucide icon names)
- Whether it's standalone (full page with nav) or embedded (no nav/footer)

**Key decisions the user SHOULD NOT need to make:**

- Which `@qlik-coe-emea/qlabs-components-marketing` component covers each section
- How `Hero` handles the image/screenshot slot
- How `FeatureGrid` accepts its items prop shape
- Whether `NavigationMenu` or `TopNav` is correct for the marketing header
- How `LogoStrip` renders SVGs vs. `<img>` tags
- Responsive behavior of each marketing section

---

## What's currently missing

### In the plugin

| Gap                          | Status                    | Covers                                                                                                       |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `new-app` skill              | **Not built** — #122, #55 | Guided intake of section list + content                                                                      |
| Marketing scaffold           | **Not built** — #123, #55 | Generating the page with correct section order + props stubs                                                 |
| Marketing / landing playbook | **Not built** — no issue  | "Marketing Page = NavigationMenu + Hero + StatsBand + FeatureGrid + CTASection + LogoStrip, wired like this" |
| Props shape translation      | **Not tracked**           | Mapping "6 features with icons" → `FeatureGrid` `items` prop shape with `icon: LucideIcon` type              |
| Visual archetype preview     | **Not built** — #57       | Showing the marketing landing archetype before scaffold                                                      |

### In the library / templates

| Gap                                                    | Status             | Detail                                                                                                                                                                                                      |
| ------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No marketing landing template exists                   | **Partial** — #102 | `registry/blocks/marketing-hero/` has just the Hero block; there is no full-page marketing template in `registry/templates/`                                                                                |
| Marketing package has no story coverage                | **Partial** — #76  | `@qlik-coe-emea/qlabs-components-marketing` components are in low story coverage — hard to discover, validate, or preview via Storybook MCP                                                                 |
| `LogoStrip` SVG vs. img handling undocumented          | **Not tracked**    | How to pass client logos (mixed SVG / PNG) to `LogoStrip` is not shown                                                                                                                                      |
| Marketing + UI component composition undocumented      | **Not tracked**    | Using `NavigationMenu` (from `@qlik-coe-emea/qlabs-components-ui`) in a marketing-page context alongside `@qlik-coe-emea/qlabs-components-marketing` sections is a cross-package composition with no recipe |
| Theme interaction with marketing components unverified | **Not tracked**    | Whether all six themes render marketing section backgrounds and text correctly has not been confirmed (marketing package may have lower theme-safety coverage)                                              |
| No testimonial / social-proof pattern                  | **Not tracked**    | A testimonials section (quote + avatar + name/title) is missing from `@qlik-coe-emea/qlabs-components-marketing`; users reach for a `Card` workaround                                                       |

### A gap not covered by any current issue

The **marketing archetype playbook** has no corresponding GitHub issue. WP-09 (#83/#66)
will build playbooks for dashboard, data, AI, and flow — but the marketing/landing
archetype is not in the planned scope. This must be explicitly added when WP-09 is
built.

Similarly, a **full marketing landing page template** (not just the hero block) has no
issue. #102 covers filling empty registry layers but is broadly scoped — the marketing
template gap should be a concrete child issue.

### Blocking GitHub issues for this scenario end-to-end

- **#55 VP-02** — new-app skill + marketing scaffold
- **#83 Playbooks** — marketing composition recipe (also needs a new child issue)
- **#66 WP-09** — playbooks as agent skills
- **#76 WP-02** — story coverage for `@qlik-coe-emea/qlabs-components-marketing` (currently low)
- **#102** — fill registry templates; full marketing template should be a child issue
- **#57 VP-04** — visual archetype preview

### A note on the marketing archetype

The marketing/landing archetype is lower priority for internal tooling use cases but
is the most important for presales and demo use cases — where brand-ui is likely to be
used to build Qlik-specific pitch pages and product demos. It's currently the least
scaffolded and least documented archetype in the library.
