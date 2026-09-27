# Atlas catalog

What each icon is: its product name, one plain sentence, the vendor's docs page, the node
type it usually is, and tags. Atlas shows it on the catalog pages (`#catalog`), in the
details card and in the editor's suggestions. Atlas calls no model: the text is written by
an LLM session connected to Atlas's MCP server, then checked by you.

## Files

- `<vendor>.yaml` — one per icon pack in `public/icons/`. The key is the icon's file stem
  (`lambda` for `aws/lambda`):

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
  ```

## Filling a vendor

1. Start Atlas (`pnpm --filter @elabs-ai/diagram dev`) and connect Claude Code to it (see
   `mcp/README.md`).
2. In that session, run the `fill-catalog` prompt with the vendor, for example `azure`.
3. It writes batches of 25 until every icon has a name, description and docs link, then
   reports what it could not identify.
4. Check a sample on the catalog page (`#catalog/<vendor>`). The page is read-only: to
   correct an entry, or to mark it checked, edit `<vendor>.yaml` here and set
   `curated: true` on it. The fill loop never overwrites a curated entry.

A broken file never hides the rest of the catalog: the dev server skips it and lists it
under `problems` in `/api/catalog/all`.
