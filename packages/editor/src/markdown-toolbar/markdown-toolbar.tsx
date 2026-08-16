"use client";

/**
 * MarkdownToolbar — formatting chrome for the markdown SOURCE pane, composed
 * entirely from @elabs/components-ui (Button, Tooltip, Separator, DropdownMenu). Actions run
 * against a Monaco editor instance via the pure commands in markdown-commands.ts.
 * Buttons disable when no editor is mounted.
 */
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import {
  Bold,
  ChevronDown,
  Code2,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  SquarePlus,
} from "lucide-react";
import { forwardRef, Fragment, type HTMLAttributes, type ReactNode } from "react";

import type { MonacoCodeEditor } from "../code-editor";
import { groupSlashCommands, type SlashCommand } from "../markdown-editor/slash";
import {
  insertDirective,
  insertHorizontalRule,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "./markdown-commands";

export interface MarkdownToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** The Monaco editor instance to act on (from CodeEditor ref/onMount). */
  editor: MonacoCodeEditor | null;
  /** Extra controls rendered on the right (e.g. a mode switch). */
  actions?: ReactNode;
  /**
   * Drives the **Insert** menu. When set, the menu lists every command that
   * carries a `snippet` (grouped by `group`), inserting that markdown at the
   * caret — so the source / split pane reaches the SAME blocks as the WYSIWYG
   * slash menu (`/calc`, `/iterate`, `/pivot`, plus any consumer commands).
   * When omitted, the menu falls back to the four built-in directive snippets.
   * (A4)
   */
  insertCommands?: SlashCommand[];
}

/** A command that actually carries a source-mode snippet. */
type InsertableCommand = SlashCommand & { snippet: string };

const DIRECTIVE_SNIPPETS: { label: string; snippet: string }[] = [
  { label: "Card", snippet: `:::card{title="Title"}\nContent\n:::` },
  { label: "Callout", snippet: `:::callout{type="info" title="Note"}\nMessage\n:::` },
  { label: "Metric", snippet: `::metric{label="Label" value="0" description="detail"}` },
  {
    label: "Timeline",
    snippet: `:::timeline\n- (done) Step one\n- (active) Step two\n- (pending) Step three\n:::`,
  },
];

export const MarkdownToolbar = forwardRef<HTMLDivElement, MarkdownToolbarProps>(
  function MarkdownToolbar({ editor, actions, insertCommands, className, ...props }, ref) {
    const disabled = !editor;
    const run = (fn: (e: MonacoCodeEditor) => void) => () => {
      if (editor) fn(editor);
    };

    // The Insert menu is driven by the slash registry when provided (A4): only
    // commands that carry a source-mode `snippet`, grouped by `group`.
    const insertGroups = insertCommands
      ? groupSlashCommands(
          insertCommands.filter((c): c is InsertableCommand => typeof c.snippet === "string"),
        )
      : null;

    const IconButton = ({
      label,
      icon,
      onClick,
    }: {
      label: string;
      icon: ReactNode;
      onClick: () => void;
    }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );

    return (
      <TooltipProvider delayDuration={300}>
        <div
          ref={ref}
          role="toolbar"
          aria-label="Markdown formatting"
          className={cn(
            "flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-surface px-2",
            className,
          )}
          {...props}
        >
          <IconButton
            label="Bold"
            icon={<Bold className="size-4" />}
            onClick={run((e) => wrapSelection(e, "**"))}
          />
          <IconButton
            label="Italic"
            icon={<Italic className="size-4" />}
            onClick={run((e) => wrapSelection(e, "*"))}
          />
          <IconButton
            label="Inline code"
            icon={<Code2 className="size-4" />}
            onClick={run((e) => wrapSelection(e, "`"))}
          />
          <IconButton label="Link" icon={<Link2 className="size-4" />} onClick={run(insertLink)} />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="gap-1"
                    aria-label="Heading level"
                  >
                    <Heading className="size-4" />
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Heading</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              {([1, 2, 3] as const).map((level) => (
                <DropdownMenuItem
                  key={level}
                  onSelect={run((e) => toggleLinePrefix(e, `${"#".repeat(level)} `))}
                >
                  Heading {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <IconButton
            label="Quote"
            icon={<Quote className="size-4" />}
            onClick={run((e) => toggleLinePrefix(e, "> "))}
          />
          <IconButton
            label="Bullet list"
            icon={<List className="size-4" />}
            onClick={run((e) => toggleLinePrefix(e, "- "))}
          />
          <IconButton
            label="Numbered list"
            icon={<ListOrdered className="size-4" />}
            onClick={run((e) => toggleLinePrefix(e, "1. "))}
          />
          <IconButton
            label="Divider"
            icon={<Minus className="size-4" />}
            onClick={run(insertHorizontalRule)}
          />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="gap-1"
                    aria-label="Insert block"
                  >
                    <SquarePlus className="size-4" />
                    <span className="text-xs">Insert</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Insert brand block</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              {insertGroups && insertGroups.length > 0
                ? insertGroups.map(({ group, commands }, gi) => (
                    <Fragment key={group}>
                      {gi > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuLabel className="text-meta font-medium text-muted-foreground">
                        {group}
                      </DropdownMenuLabel>
                      {(commands as InsertableCommand[]).map((cmd) => (
                        <DropdownMenuItem
                          key={cmd.id}
                          className="gap-2"
                          onSelect={run((e) => insertDirective(e, cmd.snippet))}
                        >
                          {cmd.icon ? (
                            <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
                              {cmd.icon}
                            </span>
                          ) : null}
                          {cmd.label}
                        </DropdownMenuItem>
                      ))}
                    </Fragment>
                  ))
                : DIRECTIVE_SNIPPETS.map(({ label, snippet }) => (
                    <DropdownMenuItem
                      key={label}
                      onSelect={run((e) => insertDirective(e, snippet))}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
        </div>
      </TooltipProvider>
    );
  },
);
