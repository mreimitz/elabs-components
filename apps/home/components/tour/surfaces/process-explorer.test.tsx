/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const processExplorerSource = readFileSync(join(here, "process-explorer.tsx"), "utf8");

describe("ProcessExplorerSurface — issue 534", () => {
  it("should import SheetTrigger for proper focus management", () => {
    // The SheetTrigger must be imported from @elabs-ai/components-ui so the button
    // can be wrapped in it, allowing Radix's Dialog primitive to track and restore
    // focus to the trigger when the Sheet closes.
    const hasTriggerImport = processExplorerSource.includes("SheetTrigger");
    expect(hasTriggerImport, "SheetTrigger must be imported from @elabs-ai/components-ui").toBe(
      true,
    );
  });

  it("should wrap the Case table button in SheetTrigger asChild", () => {
    // The button must be wrapped in <SheetTrigger asChild> so that Radix's Dialog primitive
    // can track and restore focus to the trigger when the Sheet closes (via Escape, overlay click,
    // or programmatic close). This pattern allows the button's onClick to work through the
    // SheetTrigger while maintaining focus management.
    const triggerWithButton = processExplorerSource.match(
      /<SheetTrigger\s+asChild>\s*<Button[^>]*type="button"[^>]*>\s*{tourSurfaceCopy\.processExplorer\.casesButton}\s*<\/Button>\s*<\/SheetTrigger>/,
    );
    expect(
      triggerWithButton,
      "Case table button must be wrapped in <SheetTrigger asChild> for Radix focus restoration",
    ).not.toBeNull();
  });

  it("should not have onClick handler on the Case table button when wrapped in SheetTrigger", () => {
    // When the button is wrapped in SheetTrigger, the onClick handler is no longer needed
    // because SheetTrigger automatically handles opening the Sheet.
    const triggerSection = processExplorerSource.match(
      /<SheetTrigger\s+asChild>[\s\S]*?<\/SheetTrigger>/,
    );
    expect(triggerSection).not.toBeNull();

    if (triggerSection) {
      const hasOldOnClick = triggerSection[0].includes("onClick={() => setCasesOpen(true)}");
      expect(
        hasOldOnClick,
        "onClick={() => setCasesOpen(true)} should be removed from the button inside SheetTrigger",
      ).toBe(false);
    }
  });
});
