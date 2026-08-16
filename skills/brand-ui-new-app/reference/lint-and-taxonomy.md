# Scaffold step — enforce the taxonomy (`brand/no-raw-*`)

Every scaffolded app must enforce "type is a role, colour is a token" at the
agent's point of action — not just ask for it in prose.

`brand-ui scaffold --write` already emits `eslint.config.js` and the matching
`package.json` block, picking the right branch from the spec's `standalone` flag.
This page documents **what it emits and why**, so you can review it (or wire it by
hand when you are retro-fitting an existing app).

## Branch A — in-monorepo (`"standalone": false`, the default)

### 1 · Dependency

```
"@qlik-coe-emea/qlabs-components-eslint-config": "workspace:*",
"eslint": "^9"
```

### 2 · `eslint.config.js` (app root)

The shared config ships `brand/no-raw-font-size` + `brand/no-raw-color` at
`warn`. A freshly scaffolded app starts clean, so bump them to **`error`** so
the lint _blocks_ raw sizes/colours instead of just warning:

```js
import { reactConfig } from "@qlik-coe-emea/qlabs-components-eslint-config/react";

export default [
  ...reactConfig,
  {
    rules: {
      "brand/no-raw-font-size": "error",
      "brand/no-raw-color": "error",
    },
  },
];
```

(A Storybook app also adds `eslint-plugin-storybook`; the two brand rules sit on
top either way.)

## Branch B — standalone (`"standalone": true`)

**The shared config is a private, unpublished package.** It is not on the registry
under any version, so a project outside the monorepo cannot install it —
`workspace:*` or otherwise. Do **not** put it in a standalone app's
`package.json`; the install will simply fail.

So a standalone scaffold gets a self-contained config and an honest statement of
what is missing:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// NOTE: the shared eslint-config (which ships `brand/no-raw-font-size` +
// `brand/no-raw-color`) is a PRIVATE, unpublished package — a standalone app
// cannot install it. Until it is published, the two taxonomy rules are NOT
// machine-enforced here; they are still non-negotiable and are spelled out in
// CLAUDE.md, and `brand-ui audit <dir>` catches raw colours and other token
// violations statically. Run it in CI.
export default [js.configs.recommended, ...tseslint.configs.recommended, { ignores: ["dist/**"] }];
```

The replacement teeth for this branch are **`brand-ui audit <dir>`** — the static
token / anti-slop pass, which ships with the CLI the app already installs. Wire it
as a `package.json` script and run it in CI:

```
"audit": "brand-ui audit src"
```

> Publishing the shared eslint-config would remove this asymmetry and let a
> standalone app get the real rules. That is a maintainer call (it would need a
> publish-readiness pass first), not something the scaffold can decide.

## 3 · `package.json` script (both branches)

```
"lint": "eslint ."
```

## What the rules catch

- **`brand/no-raw-font-size`** — `text-2xl`, `text-[18px]` → use a `text-<role>`
  utility (display / title / subtitle / body / caption / meta / kpi) or a
  `<Heading>` / `<Text>` component.
- **`brand/no-raw-color`** — `text-gray-500`, `bg-[#fff]` → use a semantic token
  (`text-foreground`, `text-muted-foreground`, `bg-primary` +
  `text-primary-foreground`, `bg-success/10`, `border-border`, …).

These run on every `pnpm lint` + in CI — **agent-independent**. The brand-ui
plugin also ships a PostToolUse hook (`hooks/check-raw-taxonomy.mjs`) that
surfaces the same findings **inside the agent's edit loop**, so violations are
fixed in the same turn. One set of patterns, three surfaces; judgment calls
(which role? does the hierarchy read?) stay with the `brand-ui-audit` review.
