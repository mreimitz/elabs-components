import { parseDocument, stringify } from "yaml";
import { checkText } from "../spec/check-text";
import { catalogLookupOf, suppliedBy, type CatalogLookup } from "../spec/dialect/catalog-refs";
import { catalogNameOf } from "../spec/dialect/ids";
import { isSuppliedKeyWritten } from "../spec/dialect/types";
import { LUCIDE_NAMES } from "../icons/lucide-names";
import { buildComponentTable } from "../spec/compose/resolver";
import type { CatalogEntry } from "../catalog/catalog-entry";
import type { DarkMark } from "../icons/theme-aware-mark";
import { validatePublishedStyle, type PublishedStyle } from "./published-style";
export interface EmbeddedIcon {
  label: string;
  src: string;
  dark?: DarkMark;
}
export interface ViewerSnapshot {
  version: 1;
  root: "published.yaml";
  theme: string;
  style: PublishedStyle;
  documents: Record<string, string>;
  catalog: CatalogEntry[];
  icons: Record<string, EmbeddedIcon>;
}
const ROOT_KEYS =
  "diagram title description direction nodeStyle theme legend layout zones nodes flows styles component story visual style".split(
    " ",
  );
const ZONE_KEYS =
  "id parent kind owner provider role title subtitle description icon class collapsed direction position docs status children".split(
    " ",
  );
const NODE_KEYS =
  "id parent type variant title subtitle description icon badges class tone href position docs status ref expand".split(
    " ",
  );
const FLOW_KEYS =
  "from to direction kind animated label style secure protocol schedule step class".split(" ");
const CATALOG_KEYS =
  "name vendor slug label capability description docs kind tags aliases part icon curated generic docsUnverified".split(
    " ",
  );
export const MAX_DOCUMENTS = 100;
export const MAX_SNAPSHOT_BYTES = 12_000_000;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function pick(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!object(value)) throw new Error("Published fields must be mappings.");
  const out: Record<string, unknown> = {};
  for (const key of keys) if (Object.hasOwn(value, key)) out[key] = value[key];
  return out;
}
function bounded(value: unknown, seen = new Set<object>(), depth = 0, count = { value: 0 }): void {
  if (++count.value > 50000 || depth > 48)
    throw new Error("The document exceeds the publish complexity limit.");
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) throw new Error("Recursive YAML aliases cannot be published.");
  seen.add(value);
  for (const child of Object.values(value)) bounded(child, seen, depth + 1, count);
  seen.delete(value);
}
const list = (value: unknown, map: (item: unknown) => unknown) =>
  Array.isArray(value) ? value.map(map) : value;
function isPrivateNote(value: unknown, catalog: CatalogLookup): boolean {
  if (!object(value)) return false;
  if (isSuppliedKeyWritten(value, "type")) return value.type === "note";
  const name = typeof value.ref === "string" ? catalogNameOf(value.ref) : undefined;
  const inherited = name ? catalog.get(name) : undefined;
  return inherited !== undefined && suppliedBy(inherited, catalog).type === "note";
}
const entries = (value: unknown, catalog: CatalogLookup, forceZone = false): unknown =>
  Array.isArray(value)
    ? value
        .filter((item) => !isPrivateNote(item, catalog))
        .map((item) => entry(item, catalog, forceZone))
    : value;
