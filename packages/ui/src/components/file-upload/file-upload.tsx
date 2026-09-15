"use client";
// a2ui.exposed: no

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { X, Upload, FileIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { useLocale } from "../locale-provider";
import { Progress } from "../progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileUploadStatus = "pending" | "uploading" | "success" | "error";

export interface UploadFile {
  /** Unique identifier for this file in the list. */
  id: string;
  /** The underlying File object. */
  file: File;
  /** Upload progress 0–100. */
  progress?: number;
  /** Upload lifecycle status. */
  status?: FileUploadStatus;
  /** Error message shown when status is "error". */
  errorMessage?: string;
}

/** Why `addFiles` (picker OR drag-and-drop) declined a file. */
export type FileRejectionReason = "accept" | "maxSize" | "maxFiles" | "multiple";

export interface FileRejection {
  file: File;
  reason: FileRejectionReason;
}

/**
 * Match a file against an `<input accept>`-style pattern list (comma-separated
 * extensions like `.png`, exact MIME types like `image/png`, or wildcards like
 * `image/*`). Drag-and-drop delivers files straight from `DataTransfer` — the
 * browser only enforces `accept` for the native picker dialog, never for a
 * drop — so this has to be re-applied by hand for the drop path to actually
 * "respect `accept`".
 */
function fileMatchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const patterns = accept
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) return name.endsWith(pattern);
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}

