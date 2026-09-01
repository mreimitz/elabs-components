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
      const toAdd = incoming.filter((f) => {
        if (maxSize && f.size > maxSize) return false;
        return true;
      });

      const next = [...files];
      for (const f of toAdd) {
        if (maxFiles && next.length >= maxFiles) break;
        next.push({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f });
      }
      commit(next);
    },
    [files, maxSize, maxFiles, commit],
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
  function FileUploadDropzone(
    { className, children, browseLabel = "Browse files", ...props },
    ref,
  ) {
    const { isDragging, disabled, inputId, openPicker } = useFileUpload();

    return (
      // label wraps the hidden input — clicking anywhere on the zone opens the picker
      <label
        ref={ref as React.Ref<HTMLLabelElement>}
        htmlFor={inputId}
        data-slot="file-upload-dropzone"
        data-dragging={isDragging || undefined}
        data-disabled={disabled || undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-strong bg-surface-muted px-6 py-10",
          "cursor-pointer transition-colors duration-fast",
          "hover:border-ring hover:bg-accent/50",
          "data-[dragging]:border-primary data-[dragging]:bg-primary/5",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
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
              <p className="text-sm font-medium text-foreground">Drag & drop files here</p>
              <p className="text-xs text-muted-foreground">
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
                    "text-primary-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {browseLabel}
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
        aria-label="Selected files"
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
          <span className="flex-1 min-w-0 truncate text-sm text-foreground">
            {uploadFile.file.name}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
          <p role="alert" className="text-xs text-destructive-text">
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
