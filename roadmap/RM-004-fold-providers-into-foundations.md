---
id: RM-004
title: Fold the Providers group into Foundations; give ThemeProvider and LocaleProvider one home
status: planned
priority: P2
effort: S (half day)
depends_on: [RM-003]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §1.2
---

# RM-004 Fold Providers into Foundations

## Finding

`Providers` sits second-to-last by design (the "utilities" tier), and holds exactly two stories: `Providers/LocaleProvider` (`packages/ui/src/components/locale-provider/locale-provider.stories.tsx`) and `Providers/Storybook Theme Harness` (`apps/docs/stories/storybook-theme-harness.stories.tsx`).

`ThemeProvider` has no story of its own; it is exercised only inside `Foundations/Theming` (`apps/docs/stories/foundations/theming.stories.tsx`). So the two root providers an app must mount are documented in two different tiers, and neither is on the Getting Started path.

## Change

1. `locale-provider.stories.tsx`: `title: "Foundations/Localization"`. Keep the stories; add a docs description that points at `docs/I18N.md` and shows the root mount (`<ThemeProvider><LocaleProvider>...`).
2. `storybook-theme-harness.stories.tsx`: `title: "Docs/Storybook Theme Harness"`. It is Storybook tooling, not a shipped component. Add it to the explicit `Docs` child order in `preview.tsx` (after "Testing Charts in jsdom").
3. `Foundations/Theming`: make sure the docs page has a "Root setup" section that shows `ThemeProvider` props (`theme`, `density`, `motionPref`, `decoration`) as a real story with controls, not only the switcher demo. If the file already does this, no change.
4. `Docs/Getting Started`: link to `Foundations/Theming` and `Foundations/Localization` under "mount the providers".
5. Remove `"Providers"` from `storySort.order` and from the guidelines list.

## Acceptance

- `/index.json` has no `Providers/*` title.
- `Foundations` contains `Localization`; `Docs` contains `Storybook Theme Harness`.
- Getting Started links to both provider pages.

## Test / gate

RM-002 gate passes; a11y/story baselines updated for the renamed ids.
