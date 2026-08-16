---
name: brand-ui-start
description: The front door for building UI with brand-ui — a router/concierge that asks what you want to do and hands you to the right flow. Use when someone is starting out and unsure where to begin ("help me with brand-ui", "where do I start", "I want to build something", "what can brand-ui do", "get me going"), or types /brand-ui-start. Routes to three flows — build a NEW app (brand-ui-new-app), improve/migrate an EXISTING app (brand-ui-migrate), or just help me USE brand-ui in an app that already has it (brand-ui). If the intent is already obvious (the person said "build me a dashboard" or "audit this screen"), skip the question and go straight to that flow.
user-invocable: true
argument-hint: "[what you want to do, e.g. 'build a sales dashboard' or 'help me get started']"
allowed-tools:
  - Bash(pnpm brand-ui *)
  - Bash(npx @elabs-ai/components-cli *)
  - Bash(npx brand-ui *)
---

# brand-ui-start (the front door)

One obvious entry point for working with **brand-ui** (`@elabs-ai/components-*`). Figure out
what the person actually wants, then hand them to the flow that does it — don't
do the work here. This skill is a **router**, not a builder.

## 0 · Route on intent first (skip the question when you can)

If the request already names the flow, **go straight there** — do not ask a
question the person has already answered:

| The person said…                                                                                                      | Go directly to                               |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------- | --- | ------------------ |
| "build / scaffold / start a <app                                                                                      | dashboard                                    | assistant | …>" | `brand-ui-new-app` |
| "design an **enterprise / professional** app — admin/operator console, internal/back-office tool, B2B SaaS, data app" | `brand-ui-enterprise` (→ `brand-ui-new-app`) |
| "migrate / move / port / adopt brand-ui in <existing app>"                                                            | `brand-ui-migrate`                           |
| "audit / review / is this accessible / check contrast"                                                                | `brand-ui-audit`                             |
| "how do I use / add / compose <component>", already on @brand                                                         | `brand-ui`                                   |
| "new theme / re-brand / our colors"                                                                                   | `brand-ui-theme`                             |

Only ask the routing question when the intent is genuinely unclear.

## 1 · The routing question (one round)

When you must ask, use a single `AskUserQuestion` round — one question, three
options (the harness adds "Other" for free text):

> **What do you want to do?**
>
> - **Build a new app** — start from a plain-language description; I'll run a
>   short guided interview, write a spec, and scaffold a born-on-brand app.
> - **Improve an existing app** — bring a UI that already exists onto brand-ui:
>   profile it, map its components, and migrate in reviewable steps.
> - **Just help me use brand-ui** — the app already uses `@elabs-ai/components-*`; help me
>   discover, compose, theme, and correctly use components.

Then hand off per the table below. After routing, **invoke the target skill**
(via the Skill tool / its slash command) and let it own the work — your job is
done once the person is in the right flow.

| Choice                    | Hand off to        | What it does                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build a new app           | `brand-ui-new-app` | Guided interview → `app-spec.md` → annotated scaffold from a template + playbook (VP-02). For an **enterprise/professional** surface, start with `brand-ui-enterprise` (classify register, pick the shell archetype + mandatory baseline), which then feeds this skill. |
| Improve an existing app   | `brand-ui-migrate` | Scan → map existing components to brand-ui → a phased plan → review-gated migration, one phase at a time. Analysis is read-only; the edits are made by the agent and approved by the person.                                                                            |
| Just help me use brand-ui | `brand-ui`         | Live project context, real component API, composition patterns, token rules, theming.                                                                                                                                                                                   |

## 2 · "Improve an existing app" — hand off to `brand-ui-migrate`

The **`brand-ui-migrate`** skill owns this flow: scan → map → phased plan →
reviewed migration. Invoke it and let it do the work.

1. Run the **deterministic profile** (read-only, edits nothing):
   `pnpm brand-ui scan <path> --json` (or, in a consuming project, install the CLI
   first — `pnpm add -D @elabs-ai/components-cli`, see `docs/CONSUMING.md` §1 + §7a — then
   `pnpm exec brand-ui scan …`) → framework, UI library, styling, component-usage inventory.
2. Map what it found against brand-ui: `pnpm brand-ui map <scan.json> --json`
   → which existing components have a `direct` brand-ui equivalent vs a `gap`.
