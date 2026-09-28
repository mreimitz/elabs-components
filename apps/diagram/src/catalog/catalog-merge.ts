/**
 * DG-26 (1b.3) — a line-for-line port of `server/catalog-fs.mjs` `readAll` that runs in the
 * browser: the index, the vendor files and the parts files are handed in as text (Vite's
 * `import.meta.glob` in catalog-bundle.ts, eager and `?raw`), never read from disk. Keep this
 * in step with `readAll` — every problem string, every precedence rule. React-free.
 */
import { isMap, parseDocument } from "yaml";
import type { ArchNodeType } from "../spec/dialect";
import type { CatalogEntry } from "./catalog-entry";

/** The dialect's node types; a catalog `kind` is one of them (server/catalog-fs.mjs KINDS). */
const KINDS: readonly string[] = ["service", "actor", "datastore", "queue", "external", "note"];
const KIND_ICONS: Record<string, string> = {
  service: "lucide/box",
  actor: "lucide/user",
  datastore: "lucide/database",
  queue: "lucide/layers",
  external: "lucide/globe",
  note: "lucide/file",
};
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export interface IndexIcon {
  path: string;
  label: string;
  pack: string;
}

export interface MergeCatalogInput {
  /** `public/icons/index.json`, parsed. */
  index: Readonly<Record<string, IndexIcon>>;
  /** Every icon name the app can draw (index names plus `lucide/*`). */
  iconNames: ReadonlySet<string>;
  /** vendor (file stem, e.g. "aws") → `catalog/<vendor>.yaml` text. */
  vendors: Readonly<Record<string, string>>;
  /** vendor (file stem) → `catalog/parts/<vendor>.yaml` text. */
  parts: Readonly<Record<string, string>>;
}

export interface MergeCatalogResult {
  entries: CatalogEntry[];
  problems: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** A parsed file, or `{ problem }` when it does not parse or is not a map at the top. */
function parseCatalog(
  text: string,
  label: string,
): { problem: string } | { data: Record<string, unknown> } {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    return { problem: `${label}: ${doc.errors[0]?.message.split("\n")[0]}` };
  }
  if (doc.contents !== null && doc.contents !== undefined && !isMap(doc.contents)) {
    return { problem: `${label}: the top level must be a map (slug: fields).` };
  }
  return { data: (doc.toJS() as Record<string, unknown> | null) ?? {} };
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];

/** The metadata fields a catalog file adds to an icon entry. */
function metadata(fields: Record<string, unknown>) {
  const kind =
    typeof fields.kind === "string" && KINDS.includes(fields.kind) ? fields.kind : undefined;
  return {
    ...(str(fields.name) ? { label: str(fields.name) } : {}),
    ...(str(fields.description) ? { description: str(fields.description) } : {}),
    ...(str(fields.docs) ? { docs: str(fields.docs) } : {}),
    ...(kind ? { kind: kind as ArchNodeType } : {}),
    tags: strings(fields.tags),
    aliases: strings(fields.aliases),
    ...(fields.docs_unverified === true ? { docsUnverified: true } : {}),
  };
}

/**
 * Every catalog entry: one per icon name, overlaid with each vendor file, plus every part. A
 * file that does not parse, an entry without a valid kind, or a bad part is skipped and
 * reported in `problems` — one broken file never hides the rest of the catalog. Vendors and
 * parts are read in sorted key order (`yamlFiles` sorts by file name; the input's key order is
 * whatever Vite's glob gives, so this sorts explicitly).
 */
export function mergeCatalog({
  index,
  iconNames,
  vendors,
  parts,
}: MergeCatalogInput): MergeCatalogResult {
  const problems: string[] = [];
  const entries = new Map<string, CatalogEntry>();
  for (const name of [...iconNames].sort()) {
    const [vendor = "", slug = ""] = name.split("/");
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
  for (const vendor of Object.keys(vendors).sort()) {
    const label = `catalog/${vendor}.yaml`;
    const parsed = parseCatalog(vendors[vendor] ?? "", label);
    if ("problem" in parsed) {
      problems.push(parsed.problem);
      continue;
    }
    for (const [slug, rawFields] of Object.entries(parsed.data)) {
      const name = `${vendor}/${slug}`;
      const base = entries.get(name);
      if (
        !isPlainObject(rawFields) ||
        !SLUG.test(vendor) ||
        !SLUG.test(slug) ||
        vendor === "lucide"
      ) {
        problems.push(`${label}: "${slug}" needs a valid vendor, slug and fields map.`);
        continue;
      }
      if (base) {
        entries.set(name, { ...base, ...metadata(rawFields), curated: rawFields.curated === true });
        continue;
      }
      const fields = rawFields;
      let icon = str(fields.icon);
      if (typeof fields.kind !== "string" || !KINDS.includes(fields.kind)) {
        problems.push(`${label}: "${slug}" needs a valid kind.`);
        continue;
      }
      if (
        (icon && !iconNames.has(icon)) ||
        (fields.icon != null && typeof fields.icon !== "string")
      ) {
        problems.push(`${label}: "${slug}" has an unknown icon; using the kind glyph.`);
        icon = undefined;
      }
      entries.set(name, {
        name,
        vendor,
        slug,
        label: slug,
        ...metadata(fields),
        icon: icon ?? KIND_ICONS[fields.kind]!,
        generic: true,
        curated: fields.curated === true,
      });
    }
  }
  for (const vendor of Object.keys(parts).sort()) {
    const label = `catalog/parts/${vendor}.yaml`;
    const parsed = parseCatalog(parts[vendor] ?? "", label);
    if ("problem" in parsed) {
      problems.push(parsed.problem);
      continue;
    }
    for (const [slug, rawFields] of Object.entries(parsed.data)) {
      const name = `${vendor}/${slug}`;
      const fields = isPlainObject(rawFields) ? rawFields : {};
      const icon = str(fields.icon);
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
