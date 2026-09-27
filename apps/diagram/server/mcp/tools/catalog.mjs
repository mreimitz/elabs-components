/**
 * DG-24 — catalog tools: the MCP face of `server/catalog-fs.mjs`. The icon names come from
 * the app itself (`ICON_NAMES` through the spec bridge), so the catalog, the validator and
 * the canvas agree on what exists. `catalog_missing` + `catalog_update` are the fill loop the
 * `fill-catalog` prompt drives; the loop never overwrites an entry the maintainer curated.
 */
import * as catalog from "../../catalog-fs.mjs";

const VENDOR = { type: "string", description: 'An icon pack, e.g. "aws", "qlik".' };

async function iconNames(ctx) {
  return (await ctx.bridge.load()).ICON_NAMES;
}

/** What a model needs of an entry (no file paths). */
function brief(e) {
  return {
    name: e.name,
    label: e.label,
    ...(e.description ? { description: e.description } : {}),
    ...(e.kind ? { kind: e.kind } : {}),
    ...(e.tags.length > 0 ? { tags: e.tags } : {}),
    icon: e.icon,
    ...(e.part ? { part: e.part } : {}),
  };
}

export const catalogTools = [
  {
    name: "catalog_search",
    description:
      "Find icons and parts by product name, alias or tag (case-insensitive substring). " +
      "Use a result's `icon` as a node's icon:; a part also gives subtitle/badges to copy. " +
      "Returns { results: [{ name, label, description?, kind?, tags?, icon, part? }] }.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: 'e.g. "lambda", "warehouse", "streaming".' },
        vendor: VENDOR,
        limit: { type: "integer", description: "Default 20." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: async ({ query, vendor, limit }, ctx) => {
      const { entries } = await catalog.readAll(await iconNames(ctx));
      return { results: catalog.search(entries, query, { vendor, limit }).map(brief) };
    },
  },
  {
    name: "catalog_get",
    description:
      'One entry by name ("aws/lambda", or a part such as "qlik/data-gateway-direct"): ' +
      "its metadata and a ready-to-paste node in dialect v0 (`yaml`).",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: '"vendor/slug", e.g. "aws/lambda".' } },
      required: ["name"],
      additionalProperties: false,
    },
    handler: async ({ name }, ctx) => {
      const surface = await ctx.bridge.load();
      const { entries } = await catalog.readAll(surface.ICON_NAMES);
      const entry = entries.find((e) => e.name === name);
      if (!entry) {
        const near = catalog.search(entries, name.split("/").pop(), { limit: 5 });
        throw new Error(
          `No catalog entry "${name}".` +
            (near.length > 0 ? ` Close: ${near.map((e) => e.name).join(", ")}.` : ""),
        );
      }
      // The app's own snippet (`src/catalog/entry-snippet.ts`): the entry page copies the same text.
      const out = { ...entry, yaml: surface.entrySnippet(entry) };
      delete out.iconPath;
      return out;
    },
  },
  {
    name: "catalog_missing",
    description:
      "The fill loop's worklist: entries of one pack that are not curated and lack a " +
      "description or docs, in slug order. Returns { vendor, total, missing: [{ slug, name, label }] } — " +
      "`label` is the icon file's name, often not the official product name.",
    inputSchema: {
      type: "object",
      properties: {
        vendor: VENDOR,
        limit: { type: "integer", description: `Default and maximum ${catalog.MAX_BATCH}.` },
        after: {
          type: "string",
          description:
            "Only slugs after this one (alphabetical): the last slug of your previous batch.",
        },
      },
      required: ["vendor"],
      additionalProperties: false,
    },
    handler: async ({ vendor, limit, after }, ctx) =>
      catalog.missing(vendor, await iconNames(ctx), {
        limit: Math.min(Math.max(limit ?? catalog.MAX_BATCH, 1), catalog.MAX_BATCH),
        after,
      }),
  },
  {
    name: "catalog_update",
    description:
      `Write metadata for up to ${catalog.MAX_BATCH} icons of one pack into catalog/<vendor>.yaml ` +
      "(curated: false). Curated entries are skipped, never overwritten. Each docs URL is " +
      "fetched; an unreachable one is kept and marked docs_unverified. Returns { vendor, " +
      "written, skippedCurated, docsUnverified, rejected: [{ slug, reason }] } — fix and resend " +
      "the rejected ones.",
    inputSchema: {
      type: "object",
      properties: {
        vendor: VENDOR,
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slug: { type: "string", description: "From catalog_missing." },
              name: {
                type: "string",
                description: 'The official product name, e.g. "AWS Lambda".',
              },
              description: {
                type: "string",
                description: `One plain sentence, at most ${catalog.MAX_DESCRIPTION} characters.`,
              },
              docs: {
                type: "string",
                description: "The vendor's official documentation URL (https).",
              },
              kind: { type: "string", enum: catalog.KINDS },
              tags: { type: "array", items: { type: "string" } },
              aliases: { type: "array", items: { type: "string" } },
            },
            required: ["slug", "name", "description", "docs"],
            additionalProperties: false,
          },
        },
      },
      required: ["vendor", "entries"],
      additionalProperties: false,
    },
    handler: ({ vendor, entries }) => catalog.update(vendor, entries),
  },
];
