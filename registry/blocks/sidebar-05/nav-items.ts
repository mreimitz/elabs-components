/**
 * Nav data for the dual-rail settings console, router-agnostic by construction.
 *
 * The shell has TWO navigation levels and this file holds both: the AREAS the
 * slim icon rail shows, and the SECTIONS each area opens in the second panel.
 * Every entry renders as a plain `<a href>`; swap the element for your router's
 * link and keep the matcher:
 *   <NavLink to={sectionHref(area.id, section.id)}>   (react-router)
 *   <Link href={sectionHref(area.id, section.id)}>    (next/link)
 *
 * `isPathActive`, `areaHref`, `sectionHref` and `parseSettingsPath` are exported
 * so the semantics survive that swap.
 *
 * `isPathActive` is a DELIBERATE copy of the same helper in the sibling
 * `app-shell` / `sidebar-02` / `sidebar-04` blocks. Registry blocks are
 * copy-own: `npx shadcn add sidebar-05` must install a block that works on its
 * own, and an import from `@/components/app-shell/…` would resolve here in this
 * source tree and then break for anyone who did not also install the flagship.
 * The duplication is the price of an item that installs alone — keep the copies
 * in step by hand rather than "fixing" it.
 */
import type { LucideIcon } from "lucide-react";
import { Building2, Database, Plug, Users } from "lucide-react";

/** One row of the second panel — a settings section inside an area. */
export interface SettingsSection {
  id: string;
  label: string;
  /** One line under the label, so the panel is scannable without opening rows. */
  summary: string;
  /**
   * How many settings in this section are waiting on a decision. Drives the
   * panel's count badge AND is folded into the row's accessible name — the
   * number is the reason to open the section, so it must not be visual only.
   */
  attention?: number;
}

/** One button of the slim icon rail — a top-level settings area. */
export interface SettingsArea {
  id: string;
  label: string;
  /**
   * Shown in the rail. The rail is icon-only, so every area needs a DISTINCT
   * glyph: the icon is the whole entry to a sighted scan, even though the
   * accessible name and the tooltip carry the word.
   */
  icon: LucideIcon;
  sections: SettingsSection[];
}

/** Route for an area's landing page (the panel open, nothing selected in it). */
export function areaHref(areaId: string): string {
  return `/settings/${areaId}`;
}

/** Route for one section — what the content pane shows. */
export function sectionHref(areaId: string, sectionId: string): string {
  return `/settings/${areaId}/${sectionId}`;
}

/** Stable key for a section across areas — used to look its content up. */
export function sectionKey(areaId: string, sectionId: string): string {
  return `${areaId}/${sectionId}`;
}

export function isPathActive(itemHref: string, activePath: string): boolean {
  if (itemHref === activePath) return true;
  if (itemHref === "/") return false; // the root would otherwise match everything
  return activePath.startsWith(`${itemHref}/`);
}

export const SETTINGS_AREAS: SettingsArea[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Building2,
    sections: [
      { id: "general", label: "General", summary: "Name, URL and default language" },
      { id: "branding", label: "Branding", summary: "Logo, accent colour and email header" },
      { id: "regions", label: "Regions", summary: "Where workspace data is processed" },
    ],
  },
  {
    id: "access",
    label: "Access",
    icon: Users,
    sections: [
      { id: "members", label: "Members", summary: "Who belongs to this workspace" },
      { id: "roles", label: "Roles", summary: "What each role is allowed to do" },
      {
        id: "sign-in",
        label: "Sign-in",
        summary: "How people prove who they are",
        attention: 2,
      },
    ],
  },
  {
    id: "data",
    label: "Data",
    icon: Database,
    sections: [
      { id: "retention", label: "Retention", summary: "How long records are kept" },
      { id: "exports", label: "Exports", summary: "Scheduled and on-demand extracts" },
      {
        id: "audit-log",
        label: "Audit log",
        summary: "What is recorded, and for how long",
        attention: 1,
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    sections: [
      { id: "connected-apps", label: "Connected apps", summary: "Third-party apps with access" },
      { id: "webhooks", label: "Webhooks", summary: "Where workspace events are delivered" },
      { id: "tokens", label: "Access tokens", summary: "Long-lived credentials and their scopes" },
    ],
  },
];

/**
 * The area with this id, or `undefined` for a route outside settings.
 *
 * `areas` defaults to the fixture, but is a REAL parameter rather than a
 * closed-over constant: the shell accepts its own `areas` prop, and a lookup
 * that ignored it would silently resolve a caller's area to the fixture entry
 * with the same id — the shape of bug where an empty area still renders three
 * sections.
 */
export function findArea(
  areaId: string | undefined,
  areas: SettingsArea[] = SETTINGS_AREAS,
): SettingsArea | undefined {
  return areas.find((area) => area.id === areaId);
}

/**
 * Read `/settings/<area>/<section>` back into ids. Written rather than assumed
 * because the shell initialises BOTH of its state atoms from `activePath`: a
 * consumer wiring this to a router hands the shell a route, not two ids.
 */
export function parseSettingsPath(
  activePath: string,
  areas: SettingsArea[] = SETTINGS_AREAS,
): {
  areaId?: string;
  sectionId?: string;
} {
  const segments = activePath.split("/").filter(Boolean);
  if (segments[0] !== "settings") return {};
  const area = findArea(segments[1], areas);
  if (!area) return {};
  const section = area.sections.find((candidate) => candidate.id === segments[2]);
  return { areaId: area.id, sectionId: section?.id };
}
