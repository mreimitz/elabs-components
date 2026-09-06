/**
 * The settings screen the shell's content pane holds — one section's groups of
 * rows, on the canvas.
 *
 * Two things here are deliberate and easy to get wrong when you copy this:
 *
 * 1. The scroll port is a FOCUSABLE region (`tabIndex={0}`) carrying
 *    `focus-ring-inset`, not `focus-ring`. A region that scrolls must be
 *    keyboard-operable (WCAG 2.1.1, axe `scrollable-region-focusable`), and
 *    both layers of the plain focus rung are drawn OUTSIDE the element's box —
 *    which the shell's `SidebarInset` clips with `overflow-hidden`. The inset
 *    rung draws inside the box, so it survives the clip.
 * 2. The "needs a decision" mark is TWO channels, never one. The dot uses the
 *    status FILL rung (`bg-warning`), which the token contract guarantees at
 *    >=3:1 against `--card`; the WORD beside it uses `text-warning-text`, the
 *    coloured-text rung. Colour alone would be a 1.4.1 failure, and the plate
 *    ink rung (`text-warning-foreground`) would paint near-white text here.
 */
"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  SectionHeader,
  Separator,
  Skeleton,
  StatePanel,
  Switch,
  cn,
} from "@elabs-ai/components-ui";
import { SETTINGS_GROUPS, type SettingGroup, type SettingRow } from "./settings-content";
import { sectionKey, type SettingsArea, type SettingsSection } from "./nav-items";

export interface SettingsScreenProps {
  /** The area the open section belongs to — the screen's eyebrow. */
  area?: SettingsArea;
  /** The section being shown. Nothing open renders the no-selection state. */
  section?: SettingsSection;
  /**
   * Groups to render. Defaults to the fixture keyed by `sectionKey(area, section)`,
   * so the block renders believably before you have wired anything up.
   */
  groups?: SettingGroup[];
  /** No renderable content yet — layout-shaped skeletons, no rows. */
  loading?: boolean;
  className?: string;
}

/**
 * The two-channel attention mark: a `bg-warning` DOT (the fill rung, the only
 * carrier of the colour) beside a `text-warning-text` WORD. The dot carries
 * `data-slot="settings-attention-dot"` so a story can resolve it and measure
 * its painted fill against the card ground it sits on.
 */
function AttentionMark({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-meta text-warning-text">
      <span
        data-slot="settings-attention-dot"
        aria-hidden="true"
        className="size-2 rounded-full bg-warning"
      />
      {label}
    </span>
  );
}

function SettingRowView({
  row,
  checked,
  onCheckedChange,
}: {
  row: SettingRow;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const controlId = useId();
  const descriptionId = `${controlId}-description`;
  const isSwitch = row.control.kind === "switch";

  return (
    <div
      data-slot="settings-row"
      className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
    >
      {/* `min-w-0` is what lets the description wrap instead of pushing the
          control off the card — the silent culprit in every flex row. */}
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isSwitch ? (
            <Label htmlFor={controlId} className="text-body text-foreground">
              {row.label}
            </Label>
          ) : (
            <span className="text-body font-medium text-foreground">{row.label}</span>
          )}
          {row.attention ? <AttentionMark label={row.attention} /> : null}
        </div>
        <p id={descriptionId} className="text-meta text-muted-foreground">
          {row.description}
        </p>
      </div>

      {row.control.kind === "switch" ? (
        <Switch
          id={controlId}
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-body text-muted-foreground">{row.control.value}</span>
          <Button
            variant="outline"
            size="sm"
            // Authored, not computed: seven "Change" buttons on one screen all
            // announce identically otherwise, and the visible word is the one
            // sighted users read. `aria-label` names WHICH setting it changes.
            aria-label={`${row.control.action} — ${row.label}`}
          >
            {row.control.action}
          </Button>
        </div>
      )}
    </div>
  );
}

