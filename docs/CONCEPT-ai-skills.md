# Concept — brand-ui AI Skills (+ optional MCP)

Status: proposal / for discussion · Date: 2026-06-05 · Owner: Manuel

Goal: ship an installable **AI skill layer** for `brand-ui` that supercharges UI
creation for **two audiences at once**:

1. **The maintainer (you)** — building and extending the library _inside_ this monorepo.
2. **The consumer** — a developer building their _own_ app _with_ `@elabs/components-*`, in
   their own repo, in Claude Code / Cursor / Codex / etc.

This document analyzes the reference systems, then proposes a concrete architecture
and a phased plan. Nothing here is built yet.

---

## 1. TL;DR recommendation

Ship a **`brand-ui` Claude Code plugin** (also installable as portable skills via
`npx skills add`) containing a small, sharp set of skills, backed by a tiny
**`brand-ui` CLI** (the deterministic engine) and a **generated component
manifest** the skills read as ground truth. Layer in UX-thinking and
design-taste reference knowledge — but rewired so every recommendation resolves
to a **brand-ui token**, never raw hex.

Three skill tracks:

- **`brand-ui` (consumer skill)** — the shadcn-model auto-triggering skill that
  teaches a consuming project how to discover, install, compose, theme, and
  correctly use `@elabs/components-*`. _This is the missing piece today._
- **maintainer skills** — thin skills wrapping the commands/agents you already
  have (`new-component`, `new-theme`, registry curation, release).
- **`brand-ui-audit` (quality skill)** — productizes the deterministic checks I
  already ran live (oklch contrast, radius, field-sizing, anti-patterns) +
  the cross-theme visual/a11y browser pass, so both audiences get a real,
  repeatable design review.

MCP is **Phase 3 and optional** — a thin server wrapping the same CLI engine.
Lead with skills + CLI (more portable, what shadcn/impeccable actually rely on).
**Shipped (WP-03 #81):** `brand-ui mcp` is a persistent, dependency-free stdio MCP
server over that same engine (tools: `info`/`search`/`docs`/`tokens`/`audit`),
registered in `.mcp.json` as `brand-ui`, so agents get ground truth with the
Storybook dev server **down**.

---

## 1b. Correction log — after a full read of the reference repos (2026-06-05)

The first version of this concept was written from the repos' structure + load-bearing
files. A subsequent deep read of the impeccable engine and the register/agent layers
corrected several points; the build was updated to match:

- **Register (brand vs product) — the biggest miss.** impeccable loads `reference/brand.md`
  OR `reference/product.md` per task, which flips the defaults. brand-ui is a
  **product-register** system by definition (its `product.md` equivalent reads almost
  verbatim like brand-ui's philosophy: one family, fixed rem scale, restrained color,
  all component states, skeleton loading, no modal-first); `@elabs/components-marketing` surfaces
  are **brand-register** (distinctiveness, required imagery, committed color). The
  `brand-ui-audit` skill now carries a register section.
- **The detector is bigger than I first implied.** impeccable ships a **38-rule
  anti-pattern catalog** (`cli/engine/registry/antipatterns.mjs`) run across **4 engines**
  (regex/source, static-html/jsdom, browser/DOM, visual/screenshot), each rule
  cross-linked to skill guidance via `<!-- rule:id -->` anchors. My first `brand-ui audit`
  was a 6-rule static linter; it's now **~16 token-aware static rules** (the
  regex-engine-applicable subset), calibrated against the real `@elabs/components-ui` source with
  false positives fixed and an advisory/blocking split. The DOM/visual rules stay in the
  skill's browser pass by design.
- **Rendered contrast — better technique available.** impeccable's
  `screenshot-contrast.mjs` hides the glyph text, screenshots before/after, pixel-diffs to
  isolate glyph pixels, and takes the **p10 percentile** ratio. That measures contrast
  against the _actually rendered_ background (gradients, images) — more robust than my
  `getComputedStyle`+oklch approach (which is fine for the solid-token backgrounds brand-ui
  normally uses). Noted in the audit skill as the upgrade path. Their `color.mjs` carries
  the exact lesson from my own live oklch bug: unknown color format → **err toward
  detecting, never silently skip**.
- **"7 domain reference files" was from the stale README.** impeccable v3.5 **inlines**
  the design laws in `SKILL.md` (Color/Type/Layout/Motion/Copy + Absolute bans), with
  `reference/<command>.md` carrying per-command flow and `brand.md`/`product.md` the
  register. Build-time placeholders (`{{model}}`, `{{scripts_path}}`) + provider-conditional
  `<codex>`/`<gemini>` blocks compile per-harness.
