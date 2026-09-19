---
"@elabs-ai/components-ai": minor
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": patch
"@elabs-ai/components-data": minor
"@elabs-ai/components-flow": minor
"@elabs-ai/components-icons": minor
"@elabs-ai/components-maps": minor
"@elabs-ai/components-marketing": minor
"@elabs-ai/components-terminal": minor
"@elabs-ai/components-ui": minor
"@elabs-ai/components-viewer": minor
---

Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).
