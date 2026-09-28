import { snapshot } from "../snapshot";
const files = new Map(
  Object.entries(snapshot.documents).map(([path, text]) => [path, { text, mtime: 1 }]),
);
export const currentComponentFiles = () => files;
export const componentFilesRevision = () => 0;
export const putComponentFiles = () => {
  throw new Error("Published references are read-only.");
};
export const dropComponentFile = putComponentFiles;
export const clearComponentFiles = putComponentFiles;
