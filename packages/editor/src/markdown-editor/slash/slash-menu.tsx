"use client";

/**
 * SlashMenu — the branded popup the slash plugin renders at the caret.
 *
 * Presentational + controlled: the ProseMirror plugin owns the keyboard
 * (↑/↓/Enter/Esc) and the open/query/active state, so this component just renders
 * the filtered, grouped commands and exposes `onSelect`. It is a token-styled
 * `listbox`/`option` list (NOT `@elabs/components-ui` `Command`/cmdk): a cmdk instance would
 * fight the editor for DOM focus and arrow-key handling, since the caret must stay
 * in the ProseMirror `textbox` while the user types `/query`. The plugin keeps the
 * active option in view and wires `aria-activedescendant` on the editor surface.
 *
 * Semantic tokens only; matches the `Command` popover look (bg-popover, accent
 * selection, muted group headings).
 */
import { cn } from "@elabs/components-ui/lib/cn";
import { forwardRef, type HTMLAttributes } from "react";

import { groupSlashCommands, type SlashCommand } from "./brand-slash-commands";

export interface SlashMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** The (already filtered) commands to show. */
  commands: SlashCommand[];
  /** The id of the active (highlighted) command, for `aria-selected`. */
  activeId?: string;
  /** Called when a command is chosen (click or via the plugin's Enter). */
  onSelect: (command: SlashCommand) => void;
  /** DOM id prefix so each option id is stable + unique (matches `aria-activedescendant`). */
  idPrefix?: string;
  /** Shown when the query matches nothing. */
  emptyLabel?: string;
}

/** Build the stable DOM id for a command's option element. */
export function slashOptionId(idPrefix: string, commandId: string): string {
  return `${idPrefix}-${commandId}`;
}

export const SlashMenu = forwardRef<HTMLDivElement, SlashMenuProps>(function SlashMenu(
  {
    commands,
    activeId,
    onSelect,
    idPrefix = "brand-slash",
    emptyLabel = "No matching blocks",
    className,
    ...props
  },
  ref,
) {
  const groups = groupSlashCommands(commands);

  return (
    <div
      ref={ref}
      // The editor surface carries `role="textbox"`; this list is its popup. The
      // plugin sets `aria-controls`/`aria-activedescendant` on the textbox.
      role="listbox"
      aria-label="Insert block"
      className={cn(
        "max-h-[min(320px,60vh)] w-72 overflow-y-auto overflow-x-hidden rounded-md bg-popover p-1 text-popover-foreground shadow-ring-md",
        className,
      )}
      {...props}
    >
      {commands.length === 0 ? (
        <div className="px-2 py-6 text-center text-caption text-muted-foreground">{emptyLabel}</div>
      ) : (
        groups.map(({ group, commands: groupCommands }) => (
          <div key={group} role="group" aria-label={group} className="overflow-hidden p-1">
            <div className="px-2 py-1.5 text-meta font-medium text-muted-foreground">{group}</div>
            {groupCommands.map((command) => {
              const selected = command.id === activeId;
              return (
                <div
                  key={command.id}
                  id={slashOptionId(idPrefix, command.id)}
                  role="option"
                  aria-selected={selected}
                  data-selected={selected ? "true" : undefined}
                  // The editor keeps focus, so select on mousedown (before the
                  // editor would steal focus back) and don't let the click move
                  // the selection out of the document.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(command);
                  }}
                  className={cn(
                    "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-body outline-none transition-colors duration-fast",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                  )}
                >
                  {command.icon ? (
                    <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
                      {command.icon}
                    </span>
                  ) : null}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{command.label}</span>
                    {command.description ? (
                      <span className="truncate text-meta text-muted-foreground">
                        {command.description}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
});
