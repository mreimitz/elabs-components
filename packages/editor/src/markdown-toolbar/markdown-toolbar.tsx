"use client";

/**
 * MarkdownToolbar — formatting chrome for the markdown SOURCE pane, composed
 * entirely from @elabs-ai/components-ui (Button, Tooltip, Separator, DropdownMenu). Actions run
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
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
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

// The `title=`/`label=` values below are example CONTENT dropped into the user's
// document (the same seeds `brand-slash-commands.ts` uses), not UI chrome — left
// as literal English placeholder text the author overwrites.
const DIRECTIVE_SNIPPETS: { labelKey: string; snippet: string }[] = [
  {
    labelKey: "editor.markdownToolbar.directiveCard",
    snippet: `:::card{title="Title"}\nContent\n:::`, // i18n-exempt: example document content
  },
  {
    labelKey: "editor.markdownToolbar.directiveCallout",
    snippet: `:::callout{type="info" title="Note"}\nMessage\n:::`, // i18n-exempt: example document content
  },
  {
    labelKey: "editor.markdownToolbar.directiveMetric",
    snippet: `::metric{label="Label" value="0" description="detail"}`, // i18n-exempt: example document content
  },
  {
    labelKey: "editor.markdownToolbar.directiveTimeline",
    snippet: `:::timeline\n- (done) Step one\n- (active) Step two\n- (pending) Step three\n:::`, // i18n-exempt: example document content
  },
];

export const MarkdownToolbar = forwardRef<HTMLDivElement, MarkdownToolbarProps>(
  function MarkdownToolbar({ editor, actions, insertCommands, className, ...props }, ref) {
    const { t } = useLocale();
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
          aria-label={t("editor.markdownToolbar.label")}
          className={cn(
            "flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-surface px-2",
            className,
          )}
          {...props}
        >
          <IconButton
            label={t("editor.markdownToolbar.bold")}
            icon={<Bold className="size-4" />}
            onClick={run((e) => wrapSelection(e, "**"))}
          />
          <IconButton
            label={t("editor.markdownToolbar.italic")}
            icon={<Italic className="size-4" />}
            onClick={run((e) => wrapSelection(e, "*"))}
          />
          <IconButton
            label={t("editor.markdownToolbar.inlineCode")}
            icon={<Code2 className="size-4" />}
            onClick={run((e) => wrapSelection(e, "`"))}
          />
          <IconButton
            label={t("editor.markdownToolbar.link")}
            icon={<Link2 className="size-4" />}
            onClick={run(insertLink)}
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
                    aria-label={t("editor.markdownToolbar.headingLevel")}
                  >
                    <Heading className="size-4" />
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("editor.markdownToolbar.heading")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              {([1, 2, 3] as const).map((level) => (
                <DropdownMenuItem
                  key={level}
                  onSelect={run((e) => toggleLinePrefix(e, `${"#".repeat(level)} `))}
                >
                  {t("editor.markdownToolbar.headingLevelItem", { level })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <IconButton
            label={t("editor.markdownToolbar.quote")}
            icon={<Quote className="size-4" />}
            onClick={run((e) => toggleLinePrefix(e, "> "))}
          />
          <IconButton
            label={t("editor.markdownToolbar.bulletList")}
            icon={<List className="size-4" />}
            onClick={run((e) => toggleLinePrefix(e, "- "))}
          />
          <IconButton
            label={t("editor.markdownToolbar.numberedList")}
            icon={<ListOrdered className="size-4" />}
            onClick={run((e) => toggleLinePrefix(e, "1. "))}
          />
          <IconButton
            label={t("editor.markdownToolbar.divider")}
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
                    aria-label={t("editor.markdownToolbar.insertBlock")}
                  >
                    <SquarePlus className="size-4" />
                    <span className="text-xs">{t("editor.markdownToolbar.insert")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("editor.markdownToolbar.insertBrandBlock")}</TooltipContent>
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
                : DIRECTIVE_SNIPPETS.map(({ labelKey, snippet }) => (
                    <DropdownMenuItem
                      key={labelKey}
                      onSelect={run((e) => insertDirective(e, snippet))}
                    >
                      {t(labelKey)}
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
