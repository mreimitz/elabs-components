/**
 * DG-24 — the catalog on disk (plan §4.1, V9), server side. Two kinds of file under
 * `apps/diagram/catalog/`:
 *
 *   catalog/<vendor>.yaml        one per icon pack; slug → { name, description, docs, kind,
 *                                tags, aliases, curated, docs_unverified }. Filled by an LLM
 *                                session through the MCP tools (`curated: false`), checked by
 *                                the maintainer by hand in the file (`curated: true`, never
 *                                overwritten by MCP).
 *   catalog/parts/<vendor>.yaml  hand-written preset nodes; slug → { name, icon, kind,
 *                                subtitle, badges, description, docs, tags, curated }. Never
 *                                written by MCP; checked only with `curated: true` (N7).
 *
 * `readAll` merges both with the icon names into the `CatalogEntry` list the app
 * (`src/catalog/catalog-service.ts`) and the MCP tools read. Every call reads the files again
 * (they are small; the watcher tells tabs when one changes). The one writer is the MCP fill
 * loop (`update`); it keeps every comment and untouched line (yaml's Document API) and goes
 * through `atomicWrite`. R1 has no in-app edit: the maintainer edits the YAML.
 */
import { lookup } from "node:dns/promises";
import { promises as fs } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { isMap, parseDocument } from "yaml";
import { atomicWrite, WorkspaceError } from "./workspace-fs.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CATALOG_ROOT = path.join(APP, "catalog");
export const PARTS_ROOT = path.join(CATALOG_ROOT, "parts");
const INDEX_FILE = path.join(APP, "public", "icons", "index.json");

/** The dialect's node types (`ArchNodeType`); a catalog `kind` is one of them. */
export const KINDS = ["service", "actor", "datastore", "queue", "external", "note"];
/** Generic glyphs: icon-only entries, no catalog file, never filled. */
export const LUCIDE_VENDOR = "lucide";
export const MAX_DESCRIPTION = 140;
export const MAX_BATCH = 25;
const MAX_TAGS = 8;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const YAML_OPTIONS = { lineWidth: 0, flowCollectionPadding: false };
const DOCS_TIMEOUT_MS = 5_000;
const DOCS_CONCURRENCY = 5;

const refuse = (message) => new WorkspaceError(400, message);

