import type { WorkspaceState } from "../../workspace/workspace-store";
const state: WorkspaceState = {
  tree: null,
  treeError: null,
  recents: [],
  current: null,
  dirty: false,
  save: "saved",
  savedAt: null,
  conflict: false,
  versions: null,
};
export const useWorkspace = <T>(select: (state: WorkspaceState) => T) => select(state);
export const workspaceStore = { get: () => state, subscribe: () => () => {} };
export const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/"));
export const workspaceActions = {};
export const onWorkspaceFileSaved = () => () => {};
