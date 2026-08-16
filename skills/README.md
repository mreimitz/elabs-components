# skills/

Canonical, harness-agnostic [Agent Skills](https://agentskills.io) for brand-ui.
This folder is the **source of truth**; Claude Code reads it via `../.claude-plugin/`,
and `npx skills add <path-to-this-repo>` reads it directly.

- `brand-ui/` — consumer skill: build UI with `@elabs-ai/components-*` (auto-triggers).
- `brand-ui-audit/` — design audit: static lint + cross-theme contrast/visual review.
- `brand-ui-component/` — maintainer: scaffold/extend a component.
- `brand-ui-theme/` — themes + global tokens.
- `brand-ui-registry/` — curate the shadcn-compatible registry.
- `brand-ui-new-app/` — define-to-build: guided interview → `app-spec.md` → annotated app scaffold + starter `CLAUDE.md` (entry point: `/new-app`).
- `brand-ui-migrate/` — brownfield adoption: scan → map → phased plan → reviewed migration of an app that already exists (entry point: `/brand-ui-migrate`).
- `brand-ui-enterprise/` — enterprise design-judgment layer: classify the surface (professional/consumer/marketing), pick the app-shell archetype, stand up the mandatory baseline, model objects → screens. Defers props to `brand-ui`, scoring to `brand-ui-audit`.

All skills call the `@elabs-ai/components-cli` engine (`../packages/cli`) so they read the real
code instead of guessing. See [../docs/SKILLS.md](../docs/SKILLS.md) for install
and architecture.
