---
"@elabs-ai/components-cli": minor
---

The CLI package now ships the chart descriptions as plain JSON, in `lib/definitions.generated.json`. For every chart, chart part (axes, grid, series marks, reference line) and card-like surface in `@elabs-ai/components-charts`, the file lists every prop, the values it accepts, its default, and the data the chart binds to. It also carries the chart's own documentation: its summary, the kinds of data it suits and when to pick another chart instead. The file is keyed by package name, so other packages can add their components to the same file later. The CLI reads it as JSON and needs no TypeScript or bundler at run time.

The package also ships `lib/chart-codemod-map.generated.json`, the list of renamed chart props in the shape `brand-ui codemod <map.json>` reads. It is empty for now; it fills in as chart props are renamed ahead of 6.0.0.

No command's output changes yet.
