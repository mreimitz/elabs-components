---
"@elabs-ai/components-ui": minor
---

A new entry point, `@elabs-ai/components-ui/definition`, describes a component's props as plain data. It has no React in it, so it works in a server component, a Node script or a build step.

With it you can:

- list a component's props with `field.*` (text, numbers with limits and units, choices, colours, per-breakpoint values, objects, lists), group shared props with `definePropGroup`, and declare the whole component with `defineComponent`. The compiler checks the list against the component's props type.
- fill in defaults with `resolveProps`, keep renamed props working with `applyAliases`, and check untrusted input (an agent's JSON, a saved spec) with `validateProps`, which reports problems instead of throwing.
- turn a definition into JSON Schema with `toJsonSchema`, or into a stable JSON snapshot with `toSnapshot`.
- share the ready-made `header` (title, subtitle, description), `a11y` (accessible label and description) and `status` (tone) groups.

Nothing existing changes. `STATUS_TONES` and `StatusTone` are still exported from the main entry.
