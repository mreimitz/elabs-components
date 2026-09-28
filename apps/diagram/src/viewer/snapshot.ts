import {
  MAX_SNAPSHOT_BYTES,
  validateSnapshot,
  validateSnapshotContent,
  freezeSnapshot,
} from "./manifest";
/** Immutable, customer-safe data only; the exporter and the runtime both validate it. */
function readSnapshot() {
  const source = document.getElementById("atlas-snapshot")?.textContent;
  if (!source || source.length > MAX_SNAPSHOT_BYTES)
    throw new Error("The published snapshot is missing or too large.");
  const value: unknown = JSON.parse(source);
  validateSnapshot(value);
  validateSnapshotContent(value);
  return freezeSnapshot(value);
}
export const snapshot = (() => {
  try {
    return readSnapshot();
  } catch (error) {
    const root = document.getElementById("root");
    if (root) {
      const message = document.createElement("p");
      message.setAttribute("role", "alert");
      message.textContent =
        error instanceof Error ? error.message : "This published diagram could not be opened.";
      root.replaceChildren(message);
    }
    throw error;
  }
})();
