---
"@elabs-ai/components-cli": minor
---

`brand-ui docs` now lists the props a component inherits, not only the ones it declares itself. When a component's props extend another brand-ui type, such as a chart's selection, navigator or accessibility props, those props appear under their own "props (inherited)" heading, each with the name of the type it comes from. Before, only the base type's name was shown, so props like `LineChart`'s `window`, `zoom` and `selectionToolbar` were missing from the docs. Props inherited from React or DOM types, and from other libraries, are still named in the `extends` line only.

Chart props now also show their default value and, when a prop is deprecated, the version it was deprecated in, what to use instead and the version that removes it. For example, `brand-ui docs WaterfallChart` marks `height` as deprecated in favour of `plotHeight`. The MCP `docs` tool shows the same, and the `brand-ui.manifest.json` shipped with the CLI carries these props and fields.

The short `--brief` card still lists only the props a component declares itself.