export function SettingsScreen({
  area,
  section,
  groups,
  loading = false,
  className,
}: SettingsScreenProps) {
  const resolved = useMemo<SettingGroup[]>(() => {
    if (groups) return groups;
    if (!area || !section) return [];
    return SETTINGS_GROUPS[sectionKey(area.id, section.id)] ?? [];
  }, [area, groups, section]);

  // Switch state lives here, keyed by row id, so the screen is really
  // interactive rather than a picture of one. A real app would lift this to
  // wherever it persists settings.
  const [switches, setSwitches] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  // A new section starts clean, with the fixture's own values.
  useEffect(() => {
    setSwitches({});
    setDirty(false);
  }, [area?.id, section?.id]);

  if (loading) {
    return (
      <div data-slot="settings-screen" className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div
          data-slot="settings-screen-scroll"
          // Same treatment as the loaded branch below: focusable because it
          // scrolls, `focus-ring-inset` because `SidebarInset` clips anything
          // drawn outside this box. A keyboard user must be able to scroll the
          // skeleton for the same reason they can scroll the real content.
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 focus-ring-inset sm:px-6 lg:px-8"
        >
          {/* ONE live region for the whole not-ready screen — the skeleton
              boxes inside it are each `aria-hidden`, so AT hears the sentence
              once instead of once per box. */}
          <div
            role="status"
            aria-live="polite"
            className="mx-auto flex w-full max-w-3xl flex-col gap-6"
          >
            <span className="sr-only">Loading settings…</span>
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
            {[0, 1].map((group) => (
              <Card key={group}>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[0, 1].map((row) => (
                    <div key={row} className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-3 w-full max-w-md" />
                      </div>
                      <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!area || !section) {
    return (
      <div data-slot="settings-screen" className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div
          data-slot="settings-screen-scroll"
          // Focusable because it scrolls; `focus-ring-inset` because the shell's
          // `SidebarInset` clips anything drawn outside this box. See the file
          // header. This is the block's FIRST-RUN branch and its `StatePanel`
          // ships no action, so it has zero focusable descendants.
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 focus-ring-inset sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-3xl">
            <StatePanel
              kind="empty"
              icon={<SlidersHorizontal />}
              title="No section selected"
              description="Pick an area on the left, then a section, to see what can be changed."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="settings-screen" className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        data-slot="settings-screen-scroll"
        // Focusable because it scrolls; `focus-ring-inset` because the shell's
        // `SidebarInset` clips anything drawn outside this box. See the file
        // header.
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 focus-ring-inset sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {/* `as="h1"`: this screen IS the page — its route is the open
              section — so its title is the document's outline root. Nothing
              else in this shell owns an <h1>, and a screen whose highest
              heading is an <h2> has no root at all (WCAG 1.3.1). The visual is
              unchanged; `as` picks the level, never the size. */}
          <SectionHeader
            as="h1"
            eyebrow={area.label}
            title={section.label}
            description={section.summary}
          />

          {/* Always mounted, so the first change is announced rather than
              swallowed by a region that appears at the same moment. */}
          <span role="status" aria-live="polite" className="sr-only">
            {dirty ? "Unsaved changes" : ""}
          </span>

          {resolved.length === 0 ? (
            <StatePanel
              kind="empty"
              icon={<SlidersHorizontal />}
              title="Nothing to configure yet"
              description="This section has no settings on your plan."
            />
          ) : (
            resolved.map((group) => (
              <Card key={group.id} data-slot="settings-group">
                <CardHeader>
                  {/* `as="h2"`: `SectionHeader` above owns the <h1>, so the
                      card titles are the next rung down. They moved with it —
                      leaving them at <h3> under an <h1> would skip a level and
                      fail axe's `heading-order`, which DOES run in the default
                      tag set (unlike `page-has-heading-one`). */}
                  <CardTitle as="h2">{group.title}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {group.rows.map((row, index) => (
                    <div key={row.id}>
                      {index > 0 ? <Separator className="my-0" /> : null}
                      <SettingRowView
                        row={row}
                        checked={
                          switches[row.id] ??
                          (row.control.kind === "switch" ? row.control.on : false)
                        }
                        onCheckedChange={(next) => {
                          setSwitches((current) => ({ ...current, [row.id]: next }));
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {dirty ? (
        <div
          data-slot="settings-screen-footer"
          // The one boundary between this bar and the scrolling canvas above
          // it: no fill change, no elevation, so it takes the strong rung.
          className="flex shrink-0 items-center justify-end gap-2 border-t border-border-strong px-4 py-3 sm:px-6 lg:px-8"
        >
          <span className="me-auto text-meta text-muted-foreground">You have unsaved changes.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSwitches({});
              setDirty(false);
            }}
          >
            Discard
          </Button>
          <Button size="sm" onClick={() => setDirty(false)}>
            Save changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