- **intent has a persona-agent layer I under-weighted.** 6 agents (Noor/Ember/Wren/Vigil/
  Rune/Sage) bundle the verb-skills into specialists. **Vigil** (quality+resilience+a11y)
  is the model for bundling brand-ui's reviewers: Nielsen-10 heuristic scoring (0–4), a
  **9-state inventory** (default/empty/loading/partial/error/success/offline/disabled/
  overflow), WCAG 2.2-for-designers, and finding→owner routing. A future
  `brand-ui` persona agent should follow this shape.
- **Honest scope note:** I did _not_ read every one of the ~1,869 impeccable files (the
  skill is built into ~13 identical harness copies) — I read the canonical `skill/` +
  `cli/engine/` + docs, and for intent the foundation + a representative skill + Vigil +
  the registers. I have not line-read all 14 remaining intent skills (they follow the
  intent/blueprint pattern), the 8 intent reference knowledge bases, or impeccable's
  10k-line `live-browser.js` implementation.

## 2. The two audiences and the current gap

| Capability                                        | Maintainer (in this monorepo)           | Consumer (their app)           |
| ------------------------------------------------- | --------------------------------------- | ------------------------------ |
| Discover components                               | registry + Storybook                    | **nothing**                    |
| Add / compose                                     | `/new-component`                        | **nothing** (must read source) |
| Rules enforcement (tokens-only, forwardRef, a11y) | `.claude/rules/*` + `/review-component` | **nothing**                    |
| Theming                                           | `/new-theme`                            | **nothing**                    |
| Quality audit                                     | `/visual-review`, `/qa-flows`           | **nothing**                    |
| Ship                                              | `/prepare-release`                      | n/a                            |

Everything in `.claude/` today is **monorepo-internal**. A consumer who runs
`npx shadcn add <brand-registry-url>` gets components but **zero** guidance on
the conventions that make them correct (semantic tokens, composition, theme
safety, accessibility). The skill layer closes that gap and, as a bonus, makes
the maintainer tooling portable and first-class.

Current assets we can reuse directly: **8 commands**, **7 agents**, **11 rule
files**, a **13-item shadcn-compatible registry**, and the **deterministic
checks** already prototyped during the visual review.

---

## 3. What I studied, and what we borrow

| Source                        | Pattern worth stealing                                                                                                                                                                                                                                                                    | How we apply it                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shadcn/ui `skills/shadcn`** | Thin skill + CLI backend; live project-context injection (`!`npx shadcn info --json``); Critical Rules linked to files with Incorrect/Correct pairs; component-selection table; "always fetch docs, don't guess".                                                                         | The **consumer skill** template. Our `.claude/rules/*` already _are_ the critical-rules content — repackage them as the skill's linked rule files (one source, shared with `CLAUDE.md`).             |
| **vercel/ai `skills/`**       | Split **maintainer** skills (add-provider, update-models, ADR, major-version-mode) from one **consumer** skill (`use-ai-sdk`). "**Do not trust internal knowledge — read `node_modules/<pkg>/docs` + source.**" Fetch live model IDs.                                                     | Two-track split. Ship a **generated component manifest + per-package `docs/`** so the agent reads the _real_ current API/props instead of hallucinating.                                             |
| **mattbx/shadcn-skills**      | Two complementary skills — **discovery** (before building) and **review** (after). Packaged as a plugin; multi-harness via `npx skills add`; recommends (not requires) the shadcn MCP.                                                                                                    | Our `brand-ui` skill = discovery + compose; `brand-ui-audit` = review. Same plugin + multi-harness distribution.                                                                                     |
| **impeccable**                | **One** skill, argument-routed **command menu** (audit/critique/polish/bolder/quieter/…); 7 domain reference files; **brand-vs-product register**; **deterministic anti-pattern CLI** (`npx impeccable detect`) + LLM critique; per-project `design.json`; setup step loads context once. | Productize my live checks into **`npx brand-ui audit`**; adopt the verb-command UX for the audit/build skill; ship a `brand-ui.config`/design-context file; load design references per command.      |
| **intent**                    | A **routing foundation skill** + 16 UX-discipline verb-skills + 8 reference knowledge bases + **persona agents** that bundle skills; 72-item **anti-pattern catalog**; ethical defaults; loop-back guardrails.                                                                            | The **UX-thinking layer**. Pull in a trimmed anti-pattern catalog + ethical/a11y reference knowledge as references the build/audit skills consult. Optionally bundle our agents into personas later. |
| **bencium design-audit**      | Read the design system first; walk the live app at 3 breakpoints; audit ~14 dimensions; **reduction filter**; 3-phase plan; **wait for approval**; write back `LESSONS.md`.                                                                                                               | The audit skill's protocol: read tokens → browser pass (already wired) → phased findings → approval gate → file issues (our existing `/file-issue` RCA flow).                                        |

