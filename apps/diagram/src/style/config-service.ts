import { readFile, WorkspaceApiError } from "../workspace/client";
import { watchPath } from "../workspace/live-reload";
import { createStyleConfigStore, STYLE_CONFIG_PATH } from "./workspace-config";
const store = createStyleConfigStore(async () => {
  try {
    return (await readFile(STYLE_CONFIG_PATH)).text;
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 404) return null;
    throw error;
  }
});
export const currentStyleConfig = store.current;
export const styleConfigIssues = store.issues;
export const styleConfigVersion = store.version;
export const onStyleConfigChange = store.subscribe;
let users = 0;
let stop: (() => void) | undefined;
/** Share the existing workspace stream; the last owner cancels admission of pending reads. */
export function watchStyleConfig(): () => void {
  if (users++ === 0) {
    stop = watchPath(STYLE_CONFIG_PATH, () => void store.refresh());
    void store.refresh();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users === 0) {
      stop?.();
      stop = undefined;
      store.cancel();
    }
  };
}
