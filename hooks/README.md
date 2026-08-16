# brand-ui plugin hooks

Hooks shipped with the **brand-ui** Claude Code plugin (auto-discovered from
`hooks/hooks.json` at the plugin root; referenced via `${CLAUDE_PLUGIN_ROOT}`).

## `check-raw-taxonomy.mjs` — PostToolUse(Write|Edit) taxonomy guard

The in-loop sibling of the durable CI gate (`@qlik-coe-emea/qlabs-components-eslint-config` →
`brand/no-raw-font-size`, `brand/no-raw-color`). After an agent edits a
`.tsx`/`.jsx`, it scans the file and, if it finds raw font sizes (`text-2xl`,
`text-[18px]`) or raw colours (`text-gray-500`, `bg-[#fff]`), returns them as
`additionalContext` so the **agent self-corrects in the same turn** — the fix for
"agents have no sense for font sizes / contrast".

- **Advisory, never blocking** (exit 0). It informs; the durable enforcement is
  the ESLint rule (`error` in scaffolded apps) + the `scripts/check-*` CI gates.
- **Zero-dependency** (Node ESM, stdin JSON). Works in any installed plugin,
  before `pnpm install`.
- **Scope:** skips `node_modules`, the library's own `packages/*/src`, copy-own
  `registry/`, and `*.stories.*`/`*.test.*` — those are governed by the repo
  ratchets, not this consumer-facing hook.

The three surfaces share one set of patterns (this script ·
`@qlik-coe-emea/qlabs-components-eslint-config/rules/brand-tokens.js` · `scripts/check-raw-palette.mjs`)
so they can't disagree.

> Why a hook _and_ a lint rule? Match the mechanism to the property: a decidable
> check belongs in a deterministic gate (lint/CI, agent-independent); the hook
> makes that gate fire **inside the agent's edit loop** so violations bounce back
> immediately. Judgment calls (which role? does the hierarchy read?) stay with
> the review agents (`brand-ui-audit` / `brand-ui-visual-ux-reviewer`).
