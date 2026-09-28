import { createElement } from "react";
import { registerServiceLogos } from "@elabs-ai/components-icons";
import { VendorMark } from "../../icons/theme-aware-mark";
import { LUCIDE_NAMES } from "../../icons/lucide-names";
import { snapshot } from "../snapshot";
export const ICON_NAMES = new Set([
  ...Object.keys(snapshot.icons),
  ...LUCIDE_NAMES.map((name) => `lucide/${name}`),
]);
export function registerIconPacks() {
  registerServiceLogos(
    Object.fromEntries(
      Object.entries(snapshot.icons).map(([key, icon]) => [
        key,
        icon.dark
          ? {
              label: icon.label,
              render: ({ size, variant }: { size: number; variant: "brand" | "mono" }) =>
                createElement(VendorMark, { src: icon.src, dark: icon.dark!, size, variant }),
            }
          : { label: icon.label, src: icon.src },
      ]),
    ),
  );
}
export const ICON_INDEX = Object.fromEntries(
  Object.entries(snapshot.icons).map(([key, icon]) => [
    key,
    { path: icon.src, label: icon.label, pack: key.split("/")[0] },
  ]),
);
