---
"@elabs-ai/components-charts": major
---

Start the 6.0 major line for the lockstep component suite. This release brings the accumulated chart prop, definition, responsive sizing, and interaction contract changes into one coordinated version. The chart and flow aliases introduced here remain supported through 6.x; their removal target is 7.0.0 because there was no published 5.6 warning release.

### Migrate to 6.0

1. Upgrade every installed `@elabs-ai/components-*` package together to `6.0.0` and run your app's typecheck and tests.
2. Adopt the canonical chart props now. The old names still render and warn in development. Review `packages/cli/lib/chart-codemod-map.generated.json`, or run `brand-ui codemod packages/cli/lib/chart-codemod-map.generated.json` to see a read-only migration plan. The planner does not edit files.
3. For flow nodes and groups, use `tone="neutral"` in place of `tone="default"`, and `emphasis="featured"` in place of `tone="accent"`. Use `FlowPlaceholderNode`'s `title` in place of `label`.
4. Replace `height` on `WaterfallChart`, `ChartFrame`, and `AutoChart` with `plotHeight`, and replace `<Scatter trend>` with `ScatterChart`'s `analytics` trend. These legacy paths remain available in 6.x and are scheduled for removal in 7.0.0.
