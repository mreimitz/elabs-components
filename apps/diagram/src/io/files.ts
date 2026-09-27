/**
 * DG-16 — open and save `.yaml` files (plan §10: no backend). Open reads the file the
 * person picked in a file input; Save downloads the text as it is, byte for byte, named
 * after the diagram's title. React-free. DG-21 turns them into Import and Export (below).
 */
import { MAX_DOC_BYTES } from "./share-url";
import { createUniqueFile } from "../workspace/client"; // DG-21

/** The file input's `accept`. */
export const YAML_ACCEPT = ".yaml,.yml,application/yaml,text/yaml";

/** `Lakehouse on AWS` → `lakehouse-on-aws.yaml`; no title → `diagram.yaml`. */
export function yamlFileName(title: string | undefined): string {
  const slug = (title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${slug || "diagram"}.yaml`;
}

/** The file's text; throws past `MAX_DOC_BYTES` or when it is not UTF-8. */
export async function readYamlFile(file: File): Promise<string> {
  if (file.size > MAX_DOC_BYTES) {
    throw new Error(`The file is larger than ${MAX_DOC_BYTES} bytes.`);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
}

/** Download `text` as `name`, unchanged. */
export function downloadYaml(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/yaml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Revoked on the next task: the download has started from the click.
  setTimeout(() => URL.revokeObjectURL(url));
}

// ── DG-21: Open/Save become Import/Export ───────────────────────────────────────────────
// With the workspace (plan V5, V6) a document is a file on disk that autosaves, so a local
// `.yaml` is imported into the workspace (it becomes a new workspace file) and a download is
// an export. `readYamlFile` / `downloadYaml` stay: they are the two halves' file I/O.

/** Import: `file` becomes a new workspace file in `folder` (a free name). Returns its path. */
export async function importYamlFile(file: File, folder: string): Promise<string> {
  const text = await readYamlFile(file);
  return createUniqueFile(folder, yamlFileName(file.name.replace(/\.ya?ml$/i, "")), text);
}

/** Export: download `text` named after the diagram's `title`, byte for byte. */
export function exportYaml(text: string, title: string | undefined): void {
  downloadYaml(text, yamlFileName(title));
}

/** Ask before the tab closes or reloads while `edited()` (the browser shows its own prompt). */
export function guardUnload(edited: () => boolean): () => void {
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (edited()) event.preventDefault();
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => window.removeEventListener("beforeunload", onBeforeUnload);
}
