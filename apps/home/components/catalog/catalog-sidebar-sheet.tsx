"use client";
/** The catalogue navigation below `lg`: the same sidebar, in a sheet behind a "Browse" button. */
import { PanelLeft } from "lucide-react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@elabs-ai/components-ui";
import { catalogCopy } from "../../content/copy";
import { CatalogSidebar } from "./catalog-sidebar";

export function CatalogSidebarSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <PanelLeft aria-hidden="true" />
          {catalogCopy.sidebar.open}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetTitle className="sr-only">{catalogCopy.sidebar.sheetTitle}</SheetTitle>
        <SheetDescription className="sr-only">{catalogCopy.sidebar.filter}</SheetDescription>
        <CatalogSidebar />
      </SheetContent>
    </Sheet>
  );
}
