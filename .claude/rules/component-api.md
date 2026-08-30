# Component API rules

- **Naming:** PascalCase components, kebab-case files/folders. Co-locate
  `name.tsx`, `index.ts`, `name.stories.tsx`, `name.test.tsx`.
- **Props:** extend the relevant intrinsic element props
  (`ButtonHTMLAttributes`, `HTMLAttributes<HTMLDivElement>`, …) and spread
  `...props` onto the root element so consumers can pass `id`, `aria-*`, etc.
- **className:** always accept `className` and merge with `cn()` last so callers
  can override.
- **Refs:** use `forwardRef` whenever a DOM ref is meaningful (inputs, buttons,
  Radix content). Name the render function for good stacks. **React 19's
  ref-as-prop is intentionally deferred** — keep `forwardRef` for consistency
  across the library; ref-as-prop is a future codemod, not a now-migration (see
  Composition patterns, below).
- **Variants:** use `class-variance-authority`. Export the `xxxVariants` fn for
  composition. Provide sensible `defaultVariants`. Don't hand-roll conditional
  class strings for anything with more than one axis.
- **Composition:** prefer compound components (`Card` + `CardHeader` + …) and
  Radix `asChild`/`Slot` over boolean prop explosions. See **Composition patterns**
  below for the compound-component + lifted-state convention.
