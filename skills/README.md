# skills/

Canonical, harness-agnostic [Agent Skills](https://agentskills.io) for brand-ui.
This folder is the **source of truth**; Claude Code reads it via `../.claude-plugin/`,
and `npx skills add <path-to-this-repo>` reads it directly.

- `brand-ui/` — consumer skill: build UI with `@elabs-ai/components-*` (auto-triggers); includes the agent-output contract and the A2UI generative path (`brand-ui a2ui`).
- `brand-ui-audit/` — design audit: static lint + cross-theme contrast/visual review.
- `brand-ui-component/` — maintainer: scaffold/extend a component.
- `brand-ui-theme/` — themes + global tokens.
- `brand-ui-create-theme/` — research a brand (links, files, live product, logo) → sourced theme-family proposal → written on approval (entry point: `/create-theme` in this repo). Ships `scripts/theme-kit.mjs`.
- `brand-ui-update-theme/` — enhance an existing theme family from new material as a per-token, sourced diff (entry point: `/update-theme` in this repo).
- `brand-ui-registry/` — curate the shadcn-compatible registry.
- `brand-ui-new-app/` — define-to-build: guided interview → `app-spec.md` → annotated app scaffold + starter `CLAUDE.md` (entry point: `/brand-ui-new-app`).
- `brand-ui-migrate/` — brownfield adoption: scan → map → phased plan → reviewed migration of an app that already exists (entry point: `/brand-ui-migrate`).
- `brand-ui-enterprise/` — enterprise design-judgment layer: classify the surface (professional/consumer/marketing), pick the app-shell archetype, stand up the mandatory baseline, model objects → screens. Defers props to `brand-ui`, scoring to `brand-ui-audit`.

All skills call the `@elabs-ai/components-cli` engine (`../packages/cli`) so they read the real
code instead of guessing. See [../docs/SKILLS.md](../docs/SKILLS.md) for install
and architecture.