function makeUploadFileId(file: File): string {
  return `${file.name}-${Date.now()}-${Math.random()}`;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface FileUploadContextValue {
  files: UploadFile[];
  addFiles: (incoming: File[]) => void;
  removeFile: (id: string) => void;
  isDragging: boolean;
  /** Programmatically open the native file picker. */
  openPicker: () => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  inputId: string;
}

/** Read `accept`/`multiple`/`maxSize`/`maxFiles` off a rejection for a default message. */
export function describeFileRejection(rejection: FileRejection): string {
  switch (rejection.reason) {
    case "accept":
      return `${rejection.file.name} is not an accepted file type.`;
    case "maxSize":
      return `${rejection.file.name} is too large.`;
    case "maxFiles":
      return `${rejection.file.name} was not added — the file limit was reached.`;
    case "multiple":
      return `${rejection.file.name} was not added — only one file is allowed.`;
    default:
      return `${rejection.file.name} was not added.`;
  }
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

function useFileUpload(): FileUploadContextValue {
  const ctx = use(FileUploadContext);
  if (!ctx) throw new Error("FileUpload subcomponents must be used inside <FileUpload>.");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider (FileUpload root)
// ---------------------------------------------------------------------------

export interface FileUploadProps extends HTMLAttributes<HTMLDivElement> {
  /** Controlled file list. */
  files?: UploadFile[];
  /** Called when files are added or removed. */
  onFilesChange?: (files: UploadFile[]) => void;
  /**
   * Called with the files a picker selection OR a drag-and-drop declined —
   * wrong type (`accept`), over `maxSize`, over `maxFiles`, or extra files
   * dropped when `multiple` is false — each with its {@link FileRejectionReason}.
   */
  onFilesRejected?: (rejections: FileRejection[]) => void;
  /** Accepted MIME types / extensions (forwarded to <input accept>). */
  accept?: string;
  /** Allow multiple files at once. */
  multiple?: boolean;
  /** Maximum individual file size in bytes. */
  maxSize?: number;
  /** Maximum number of files in the list at once. */
  maxFiles?: number;
  /** Disable all interactions. */
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * FileUpload — compound-component root (Provider).
 *
 * Holds the selected-file list + drag state and exposes
 * `{ files, addFiles, removeFile, isDragging }` via context.
 * **Presentational** — the app drives per-item `progress` + `status` on
 * `<FileUploadItem>`. No upload/network logic lives here.
 *
 * Controlled via `files`/`onFilesChange`; uncontrolled by default.
 */
export const FileUpload = forwardRef<HTMLDivElement, FileUploadProps>(function FileUpload(
  {
    files: filesProp,
    onFilesChange,
    onFilesRejected,
    accept,
    multiple = false,
    maxSize,
    maxFiles,
    disabled = false,
    className,
    children,
    ...props
  },
  ref,
) {
  const isControlled = filesProp !== undefined;
  const [internalFiles, setInternalFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const files = useMemo(
    () => (isControlled ? (filesProp ?? []) : internalFiles),
    [isControlled, filesProp, internalFiles],
  );

  const commit = useCallback(
    (next: UploadFile[]) => {
      if (!isControlled) setInternalFiles(next);
      onFilesChange?.(next);
    },
    [isControlled, onFilesChange],
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      const rejections: FileRejection[] = [];

      // A drop can deliver more files than the native picker ever would —
      // `multiple` is only enforced by the browser for the `<input>` dialog,
      // never for `DataTransfer`, so re-apply it here for the drop path too.
      let candidates = incoming;
      if (!multiple && candidates.length > 1) {
        rejections.push(
          ...candidates.slice(1).map((file) => ({ file, reason: "multiple" as const })),
        );
        candidates = candidates.slice(0, 1);
      }

      const toAdd: File[] = [];
      for (const f of candidates) {
        if (!fileMatchesAccept(f, accept)) {
          rejections.push({ file: f, reason: "accept" });
          continue;
        }
        if (maxSize && f.size > maxSize) {
          rejections.push({ file: f, reason: "maxSize" });
          continue;
        }
        toAdd.push(f);
      }

      const next = [...files];
      for (const f of toAdd) {
        if (maxFiles && next.length >= maxFiles) {
          rejections.push({ file: f, reason: "maxFiles" });
          continue;
        }
        next.push({ id: makeUploadFileId(f), file: f });
      }

      commit(next);
      if (rejections.length > 0) onFilesRejected?.(rejections);
    },
    [files, accept, multiple, maxSize, maxFiles, commit, onFilesRejected],
  );

  const removeFile = useCallback(
    (id: string) => {
      commit(files.filter((f) => f.id !== id));
    },
    [files, commit],
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(Array.from(e.target.files));
        // Reset so the same file can be re-selected
        e.target.value = "";
      }
    },
    [addFiles],
  );

  const ctx = useMemo<FileUploadContextValue>(
    () => ({
      files,
      addFiles,
      removeFile,
      isDragging,
      openPicker,
      accept,
      multiple,
      maxSize,
      maxFiles,
      disabled,
      inputId,
    }),
    [
      files,
      addFiles,
      removeFile,
      isDragging,
      openPicker,
      accept,
      multiple,
      maxSize,
      maxFiles,
      disabled,
      inputId,
    ],
  );

  return (
    <FileUploadContext value={ctx}>
      <div
        ref={ref}
        data-slot="file-upload"
        data-disabled={disabled || undefined}
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        {/* Visually hidden real file input — always present for keyboard users */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          onChange={handleInputChange}
        />
        {/* Drag state setter lives here so any child drag interaction is captured */}
        <div
          onDragEnter={() => {
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            // Only clear dragging when leaving the root container
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDragOver={(e: DragEvent) => {
            e.preventDefault();
          }}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (!disabled && e.dataTransfer.files.length > 0) {
              addFiles(Array.from(e.dataTransfer.files));
            }
          }}
          className="contents"
        >
          {children}
        </div>
      </div>
    </FileUploadContext>
  );
});

// ---------------------------------------------------------------------------
// FileUploadDropzone
// ---------------------------------------------------------------------------

export interface FileUploadDropzoneProps extends HTMLAttributes<HTMLElement> {
  /** Label for the visually-hidden file picker link (for SR users). */
  browseLabel?: string;
}

/**
 * FileUploadDropzone — the drag-and-drop target.
 *
 * Uses a `<label>` wrapping the hidden `<input>` so the ENTIRE zone is ONE hit
 * target — no `<div onClick>`.  Keyboard users get the Browse button as a
 * complementary path.
 */
export const FileUploadDropzone = forwardRef<HTMLElement, FileUploadDropzoneProps>(
  function FileUploadDropzone({ className, children, browseLabel, ...props }, ref) {
    const { isDragging, disabled, inputId, openPicker } = useFileUpload();
    const { t } = useLocale();
    const resolvedBrowseLabel = browseLabel ?? t("ui.fileUpload.browseFiles");

    return (
      // label wraps the hidden input — clicking anywhere on the zone opens the
      // picker. A `<label>` is not itself keyboard-operable (no native
      // Enter/Space activation and, since the input carries `tabIndex={-1}`,
      // nothing here is in the tab order) — that leaves a custom-`children`
      // dropzone with no keyboard path at all, so this also owns its own
      // tab stop + Enter/Space handling.
      <label
        ref={ref as React.Ref<HTMLLabelElement>}
        htmlFor={inputId}
        tabIndex={disabled ? undefined : 0}
        role="button"
        aria-disabled={disabled || undefined}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        data-slot="file-upload-dropzone"
        data-dragging={isDragging || undefined}
        data-disabled={disabled || undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-strong bg-surface-muted px-6 py-10",
          "cursor-pointer transition-colors duration-fast",
          "hover:border-ring hover:bg-accent/50",
          "data-[dragging]:border-primary data-[dragging]:bg-primary/5",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          "focus-ring-within focus-within:ring-offset-2 focus-within:ring-offset-background",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-body font-medium text-foreground">
                {t("ui.fileUpload.dragDropHere")}
              </p>
              <p className="text-meta text-muted-foreground">
                or{" "}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    openPicker();
                  }}
                  className={cn(
                    // #399 — inline text trigger inside a sentence → `-text` rung.
                    "text-primary-text underline-offset-2 hover:underline focus-ring rounded-sm",
                    // #322 — the dropzone's `focus-ring-within` (above) is the
                    // one compound indicator for this composite control; this
                    // button delegates rather than painting a second one.
                    "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {resolvedBrowseLabel}
                </button>
              </p>
            </div>
          </>
        )}
      </label>
    );
  },
);

// ---------------------------------------------------------------------------
// FileUploadList
// ---------------------------------------------------------------------------

export type FileUploadListProps = HTMLAttributes<HTMLUListElement>;

/**
 * FileUploadList — the `role="status"` region that lists accepted files.
 * Reads from context; children are `<FileUploadItem>` elements.
 */
export const FileUploadList = forwardRef<HTMLUListElement, FileUploadListProps>(
  function FileUploadList({ className, children, ...props }, ref) {
    const { files } = useFileUpload();
    const { t } = useLocale();
    if (files.length === 0 && !children) return null;

    return (
      // `aria-live="polite"` alone is enough to announce additions/removals —
      // it does NOT require `role="status"`. Adding that role here used to
      // override the `<ul>`'s implicit `list` role, which strips the
      // `listitem` role from every `<FileUploadItem>` (`<li>`) inside it and
      // fails axe's `listitem` rule the moment the list is non-empty.
      <ul
        ref={ref}
        aria-live="polite"
        aria-label={t("ui.fileUpload.selectedFiles")}
        data-slot="file-upload-list"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {children}
      </ul>
    );
  },
);

// ---------------------------------------------------------------------------
// FileUploadItem
// ---------------------------------------------------------------------------

export interface FileUploadItemProps extends HTMLAttributes<HTMLLIElement> {
  /** The UploadFile entry to display. */
  uploadFile: UploadFile;
  /** Upload progress 0–100. Shown only during "uploading" status. */
  progress?: number;
  /** Current status of the upload. */
  status?: FileUploadStatus;
  /** Error message (displayed when status="error"). */
  errorMessage?: string;
}

const statusIcon: Record<FileUploadStatus, ReactNode> = {
  pending: <FileIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
  uploading: <FileIcon className="size-4 text-primary" aria-hidden="true" />,
  success: <CheckCircle2 className="size-4 text-success" aria-hidden="true" />,
  error: <AlertCircle className="size-4 text-destructive" aria-hidden="true" />,
};

/**
 * FileUploadItem — a single row in the file list.
 *
 * The app controls `progress` and `status` to drive the upload lifecycle.
 * Per-file errors use `role="alert"`.
 */
export const FileUploadItem = forwardRef<HTMLLIElement, FileUploadItemProps>(
  function FileUploadItem(
    { uploadFile, progress, status = "pending", errorMessage, className, ...props },
    ref,
  ) {
    const { removeFile, disabled } = useFileUpload();
    const resolvedProgress = progress ?? uploadFile.progress;
    const resolvedStatus = status ?? uploadFile.status ?? "pending";
    const resolvedError = errorMessage ?? uploadFile.errorMessage;

    const isUploading = resolvedStatus === "uploading";
    const isError = resolvedStatus === "error";

    return (
      <li
        ref={ref}
        data-slot="file-upload-item"
        data-status={resolvedStatus}
        className={cn(
          "flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {statusIcon[resolvedStatus]}
          <span className="flex-1 min-w-0 truncate text-body text-foreground">
            {uploadFile.file.name}
          </span>
          <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
            {formatFileSize(uploadFile.file.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${uploadFile.file.name}`}
            disabled={disabled}
            onClick={() => removeFile(uploadFile.id)}
            className="shrink-0"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {isUploading && resolvedProgress !== undefined && (
          <Progress value={resolvedProgress} className="h-1" />
        )}
        {isError && resolvedError && (
          // #124: this is running text (the rejection reason), so it takes the
          // >=4.5:1 ink rung `text-destructive-text` — not the 3:1 mark rung the
          // `statusIcon.error` glyph above correctly keeps.
          <p role="alert" className="text-meta text-destructive-text">
            {resolvedError}
          </p>
        )}
      </li>
    );
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}\u00A0B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}\u00A0KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}\u00A0MB`;
}

// ---------------------------------------------------------------------------
// useFileUpload export (for advanced consumers outside a subpart)
// ---------------------------------------------------------------------------
export { useFileUpload };
