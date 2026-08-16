# The visual feedback loop (propose → preview → pick → refine)

The reusable interaction loop for **every visual decision** in a guided flow
(`brand-ui-new-app` today; `migrate` when it lands). brand-ui's edge: previews
are **real rendered components in the chosen theme** (via the Storybook MCP), not
mockups. This is the canonical reference (VP-04) both flows follow — keep the loop
identical across them.

## The loop

1. **Propose** — offer **2–4 concrete options**, never an open-ended "what do you
   want?". Each option is a real, namable choice (an archetype, a theme, a nav
   shape, a chart type), not a parameter.
2. **Preview** — render the options at the **highest fidelity available** (ladder
   below). Surface the preview URL/artifact to the user — don't describe a render
   you could show.
3. **Pick** — one `AskUserQuestion` round (≤4 options; "Other" is free text). When
   a render exists, attach it (option preview / the surfaced URL) so the choice is
   made on the UI, not on prose.
4. **Refine** — apply the pick, re-preview, and offer the next decision. Stop when
   the user is happy or says "defaults are fine" (record the defaults in the spec).

## The fidelity ladder (always use the highest rung available)

| Rung | Mechanism                                                                                                        | When                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | **Real Storybook render** — `mcp__storybook__preview-stories` with `globals={theme:'<slug>'}` (see helper below) | The option maps to a real component/template/playbook story. |
| 2    | **Generated surface preview** — `pnpm surface:preview` writes a self-contained themed HTML file (see below)      | A composed multi-component screen no single story covers.    |
| 3    | **Option thumbnail / code snippet** — `AskUserQuestion` option `preview`                                         | A quick A/B where a full render is overkill or unavailable.  |
| 4    | **Text description** — last resort                                                                               | Nothing renders (no Storybook, no preview command).          |

**Rule:** never advance a visual choice on **text alone** when a render is
possible. Work **down** the ladder and stop at the first rung that is reachable:
rung 1 if the Storybook dev server can be started, else rung 2 if you are inside
the brand-ui monorepo, else rung 3, and only then rung 4. Say which rung you used
when the choice was not made on a real render.

## Getting a real render (rung 1)

- If the `mcp__storybook__*` tools exist, call `mcp__storybook__preview-stories`
  with the story ID + `globals={theme:'<slug>'}` and **surface the URL**.
- If they don't exist and you're inside the brand-ui monorepo, **start the dev
  server** (`pnpm storybook` in the background), drive it, then stop it when done.
- Theme slugs are the CSS slugs, never display names: `light`, `dark`,
  `dark`. Story-ID derivation + tool details: the brand-ui Storybook-MCP rule.
- **Fallback (server unavailable):** drop to rung 2 (artifact) or rung 3
  (option preview) — and say plainly that the choice was made without a live
  render, so the user knows to eyeball it after scaffolding.

## Getting a composed-surface preview (rung 2)

Rung 1 shows one component. It cannot show a whole **assembled screen** — an app
shell plus its regions — because no single story covers the composition. Rung 2
does, inside the brand-ui monorepo:

```bash
pnpm surface:preview -- --archetype dashboard --theme dark --out ./dashboard.dark.html
pnpm surface:preview -- --list   # the archetypes and theme slugs available
```

It writes one self-contained HTML file per (archetype, theme) — no network, no
CDN, no webfont — and prints its absolute path. **Surface that path to the user**
so the choice is made on the picture. What it shows is real: the token colours of
the chosen theme and the real surface hierarchy (chrome → canvas → raised), with
each composed region as a labelled placeholder block. What it does not show is
finished pixels — say so when you hand it over, and follow up with rung 1 for the
individual components.

Outside the monorepo the command is not available: drop to rung 3.

## Where it's used in the interview

`reference/stages.md` marks each stage that carries a visual choice with **[visual
loop]** — stages 2 (archetype), 3 (nav), 5 (brand/feel/theme + taste profile), and
6 (per-surface chart types / layout). Run this loop there; capture the chosen
option into `app-spec.md` immediately.

## What to propose (the curated arsenal)

When step 1 needs concrete layout options, take them from
**[`reference/patterns.md`](./patterns.md)** — the short list of premium patterns
that are expressible with shipped components + tokens, each tagged with the
minimum **register / expressiveness** it is offered at and its motion note.

- **Filter the options by the spec's taste profile.** Calm/product is the
  default; only offer a `brand`-register row (split hero, stat band, logo strip,
  CTA section) once stage 5 has set `taste.register = "brand"`, and only offer a
  decoration row once `taste.expressiveness ≥ 6`.
- **Preview before proposing** where a story exists (rung 1) — an expressive
  pattern picked from prose is exactly the decision this loop exists to prevent.
- If the surface seems to need a pattern that isn't on the list, raise it with
  the design-system maintainers rather than inventing a component in a scaffold.

## Review the result like a designer

After scaffolding a surface, review it for interaction & front-end hygiene and,
for anything bigger than a tweak, run the `brand-ui-visual-ux-reviewer` — the loop
is for _choosing_, the reviewers are for _verifying_ the rendered result. Report
the findings to the user (the reviewers report; they don't fix).