Common thread across all five: **the skill is thin and teaches judgment + rules;
a deterministic tool (CLI/MCP) and machine-readable data do the heavy lifting.**
We already have the tool primitives (registry, validate script, the audit evals);
we just haven't packaged them.

---

## 4. Proposed architecture

```
elabs-components/
├─ .claude-plugin/
│  ├─ plugin.json            # the brand-ui plugin (points at ./skills)
│  └─ marketplace.json       # so `/plugin marketplace add <path-to-this-repo>` works
├─ skills/                   # NEW — the shipped skills (portable, multi-harness)
│  ├─ brand-ui/              # CONSUMER skill (shadcn-model, auto-trigger)
│  │  ├─ SKILL.md
│  │  └─ rules/              # symlink/generated from .claude/rules/* (single source)
│  ├─ brand-ui-audit/        # QUALITY skill (deterministic + browser + UX-thinking)
│  │  ├─ SKILL.md
│  │  └─ reference/          # contrast, spacing, motion, a11y, anti-patterns (token-aware)
│  ├─ brand-ui-component/    # MAINTAINER: scaffold/extend a component (wraps /new-component)
│  ├─ brand-ui-theme/        # MAINTAINER + consumer: create/retune a theme (wraps /new-theme)
│  └─ brand-ui-registry/     # MAINTAINER: curate/validate/publish registry items
├─ packages/
│  └─ <pkg>/docs/            # NEW — generated machine-readable component docs (ground truth)
├─ tooling/brand-ui-cli/     # NEW — the deterministic engine (the "backend")
│  └─ commands: info · search · docs · audit · manifest · theme-contrast
└─ brand-ui.manifest.json    # NEW — generated: components, props, exports, tokens, themes, registry map
```

Four building blocks:

1. **Skills** (thin instruction files). Auto-trigger via rich `description`;
   reference rule/knowledge files; never hardcode the API.
2. **`brand-ui` CLI** (the deterministic backend). Mirrors shadcn's `info/search/docs`
   plus our own `audit` (the oklch-contrast / radius / field-sizing / anti-pattern
   detector I already proved works) and `manifest` (regenerate ground truth).
   Ships as a `bin` on the `brand-ui` package.
3. **Component manifest + per-package docs** (the ground truth). Generated from
   the packages (exports + `react-docgen`/`ts-morph` prop types + story names +
   tokens from `themes.css`). The consumer skill reads this so it never guesses
   props — the vercel "don't trust memory" principle, enforced.
4. **Plugin + marketplace manifests** (distribution). One `npx`/`/plugin`
   command installs everything; multi-harness build optional in Phase 2.

Why CLI before MCP: the CLI is portable across every harness, trivial to ship
(`bin` in package.json), and is exactly how shadcn/impeccable operate. MCP is a
nicer DX but heavier to install/run and harness-specific — better as an optional
Phase 3 wrapper over the _same_ engine.

---

## 5. The skill catalog

### Track A — `brand-ui` (consumer, the headline)

- `name: brand-ui`, `user-invocable: false` (auto-triggers when a project depends
  on `@elabs/components-*` or asks to build UI with it).
- **Live context:** `!`npx brand-ui info --json``→ installed`@brand` packages,
  active theme(s), token set, available components, registry URL.
- **Critical rules** (linked files, reused from `.claude/rules/*`): semantic
  tokens only (no raw hex), `forwardRef` + `cn()` + spread props, Radix for
  overlays, compound composition, focus rings, a11y baseline, theme-safety in all
  both themes.
- **Component-selection table:** "need → @brand component" (Button, DataTable,
  ChatShell, CanvasShell, MetricGrid, AppShell, …).
- **Composition patterns:** AppShell = `SidebarProvider`+`Sidebar`+`SidebarInset`;
  dashboard = `MetricGrid`+`DataTable`; assistant = `ChatShell`+AI elements.
- **Workflow:** check installed → `brand-ui search` → `npx shadcn add <brand url>`
  → read manifest for real props → verify against rules → run `brand-ui audit`.

### Track B — maintainer skills (wrap existing commands/agents)

- `brand-ui-component` → `/new-component` flow + `brand-ui-component-builder` /
  `review-component` (dedupe gate, quality gates, story + test, barrel export).
