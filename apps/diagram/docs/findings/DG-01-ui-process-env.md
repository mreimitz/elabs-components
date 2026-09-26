# DG-01 — `packages/ui` reads `process.env.NODE_ENV` unguarded

## What

`packages/ui`'s workspace **source** (not its built `dist`) references the ambient
Node global `process` directly, with no local guard or shim:

- `packages/ui/src/components/command/command.tsx:376`
  ```ts
  if (process.env.NODE_ENV !== "production") {
  ```
- `packages/ui/src/components/context-rail/context-rail.tsx:584`
  ```ts
  if (process.env.NODE_ENV !== "production" && overlayBreakpoint < 768) {
  ```

Both are dev-only warn/assert branches — reasonable to keep, but they assume
`process`/`NodeJS` are ambiently declared wherever this file gets typechecked.

## Where it bit apps/diagram

`@elabs-ai/components-ui`'s `exports["."]` resolves to `./src/index.ts` inside the
workspace (`packages/ui/package.json`), same as `verified-apis.md` documents for the
Tailwind `@source` lines. That means when `apps/diagram` (or any workspace consumer)
typechecks against `@elabs-ai/components-ui`, TypeScript type-checks
`packages/ui/src/**` **under the consuming project's own compiler options** — there is no
project-reference boundary. `apps/diagram/tsconfig.json` intentionally sets
`"types": ["react", "react-dom"]` (no `"node"`, since the item's dependency list for this
app does not include `@types/node`), so `process` resolved to nothing and
`typecheck:local` failed:

```
../../packages/ui/src/components/command/command.tsx(376,7): error TS2591: Cannot find name 'process'. …
../../packages/ui/src/components/context-rail/context-rail.tsx(584,9): error TS2591: Cannot find name 'process'. …
```

## Why `packages/ui`'s own `typecheck` passes

`pnpm --filter @elabs-ai/components-ui typecheck` is green even though `packages/ui`'s
own `tsconfig.json` also restricts `"types"` — to `["react", "react-dom",
"vitest/globals", "@testing-library/jest-dom"]` — and does **not** list `"node"` either.
The difference: `vitest` is in that list (via `"vitest/globals"`), and pnpm resolved
`vitest` in this repo against a real `@types/node` peer —
`node_modules/.pnpm/vitest@3.2.6_@types+debug@4.1.13_@types+node@22.19.19_…` — so
`vitest`'s own type graph (pulled in because it's a named entry in `"types"`) carries
`@types/node`'s ambient `process`/`NodeJS` declarations along with it as a side effect.
`apps/diagram` has no reason to depend on `vitest` (it ships no tests, D14), so it never
gets that accidental ambient `process`, and is the first consumer in the repo to notice
this file isn't self-contained.

## Work-around in the app

`apps/diagram/src/types/process-env.d.ts` — a minimal ambient declaration
(`declare const process: { env: Record<string, string | undefined> }`), so `tsc` resolves
`process.env.NODE_ENV` without installing `@types/node`. Marked `// P4: library gap` per
item instructions.

## Proposed fix in `packages/ui` (P4)

`packages/ui`'s own build output should not depend on any consumer accidentally having
Node ambient types available. Two options, either resolves it at the source:

1. Ship a small ambient declaration file with the package's own source (e.g.
   `packages/ui/src/env.d.ts` with `declare const process: { env: Record<string,
string | undefined> } | undefined;`), so any consumer that resolves `@elabs-ai/components-ui`
   to source picks it up automatically via TS's normal `include` of sibling `.d.ts`
   files — no action needed downstream.
2. Or replace the two call sites with an `import.meta.env`-safe guard (Vite/ESM native,
   no ambient Node global needed at all): something like
   `const isDev = typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : import.meta.env?.DEV;`
   — but `typeof process` alone still needs `process` declared somewhere to typecheck,
   so this still wants option 1's shim, just written defensively at the two call sites
   instead of relying on it being ambient.

Either way this is a `packages/ui` change, out of scope for this app-only work package.
