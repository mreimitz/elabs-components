# Atlas catalog

What each icon is: its product name, one plain sentence, the vendor's docs page, the node
type it usually is, and tags. Atlas shows it on the catalog pages (`#catalog`), in the
details card and in the editor's suggestions. Atlas calls no model: the text is written by
an LLM session connected to Atlas's MCP server, then checked by you.

## Files

- `<vendor>.yaml` — one per vendor. A key can be an icon's file stem
  (`lambda` for `aws/lambda`) or a new product slug:

  ```yaml
  lambda:
    name: AWS Lambda
    description: Serverless compute that runs your code in response to events.
    docs: https://docs.aws.amazon.com/lambda/
    kind: service # service | actor | datastore | queue | external | note
    tags: [compute, serverless]
    curated: false # true once you have checked it; the fill loop never overwrites true
  ```

  `docs_unverified: true` means Atlas could not open the docs page when it was written.

- `parts/<vendor>.yaml` — preset nodes you write by hand: a known icon plus the fields a node
  copies (`subtitle`, `badges`), for things that have no icon of their own. The key must not
  be an icon's stem.

  ```yaml
  data-gateway-direct:
    name: Qlik Data Gateway – Direct Access
    icon: qlik/data-gateway
    kind: service
    subtitle: Direct Access
    badges: [customer-hosted]
    description: Lets Qlik Cloud query on-premises and private-cloud sources through an outbound-only connection.
    curated: true # once you have read it; until then the page says "Not checked yet"
  ```

  The fill loop never writes parts. The parts shipped here were drafted by an agent and carry
  no `curated` yet: read each one, then set `curated: true` on it.

## Filling a vendor

1. Start Atlas (`pnpm --filter @elabs-ai/diagram dev`) and connect Claude Code to it (see
   `mcp/README.md`).
2. In that session, run the `fill-catalog` prompt with the vendor, for example `azure`.
3. It writes batches of 25 until every product icon has a name, description and docs link,
   then reports what it left out: icons it could not identify, and generic glyphs (a gear, a
   globe, a folder) that have no product page of their own.
4. Check a sample on the catalog page (`#catalog/<vendor>`). The page is read-only: to
   correct an entry, or to mark it checked, edit `<vendor>.yaml` here and set
   `curated: true` on it. The fill loop never overwrites a curated entry.

A broken file never hides the rest of the catalog: the dev server skips it and lists it
under `problems` in `/api/catalog/all`.

## Products without an icon

Use `catalog_update` with a new slug and a valid `kind` to add a product the icon pack does
not cover. For a vendor with neither a pack nor a catalog file, also pass
`create_vendor: true`; without it, a typo cannot create a vendor. Vendor names and slugs
use lowercase letters, digits and hyphens. Invalid entries are rejected before any file
is created. Curated entries and hand-written parts remain protected.

```json
{
  "vendor": "example-vendor",
  "create_vendor": true,
  "entries": [
    {
      "slug": "analytics-cloud",
      "name": "Analytics Cloud",
      "description": "Managed analytics for the team's data.",
      "docs": "https://example.com/docs/analytics",
      "kind": "service"
    }
  ]
}
```

These entries are stored with `generic: true` and `curated: false`. The catalog shows
**No product icon**. Optional `icon` must name an existing icon (for example `lucide/brain`);
otherwise the kind supplies a glyph: service → box, actor → user, datastore → database,
queue → layers, external → globe, note → file. Do not choose an unrelated product logo.
The read API's `icon` is the resolved drawable name; the YAML need not contain `icon`.
A hand-edited unknown icon is reported and falls back to the kind glyph.

Use `ref: catalog/example-vendor/analytics-cloud` in new diagrams. Existing
`icon: example-vendor/analytics-cloud` aliases still draw the fallback without rewriting
the YAML. If a matching product icon is later shipped in the icon index, it takes
precedence immediately; the next non-curated update removes the stale `generic` marker.
`catalog_missing` includes incomplete generic entries with `generic: true` in each row.
New and changed vendor files update running tabs through the catalog event stream.
