import { navigate } from "../../routes/use-hash";
import { snapshot } from "../snapshot";
export const currentMode = () => "view" as const;
export const useDocMode = currentMode;
export const modeActions = { setMode() {}, setPhonePane() {} };
export function openDoc(path: string) {
  if (Object.hasOwn(snapshot.documents, path)) navigate({ kind: "doc", path });
}
