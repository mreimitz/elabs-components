"use client";

/**
 * Document library — a data room with the file open beside the list.
 *
 * One `FileViewer` handles every row: markdown renders as a document, CSV as a table, JSON and
 * code with syntax colours, a log as text, an image as an image — each through an adapter that
 * is loaded only when a file of that kind is opened. The toolbar, find-in-document
 * (Ctrl/Cmd + F inside the frame) and zoom are the viewer's own parts.
 *
 * Copy-own it: `npx shadcn add document-library-01`.
 */
import { Badge, Input, fileIconFor } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  FileViewerContent,
  FileViewerFind,
  FileViewerFrame,
  FileViewerPager,
  FileViewerProvider,
  FileViewerRotate,
  FileViewerToolbar,
  FileViewerZoom,
} from "@elabs-ai/components-viewer";
import { Search } from "lucide-react";
import { createElement, useMemo, useState } from "react";
import { DATA_ROOM, type DataRoomFile } from "@/components/document-parts/files";

const FOLDERS = ["Contracts", "Quality", "Operations"] as const;

const size = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export interface DocumentLibraryProps {
  files?: DataRoomFile[];
  /** The file that is open first. Default: the first one. */
  defaultFileId?: string;
  className?: string;
}

export function DocumentLibrary({
  files = DATA_ROOM,
  defaultFileId,
  className,
}: DocumentLibraryProps) {
  const [openId, setOpenId] = useState(defaultFileId ?? files[0]?.id);
  const [query, setQuery] = useState("");
  const open = files.find((file) => file.id === openId) ?? files[0];

  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle
        ? files.filter((file) =>
            `${file.source.name} ${file.owner} ${file.folder}`.toLowerCase().includes(needle),
          )
        : files,
    [files, needle],
  );

  return (
    <div
      className={cn(
        "@container flex h-[40rem] w-full overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
      data-slot="document-library"
    >
      <div className="flex w-full flex-col @3xl:flex-row">
        <nav
          aria-label="Files"
          className="flex max-h-56 min-h-0 w-full shrink-0 flex-col border-b border-border @3xl:max-h-none @3xl:w-80 @3xl:border-e @3xl:border-b-0"
        >
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-body font-semibold text-foreground">Supplier data room</h2>
              <span className="text-meta tabular-nums text-muted-foreground">
                {shown.length} of {files.length}
              </span>
            </div>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Filter files"
                className="ps-8"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by name, folder or owner"
                value={query}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {shown.length === 0 ? (
              <p className="p-3 text-body-sm text-muted-foreground">No file matches “{query}”.</p>
            ) : null}
            {FOLDERS.map((folder) => {
              const inFolder = shown.filter((file) => file.folder === folder);
              if (inFolder.length === 0) return null;
              return (
                <section aria-label={folder} className="mb-2" key={folder}>
                  <h3 className="px-2 py-1 text-meta font-semibold text-muted-foreground uppercase">
                    {folder}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {inFolder.map((file) => {
                      const current = file.id === open?.id;
                      return (
                        <li key={file.id}>
                          <button
                            aria-current={current ? "true" : undefined}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-start transition-colors duration-fast focus-ring",
                              current
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-muted hover:text-foreground",
                            )}
                            onClick={() => setOpenId(file.id)}
                            type="button"
                          >
                            {createElement(fileIconFor(file.source.name), {
                              "aria-hidden": true,
                              className: "mt-0.5 size-4 shrink-0 text-muted-foreground",
                            })}
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-body-sm font-semibold">
                                {file.source.name}
                              </span>
                              <span className="truncate text-meta text-muted-foreground">
                                {file.owner} · {size(file.size)} · {day(file.modified)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {open ? (
            <FileViewerProvider key={open.id} source={open.source}>
              <p className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-meta text-muted-foreground">
                <Badge variant="outline">{open.folder}</Badge>
                <span>
                  {open.owner} · {size(open.size)} · updated {day(open.modified)}
                </span>
              </p>
              <FileViewerFrame className="min-h-0 flex-1 rounded-none border-0">
                <FileViewerToolbar>
                  <FileViewerPager />
                  <FileViewerZoom />
                  <FileViewerRotate />
                </FileViewerToolbar>
                <FileViewerFind />
                <FileViewerContent />
              </FileViewerFrame>
            </FileViewerProvider>
          ) : null}
        </div>
      </div>
    </div>
  );
}
