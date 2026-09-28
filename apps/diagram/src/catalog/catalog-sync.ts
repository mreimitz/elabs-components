/**
 * DG-26 (1b.4) — keeps catalog references live: a catalog change recompiles the open diagram
 * against the new entries. Never touches the text, the dirty flag or undo.
 */
import { useEffect } from "react";
import { diagramActions } from "../state/diagram-store";
import { catalogService } from "./catalog-service";
import { onCatalogChange } from "./catalog-bundle";

export function useCatalogSync(): void {
  useEffect(() => {
    const offService = catalogService.subscribe(() => undefined); // starts the first load
    const offChange = onCatalogChange(() => diagramActions.recompile());
    return () => {
      offService();
      offChange();
    };
  }, []);
}
