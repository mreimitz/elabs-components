import { normalizeArch, parseArchYaml } from "../spec/dialect";
import { loadComponentFiles, type ComponentFiles, type LoadFile } from "../spec/compose/resolver";
import { componentFilesRevision } from "../state/component-files";
import { readFile, WorkspaceApiError } from "./client";
export const loadComponentFile: LoadFile = async (path) => {
  try {
    const file = await readFile(path);
    return file.mtime > 0 ? file : { error: "The workspace service did not return a file." };
  } catch (error) {
    return error instanceof WorkspaceApiError && error.status === 404
      ? null
      : { error: error instanceof Error ? error.message : String(error) };
  }
};
/** A private snapshot: callers publish only after checking their document/request identity. */
export async function preloadComponents(
  text: string,
  isCurrent: () => boolean = () => true,
  initial: ComponentFiles = new Map(),
): Promise<ComponentFiles | null> {
  let ast;
  try {
    const parsed = parseArchYaml(text);
    ast = normalizeArch(parsed.raw, parsed.sourceMap).ast;
  } catch {
    return new Map();
  }
  if (!ast) return new Map();
  let reused = initial;
  while (isCurrent()) {
    const revision = componentFilesRevision();
    const files = await loadComponentFiles(ast, loadComponentFile, reused);
    if (!isCurrent()) return null;
    if (revision === componentFilesRevision()) return files;
    reused = new Map();
  }
  return null;
}
