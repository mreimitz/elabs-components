"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  fileIconFor,
} from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRightIcon,
  DatabaseIcon,
  FileCode2Icon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  TableIcon,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { createContext, forwardRef, useCallback, useContext, useMemo, useState } from "react";
import type { ContextAsset, ContextAssetType } from "./context-panel";

interface FileTreeContextType {
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

// Default noop for context default value
// oxlint-disable-next-line eslint(no-empty-function)
const noop = () => {};

const FileTreeContext = createContext<FileTreeContextType>({
  // oxlint-disable-next-line eslint-plugin-unicorn(no-new-builtin)
  expandedPaths: new Set(),
  togglePath: noop,
});

/**
 * Visual axis (#193, research 04 §4 ASSET-1): `code` (default, unchanged) is
 * the IDE source tree — mono + hard box; `document` is the produced-asset
 * look — sans body role, no box (section label + spacing separate it,
 * research 08), for trees of documents rather than source files.
 */
const fileTreeVariants = cva("", {
  variants: {
    variant: {
      code: "rounded-lg border bg-background font-mono text-sm",
      document: "text-body",
    },
  },
  defaultVariants: { variant: "code" },
});

export type FileTreeVariant = NonNullable<VariantProps<typeof fileTreeVariants>["variant"]>;

export type FileTreeProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> &
  VariantProps<typeof fileTreeVariants> & {
    expanded?: Set<string>;
    defaultExpanded?: Set<string>;
    selectedPath?: string;
    onSelect?: (path: string) => void;
    onExpandedChange?: (expanded: Set<string>) => void;
  };

export const FileTree = forwardRef<HTMLDivElement, FileTreeProps>(function FileTree(
  {
    expanded: controlledExpanded,
    defaultExpanded = new Set(),
    selectedPath,
    onSelect,
    onExpandedChange,
    variant,
    className,
    children,
    ...props
  },
  ref,
) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expandedPaths = controlledExpanded ?? internalExpanded;

  const togglePath = useCallback(
    (path: string) => {
      const newExpanded = new Set(expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      setInternalExpanded(newExpanded);
      onExpandedChange?.(newExpanded);
    },
    [expandedPaths, onExpandedChange],
  );

  const contextValue = useMemo(
    () => ({ expandedPaths, onSelect, selectedPath, togglePath }),
    [expandedPaths, onSelect, selectedPath, togglePath],
  );

  return (
    <FileTreeContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cn(fileTreeVariants({ variant }), className)}
        role="tree"
        {...props}
      >
        <div className={cn(variant === "document" ? undefined : "p-2")}>{children}</div>
      </div>
    </FileTreeContext.Provider>
  );
});

export type FileTreeIconProps = HTMLAttributes<HTMLSpanElement>;

export const FileTreeIcon = ({ className, children, ...props }: FileTreeIconProps) => (
  <span className={cn("shrink-0", className)} {...props}>
    {children}
  </span>
);

export type FileTreeNameProps = HTMLAttributes<HTMLSpanElement>;

export const FileTreeName = ({ className, children, ...props }: FileTreeNameProps) => (
  <span className={cn("truncate", className)} {...props}>
    {children}
  </span>
);

interface FileTreeFolderContextType {
  path: string;
  name: string;
  isExpanded: boolean;
}

const FileTreeFolderContext = createContext<FileTreeFolderContextType>({
  isExpanded: false,
  name: "",
  path: "",
});

export type FileTreeFolderProps = HTMLAttributes<HTMLDivElement> & {
  path: string;
  name: string;
};

export const FileTreeFolder = ({
  path,
  name,
  className,
  children,
  ...props
}: FileTreeFolderProps) => {
  const { expandedPaths, togglePath, selectedPath, onSelect } = useContext(FileTreeContext);
  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;

  const handleOpenChange = useCallback(() => {
    togglePath(path);
  }, [togglePath, path]);

  const handleSelect = useCallback(() => {
    onSelect?.(path);
  }, [onSelect, path]);

  const folderContextValue = useMemo(() => ({ isExpanded, name, path }), [isExpanded, name, path]);

  return (
    <FileTreeFolderContext.Provider value={folderContextValue}>
      <Collapsible onOpenChange={handleOpenChange} open={isExpanded}>
        <div className={cn("", className)} role="treeitem" tabIndex={0} {...props}>
          <div
            className={cn(
              "flex w-full items-center gap-1 rounded px-2 py-1 text-start transition-colors hover:bg-muted/50",
              isSelected && "bg-muted",
            )}
          >
            <CollapsibleTrigger asChild>
              <button
                className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0"
                type="button"
              >
                <ChevronRightIcon
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-90",
                  )}
                  data-rtl-flip
                />
              </button>
            </CollapsibleTrigger>
            <button
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-start"
              onClick={handleSelect}
              type="button"
            >
              <FileTreeIcon>
                {isExpanded ? (
                  <FolderOpenIcon className="size-4 text-primary" />
                ) : (
                  <FolderIcon className="size-4 text-primary" />
                )}
              </FileTreeIcon>
              <FileTreeName>{name}</FileTreeName>
            </button>
          </div>
          <CollapsibleContent>
            <div className="ms-4 border-s ps-2">{children}</div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </FileTreeFolderContext.Provider>
  );
};

