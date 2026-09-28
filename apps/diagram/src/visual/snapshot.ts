import type { ArchDiagram } from "../spec/dialect";
import { buildComponentTable } from "../spec/compose/resolver";
import { currentComponentFiles } from "../state/component-files";
import { catalogVersion, currentCatalog } from "../catalog/catalog-bundle";
import { ICON_NAMES } from "../icons/icon-names";
import { resolveVisual } from "./resolve-visual";

const snapshots = new WeakMap<
  ArchDiagram,
  {
    files: ReturnType<typeof currentComponentFiles>;
    catalog: number;
    value: ReturnType<typeof resolveVisual>;
  }
>();
/** The canvas and morph consume the same immutable resolved projection. */
export function visualSnapshot(ast: ArchDiagram) {
  const files = currentComponentFiles();
  const revision = catalogVersion();
  const saved = snapshots.get(ast);
  if (saved && saved.files === files && saved.catalog === revision) return saved.value;
  const catalog = currentCatalog();
  const components = buildComponentTable(ast, files, { catalog, iconNames: ICON_NAMES });
  const value = resolveVisual(ast, { catalog, components });
  snapshots.set(ast, { files, catalog: revision, value });
  return value;
}
