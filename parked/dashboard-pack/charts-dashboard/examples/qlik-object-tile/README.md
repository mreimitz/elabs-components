# `qlik-object` — embedding a BI host's own visualisation

A SKELETON tile kind (`qlik-object-tile.tsx`) documenting how a nebula.js visualisation would
mount inside a sheet's grid cell, without this repo ever depending on `@nebula.js/*`. Copy it
into your own app and replace the one call site that matters — see below.

## The idea

A dashboard sheet built from `@elabs-ai/components-charts/dashboard` composes its own tile kinds
(`chart`, `metric`, `filter`, …) alongside tiles a HOST renders itself — a table, a chat panel, or,
as here, a BI platform's own object (a Qlik sheet object embedded via nebula.js). The sheet never
needs to know what a `qlik-object` tile draws; it only needs a `<div>` to hand the host and the
tile's declared size, mode and interactions — exactly what `DashboardTileProps` already carries
for every kind.

## The `host` prop

`DashboardProvider` takes an optional `host?: Record<string, unknown>` pass-through
(`dashboard-sheet/dashboard-provider.tsx`, `// host pass-through — RM-085`) — an escape hatch for
values a tile kind needs that have nothing to do with the sheet's own spec/selection/layout model
(D5: the library renders, it never owns a runtime). This example's `QlikObjectHost` interface
names exactly one key, `renderObject`:

```tsx
import { DashboardProvider } from "@elabs-ai/components-charts/dashboard";
import { embed } from "@nebula.js/stardust"; // your app's own dependency, not this repo's

const nebulaApp = embed(qlikEngineApp, { types: [] }); // your own connection setup

<DashboardProvider
  spec={spec}
  tiles={tiles}
  host={{
    renderObject: (element, objectId, { interactions }) => {
      let disposed = false;
      let viz: { destroy(): void } | undefined;
      nebulaApp.render({ element, id: objectId, options: { interactions } }).then((v) => {
        if (disposed) v.destroy();
        else viz = v;
      });
      return () => {
        disposed = true;
        viz?.destroy();
      };
    },
  }}
>
  {/* ... */}
</DashboardProvider>;
```

`nebulaApp.render({ element, id, options: { interactions } })` is nebula.js's own call — this
package never makes it. The `qlik-object` tile kind's job is only to hand a mounted `<div>` and the
tile's `interactions` to whatever function the host supplies.

## Why `interactions` needs no translation

`DashboardTileProps.interactions` is `Required<ChartInteractions>` —
`{ passive, active, select, edit }` (`charts/chart-config-context.tsx`) — the SAME four keys
nebula.js's own `Interactions` type uses for a visualisation's `options.interactions`. That is a
deliberate choice (analysis Sources): a `qlik-object` tile's `renderObject` call passes
`{ interactions }` straight through with no per-key renaming, no boolean inversion, nothing to get
wrong. View mode mounts `passive`/`active`/`select`; edit mode mounts only `edit`
(`dashboard-sheet/dashboard-tile.tsx`) — the same split a real nebula visualisation expects between
a reader looking at a sheet and an editor arranging it.

## The "host renderer missing" fallback

`host.renderObject` is optional by construction (the sheet has no BI host in every story or test
that registers this kind). Its absence renders a `ui/StatePanel` naming the gap rather than a blank
tile — same convention as an unregistered tile kind (`DashboardTileKind` docs,
`dashboard-sheet/labels.ts`'s `unknownKind`).

## What this package never does

`@elabs-ai/components-charts` never imports, calls, or knows about `@nebula.js/*` or any other BI
platform's SDK (D5; `.claude/rules/dashboard.md`'s import boundary). Every line that knows
`renderObject` exists lives in this example file and the `host` object your own app builds —
swap the engine, and only your own `renderObject` implementation changes.

## Related

- `packages/charts/src/dashboard/README.md` — "Embedding in a BI host".
- `packages/charts/src/dashboard/examples/engine-driver/` — the matching `SelectionDriver` example
  for an associative engine's SELECTION side; this file is the RENDERING side.
- `docs/CONSUMING.md` — the "Dashboard surface" per-package extras entry.
