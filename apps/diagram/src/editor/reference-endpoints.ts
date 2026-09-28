import { checkArchYaml, type ArchNodeSpec } from "../spec/dialect";
import { catalogNameOf, refFileOf } from "../spec/dialect/ids";
import { suppliedBy, type CatalogLookup } from "../spec/dialect/catalog-refs";
import { MAX_COMPONENT_DEPTH, type ComponentFiles } from "../spec/compose/resolver";
import type { EndpointMetadata } from "./endpoint-metadata";

/** Resolve against the current buffer and current file snapshot, including collapsed instances.
 * Never borrow an old graph's qualified IDs after the user edits a reference. */
export function referenceEndpoints(
  text: string,
  catalog: CatalogLookup,
  files: ComponentFiles,
  iconNames: ReadonlySet<string>,
  query = "",
): EndpointMetadata[] {
  if (!files.size) return [];
  const checked = checkArchYaml(text, iconNames, { catalog, files });
  if (!checked.ast || !checked.components) return [];
  const table = checked.components;
  const output: EndpointMetadata[] = [];
  // Repeated instances can multiply exponentially even with a depth bound.
  // A qualified query prunes unrelated branches before they spend the work budget.
  const prefix = query.toLowerCase();
  const qualified = prefix.includes(".");
  let remaining = 10_000;
  const available = () => remaining > 0 && output.length < 1_000;
  const relevantBranch = (id: string) =>
    !qualified || prefix.startsWith(`${id.toLowerCase()}.`) || id.toLowerCase().startsWith(prefix);
  const emit = (entry: EndpointMetadata) => {
    remaining -= 1;
    if (!prefix || `${entry.id} ${entry.title}`.toLowerCase().includes(prefix)) output.push(entry);
  };
  const metadata = (node: ArchNodeSpec, id: string): EndpointMetadata => {
    const file = node.ref && refFileOf(node.ref);
    const entry = file ? table.get(file) : undefined;
    const resolved = entry?.status === "ok" ? entry : undefined;
    const name = node.ref && catalogNameOf(node.ref);
    const item = name ? catalog.get(name) : undefined;
    const supplied = item ? suppliedBy(item, catalog) : undefined;
    return {
      id,
      title: node.unwritten?.includes("title") ? (resolved?.title ?? node.title) : node.title,
      kind: file ? "diagram reference" : node.type,
      icon: node.unwritten?.includes("icon") ? (resolved?.icon ?? node.icon) : node.icon,
      description: node.description ?? resolved?.description ?? supplied?.description,
    };
  };
  const visit = (node: ArchNodeSpec, prefix: string, stack: readonly string[]) => {
    if (!available() || !relevantBranch(prefix)) return;
    const file = node.ref && refFileOf(node.ref);
    if (!file || stack.includes(file) || stack.length >= MAX_COMPONENT_DEPTH) return;
    const entry = table.get(file);
    if (entry?.status !== "ok") return;
    for (const zone of entry.ast.zones) {
      if (!available()) return;
      emit({
        id: `${prefix}.${zone.id}`,
        title: zone.title,
        kind: "zone",
        description: zone.description,
      });
    }
    for (const child of entry.ast.nodes) {
      if (!available()) return;
      const id = `${prefix}.${child.id}`;
      emit(metadata(child, id));
      visit(child, id, [...stack, file]);
    }
  };
  for (const node of checked.ast.nodes) {
    if (!node.ref || !refFileOf(node.ref)) continue;
    if (!available()) break;
    emit(metadata(node, node.id));
    visit(node, node.id, []);
  }
  return output;
}