interface FileTreeFileContextType {
  path: string;
  name: string;
}

const FileTreeFileContext = createContext<FileTreeFileContextType>({
  name: "",
  path: "",
});

export type FileTreeFileProps = HTMLAttributes<HTMLDivElement> & {
  path: string;
  name: string;
  icon?: ReactNode;
};

export const FileTreeFile = ({
  path,
  name,
  icon,
  className,
  children,
  ...props
}: FileTreeFileProps) => {
  const { selectedPath, onSelect } = useContext(FileTreeContext);
  const isSelected = selectedPath === path;

  const handleClick = useCallback(() => {
    onSelect?.(path);
  }, [onSelect, path]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        onSelect?.(path);
      }
    },
    [onSelect, path],
  );

  const fileContextValue = useMemo(() => ({ name, path }), [name, path]);

  return (
    <FileTreeFileContext.Provider value={fileContextValue}>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-muted/50",
          isSelected && "bg-muted",
          className,
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        {...props}
      >
        {children ?? (
          <>
            {/* Spacer for alignment */}
            <span className="size-4 shrink-0" />
            <FileTreeIcon>
              {icon ?? <FileIcon className="size-4 text-muted-foreground" />}
            </FileTreeIcon>
            <FileTreeName>{name}</FileTreeName>
          </>
        )}
      </div>
    </FileTreeFileContext.Provider>
  );
};

export type FileTreeActionsProps = HTMLAttributes<HTMLDivElement>;

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FileTreeActions = ({ className, children, ...props }: FileTreeActionsProps) => (
  <div
    className={cn("ms-auto flex items-center gap-1", className)}
    onClick={stopPropagation}
    onKeyDown={stopPropagation}
    role="group"
    {...props}
  >
    {children}
  </div>
);

/** Asset-type glyphs (lucide, research 04 §4) — doc / code / sql / csv / image. */
export const PRODUCED_ASSET_ICONS: Record<ContextAssetType, LucideIcon> = {
  markdown: FileTextIcon,
  code: FileCode2Icon,
  sql: DatabaseIcon,
  csv: TableIcon,
  image: ImageIcon,
};

/**
 * The glyph for one asset.
 *
 * A FILE-BACKED asset (`source` set — a PDF, a deck, a video reaching the rail
 * through `AssetPreview`'s `renderPreview` seam) carries a `type` from a closed
 * five-member union that cannot describe it, so the type-keyed glyph above
 * would lie: a PDF typed `code` would draw a code glyph. Its name and MIME do
 * know, so those go through the shared resolver instead (ADR 0024 §6).
 *
 * An asset with inline `content` keeps the type-keyed glyph exactly as before —
 * for those the author's `type` is the better answer, not a guess from a
 * filename.
 */
function assetIcon(asset: ContextAsset): LucideIcon {
  return asset.source ? fileIconFor(asset.name, asset.mediaType) : PRODUCED_ASSET_ICONS[asset.type];
}

export type ProducedAssetTreeProps = Omit<
  FileTreeProps,
  "variant" | "onSelect" | "selectedPath"
> & {
  /** The produced assets, in display order. */
  assets: ContextAsset[];
  /** Selected asset id (mirror `useContextPanel().state.selectedAsset?.id`). */
  selectedId?: string;
  /** Called with the chosen asset — wire to `useContextPanel().actions.openDetail`. */
  onSelect?: (asset: ContextAsset) => void;
};

/**
 * ProducedAssetTree — the document-variant preset (#193, research 04 §4):
 * produced assets are documents, not source code, so the tree reads sans,
 * box-free, with first-class asset-type icons. Pair with `ContextPanelSection`
 * for the label; selection drives the ContextPanel drill-in.
 */
export const ProducedAssetTree = forwardRef<HTMLDivElement, ProducedAssetTreeProps>(
  function ProducedAssetTree({ assets, selectedId, onSelect, ...props }, ref) {
    const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
    const handleSelect = useCallback(
      (path: string) => {
        const asset = assetsById.get(path);
        if (asset) onSelect?.(asset);
      },
      [assetsById, onSelect],
    );
    return (
      <FileTree
        ref={ref}
        variant="document"
        selectedPath={selectedId}
        onSelect={handleSelect}
        {...props}
      >
        {assets.length === 0 ? (
          <p className="px-2 py-1 text-body text-muted-foreground">No assets produced yet.</p>
        ) : (
          assets.map((asset) => {
            const Icon = assetIcon(asset);
            return (
              <FileTreeFile key={asset.id} path={asset.id} name={asset.name}>
                <FileTreeIcon>
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                </FileTreeIcon>
                <FileTreeName>{asset.name}</FileTreeName>
              </FileTreeFile>
            );
          })
        )}
      </FileTree>
    );
  },
);
