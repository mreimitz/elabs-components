/** The details card's read model. Keep catalog precedence and link safety outside React. */
import type { Node } from "@elabs-ai/components-flow";
import type { CatalogEntry } from "../catalog/catalog-entry";
import {
  ARCH_COMPOSITE_TYPE,
  ARCH_KIND_DEFAULT_ICON,
  ARCH_KIND_LABEL,
  ARCH_NODE_TYPE,
  type ArchMarkedKind,
  type ArchNodeData,
  type ArchNodeStatus,
} from "../nodes/arch-node-data";
import { suppliedBy } from "../spec/dialect/catalog-refs";
import { refFileOf } from "../spec/dialect/ids";

const MARKED_KINDS = Object.keys(ARCH_KIND_LABEL) as ArchMarkedKind[];
export type DetailKind = ArchMarkedKind | "composite";

/** Zones and notes already expose their content on the canvas. */
export function detailKind(node: Node): DetailKind | undefined {
  return node.type === ARCH_COMPOSITE_TYPE
    ? "composite"
    : MARKED_KINDS.find((kind) => ARCH_NODE_TYPE[kind] === node.type);
}

/** Shared diagrams are untrusted: only absolute web links are actionable. */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A catalog reference keeps its identity when its display icon is overridden. */
export function catalogNameOfNode(node: Node | undefined): string | undefined {
  if (!node || !detailKind(node) || node.type === ARCH_COMPOSITE_TYPE) return undefined;
  const data = node.data as ArchNodeData;
  const name = data.catalogEntry ?? data.icon;
  return typeof name === "string" && !name.startsWith("lucide/") ? name : undefined;
}

/** Only the compiler's normalized workspace path can become an internal route. */
export function componentPathOf(data: ArchNodeData): string | undefined {
  const path = data.component;
  return !data.broken && typeof path === "string" && refFileOf(`ws/${path}`) === path
    ? path
    : undefined;
}

export interface NodeDetails {
  kind: DetailKind;
  name: string;
  eyebrow: string;
  product?: string;
  subtitle?: string;
  icon: string;
  badges: readonly string[];
  description?: string;
  docs?: string;
  docsUnverified: boolean;
  status?: ArchNodeStatus;
  catalog?: { vendor: string; entry: string };
  componentPath?: string;
}

const STATUSES: readonly ArchNodeStatus[] = ["ok", "degraded", "down", "planned"];
const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

export function resolveNodeDetails(
  node: Node,
  entry?: CatalogEntry,
  iconEntry?: CatalogEntry,
): NodeDetails | undefined {
  const kind = detailKind(node);
  if (!kind) return undefined;
  const data = node.data as ArchNodeData;
  const catalog = entry
    ? suppliedBy(entry, new Map(iconEntry ? [[iconEntry.name, iconEntry]] : []))
    : undefined;
  const ownDocs = safeHref(data.docs) ?? safeHref(data.href);
  const docsCleared = typeof data.docs === "string" && data.docs.trim() === "";
  const docs = docsCleared ? undefined : (ownDocs ?? safeHref(catalog?.docs));
  const label = kind === "composite" ? "Diagram reference" : ARCH_KIND_LABEL[kind];
  const provider = text(data.provider);
  return {
    kind,
    name: data.title,
    eyebrow: provider ? `${provider} · ${label}` : label,
    product: entry?.label !== data.title ? text(entry?.label) : undefined,
    subtitle: text(data.subtitle),
    icon: data.icon ?? (kind === "composite" ? "lucide/layers" : ARCH_KIND_DEFAULT_ICON[kind]),
    badges: data.badges ?? [],
    description:
      typeof data.description === "string" ? data.description : text(catalog?.description),
    docs,
    docsUnverified: Boolean(docs && !ownDocs && catalog?.docsUnverified),
    status: STATUSES.find((status) => status === data.status),
    catalog: entry ? { vendor: entry.vendor, entry: entry.slug } : undefined,
    componentPath: kind === "composite" ? componentPathOf(data) : undefined,
  };
}
