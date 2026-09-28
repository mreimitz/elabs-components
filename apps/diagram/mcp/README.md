# Atlas MCP server

Atlas's dev server is also an MCP server: an LLM session (Claude Code, Claude Desktop) reads,
writes and validates the diagrams in `apps/diagram/workspace/`. Atlas itself calls no model and
holds no key. It answers only requests addressed to localhost, and only while
`pnpm --filter @elabs-ai/diagram dev` runs (not `vite preview`).

Endpoint: `http://localhost:5180/mcp`

This file is the source of the connect strings; Atlas's Home (DG-23) copies them.

## Claude Code

```sh
claude mcp add --transport http atlas http://localhost:5180/mcp
```

## Claude Desktop

Add to `claude_desktop_config.json`, then restart Claude Desktop. Its config starts local
commands, so the `mcp-remote` bridge connects it to the HTTP endpoint (npx fetches it when
Claude Desktop starts; it is not a dependency of this repo):

```json
{
  "mcpServers": {
    "atlas": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:5180/mcp"]
    }
  }
}
```

Not verified yet: no Claude Desktop session has connected this way so far.

## Prompts

- `author-diagram` — draw a diagram from a description.
- `fill-catalog` — fill one vendor's catalog entries (argument `vendor`, e.g. `aws`); see
  `catalog/README.md`.

## A first session

1. Start Atlas and open http://localhost:5180 in a browser to watch the diagrams.
2. Connect as above; ask for the `author-diagram` prompt with three sentences about your landscape.
3. The session validates and creates the file; open it in the tab (`#d/<path>`).
4. Ask it to fix what reads badly; every write is validated first, nothing broken is saved, and
   the open tab redraws after each write.

## Tools

| Tool                | Input                                                                                                     | Returns / does                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workspace_tree`    | `{}`                                                                                                      | folders, and diagrams with title, kind, mtime, size                                                                                                          |
| `diagram_read`      | `{ path }` (a `.yaml`/`.yml` path)                                                                        | `{ path, mtime, text }`                                                                                                                                      |
| `diagram_write`     | `{ path, text, base }`                                                                                    | validate, then write if `base` (the mtime read) still matches → `{ path, mtime, size, warnings }`                                                            |
| `diagram_create`    | `{ path, text }`                                                                                          | validate, then create (never overwrites) → same                                                                                                              |
| `diagram_move`      | `{ from, to }`                                                                                            | never overwrites → `{ from, to }`                                                                                                                            |
| `diagram_trash`     | `{ path }`                                                                                                | to `_trash/` → `{ path, trashedTo }`                                                                                                                         |
| `spec_validate`     | `{ text }`                                                                                                | `{ ok, issues: [{ severity, code, path, message, line?, col?, suggestion? }] }`                                                                              |
| `spec_compile`      | `{ text }`                                                                                                | `{ ok, issues, diagram }` — the flattened model (zones, nodes with `parent`, flows with `form`)                                                              |
| `spec_schema`       | `{}`                                                                                                      | the dialect v1 JSON Schema                                                                                                                                   |
| `compose_set`       | `{ path, target, patch }`                                                                                 | `target`: node/zone id, `flow:<from>-><to>`, or `""` (top level); a `patch` value `null` removes the key                                                     |
| `compose_add_nodes` | `{ path, into?, nodes: [{ id, … }] }`                                                                     | append to zone `into`'s children, or to top-level `nodes:`                                                                                                   |
| `compose_add_flows` | `{ path, flows: [{ from, to, … }] }`                                                                      | append to `flows:` in the shortest form                                                                                                                      |
| `catalog_search`    | `{ query, vendor?, limit? }`                                                                              | products, icons and parts by name, alias or tag → `{ results: [{ name, label, description?, kind?, tags?, icon, part? }] }`                                  |
| `catalog_get`       | `{ name }`                                                                                                | one entry and a ready-to-paste node (`yaml`)                                                                                                                 |
| `catalog_missing`   | `{ vendor, limit?, after? }`                                                                              | the fill loop's worklist → `{ vendor, total, missing: [{ slug, name, label, generic? }] }`                                                                   |
| `catalog_update`    | `{ vendor, create_vendor?, entries: [{ slug, name, description, docs, kind?, icon?, tags?, aliases? }] }` | writes `catalog/<vendor>.yaml`; new slugs require `kind`, new vendors require `create_vendor: true`; optional `icon` must exist; curated entries are skipped |

A write with a YAML error writes nothing and answers the errors with their line numbers. The
`compose_*` tools edit the file's text in place: every line they do not touch, comments
included, stays as it was.

## Skill

Copy `mcp/skills/atlas/` to `~/.claude/skills/atlas/` for the authoring loop in every session.
