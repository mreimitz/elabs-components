import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("later utilities win for a genuine conflict (e.g. padding)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("keeps semantic type-role and text-color independent (#187)", () => {
    expect(cn("text-kpi", "text-foreground")).toContain("text-kpi");
    expect(cn("text-kpi", "text-foreground")).toContain("text-foreground");
  });

  // #336: the CardDescription regression was NOT a tailwind-merge conflict — it
  // was an invalid, misspelled utility name that isn't a real Tailwind class,
  // which tailwind-merge's default `text-*` color group happily classified as
  // an unrecognized color and dropped in favor of whichever `text-<color>`
  // utility came later. `text-balance` is a real, already-registered Tailwind
  // utility that tailwind-merge groups under its own `text-wrap` conflict
  // group by default — no `cn.ts` registration is (or ever was) needed to
  // keep it independent from `text-<color>`.
  it("keeps text-balance and text-<color> independent regardless of order (#336)", () => {
    const colorFirst = cn("text-sm", "text-muted-foreground", "text-balance");
    expect(colorFirst).toContain("text-muted-foreground");
    expect(colorFirst).toContain("text-balance");

    const wrapFirst = cn("text-sm", "text-balance", "text-muted-foreground");
    expect(wrapFirst).toContain("text-muted-foreground");
    expect(wrapFirst).toContain("text-balance");
  });

  it("still dedupes conflicting text-wrap utilities against each other", () => {
    expect(cn("text-balance", "text-pretty")).toBe("text-pretty");
  });

  it("still dedupes conflicting text-<color> utilities against each other", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps every type role beside a text colour, and lets a later role replace it", () => {
    for (const role of ["eyebrow", "kpi-sm", "display-lg", "heading-xs", "table-header"]) {
      expect(cn(`text-${role}`, "text-muted-foreground")).toBe(
        `text-${role} text-muted-foreground`,
      );
      expect(cn(`text-${role}`, "text-caption")).toBe("text-caption");
    }
  });

  it("lets a caller's utility replace a component-seam token default", () => {
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-popover", "shadow-lg")).toBe("shadow-lg");
    expect(cn("shadow-dialog", "shadow-none")).toBe("shadow-none");
    expect(cn("rounded-badge", "rounded-md")).toBe("rounded-md");
    expect(cn("font-tabs-active", "font-bold")).toBe("font-bold");
    expect(cn("leading-(--card-title-leading)", "leading-tight")).toBe("leading-tight");
    expect(cn("tracking-(--table-header-tracking)", "tracking-wide")).toBe("tracking-wide");
    expect(cn("text-table-header-foreground", "text-foreground")).toBe("text-foreground");
  });
});
