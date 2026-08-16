# 12 · Decision record — adopting Vercel's Web Interface Guidelines (delta-only)

> **Status:** Accepted + partially implemented · 2026-06-06. Prompted by the Vercel
> `web-interface-guidelines/command.md` review. Records what we adopted, what was
> applied this session, and where the rest lands across the existing WPs + the
> vibe-coder plugin. **No new stream** — it sharpens existing rules/agents/WPs.

## Context

Vercel's `command.md` is a terse `file:line` UI-compliance reviewer spanning ~14
domains + a gate-able anti-pattern list. It's the **interaction & front-end-hygiene**
layer that complements — not overlaps — brand-ui's strengths (tokens, six themes,
`cva`, the a11y baseline, the motion gate). Adopting it **wholesale would duplicate**
our a11y/motion rules and import Tailwind/Next-isms that fight our token rules, so we
take the **delta** in brand-ui's idiom, and split **library vs app** concerns.

## Decision

1. **Delta-only rule.** New `.claude/rules/interaction-guidelines.md` holds the
   net-new **component-level** domains (forms behaviour, micro-typography, content
   handling, images/CLS, performance, touch/overscroll, hover/destructive). It
   **extends** (doesn't restate) `accessibility.md`, `MOTION_GUIDELINES.md`,
   `theming.md`. Imported from `CLAUDE.md`.
2. **A static reviewer command.** `/review-interface <path>` — terse `file:line`
   findings, complementing `/review-component` (full gate) and the browser-based
   `visual-ux-reviewer`. Wired into both reviewer agents.
3. **Library vs app split.** App-level items — URL/`nuqs` state, RSC hydration
   specifics, `env(safe-area-inset-*)`, `<meta theme-color>`, `Accept-Language` —
   are **not** component rules; they live in the **apps** + the **plugin's
   generated-app guidance** (VP-02/VP-04).

## Applied this session (done + typechecked)

- `interaction-guidelines.md` (rule) + `/review-interface` (command); CLAUDE.md
  import; pointers in `visual-ux-reviewer`, `accessibility-reviewer`,
  `/review-component`; `color-scheme` note in `theming.md`.
- **Five component quick-wins** (the concrete gaps the audit exposed):
  - `color-scheme: light|dark` on **all six theme blocks** (`themes.css`).
  - `touch-action: manipulation` on **Button** (kills 300ms tap delay).
  - `overscroll-behavior: contain` on **Dialog / Drawer / Sheet** (no scroll-chain).
  - `tabular-nums` on **MetricCard** value + delta.
  - `translate="no"` on **Kbd** (don't auto-translate `⌘K`).

## Where the rest lands (WP / plugin wiring)

- **WP-10 (gates):** the anti-pattern list → `eslint-plugin-jsx-a11y` + custom rules
  (`transition: all`, `outline-none` w/o focus-visible, `<div onClick>`, `<img>` w/o
  dims, icon button w/o `aria-label`, hardcoded date/number → `Intl.*`). Enforcement,
  not reminder.
- **WP-15 (anti-slop):** harvest **micro-typography** (`…`/curly quotes/nbsp/
  tabular-nums) + **content/copy** (active voice, Title Case, specific labels,
  errors-with-fix, numerals) into the AI-TELLS catalog + the anti-slop audit —
  highest overlap.
- **WP-06 (i18n/RTL):** add `Intl.DateTimeFormat`/`Intl.NumberFormat` + `translate="no"`
  (brand/code tokens) to scope.
- **WP-02 / WP-12:** `interaction-guidelines.md` is one source → generated into the
  guidance surfaces; `/review-interface` is part of the coverage bar.
- **Plugin — VP-02 (greenfield) + VP-04 (visual loop):** the biggest fit. The plugin
  **audits generated UIs against `/review-interface`** inside propose→preview→refine,
  and **ships the guidelines as the end-user quality bar** (the "plugin defines the
  standard" pattern, like the Lucide default). **VP-03 (brownfield)** flags the
  anti-patterns during the migration scan.

## Honest status

The rule, command, wiring, and five quick-wins are **applied + typechecked** (tsc
green for `@qlik-coe-emea/qlabs-components-ui` + `@qlik-coe-emea/qlabs-components-charts`). They are **not visually verified** — the
sandbox can't run Storybook — so confirm on a real screen (`pnpm storybook` +
`/review-interface`). The ESLint gate (WP-10) and the WP-15/06/02/12 + VP absorption
are **proposed**, not built.

---

_Source: Vercel Web Interface Guidelines (`vercel-labs/web-interface-guidelines/command.md`),
adopted delta-only. Rule: `.claude/rules/interaction-guidelines.md`; command:
`.claude/commands/review-interface.md`._