function entry(value: unknown, catalog: CatalogLookup, forceZone = false): unknown {
  if (!object(value)) return value;
  const zone = forceZone || Object.hasOwn(value, "children") || Object.hasOwn(value, "kind");
  const out = pick(value, zone ? ZONE_KEYS : NODE_KEYS);
  if (Object.hasOwn(out, "children")) out.children = entries(out.children, catalog);
  if (object(out.position)) out.position = pick(out.position, ["x", "y"]);
  return out;
}
function visual(value: unknown): unknown {
  if (!object(value)) return value;
  const out = pick(value, ["lanes", "boxes", "flows", "hide", "controlPlane"]);
  for (const [key, fields] of Object.entries({
    lanes: ["id", "role", "title", "of"],
    boxes: ["id", "lane", "title", "members", "processes", "sub", "aside"],
    flows: ["from", "to", "label", "process"],
  }))
    if (Object.hasOwn(out, key)) out[key] = list(out[key], (item) => pick(item, fields));
  return out;
}
/** Comments, internal notes/metrics and unknown extension fields never enter compilation. */
export function sanitizePublishedText(text: string, catalog: CatalogLookup = new Map()): string {
  if (text.length > 2_000_000) throw new Error("A diagram exceeds the publish text limit.");
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`Cannot publish invalid YAML: ${doc.errors[0]!.message}`);
  const raw: unknown = doc.toJS({ maxAliasCount: 100 });
  bounded(raw);
  const out = pick(raw, ROOT_KEYS);
  for (const key of ["nodes", "zones"])
    if (Object.hasOwn(out, key)) out[key] = entries(out[key], catalog, key === "zones");
  if (Object.hasOwn(out, "flows"))
    out.flows = list(out.flows, (item) => {
      if (typeof item === "string") return item;
      if (!object(item)) return item;
      if (Object.hasOwn(item, "from") || Object.hasOwn(item, "to")) return pick(item, FLOW_KEYS);
      const keys = Object.keys(item);
      if (keys.length !== 1) throw new Error("A shorthand flow must have one expression.");
      const key = keys[0]!;
      return { [key]: !object(item[key]) ? item[key] : pick(item[key], FLOW_KEYS) };
    });
  if (object(out.styles))
    out.styles = Object.fromEntries(
      Object.entries(out.styles).map(([key, value]) => [key, pick(value, ["tone", "badge"])]),
    );
  if (object(out.component)) out.component = pick(out.component, ["icon", "description"]);
  if (object(out.style)) out.style = pick(out.style, ["technical", "visual"]);
  if (Object.hasOwn(out, "visual")) out.visual = visual(out.visual);
  if (object(out.story)) {
    out.story = pick(out.story, ["autoplay", "steps"]);
    const story = out.story as Record<string, unknown>;
    story.steps = list(story.steps, (item) => {
      const step = pick(item, ["title", "targets", "text", "duration", "callouts"]);
      if (Object.hasOwn(step, "callouts"))
        step.callouts = list(step.callouts, (callout) => pick(callout, ["at", "text"]));
      return step;
    });
  }
  return stringify(out, { lineWidth: 0 });
}
export function publicCatalogEntry(value: CatalogEntry): CatalogEntry {
  const out = pick(value, CATALOG_KEYS);
  if (object(out.part)) out.part = pick(out.part, ["subtitle", "badges"]);
  return out as unknown as CatalogEntry;
}
export function safeSnapshotJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
/** Validate the envelope before any embedded adapter reads it. Rendering validation follows. */
export function validateSnapshot(value: unknown): asserts value is ViewerSnapshot {
  if (!object(value) || value.version !== 1 || value.root !== "published.yaml")
    throw new Error("This published diagram uses an unsupported version.");
  if (
    Object.keys(value).some(
      (key) =>
        !["version", "root", "theme", "style", "documents", "catalog", "icons"].includes(key),
    )
  )
    throw new Error("The published snapshot has unsupported fields.");
  if (
    typeof value.theme !== "string" ||
    ![
      "light",
      "dark",
      "qlik-light",
      "qlik-dark",
      "clickhouse-light",
      "clickhouse-dark",
      "salesforce-light",
      "salesforce-dark",
      "snowflake-light",
      "snowflake-dark",
    ].includes(value.theme)
  )
    throw new Error("The published theme is not supported.");
  if (
    !object(value.documents) ||
    !Object.hasOwn(value.documents, value.root) ||
    Object.keys(value.documents).length > MAX_DOCUMENTS
  )
    throw new Error("Published diagrams are missing or exceed the document limit.");
  for (const [path, text] of Object.entries(value.documents)) {
    if (
      !/^[a-zA-Z0-9_./ -]+\.ya?ml$/.test(path) ||
      path.startsWith("/") ||
      path.split("/").some((part) => part === ".." || part === "." || !part)
    )
      throw new Error("Invalid embedded diagram path.");
    if (typeof text !== "string" || sanitizePublishedText(text) !== text)
      throw new Error("An embedded diagram contains unfiltered authoring fields.");
  }
  if (!Array.isArray(value.catalog) || value.catalog.length > 500)
    throw new Error("Invalid embedded catalog.");
  const strings = (value: unknown) =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
  for (const entry of value.catalog) {
    if (
      !object(entry) ||
      JSON.stringify(publicCatalogEntry(entry as unknown as CatalogEntry)) !==
        JSON.stringify(entry) ||
      typeof entry.name !== "string" ||
      typeof entry.icon !== "string" ||
      typeof entry.label !== "string" ||
      !strings(entry.tags) ||
      !strings(entry.aliases) ||
      typeof entry.vendor !== "string" ||
      typeof entry.slug !== "string" ||
      typeof entry.curated !== "boolean" ||
      ["description", "docs", "kind", "capability"].some(
        (key) => entry[key] !== undefined && typeof entry[key] !== "string",
      ) ||
      (entry.generic !== undefined && entry.generic !== true) ||
      (entry.docsUnverified !== undefined && typeof entry.docsUnverified !== "boolean") ||
      (entry.part !== undefined &&
        (!object(entry.part) ||
          Object.keys(entry.part).some((key) => !["subtitle", "badges"].includes(key)) ||
          (entry.part.subtitle !== undefined && typeof entry.part.subtitle !== "string") ||
          (entry.part.badges !== undefined && !strings(entry.part.badges))))
    )
      throw new Error("Invalid embedded catalog entry.");
  }
  const publicCatalog = catalogLookupOf(value.catalog as unknown as CatalogEntry[]);
  for (const text of Object.values(value.documents)) {
    if (sanitizePublishedText(text as string, publicCatalog) !== text)
      throw new Error("An embedded diagram contains a private catalog-supplied note.");
  }
  if (!object(value.icons) || Object.keys(value.icons).length > 500)
    throw new Error("Invalid embedded icon set.");
  const image = (src: unknown) =>
    typeof src === "string" &&
    /^data:image\/(svg\+xml|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(src) &&
    src.length <= 1_000_000;
  for (const icon of Object.values(value.icons)) {
    if (
      !object(icon) ||
      Object.keys(icon).some((key) => !["label", "src", "dark"].includes(key)) ||
      typeof icon.label !== "string" ||
      !image(icon.src) ||
      !(
        icon.dark === undefined ||
        icon.dark === "keep" ||
        icon.dark === "mono" ||
        (object(icon.dark) && Object.keys(icon.dark).length === 1 && image(icon.dark.src))
      )
    )
      throw new Error("Invalid embedded icon.");
  }
  const rootData = parseDocument(value.documents[value.root] as string).toJS({
    maxAliasCount: 100,
  }) as Record<string, unknown>;
  validatePublishedStyle(value.style, value.theme, rootData.style);
  if (JSON.stringify(value).length > MAX_SNAPSHOT_BYTES)
    throw new Error("The published snapshot exceeds its size limit.");
}

/** Validate references and story targets against exactly what the customer receives. */
export function validateSnapshotContent(snapshot: ViewerSnapshot): void {
  const catalog = catalogLookupOf(snapshot.catalog);
  const files = new Map(
    Object.entries(snapshot.documents).map(([path, text]) => [path, { text, mtime: 1 }]),
  );
  const iconNames = new Set([
    ...Object.keys(snapshot.icons),
    ...LUCIDE_NAMES.map((name) => `lucide/${name}`),
  ]);
  for (const [path, text] of Object.entries(snapshot.documents)) {
    const checked = checkText(text, iconNames, { catalog, files });
    if (!checked.ok || !checked.ast || !checked.spec)
      throw new Error(
        `Invalid embedded diagram ${path}: ${checked.issues.find((issue) => issue.severity === "error")?.message ?? "Not a diagram."}`,
      );
    const table = buildComponentTable(checked.ast, files, { catalog, iconNames });
    for (const ref of table.values())
      if (ref.status !== "ok") throw new Error(`Invalid embedded reference: ${ref.status}.`);
  }
}
export function freezeSnapshot(snapshot: ViewerSnapshot): ViewerSnapshot {
  const freeze = (value: unknown) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(snapshot);
  return snapshot;
}
