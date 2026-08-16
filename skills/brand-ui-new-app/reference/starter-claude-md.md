# Starter agent context (`CLAUDE.md` + `AGENTS.md`)

`brand-ui scaffold --write <target>` emits **both** files from these templates,
with the theme / archetype / playbook / spec path already substituted — you do not
normally write them by hand. They are documented here so you can review what the
scaffold produced, and so the wording is edited in one place.

Purpose: any later agent session in that app inherits the brand constraints
without the user re-explaining them. `CLAUDE.md` is the contract; `AGENTS.md` is
the vendor-neutral pointer at it — emit **both**, never just one.

Fill `{register}` / `{density}` / `{motion}` / `{expressiveness}` from the spec's
`taste` block (restrained defaults: `product` / `comfortable` / `system` / `0`).
The same values go in the app's `brand-ui.config.json`, so `brand-ui audit`
judges the app against the profile it was built to.

## `CLAUDE.md`

````markdown
# CLAUDE.md — {Title}

This app is built on **brand-ui** (`@elabs-ai/components-*`). It was scaffolded from the
**{archetype}** template; the spec is in `./app-spec.md` — read it before
making structural changes.

## Taste profile (what this app is meant to feel like)

**register `{register}` · density `{density}` · motion `{motion}` ·
expressiveness `{expressiveness}`** — also recorded in `./brand-ui.config.json`,
which is what `brand-ui info` / `brand-ui audit` read. Change it there and in the
root `<ThemeProvider>` props, never per component. `expressiveness` IS the
decoration dial (`--decoration`, 0–10), not a separate setting.

- **`{register}`** picks the bar this UI is judged against — `product` = earned
  familiarity (restrained, every state present); `brand` = distinctiveness
  (committed colour, real imagery, a POV). It changes the JUDGEMENT, never the
  styling: no component may branch on it.
- **Motion stays `system` or `reduced` here.** `system` already animates fully
  for everyone whose OS is neutral. Never set the app default to `full`: that
  value keeps motion running _through_ a visitor's OS reduce-motion request. If
  people should be able to turn motion up, give them a control
  (`useMotionPreference()` in a settings pane) — the choice is theirs, not the
  app's.

## Non-negotiable rules

- **Use brand-ui components first.** Before writing any UI markup, check
  `…-ui`, `…-data`, `…-ai`, `…-flow`, `…-charts`, `…-marketing` for an existing
  component (`pnpm exec brand-ui search <concept>` once the CLI is installed — see
  `docs/CONSUMING.md` §1 + §7a — or the `mcp__brand-ui__search` tool in Claude
  Code). Do not hand-roll tables, dialogs, chat bubbles, or KPI tiles.
- **Type is a role, not a size.** Use a `text-<role>` utility (`text-title`,
  `text-body`, `text-caption`, `text-display`, `text-kpi`, …) or the
  `<Heading>`/`<Text>` components. Never `text-2xl`, `text-sm`, or `text-[18px]`
  — raw sizes break the hierarchy and aren't theme-aware.
- **Semantic tokens only.** `bg-background`, `text-muted-foreground`,
  `bg-primary` (+ `text-primary-foreground`), `border-border`,
  `var(--chart-1..5)`. Never raw hex, `rgb()`, `bg-[#…]`, or a Tailwind palette
  (`text-gray-500`, `bg-red-500`). Re-theming must stay a token swap.
- **Don't touch the theme mechanism.** The app is themed via
  `<ThemeProvider defaultTheme="{theme}">` from `…-tokens` (see `src/main.tsx`).
  To change look-and-feel, change tokens/theme — not component styles.
- **Keep the existing shell.** Extend the sidebar/nav in place; don't rebuild it.
- **Icons:** generic glyphs from `lucide-react`; brand marks from `…-icons`.
  No other icon libraries.
- **States:** every async surface gets loading (`Skeleton`), empty
  (`StatePanel kind="empty"`), and error (`StatePanel kind="error"`) — never a
  blank region.
- **brand-ui is presentation-only.** Model calls, fetching, and transport
  live in this app's hooks/services — never inside shared UI components.