- **Stable selectors (`data-slot`):** the **root** element of a component carries
  `data-slot="<kebab-component-name>"`; every sub-part carries
  `data-slot="<kebab-component-name>-<part>"` (`message` → `message-content`,
  `message-header`, `message-avatar`, …). It is the library's stable seam for
  consumers, tests and agents to target a part **without** depending on class
  names, DOM order or wrapper depth. **A named preset that wraps a base component
  keeps the BASE root slot** — `UserMessage` and `AgentMessage` both emit
  `data-slot="message"` — so one consumer selector matches every entry point.
  Where a marker **class** is load-bearing for styling (`is-user` and the
  `group-[.is-user]:` selectors it compiles against), the `data-*` attribute is
  its **semantic twin, not a replacement** — add the attribute, never delete the
  class. Reference implementation: `packages/ai/src/message.tsx`. Most of the
  library does **not** follow this yet, so `pnpm data-slot:check` (#312) is a
  **ratchet**, not a sweep: `scripts/data-slot-baseline.json` records a
  `[components, slots]` pair for **every** gated module (273 of 295 declare no
  slot today and are grandfathered). A module that gains an exported component
  without gaining a `data-slot=` declaration **fails** — in an already-slotted
  module (`sidebar.tsx`, `message.tsx`) exactly as in a slot-less one — and so
  does stripping selectors off parts that still ship. **What the gate cannot
  see:** it counts declarations, not per-part coverage, so two new parts sharing
  one new slot pass CI while still violating this rule; slot _values_
  (`<kebab-name>[-<part>]`) and the wrapping-preset rule aren't machine-checked
  either. Those are on the author and the reviewer. Fixing an existing module is
  a welcome, separate ratchet-down (`pnpm data-slot:check -- --update`); a bulk
  sweep is not required by this rule.
- **Controlled/uncontrolled:** mirror the platform. If you support both, derive
  `isControlled = value !== undefined` and never flip between modes.
- **Types:** export every public prop/type. Coding agents rely on these — when the
  Storybook dev server is running, agents read the **real** prop surface via
  `mcp__storybook__get-documentation` rather than guessing (anti-hallucination); else
  Read the `.tsx` + exported types. See @.claude/rules/storybook-mcp.md.
- **Story coverage:** the co-located `*.stories.tsx` should exercise the component's
  variants and key states (default/hover/focus/disabled, plus loading/error/empty
  where they apply) so the API is verifiable in Storybook, not just on paper.
  **Enforced for `cva` variants (#388):** `pnpm variants:check` reads each
  component's expanded `cva` variant values from `brand-ui.manifest.json` and
  asserts every value appears in a RENDERED position (a JSX attribute or an
  `args`/object-literal key) — a mention inside `argTypes.options` or a prop
  `description` does not count, because it makes a value selectable in the
  controls panel without any story ever rendering it (and therefore without it
  ever reaching the blocking interaction + axe job). A default value is also
  satisfied by any story that renders the component without setting that axis
  at all. Pre-existing gaps are a ratchet baseline
  (`scripts/variant-coverage-baseline.json`, only goes down via `--update`); a
  component that gains a new variant value must ship the story that exercises
  it. See `scripts/check-variant-coverage.mjs`. **Regression locks with observable
  side effects must be verified co-resident:** when a play-function assertion
  depends on an observable side effect (a DOM mutation, an observer firing, an
  attribute flip) rather than a pure output value, it can silently pass in
  isolation while failing when its story runs alongside siblings in the same
  file — because preceding stories can leave state behind that substitutes for
  the effect the lock is supposed to isolate. Verify such locks in their
  ordinary, full-suite invocation, not only via isolated `-t "story name"` runs.
  If a lock only holds in isolation, give it its own story file rather than
  co-locating it. See `packages/ui/src/components/mention-input/mention-input-mirror.stories.tsx`
  and `docs/ADR/0023-mention-input-primitive.md` §6 for the worked example.
- **Server safety:** add `"use client"` to components using hooks/effects when
  they may be consumed by RSC apps (e.g. `ThemeProvider`).
- **No barrels-of-everything in components:** each component's `index.ts`
  re-exports only its own public surface.

## Composition patterns (compound components + lifted state)

For anything beyond a single primitive, **compose — don't configure**. Adopted from
the Vercel `composition-patterns` skill in brand-ui's idiom (Radix, `cn`, our
`forwardRef` convention). This section IS the surviving decision record — the working
paper it was distilled from was removed when this fork was debranded.

- **Avoid boolean-prop proliferation.** Don't add `isThread`/`isEditing`/`isMini`
  flags to fork behaviour — each boolean doubles the state space and breeds
  impossible combinations. Compose, or make an **explicit variant component**
  (`ThreadComposer`, not `<Composer isThread>`). `cva` is for _visual_ axes
  (size/tone), NOT behavioural modes.
- **Compound components share a context, not props.** Structure complex components
  as `X` + `X.Provider` + parts (`X.Frame`/`X.Input`/…); subcomponents read the
  context, consumers compose the pieces they need (the `Card`/`Tabs`/`Sidebar`
  pattern). Prefer `asChild`/`Slot` over wrapper props.
- **Lift state into the Provider; expose a `state` / `actions` / `meta` interface.**
  The provider is the ONLY place that knows _how_ state is managed (`useState`, a
  store, a server sync); UI parts depend on the **interface**, not the
  implementation — so the same UI is dependency-injectable ("swap the provider, keep
  the UI"), and sibling controls **outside** the visual frame but **inside** the
  provider can read/drive state (no prop-drilling, no `useEffect`-to-sync, no refs).
  Canonical shape for **stateful compound components**: `ChartFrame` (charts),
  `PromptInput`/`Conversation` (`@elabs-ai/components-ai`), `DataTable` (`@elabs-ai/components-data`), the React
  Flow canvas, and the future A2UI surfaces.
- **Children over render-props.** Compose static structure with `children`; reserve
  `renderX` for when the parent must hand data _back_ to the child (e.g. a
  virtualized list's `renderItem`).
- **React 19:** **keep `forwardRef`** (consistency across the library — ref-as-prop
  is a deferred codemod, doc 13). DO prefer **`use(Context)` over
  `useContext(Context)`** for new context reads (it can be called conditionally).

## Subpath exports (gated — not a general API-organization tool)

A package's public surface is its barrel (`@elabs-ai/components-<pkg>`). A **subpath export**
(`@elabs-ai/components-<pkg>/markdown/frontmatter`) is a deliberate exception, warranted ONLY
when both hold:

1. **Lighter / different dependency tree.** The leaf has a materially lighter or
   different dependency tree than the package trunk — e.g. a pure helper that does
   NOT pull the package's heavy engine (Monaco, React Flow, TanStack).
2. **A real consumer needs the leaf without the trunk.** A concrete caller —
   unit tests that must avoid the engine (Monaco-in-jsdom), an RSC/server path, or
   a bundle-sensitive route — needs the leaf in isolation.

It is **NOT** a general way to organize an API ("data utils get a subpath" would
fragment every package's surface — don't). When in doubt, export from the barrel.

When a subpath IS warranted, add it in **all three places** so source-consumed and
built consumers agree, then make it discoverable:

- `exports` (source entry) **and** `publishConfig.exports` (`dist` entry) in the
  package's `package.json`.
- a `tsup.config.ts` entry so it builds to `dist/`.
- run `pnpm manifest` and register it in the discovery surfaces, and route the
  decision through `brand-ui-design-system-architect` (a subpath is a structural API
  change). See @.claude/rules/quality-gates.md "Adding a new package or a public
  subpath export" and `docs/ADR/0006-subpath-exports.md`.
