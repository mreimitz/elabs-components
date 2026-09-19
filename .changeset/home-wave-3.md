---
"@elabs-ai/components-ui": minor
"@elabs-ai/components-cli": minor
---

UI gains three new components: `SpecPlayground` is a live JSON spec editor that validates, renders, shows path/code/message errors that jump to the line, displays the last valid render when the spec is incomplete, offers an examples menu, and accepts a pluggable `editor` slot (Textarea by default); all strings are configurable via `labels`. `IntegrationMatrix` is a table of agent integration routes selectable by host, with copy and link actions for each. `InstallTabs` includes a package-install tab (`pnpm add …`, which switches by app archetype), a copy-own tab (registry block via `shadcn add`), one tab per agent host, and a prompt tab; all text is configurable. CLI: `createMcpHttpHandler` and the `llms` renderer accept a `siteRoutes` option (default `false`). With `siteRoutes: true`, story links point to `https://elabs-ai.com/storybook/?path=…` and the registry endpoint is `https://elabs-ai.com/r`; with it off (default), output is unchanged.
