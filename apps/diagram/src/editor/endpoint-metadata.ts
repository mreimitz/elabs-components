import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { suppliedBy, type CatalogLookup } from "../spec/dialect/catalog-refs";
import { catalogNameOf } from "../spec/dialect/ids";
import { isSuppliedKeyWritten, type SuppliedKey } from "../spec/dialect/types";
import { NODE_DEF, ZONE_DEF } from "../spec/dialect/definitions";
import type { YamlPath } from "./yaml-context";

export interface EndpointMetadata {
  id: string;
  title: string;
  kind?: string;
  icon?: string;
  description?: string;
}

interface CompiledEndpoint {
  id: string;
  type?: string;
  data: Record<string, unknown>;
}
const ZONE_ONLY = Object.keys(ZONE_DEF.fields).filter((key) => !(key in NODE_DEF.fields));

/** Read the current buffer, including incomplete edits, without borrowing stale graph titles.
 * The caller may add qualified endpoints only when that graph was compiled from this text. */
export function endpointMetadata(
  text: string,
  catalog: CatalogLookup,
  compiled: readonly CompiledEndpoint[] = [],
): EndpointMetadata[] {
  const out = new Map<string, EndpointMetadata>();
  const walk = (node: unknown, path: YamlPath) => {
    if (isMap(node)) {
      const id = node.get("id");
      const container = path.at(-2);
      if (
        typeof id === "string" &&
        typeof path.at(-1) === "number" &&
        (container === "nodes" || container === "zones" || container === "children")
      ) {
        const ref = node.get("ref");
        const name = typeof ref === "string" ? catalogNameOf(ref) : undefined;
        const entry = name ? catalog.get(name) : undefined;
        const supplied =
          entry && entry.vendor !== "lucide" ? suppliedBy(entry, catalog) : undefined;
        const raw = Object.fromEntries(
          ["title", "type", "icon"]
            .filter((key) => node.has(key))
            .map((key) => {
              const value = node.get(key, true);
              return [key, isScalar(value) ? value.value : undefined];
            }),
        );
        // YAML null is unwritten; an explicitly empty scalar is a deliberate override.
        const field = (key: SuppliedKey, fallback?: string) =>
          isSuppliedKeyWritten(raw, key)
            ? typeof raw[key] === "string"
              ? String(raw[key])
              : undefined
            : fallback;
        out.set(id, {
          id,
          title: field("title", supplied?.title) ?? id,
          kind:
            container === "zones" ||
            (container === "children" && ZONE_ONLY.some((key) => node.has(key)))
              ? "zone"
              : field("type", supplied?.type ?? "service"),
          icon: field("icon", supplied?.icon),
          description:
            typeof node.get("description") === "string"
              ? String(node.get("description"))
              : supplied?.description,
        });
      }
      for (const pair of node.items)
        if (isScalar(pair.key)) walk(pair.value, [...path, String(pair.key.value)]);
    } else if (isSeq(node)) node.items.forEach((item, index) => walk(item, [...path, index]));
  };
  walk(parseDocument(text).contents, []);
  for (const node of compiled) {
    if (!node.id.includes(".") || !out.has(node.id.split(".")[0]!)) continue;
    const string = (value: unknown) => (typeof value === "string" ? value : undefined);
    out.set(node.id, {
      id: node.id,
      title: string(node.data.title) ?? node.id,
      kind: node.type?.replace(/^arch\//, ""),
      icon: string(node.data.icon),
      description: string(node.data.description),
    });
  }
  return [...out.values()];
}
