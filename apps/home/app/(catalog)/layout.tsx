import type { ReactNode } from "react";
import { SiteGround } from "../../components/site-ground";

// Catalogue routes share the site shell's rail (it IS the catalogue navigation); this layout
// only lays the ambient ground under them.
export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteGround />
      {children}
    </>
  );
}
