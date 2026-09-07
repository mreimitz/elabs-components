# Component API rules

- **Naming:** PascalCase components, kebab-case files/folders; co-locate `name.tsx`, `index.ts`,
  `name.stories.tsx`, `name.test.tsx`.
- **Props:** extend the intrinsic element props (`ButtonHTMLAttributes`, `HTMLAttributes<…>`);
  spread `...props` onto the root so `id`/`aria-*` pass through.
- **className:** always accept it; merge with `cn()` last so callers can override.
- **Refs:** `forwardRef` wherever a DOM ref is meaningful (inputs, buttons, Radix content); name
  the render function. Keep `forwardRef` on React 19 (ref-as-prop is a deferred codemod).
- **Variants:** anything with >1 visual axis uses `class-variance-authority`, never hand-rolled
  conditional class strings; export `xxxVariants`; set `defaultVariants`.
- **Composition:** compound components + Radix `asChild`/`Slot` over boolean-prop explosions.
- **Stable selectors (`data-slot`):** root `data-slot="<kebab-name>"`, each sub-part
  `data-slot="<kebab-name>-<part>"`. A preset wrapping a base component KEEPS the base root slot
  (`UserMessage`/`AgentMessage` emit `data-slot="message"`). Keep a load-bearing marker class
  (`is-user`): the attribute is its twin, not a replacement (ref `packages/ai/src/message.tsx`).
  Gate `pnpm data-slot:check` (#312, ratchet vs `scripts/data-slot-baseline.json`): a new exported
  component without a new `data-slot=` fails, as does stripping shipped selectors; slot values,
  per-part coverage and the preset rule are not machine-checked; `-- --update` ratchets down.
- **Controlled/uncontrolled:** mirror the platform; if both, `isControlled = value !== undefined`,
  never flip modes.
- **Types:** export every public prop/type. Read real props via `mcp__storybook__get-documentation`
  or the `.tsx`; never guess (@.claude/rules/storybook-mcp.md).
- **Story coverage:** `*.stories.tsx` exercises variants + key states (default/hover/focus/disabled,
  loading/error/empty where they apply). Gate `pnpm variants:check` (#388): every `cva` variant
  value must be RENDERED by a story (a JSX attribute or `args` key; `argTypes.options`/`description`
  don't count; a default is met by leaving the axis unset); ratchet vs
  `scripts/variant-coverage-baseline.json`, a new value ships its story. A regression lock on an
  observable side effect (DOM mutation, observer, attribute flip) must be verified CO-RESIDENT
  (full-suite run, not only isolated `-t` runs); if it only holds alone, give it its own story file
  (`mention-input-mirror.stories.tsx`, ADR 0023 §6).
- **Server safety:** `"use client"` on hook/effect components an RSC app may consume.
- **No barrels-of-everything:** a component's `index.ts` re-exports only its own surface.

## Composition patterns

Compose, don't configure (from Vercel's `composition-patterns` skill).

- **No boolean-prop proliferation** (`isThread`/`isEditing`/`isMini`): compose, or make an explicit
  variant component (`ThreadComposer`, not `<Composer isThread>`). `cva` is for VISUAL axes only,
  never behavioural modes.
- **Compound components share a context, not props:** `X` + `X.Provider` + parts
  (`Card`/`Tabs`/`Sidebar`); consumers compose what they need; `asChild`/`Slot` over wrapper props.
- **Lift state into the Provider; expose `state` / `actions` / `meta`.** Only the provider knows
  HOW state is managed; parts and sibling controls inside the provider read/drive it through the
  interface: no prop-drilling, no `useEffect`-to-sync, no refs. Canonical: `ChartFrame`,
  `PromptInput`, `DataTable`.
- **Children over render-props;** `renderX` only when the parent hands data BACK (`renderItem`).
- **React 19:** keep `forwardRef`; prefer `use(Context)` over `useContext(Context)` for new reads.

## Subpath exports (gated)

The public surface is the barrel. A subpath (`@elabs-ai/components-<pkg>/markdown/frontmatter`) is
warranted ONLY when BOTH hold: (1) a lighter/different dependency tree (no heavy engine: Monaco,
React Flow, TanStack); (2) a real consumer needs the leaf alone (engine-free tests, RSC/server, a
bundle-sensitive route). Never as API organization; in doubt, the barrel. Add it in ALL THREE
places (`exports` AND `publishConfig.exports` in `package.json`, a `tsup.config.ts` entry), run
`pnpm manifest`, register it in the discovery surfaces, and route it through
`brand-ui-design-system-architect`. See @.claude/rules/quality-gates.md (subpath section) +
`docs/ADR/0006-subpath-exports.md`.

History and measurements: docs/rules-history/component-api.md