- **Audit after UI edits.** Run `pnpm lint` and `pnpm audit:ui` (which is
  `brand-ui audit src`); `brand/no-raw-font-size` and `brand/no-raw-color` flag raw
  sizes/colours, and the audit is the static token/anti-slop pass that keeps the UI
  on-system. Both run in the emitted CI workflow — keep that job green.
- **No placeholder slop.** Sample content is real and domain-specific — never
  "John Doe", "99.99%", "Acme", or a filler verb ("Elevate", "Seamless").
  `pnpm exec brand-ui audit src --strict` **exits 1** on any content-slop or
  blocking style finding — it is a gate, not a nit. Run it before calling any UI
  change done.

## What exists (don't guess an API)

`./brand-ui-context.md` is the generated inventory of every component in every
`@elabs-ai/components-*` package — read it before inventing a component.
`pnpm exec brand-ui docs <Name>` gives the real props; `brand-ui context`
regenerates the inventory after a package upgrade.

## Run it

```bash
pnpm dev        # vite (index.html → src/main.tsx → src/App.tsx)
pnpm typecheck  # tsc --noEmit
pnpm lint
pnpm audit:ui   # brand-ui audit src
```

## Install / make it runnable

{install-block}

## Wiring points

Unfinished spots are marked `TODO(spec):` (what the spec did not answer) and
`WIRE:` (where real data plugs in). `grep -rn "TODO(spec):\|WIRE:" src` lists
what's left. Wire them; don't delete the guidance until each is wired.

## Themes

Three shipped themes: `light`, `dark`. Anything you build
must read correctly in **all three** — that is an observed result (render it),
never inferred from "it uses tokens".

## Composition reference

This archetype's recipe: {playbook-link} (building blocks, wiring order,
common mistakes). Follow it before inventing new structure.
````

### `{install-block}` — standalone

The packages are private on GitHub Packages, so a standalone app cannot install
without this. The scaffold fills it from the same package array that generated
`src/styles.css`, so the dependency set and the `@source` lines can never diverge.

````markdown
Packages come from the public npm registry — no `.npmrc`, no token.

```bash
pnpm add "@elabs-ai/components-tokens@^{release}" …    # the packages
pnpm add "react@^19.0.0" "@xyflow/react@^12.11.1" …               # + engine peers
```

Every engine peer is pinned to the range the brand-ui package that needs it
declares (read from that package, never a `*` wildcard): a mismatched
`@xyflow/react` / `monaco-editor` / `ai` breaks at runtime, not at install.

`src/styles.css` already carries the token import and one `@source` line per
installed package — **do not delete them**, the components render unstyled
without them. Full recipe: `docs/CONSUMING.md` §1-4 in the brand-ui repo.
````

### `{install-block}` — in-monorepo

```markdown
This app lives inside the brand-ui monorepo: `@elabs-ai/components-*`
dependencies stay `workspace:*` and `pnpm install` at the repo root wires them.
`src/styles.css` carries the token import and one `@source` line per package —
**do not delete them**, the components render unstyled without them.
```

## `AGENTS.md`

A short pointer, so an agent that looks for `AGENTS.md` lands on the same rules
instead of inventing its own.

```markdown
# AGENTS.md — {Title}

**Read `./CLAUDE.md` first — it is the full contract for this app** (component
reuse, the type/colour taxonomy, theming, state coverage, the presentation-layer
boundary). This file exists so agents that look for `AGENTS.md` find the same rules.

The short version:

- Compose from `@elabs-ai/components-*`; don't hand-roll tables, dialogs,
  chat bubbles or KPI tiles.
- Type is a **role** (`text-title`/`text-body`/…), colour is a **token**
  (`bg-primary`, `text-muted-foreground`) — never a raw size or hex.
- The theme is `{theme}`, applied by `<ThemeProvider>` in `src/main.tsx`;
  change tokens, not component styles. Everything must read in both themes.
- The spec is `./app-spec.md`; `grep -rn "TODO(spec):" src` is the to-do list.
- `./brand-ui-context.md` lists every component in every package — read it instead
  of inventing one; `brand-ui docs <Name>` gives the real props.
- brand-ui renders models — it never calls them. Fetching/transport lives in this app.
```
