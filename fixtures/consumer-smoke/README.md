# consumer-smoke fixture

The only thing in this repo that consumes the **built `dist/` artifact** the way
an external consumer does.

Everywhere else, `@elabs-ai/components-*` resolves to TypeScript **source** via the `exports`
map (the Turborepo just-in-time-package pattern). That is fast and great for
development, but it means `pnpm dev`, `pnpm build`, `pnpm typecheck` and all ~40
CI gates are blind to anything that only breaks in the published shape. Four real
defects lived there undetected:

- `"use client"` directives stripped from every `dist/*.js` (RSC consumers broke)
- `@elabs-ai/components-tokens` fonts copied to `dist/fonts/fonts/…`, so every `@font-face` 404'd
- `@elabs-ai/components-maps` / `@elabs-ai/components-editor` CSS extracted by esbuild and then orphaned, so
  the components shipped unstyled
- `@elabs-ai/components-editor`'s `./monaco-environment` subpath pointing at raw `.ts`

This fixture is not run directly. `pnpm consumer:check`
(`scripts/check-consumer-install.mjs`) copies it to a temp directory outside the
workspace, rewrites each `@elabs-ai/components-*` placeholder version to a freshly packed
tarball, installs, builds it with Vite, and asserts the artifact is sane.

`src/index.css` is a literal copy of what `docs/CONSUMING.md` tells consumers to
write. If the two drift, the docs are wrong — that is intentional.