3. **Score its taste** (read-only): `pnpm brand-ui audit <path> --json`. Report it
   alongside the component map — the map says _what_ to migrate, the audit says
   _how far the UI is from the bar_:
   - the **active taste profile** it judged against (the audit resolves the
     nearest `brand-ui.config.json` from the target itself and prints
     `[config]`/`[default]`; absent config ⇒ the restrained default
     `product / comfortable / system / 0` — say so rather than presenting a
     default as a decision);
   - **content slop** (`slop-generic-name` / `slop-fake-number` /
     `slop-brand-name`) — the "Jane Doe effect", the single strongest signal that
     a UI reads as generated;
   - **blocking token/style findings** — raw hex/`rgb()` counts are the migration's
     real size, since every one becomes a semantic token.

   Give a plain-language score ("N content-slop occurrences, M raw colours across
   K files"), never a made-up grade, and point deeper work at `brand-ui-audit`
   (which adds the rendered cross-theme + WCAG pass). **This reports; it fixes
   nothing.**

4. **Propose the taste upgrades** — a score with no proposal is just a grade.
   Turn each finding CLASS the audit returned into a concrete, named change, and
   present them as a short phased list the person can accept or decline. The
   mapping is fixed (don't improvise a different one):

   | Audit finding class                                          | The upgrade to propose                                                                                                                                                                     | Where it lands                                      |
   | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
   | `raw-hex` / `rgb()` / Tailwind palette                       | swap each for the semantic token carrying that role (`bg-card`, `text-muted-foreground`, `border-border`, `--chart-1..5`). If the palette IS the brand's, re-theme it via `brand-ui-theme` | tokens + theme, never component source              |
   | raw font sizes (`text-xl`, `text-[18px]`)                    | type roles (`text-display/title/subtitle/body/caption/meta/kpi`) — after colour, the biggest "reads as templated" fix                                                                      | components; `brand/no-raw-font-size` keeps it fixed |
   | `slop-generic-name` / `slop-fake-number` / `slop-brand-name` | replace with real content from the app's own domain (its entities, real figures, the real product name)                                                                                    | copy in the surfaces                                |
   | `over-round` / `side-stripe` / `bounce-easing`               | if this really is a **brand** surface, record `register: "brand"` (they soften to advisory); otherwise take the radius/border/easing tokens                                                | `brand-ui.config.json`, or the components           |
   | hand-tuned padding for dense tables/toolbars                 | set the **density dial** once (`taste.density: "compact"` + `<ThemeProvider defaultDensity>`) instead of per-component spacing                                                             | root provider + `brand-ui.config.json`              |
   | ad-hoc ornament (gradients, glows, decorative borders)       | **expressiveness IS `--decoration`** — pick one level 0–10 at the root; drop the per-component ornament                                                                                    | root provider + config                              |
   | blank regions / spinner-only async surfaces                  | the loading vocabulary: `Skeleton` (layout-shaped) · `EmptyState` · `ErrorState`                                                                                                           | per surface                                         |
   | motion                                                       | offer a motion control (`useMotionPreference()`); **never** propose `full` as the app default — it overrides a visitor's OS reduce-motion request                                          | a settings toggle, not a default                    |

   Then propose the **profile itself**: the register/density/motion/expressiveness
   this app should be judged against, written once into `brand-ui.config.json` at
   its root so every later `brand-ui audit` judges it against that bar. Offer
   layout upgrades only from the curated arsenal
   (`skills/brand-ui-new-app/reference/patterns.md`), filtered by that register +
   expressiveness. Sequence the proposal: colour tokens → type roles → states →
   profile + dials → patterns.

   **This proposes; it changes nothing.** Each accepted item becomes a reviewed
   change through `brand-ui`.

5. Walk the results with the person and hand the build-out to `brand-ui` for the
   `direct` swaps. **Say plainly** that automated codemod migration arrives with
   VP-03 — for now this is analysis + manual, reviewed changes, never a bulk edit.

## 3 · Degrade gracefully in plain chat

Subagents and hooks only light up in Claude Code and Cowork; in plain chat (and
anywhere the other skills aren't installed), this router still works as guidance:
ask the routing question, then describe the chosen flow and point at the
`brand-ui` consumer skill and the `@elabs-ai/components-cli` commands (`brand-ui info` /
`search` / `docs`) the person can run themselves. Never block on a capability
that isn't present — route with what's available.

## Rules

- **Route, don't build.** Hand off; let the target flow do the work.
- **Don't re-ask answered questions.** If the description already states the
  archetype/theme/intent, skip straight to the flow.
- **Be honest about what's shipped.** The analysis half of `brand-ui-migrate`
  is read-only and there is no automated codemod — the edits are reviewed changes,
  never a bulk rewrite. Say so before the person starts.