async function readText(abs) {
  try {
    return await fs.readFile(abs, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

/** `public/icons/index.json`: `{ "aws/lambda": { path, label, pack } }`. */
async function readIndex() {
  return JSON.parse(await fs.readFile(INDEX_FILE, "utf8"));
}

/** The icon packs (`aws`, `azure`, …): the vendors a catalog file may exist for. */
export async function packs() {
  return [...new Set(Object.values(await readIndex()).map((e) => e.pack))].sort();
}

async function yamlFiles(dir) {
  const names = await fs.readdir(dir).catch(() => []);
  return names
    .filter((n) => n.endsWith(".yaml") && !n.startsWith("."))
    .map((n) => n.slice(0, -".yaml".length))
    .sort();
}

/** `catalog/aws.yaml` → `aws`; `catalog/parts/qlik.yaml` → `qlik`; anything else → null. */
export function vendorOf(abs) {
  const rel = path.relative(CATALOG_ROOT, abs).split(path.sep);
  const file = rel.length === 1 ? rel[0] : rel.length === 2 && rel[0] === "parts" ? rel[1] : "";
  return file.endsWith(".yaml") && !file.startsWith(".") ? file.slice(0, -".yaml".length) : null;
}

const vendorFile = (vendor) => path.join(CATALOG_ROOT, `${vendor}.yaml`);
const partsFile = (vendor) => path.join(PARTS_ROOT, `${vendor}.yaml`);

/** A parsed file, or `{ problem }` when it does not parse or is not a map at the top. */
function parseCatalog(text, label) {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    return { problem: `${label}: ${doc.errors[0].message.split("\n")[0]}` };
  }
  if (doc.contents !== null && doc.contents !== undefined && !isMap(doc.contents)) {
    return { problem: `${label}: the top level must be a map (slug: fields).` };
  }
  return { doc, data: doc.toJS() ?? {} };
}

const str = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);

/** The metadata fields a catalog file adds to an icon entry. */
function metadata(fields) {
  const kind = KINDS.includes(fields.kind) ? fields.kind : undefined;
  return {
    ...(str(fields.name) ? { label: str(fields.name) } : {}),
    ...(str(fields.description) ? { description: str(fields.description) } : {}),
    ...(str(fields.docs) ? { docs: str(fields.docs) } : {}),
    ...(kind ? { kind } : {}),
    tags: strings(fields.tags),
    aliases: strings(fields.aliases),
    ...(fields.docs_unverified === true ? { docsUnverified: true } : {}),
  };
}

/**
 * Every catalog entry: one per icon name (`iconNames`, the app's own `ICON_NAMES` — index
 * plus `lucide/*`), overlaid with `catalog/<vendor>.yaml`, plus every part. A file that does
 * not parse, an entry for a name that is no icon, or a bad part is skipped and reported in
 * `problems` — one broken file never hides the rest of the catalog.
 *
 * @param {ReadonlySet<string>} iconNames
 */
export async function readAll(iconNames) {
  const index = await readIndex();
  const problems = [];
  const entries = new Map();
  for (const name of [...iconNames].sort()) {
    const [vendor, slug] = name.split("/");
    const icon = index[name];
    entries.set(name, {
      name,
      vendor,
      slug,
      label: icon?.label ?? slug,
      tags: [],
      aliases: [],
      icon: name,
      curated: false,
      ...(icon ? { iconPath: icon.path } : {}),
    });
  }
  for (const vendor of await yamlFiles(CATALOG_ROOT)) {
    const label = `catalog/${vendor}.yaml`;
    const parsed = parseCatalog((await readText(vendorFile(vendor))) ?? "", label);
    if (parsed.problem) {
      problems.push(parsed.problem);
      continue;
    }
    for (const [slug, fields] of Object.entries(parsed.data)) {
      const name = `${vendor}/${slug}`;
      const base = entries.get(name);
      if (!base || !fields || typeof fields !== "object") {
        problems.push(`${label}: "${slug}" is not an icon of ${vendor}; the entry is ignored.`);
        continue;
      }
      entries.set(name, { ...base, ...metadata(fields), curated: fields.curated === true });
    }
  }
  for (const vendor of await yamlFiles(PARTS_ROOT)) {
    const label = `catalog/parts/${vendor}.yaml`;
    const parsed = parseCatalog((await readText(partsFile(vendor))) ?? "", label);
    if (parsed.problem) {
      problems.push(parsed.problem);
      continue;
    }
    for (const [slug, fields] of Object.entries(parsed.data)) {
      const name = `${vendor}/${slug}`;
      const icon = str(fields?.icon);
      if (entries.has(name)) {
        problems.push(`${label}: "${slug}" is also an icon name (${name}); rename the part.`);
      } else if (!SLUG.test(slug) || !icon || !iconNames.has(icon)) {
        problems.push(`${label}: "${slug}" needs an icon: that is a known icon name.`);
      } else {
        const badges = strings(fields.badges);
        entries.set(name, {
          name,
          vendor,
          slug,
          label: slug,
          ...metadata(fields),
          icon,
          // Checked only once the maintainer says so in the file (N7): the shipped parts were
          // drafted by an agent, and a part is no more trusted than an entry until read.
          curated: fields.curated === true,
          part: {
            ...(str(fields.subtitle) ? { subtitle: str(fields.subtitle) } : {}),
            ...(badges.length > 0 ? { badges } : {}),
          },
        });
      }
    }
  }
  return { entries: [...entries.values()], problems };
}

/** Case-insensitive substring match on name, label, aliases and tags. */
export function search(entries, query, { vendor, limit = 20 } = {}) {
  const needle = String(query ?? "")
    .trim()
    .toLowerCase();
  const out = [];
  for (const e of entries) {
    if (vendor && e.vendor !== vendor) continue;
    const hay = [e.name, e.label, ...e.aliases, ...e.tags].join(" ").toLowerCase();
    if (needle && !hay.includes(needle)) continue;
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Why a docs URL is refused outright, or null. Only public https pages are fetched. */
export function docsProblem(docs) {
  let url;
  try {
    url = new URL(docs);
  } catch {
    return "docs is not a URL";
  }
  if (url.protocol !== "https:") return "docs must be an https:// URL";
  const host = url.hostname;
  if (
    !host.includes(".") ||
    /^\[|^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    /(^|\.)(localhost|local|internal)$/i.test(host)
  ) {
    return "docs must be a public web address";
  }
  return null;
}

/** Loopback, private, link-local, CGNAT or unspecified — never fetched from the dev server. */
function isPrivateAddress(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]);
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Does the page answer? HEAD, then GET when a server refuses HEAD (403/405). Redirects are
 * not followed (a 3xx means the address exists). A host that resolves to a private address is
 * never fetched (the model chooses the URL; `docsProblem` only sees the name). Any failure or
 * timeout → false.
 */
export async function docsReachable(docs) {
  const addresses = await lookup(new URL(docs).hostname, { all: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) return false;
  for (const method of ["HEAD", "GET"]) {
    try {
      // Node's built-in fetch (no dependency); `globalThis.` because the lint config has no
      // web globals for server files.
      const res = await globalThis.fetch(docs, {
        method,
        redirect: "manual",
        signal: globalThis.AbortSignal.timeout(DOCS_TIMEOUT_MS),
      });
      await res.body?.cancel();
      if (res.status < 400) return true;
      if (method === "HEAD" && (res.status === 403 || res.status === 405)) continue;
      return false;
    } catch {
      return false;
    }
  }
  return false;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Entries of `vendor` the fill loop still has to write: not curated, and no description or
 * docs. `total` counts all of them; `missing` is the next `limit` in slug order after
 * `after` (so a slug the model skips never blocks the loop).
 */
export async function missing(vendor, iconNames, { limit = MAX_BATCH, after } = {}) {
  await assertPack(vendor);
  const { entries } = await readAll(iconNames);
  const open = entries.filter(
    (e) => e.vendor === vendor && !e.part && !e.curated && (!e.description || !e.docs),
  );
  const next = typeof after === "string" ? open.filter((e) => e.slug > after) : open;
  return {
    vendor,
    total: open.length,
    missing: next.slice(0, limit).map((e) => ({ slug: e.slug, name: e.name, label: e.label })),
  };
}

async function assertPack(vendor) {
  if (typeof vendor !== "string" || !(await packs()).includes(vendor)) {
    throw refuse(`"${vendor}" is not an icon pack. Packs: ${(await packs()).join(", ")}.`);
  }
}

/** One patch's problem, or null. */
function patchProblem(p, index, vendor) {
  if (!p || typeof p.slug !== "string" || !index[`${vendor}/${p.slug}`]) {
    return `not an icon of ${vendor}`;
  }
  if (p.description !== undefined && p.description !== null) {
    if (typeof p.description !== "string" || p.description.length > MAX_DESCRIPTION) {
      return `description must be at most ${MAX_DESCRIPTION} characters`;
    }
    if (/\n/.test(p.description)) return "description must be one line";
  }
  if (p.docs !== undefined && p.docs !== null && p.docs !== "") {
    const problem = docsProblem(p.docs);
    if (problem) return problem;
  }
  if (p.kind !== undefined && p.kind !== null && !KINDS.includes(p.kind)) {
    return `kind must be one of ${KINDS.join(", ")}`;
  }
  for (const key of ["tags", "aliases"]) {
    const v = p[key];
    if (v !== undefined && v !== null) {
      if (!Array.isArray(v) || v.length > MAX_TAGS || v.some((t) => typeof t !== "string")) {
        return `${key} must be a list of at most ${MAX_TAGS} strings`;
      }
    }
  }
  return null;
}

/** Writes to one vendor file run one after another (two fill sessions may meet). */
const queues = new Map();
function serialized(vendor, task) {
  const run = (queues.get(vendor) ?? Promise.resolve()).then(task, task);
  queues.set(
    vendor,
    run.catch(() => {}),
  );
  return run;
}

/**
 * The map for `slug`, appended when new. Never inserted in the middle: yaml attaches a
 * file's header comment to the first key, so an insert before it would carry the header down
 * (measured in hardening). The fill loop writes in slug order, so the file stays near-sorted.
 */
function entryMap(doc, slug) {
  if (!isMap(doc.contents)) doc.contents = doc.createNode({});
  doc.contents.flow = false;
  const existing = doc.contents.get(slug, true);
  if (isMap(existing)) return existing;
  const entry = doc.createNode({});
  doc.contents.set(slug, entry);
  return entry;
}

function setField(doc, entry, key, value) {
  if (value === undefined) return;
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    entry.delete(key);
    return;
  }
  const node = doc.createNode(value);
  if (Array.isArray(value)) node.flow = true;
  entry.set(key, node);
}

/**
 * Write metadata for icons of one pack — the MCP fill loop (`catalog_update`), the only
 * writer. A curated entry is never touched (`skippedCurated`); everything written is
 * `curated: false`. A `null` or `""` value removes the key. Docs are checked before the write
 * (outside the file lock); an unreachable page is kept but marked `docs_unverified: true`.
 *
 * @returns {{ vendor, written: string[], skippedCurated: string[], docsUnverified: string[],
 *   rejected: { slug: string, reason: string }[] }}
 */
export async function update(vendor, patches) {
  await assertPack(vendor);
  if (!Array.isArray(patches) || patches.length === 0) throw refuse("entries must not be empty.");
  if (patches.length > MAX_BATCH) throw refuse(`At most ${MAX_BATCH} entries per call.`);
  const index = await readIndex();
  const rejected = [];
  const accepted = [];
  for (const p of patches) {
    const reason = patchProblem(p, index, vendor);
    if (reason) rejected.push({ slug: String(p?.slug), reason });
    else accepted.push(p);
  }
  const reachable = await mapLimit(accepted, DOCS_CONCURRENCY, (p) =>
    typeof p.docs === "string" && p.docs !== "" ? docsReachable(p.docs) : Promise.resolve(null),
  );
  return serialized(vendor, async () => {
    const label = `catalog/${vendor}.yaml`;
    const text = (await readText(vendorFile(vendor))) ?? `# Atlas catalog — ${vendor}.\n{}\n`;
    const doc = parseDocument(text);
    if (doc.errors.length > 0 || (doc.contents && !isMap(doc.contents))) {
      throw new WorkspaceError(409, `${label} does not parse; fix it by hand first.`);
    }
    const result = { vendor, written: [], skippedCurated: [], docsUnverified: [], rejected };
    accepted.forEach((p, i) => {
      const current = doc.contents?.get?.(p.slug, true);
      if (isMap(current) && current.get("curated") === true) {
        result.skippedCurated.push(p.slug);
        return;
      }
      const entry = entryMap(doc, p.slug);
      setField(doc, entry, "name", p.name);
      setField(doc, entry, "description", p.description);
      setField(doc, entry, "docs", p.docs);
      setField(doc, entry, "kind", p.kind);
      setField(doc, entry, "tags", p.tags);
      setField(doc, entry, "aliases", p.aliases);
      entry.set("curated", false);
      if (reachable[i] === false) {
        entry.set("docs_unverified", true);
        result.docsUnverified.push(p.slug);
      } else if (reachable[i] === true || p.docs === null || p.docs === "") {
        entry.delete("docs_unverified");
      }
      result.written.push(p.slug);
    });
    if (result.written.length > 0) {
      await fs.mkdir(CATALOG_ROOT, { recursive: true });
      await atomicWrite(vendorFile(vendor), doc.toString(YAML_OPTIONS));
    }
    return result;
  });
}
