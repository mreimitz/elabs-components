import { currentStyleConfig, styleConfigVersion, styleConfigIssues } from "../style/config-service";
import { diagramStore } from "../state/diagram-store";
import { catalogVersion } from "../catalog/catalog-bundle";
import { catalogService } from "../catalog/catalog-service";
import { readFile } from "../workspace/client";
import { ICON_NAMES } from "../icons/icon-names";
import { ICON_INDEX, THEME_AWARE_MARKS } from "../icons/register-packs";
import { createViewerSnapshot } from "../viewer/create-snapshot";
import { viewerHtml, type ViewerTemplate } from "../viewer/html";
import type { EmbeddedIcon } from "../viewer/manifest";
import { pictureFileName, saveBlob } from "./export";
async function dataIcon(path: string): Promise<string> {
  if (!path.startsWith("/icons/") || path.includes(".."))
    throw new Error("The icon asset is outside the shipped icon set.");
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not embed icon ${path}.`);
  const blob = await response.blob();
  if (blob.size > 750_000) throw new Error("An icon exceeds the publish asset limit.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read an icon asset."));
    reader.readAsDataURL(blob);
  });
}
async function icon(name: string): Promise<EmbeddedIcon> {
  const entry = ICON_INDEX[name];
  if (!entry) throw new Error(`No embedded icon is available for ${name}.`);
  const dark = THEME_AWARE_MARKS[name];
  return {
    label: entry.label,
    src: await dataIcon(entry.path),
    ...(dark ? { dark: typeof dark === "string" ? dark : { src: await dataIcon(dark.src) } } : {}),
  };
}
export async function publishDiagram(): Promise<{ name: string; bytes: number }> {
  const { text, drawn, path: sourcePath, loadCount } = diagramStore.get();
  const title = drawn.ast?.title ?? "Diagram";
  await catalogService.ready();
  if (styleConfigIssues().length)
    throw new Error(
      "Workspace styles could not be loaded. Resolve the style configuration before publishing.",
    );
  const styleRevision = styleConfigVersion();
  const catalogRevision = catalogVersion();
  const files = new Map<string, Awaited<ReturnType<typeof readFile>>>();
  const snapshot = await createViewerSnapshot({
    text,
    theme: document.documentElement.getAttribute("data-theme") ?? "light",
    catalog: catalogService.all(),
    workspaceStyles: currentStyleConfig(),
    iconNames: ICON_NAMES,
    loadDocument: async (path) => {
      const file = await readFile(path);
      files.set(path, file);
      return file.text;
    },
    loadIcon: icon,
  });
  const response = await fetch("/viewer.template.json");
  if (!response.ok) throw new Error("The offline viewer could not be built. Try publishing again.");
  const template = (await response.json()) as ViewerTemplate;
  for (const [path, original] of files) {
    const current = await readFile(path);
    if (current.mtime !== original.mtime || current.text !== original.text)
      throw new Error("A referenced diagram changed while publishing. Please retry.");
  }
  const current = diagramStore.get();
  if (
    current.text !== text ||
    current.path !== sourcePath ||
    current.loadCount !== loadCount ||
    styleConfigVersion() !== styleRevision ||
    catalogVersion() !== catalogRevision
  )
    throw new Error("The diagram or catalog changed while publishing. Please retry.");
  const html = await viewerHtml(snapshot, template, title);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const name = pictureFileName(title, "svg").replace(/\.svg$/, ".atlas.html");
  saveBlob(blob, name);
  return { name, bytes: blob.size };
}
