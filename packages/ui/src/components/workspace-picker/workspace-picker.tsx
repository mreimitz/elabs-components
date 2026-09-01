"use client";

import { forwardRef, useState, type FormEvent, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { useLocale } from "../locale-provider";
import { ModelPicker, type ModelPickerGroup, type ModelPickerStatus } from "../model-picker";
import { formatLastOpened, type Workspace } from "./workspace-picker-state";

export type { Workspace };

export interface WorkspacePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Recent workspaces, most-relevant first — the caller owns ordering. */
  workspaces: Workspace[];
  /** The currently open workspace's id. */
  currentId?: string;
  /** Fires with the chosen workspace; the popover closes first. */
  onSelect?: (workspace: Workspace) => void;
  /**
   * Free-text path entry, rendered in `ModelPicker`'s `footer` slot below the
   * list. Fires with the raw string the user typed once it validates as
   * non-empty — this component performs no filesystem access of any kind
   * (presentation layer, D5); resolving, normalizing or checking the path is
   * the caller's job.
   */
  onSubmitPath?: (path: string) => void;
  /**
   * Drives the same four-body state grid as `ModelPicker` — see
   * `ModelPickerStatus`. Default `"ready"`, inherited from `ModelPicker`.
   */
  status?: ModelPickerStatus;
  disabled?: boolean;
  /** Accessible name for the trigger and the popover — what the control is FOR. */
  "aria-label"?: string;
  /** Controlled popover open state — see `ModelPicker`'s controlled contract. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Recent-workspace switcher — issue #111, decided in
 * `docs/decisions/2026-09-01-brainless-adoption-architecture.md` § 7.
 *
 * A `ModelPicker` PRESET, not a new picker: `ModelPickerItem`'s
 * `id`/`label`/`description`/`meta` shape is already a superset of what a
 * workspace needs, so this component only supplies workspace-shaped
 * defaults — it maps `path` into the truncating `description` slot, formats
 * `lastOpenedAt` with `Intl.RelativeTimeFormat`, marks the current workspace
 * in the row's TEXT (never colour alone — `ModelPicker`'s check glyph is
 * `aria-hidden` and cannot carry that on its own), and renders the free-text
 * path entry into `ModelPicker`'s `footer` slot so it sits below the list,
 * un-filtered by the search query.
 *
 * Unlike `TeamSwitcher`, this has no `Sidebar` dependency — it works anywhere
 * a picker is needed (a session launch card, a command palette), not only
 * inside a sidebar.
 */
export const WorkspacePicker = forwardRef<HTMLDivElement, WorkspacePickerProps>(
  function WorkspacePicker(
    {
      workspaces,
      currentId,
      onSelect,
      onSubmitPath,
      status,
      disabled,
      className,
      open,
      onOpenChange,
      "aria-label": ariaLabelProp,
      ...props
    },
    ref,
  ) {
    const { t, locale } = useLocale();
    const [path, setPath] = useState("");

    const current = workspaces.find((workspace) => workspace.id === currentId);
    const triggerLabel = current?.name ?? t("ui.workspacePicker.placeholder");
    const ariaLabel = ariaLabelProp ?? t("ui.workspacePicker.label");

    const group: ModelPickerGroup = {
      key: "workspaces",
      label: t("ui.workspacePicker.recent"),
      items: workspaces.map((workspace) => {
        const isCurrent = workspace.id === currentId;
        const meta: string[] = [];
        if (workspace.lastOpenedAt) {
          meta.push(formatLastOpened(workspace.lastOpenedAt, locale));
        }
        // Marked in TEXT so the marker reaches the row's accessible name and
        // survives greyscale (accessibility.md's colour-is-never-the-only-
        // channel test) — ModelPicker's own check glyph is `aria-hidden` and
        // cannot carry this alone.
        if (isCurrent) meta.push(t("ui.workspacePicker.current"));
        return {
          id: workspace.id,
          label: workspace.name,
          description: workspace.path,
          meta,
        };
      }),
    };

    const handleSelect = (item: { id: string }) => {
      const workspace = workspaces.find((w) => w.id === item.id);
      if (workspace) onSelect?.(workspace);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (path.trim() === "") return;
      onSubmitPath?.(path);
      setPath("");
    };

    return (
      <ModelPicker
        ref={ref}
        data-slot="workspace-picker"
        className={cn(className)}
        groups={[group]}
        value={currentId}
        onSelect={handleSelect}
        status={status}
        triggerLabel={triggerLabel}
        aria-label={ariaLabel}
        searchPlaceholder={t("ui.workspacePicker.searchPlaceholder")}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
        footer={
          // Outside `CommandList` on purpose (ModelPicker's own contract): a
          // persistent action row, never filtered by the search query and
          // never part of cmdk's roving selection.
          //
          // `onKeyDown` stops propagation because cmdk binds ITS OWN keydown
          // handler on the `Command` root and reacts to Enter/Home/End/
          // ArrowUp/ArrowDown regardless of which descendant is focused —
          // without this, pressing Enter here would move the list's
          // highlight instead of submitting the path.
          <form
            data-slot="workspace-picker-path-form"
            onSubmit={handleSubmit}
            onKeyDown={(event) => event.stopPropagation()}
            className="flex items-center gap-2 border-t p-2"
          >
            <Input
              data-slot="workspace-picker-path-input"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder={t("ui.workspacePicker.pathPlaceholder")}
              aria-label={t("ui.workspacePicker.pathLabel")}
              className="h-8 min-w-0 flex-1"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              aria-disabled={path.trim() === ""}
              data-slot="workspace-picker-path-submit"
            >
              {t("ui.workspacePicker.openPath")}
            </Button>
          </form>
        }
        {...props}
      />
    );
  },
);
