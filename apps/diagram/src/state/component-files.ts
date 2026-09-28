import type { ComponentFiles } from "../spec/compose/resolver";
let files: ComponentFiles = new Map();
let revision = 0;
export const currentComponentFiles = (): ComponentFiles => files;
export const componentFilesRevision = (): number => revision;
export function putComponentFiles(next: ComponentFiles): void {
  files = new Map(next);
}
/** Invalidate in-flight reads as well as previously published data. */
export function dropComponentFile(path: string): void {
  revision += 1;
  const next = new Map(files);
  next.delete(path);
  files = next;
}
export function clearComponentFiles(): void {
  revision += 1;
  files = new Map();
}
