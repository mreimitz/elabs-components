---
description: Promote an existing component/block/template into a shadcn-compatible registry item
argument-hint: <item-name> <registry:type> [source component/block]
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(node:*), Bash(pnpm:*), mcp__storybook__*
---

You are adding an item to the internal registry (`registry/`). Read
`@.claude/rules/registry.md` and `docs/REGISTRY_GUIDELINES.md` first.

For a non-trivial item — deciding component vs. block vs. template, keeping
`dependencies`/`registryDependencies` accurate, or a multi-file block/template —
delegate the curation to the **`brand-ui-registry-curator`** agent (Task tool): it
owns registry hygiene end-to-end and re-runs `pnpm registry:validate`. For a simple
single-file `registry:ui` you can follow the steps below directly.

Steps:

1. Decide the item kind (read the guidelines):
   - `registry:ui` — a self-contained primitive (imports `@/lib/utils`)
   - `registry:block` — a copy-owned composition that imports installed
     `@elabs/components-*` packages (declare them in `dependencies`)
   - `registry:theme` — a token set via `cssVars`
2. Create the source file(s) under `registry/components/`, `registry/blocks/<name>/`,
   or `registry/themes/`.
   2.5. Add a co-located `*.stories.tsx` for the item (or reference an existing story)
   showcasing its key variants/states across themes, so it's discoverable + testable
   via Storybook MCP. See @.claude/rules/storybook-mcp.md.
3. Add an entry to `registry/registry.json`:
   - `$schema`, unique `name`, `type`, `title`, `description`
   - `dependencies` (npm + `@elabs/components-*`), `registryDependencies` (other items)
   - `files[]` with `path` (relative to repo root) + `type` (+ `target` for
     `registry:page`/`registry:file`)
4. Run `pnpm registry:validate` and fix any errors. If the Storybook dev server is
   running, run `mcp__storybook__run-story-tests` + `mcp__storybook__preview-stories`
   on the item across themes; otherwise verify it renders manually.
5. Optionally dry-run the shadcn build: `pnpm dlx shadcn@latest build registry/registry.json --output registry/__output`.
6. Summarize the item and how a consumer installs it (`npx shadcn add <name>`).

Never invent files that don't exist on disk — the validator checks every path.