- `brand-ui-theme` → `/new-theme` (a `src/themes/<name>.css` block,
  `BUILT_IN_THEMES`/`BUILT_IN_THEME_META`, registry theme item, contrast check).
  Useful to consumers too — though a consumer theme needs none of that, only
  `defineTheme` + the provider's `themes` prop (ADR 0029).
- `brand-ui-registry` → `brand-ui-registry-curator` (package vs registry decision,
  `registry:validate`, build/publish).
- (release stays a command; optionally `brand-ui-release`.)

### Track C — `brand-ui-audit` (quality, the differentiator)

- Argument-routed like impeccable: `audit · contrast · radius · review · polish`.
- **Deterministic pass:** `npx brand-ui audit <path|url>` — oklch-aware WCAG
  contrast, radius/spacing scale, field-sizing/overflow, token violations
  (raw hex outside `themes.css`), plus an anti-pattern set adapted from
  impeccable/intent (side-stripe borders, gradient text, nested cards, gray-on-
  color, dark-pattern smells).
- **Visual pass:** the agent-browser cross-theme screenshot + critique I ran in
  the visual-UX review (light/dark).
- **Output:** 3-phase plan (bencium) → approval gate → file each finding via the
  existing `/file-issue` RCA → GitHub flow.
- **Token-aware:** every fix references a `@brand` token; it will _never_ suggest
  raw colors — this is what makes it on-brand vs. generic impeccable.

The audit engine already exists in prototype form (the contrast/radius/composer
checks from the visual review). This is the lowest-effort, highest-signal piece
to productize first.

---

## 6. Single source of truth (no drift)

- `.claude/rules/*` is the canonical rule content. `CLAUDE.md` imports it for the
  monorepo; the shipped `brand-ui` skill generates its `rules/` from the same
  files at build time. One edit updates both maintainer and consumer guidance.
- `brand-ui.manifest.json` + per-package `docs/` are **generated** in `pnpm build`
  (and validated in CI), so the skill's component/prop/token knowledge can never
  lag the code — the vercel "read the package, not your memory" guarantee.

---

## 7. Distribution

- **Claude Code:** `/plugin marketplace add <path-to-this-repo>` →
  install `brand-ui`. (Or `npx skills add <path-to-this-repo>`.)
- **Other harnesses (Phase 2):** a build step compiles `skills/` into
  `.cursor/`, `.gemini/`, `.codex/.agents/`, `.github/` layouts (impeccable's
  approach) so Cursor/Codex/Copilot/Gemini users get the same skill.
- **CLI:** `npx brand-ui ...` via the package `bin`; works with or without the
  plugin installed — but **not** without auth. `@elabs/components-cli`
  is a **private GitHub Packages** dependency (ADR 0016), so every `npx brand-ui …`
  / `npx @elabs/components-cli …` example in this document assumes the
  one-time setup first: map the `@elabs` scope in `.npmrc` to
  `npm.pkg.github.com` with a `read:packages` PAT, then
  `pnpm add -D @elabs/components-cli` and call it as
  `pnpm exec brand-ui …`. See `docs/CONSUMING.md` §1 + §7a. Without that, a bare
  `npx` 404s (#265).

---

## 8. Phased roadmap

- **Phase 1 (highest value, ~self-contained):**
  1. `brand-ui` consumer skill (SKILL.md + rule files generated from `.claude/rules`).
  2. `brand-ui.manifest.json` generator + `npx brand-ui info|search|docs`.
  3. `.claude-plugin/plugin.json` + `marketplace.json`; installable in Claude Code.
- **Phase 2:** 4. `brand-ui-audit` skill + `npx brand-ui audit` (productize the prototype checks). 5. Maintainer skills wrapping existing commands/agents. 6. Multi-harness build (Cursor/Codex/Gemini/Copilot).
- **Phase 3 (optional):** 7. ✅ **shipped** — `brand-ui mcp`, a persistent dependency-free stdio MCP server wrapping the same CLI engine (`info`/`search`/`docs`/`tokens`/`audit`), registered in `.mcp.json` (#81). 8. UX-thinking persona agents (intent-style) bundling our reviewers.

---

## 9. Open decisions (for you)

1. **Audience priority for Phase 1** — consumer skill first (most leverage for
   users) vs. maintainer skills first (most leverage for you day-to-day)?
2. **Scope of the audit engine** — port just the checks I already ran, or aim for
   an impeccable-sized rule set (24+)?
3. **MCP** — commit to Phase 3 MCP, or stay CLI-only for portability?
4. **Multi-harness** — Claude Code only, or compile for Cursor/Codex/etc. too?
5. **Naming/visibility** — internal-only (Qlik) plugin, or eventually public like
   the references?

```

```
