"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@qlik-coe-emea/qlabs-components-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qlik-coe-emea/qlabs-components-ui";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@qlik-coe-emea/qlabs-components-ui";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@qlik-coe-emea/qlabs-components-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qlik-coe-emea/qlabs-components-ui";
import { Spinner } from "@qlik-coe-emea/qlabs-components-ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { useLocale } from "@qlik-coe-emea/qlabs-components-ui";
import type { ChatStatus, FileUIPart, SourceDocumentUIPart } from "ai";
import { CornerDownLeftIcon, ImageIcon, Monitor, PlusIcon, SquareIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import type {
  ChangeEvent,
  ChangeEventHandler,
  ClipboardEventHandler,
  ComponentProps,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
  KeyboardEventHandler,
  PropsWithChildren,
  ReactNode,
  RefObject,
} from "react";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Helpers
// ============================================================================

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    // FileReader uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    return new Promise((resolve) => {
      const reader = new FileReader();
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      reader.onloadend = () => resolve(reader.result as string);
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const captureScreenshot = async (): Promise<File | null> => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return null;
  }

  let stream: MediaStream | null = null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: true,
    });

    video.srcObject = stream;

    // Video element uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    await new Promise<void>((resolve, reject) => {
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      video.onloadedmetadata = () => resolve();
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      video.onerror = () => reject(new Error("Failed to load screen stream"));
    });

    await video.play();

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    // canvas.toBlob uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
      return null;
    }

    const timestamp = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");

    return new File([blob], `screenshot-${timestamp}.png`, {
      lastModified: Date.now(),
      type: "image/png",
    });
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    video.pause();
    video.srcObject = null;
  }
};

// ============================================================================
// Provider Context & Types
// ============================================================================

export interface AttachmentsContext {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export interface TextInputContext {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
}

export interface PromptInputControllerProps {
  textInput: TextInputContext;
  attachments: AttachmentsContext;
  /** INTERNAL: Allows PromptInput to register its file textInput + "open" callback */
  __registerFileInput: (ref: RefObject<HTMLInputElement | null>, open: () => void) => void;
}

const PromptInputController = createContext<PromptInputControllerProps | null>(null);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController().",
    );
  }
  return ctx;
};

// Optional variants (do NOT throw). Useful for dual-mode components.
const useOptionalPromptInputController = () => useContext(PromptInputController);

export const useProviderAttachments = () => {
  const ctx = useContext(ProviderAttachmentsContext);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments().",
    );
  }
  return ctx;
};

const useOptionalProviderAttachments = () => useContext(ProviderAttachmentsContext);

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
}>;

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- attachments state (global when wrapped)
  const [attachmentFiles, setAttachmentFiles] = useState<(FileUIPart & { id: string })[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // oxlint-disable-next-line eslint(no-empty-function)
  const openRef = useRef<() => void>(() => {});

  const add = useCallback((files: File[] | FileList) => {
    const incoming = [...files];
    if (incoming.length === 0) {
      return;
    }

    setAttachmentFiles((prev) => [
      ...prev,
      ...incoming.map((file) => ({
        filename: file.name,
        id: nanoid(),
        mediaType: file.type,
        type: "file" as const,
        url: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    setAttachmentFiles((prev) => {
      const found = prev.find((f) => f.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachmentFiles((prev) => {
      for (const f of prev) {
        if (f.url) {
          URL.revokeObjectURL(f.url);
        }
      }
      return [];
    });
  }, []);

  // Keep a ref to attachments for cleanup on unmount (avoids stale closure)
  const attachmentsRef = useRef(attachmentFiles);

  useEffect(() => {
    attachmentsRef.current = attachmentFiles;
  }, [attachmentFiles]);

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(
    () => () => {
      for (const f of attachmentsRef.current) {
        if (f.url) {
          URL.revokeObjectURL(f.url);
        }
      }
    },
    [],
  );

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear,
      fileInputRef,
      files: attachmentFiles,
      openFileDialog,
      remove,
    }),
    [attachmentFiles, add, remove, clear, openFileDialog],
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    [],
  );

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      __registerFileInput,
      attachments,
      textInput: {
        clear: clearInput,
        setInput: setTextInput,
        value: textInput,
      },
    }),
    [textInput, clearInput, attachments, __registerFileInput],
  );

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  );
};

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

/**
 * Submit-readiness, lifted into `PromptInput` so the guard and the affordance
 * agree. `handleSubmit` is the invariant (it is reachable via `requestSubmit()`
 * or a consumer's own button); `PromptInputSubmit`'s disabled state is the
 * affordance. Both read `canSubmit` — a live-looking button that does nothing
 * is an accessibility lie, and a guard nobody can see is a dead end.
 */
interface PromptInputSubmitStateContextValue {
  /** Non-whitespace text, or at least one attachment. */
  canSubmit: boolean;
  /**
   * INTERNAL — the uncontrolled textarea reports empty↔non-empty transitions.
   * A boolean, so React bails out on identical state and typing does not make
   * an uncontrolled input re-render per keystroke.
   */
  setHasText: (hasText: boolean) => void;
  /**
   * True while at least one `PromptInputStop` is mounted (#351). When a
   * consumer composes a dedicated Stop control, `PromptInputSubmit` never
   * needs to double as Stop — it stays the Send action in every state.
   */
  hasDedicatedStop: boolean;
  /** Registers a mounted `PromptInputStop`; returns its unregister fn. */
  registerStop: () => () => void;
}

const PromptInputSubmitStateContext = createContext<PromptInputSubmitStateContextValue | null>(
  null,
);

/** Optional — `PromptInputSubmit` may legitimately render outside a `PromptInput`. */
const useOptionalSubmitState = () => useContext(PromptInputSubmitStateContext);

/** The `data-slot` the Enter handler uses to find the send control. */
const SUBMIT_SLOT = "prompt-input-submit";

export const usePromptInputAttachments = () => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const context = local ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider",
    );
  }
  return context;
};

// ============================================================================
// Referenced Sources (Local to PromptInput)
// ============================================================================

export interface ReferencedSourcesContext {
  sources: (SourceDocumentUIPart & { id: string })[];
  add: (sources: SourceDocumentUIPart[] | SourceDocumentUIPart) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const LocalReferencedSourcesContext = createContext<ReferencedSourcesContext | null>(null);

export const usePromptInputReferencedSources = () => {
  const ctx = useContext(LocalReferencedSourcesContext);
  if (!ctx) {
    throw new Error(
      "usePromptInputReferencedSources must be used within a LocalReferencedSourcesContext.Provider",
    );
  }
  return ctx;
};

export type PromptInputActionAddAttachmentsProps = ComponentProps<typeof DropdownMenuItem> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  const handleSelect = useCallback(
    (e: Event) => {
      e.preventDefault();
      attachments.openFileDialog();
    },
    [attachments],
  );

  return (
    <DropdownMenuItem {...props} onSelect={handleSelect}>
      <ImageIcon className="me-2 size-4" /> {label}
    </DropdownMenuItem>
  );
};

export type PromptInputActionAddScreenshotProps = ComponentProps<typeof DropdownMenuItem> & {
  label?: string;
};

export const PromptInputActionAddScreenshot = ({
  label = "Take screenshot",
  onSelect,
  ...props
}: PromptInputActionAddScreenshotProps) => {
  const attachments = usePromptInputAttachments();

  const handleSelect = useCallback(
    async (event: Event) => {
      onSelect?.(event);
      if (event.defaultPrevented) {
        return;
      }

      try {
        const screenshot = await captureScreenshot();
        if (screenshot) {
          attachments.add([screenshot]);
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "AbortError")
        ) {
          return;
        }
        throw error;
      }
    },
    [onSelect, attachments],
  );

  return (
    <DropdownMenuItem {...props} onSelect={handleSelect}>
      <Monitor className="me-2 size-4" />
      {label}
    </DropdownMenuItem>
  );
};

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit" | "onError"> & {
  // e.g., "image/*" or leave undefined for any
  accept?: string;
  multiple?: boolean;
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean;
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean;
  // Minimal constraints
  maxFiles?: number;
  // bytes
  maxFileSize?: number;
  /**
   * The fill of the inner well (the `InputGroup` `variant`). `"surface"`
   * (default) is the standard muted composer look; `"card"` renders a
   * `bg-card` well for nesting inside an already-tinted outer frame — the
   * "double card" look (#254). e.g.
   * `<div className="rounded-xl bg-surface-muted p-1.5"><PromptInput tone="card">…</PromptInput></div>`.
   * The well fill is NOT universally "white": `--card` reads lighter
   * (raised) than `--surface-muted` on light themes, but darker (recessed) on
   * qlik-dark and blueprint — the same theme-dependent trade-off documented
   * for `bg-surface-muted`-as-a-well in `styling-and-tokens.md`. The well
   * stays a legible, distinct tone against the outer frame in every theme;
   * only the "raised" framing is light-themes-specific.
   */
  tone?: "surface" | "card";
  onError?: (err: { code: "max_files" | "max_file_size" | "accept"; message: string }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
  /**
   * Classes for the inner surface (the visible `InputGroup` well), e.g. to shape
   * its corners. `className` styles the outer `<form>`; this styles the well —
   * the only way to reach it from outside (used by `Composer`).
   */
  surfaceClassName?: string;
};

export const PromptInput = ({
  className,
  surfaceClassName,
  tone = "surface",
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  // Microcopy goes through the locale seam. `useLocale` is provider-optional —
  // with no <LocaleProvider> it returns the shipped English defaults, so this is
  // not a breaking change and needs no ancestor. See ADR 0017.
  const { t } = useLocale();

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // ----- Local attachments (only used when no provider)
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const files = usingProvider ? controller.attachments.files : items;

  // ----- Submit readiness (drives both the guard and the disabled affordance)
  const [hasLocalText, setHasLocalText] = useState(false);
  const hasText = usingProvider ? controller.textInput.value.trim().length > 0 : hasLocalText;

  // ----- Dedicated Stop control registration (#351 — the composed "separate"
  // arrangement). A ref counter tolerates >1 mounted PromptInputStop; the
  // boolean state is what's actually read, so React bails out on identical
  // values the same way `setHasText` does.
  const [hasDedicatedStop, setHasDedicatedStop] = useState(false);
  const stopCountRef = useRef(0);
  const registerStop = useCallback(() => {
    stopCountRef.current += 1;
    setHasDedicatedStop(true);
    return () => {
      stopCountRef.current = Math.max(0, stopCountRef.current - 1);
      if (stopCountRef.current === 0) {
        setHasDedicatedStop(false);
      }
    };
  }, []);

  // ----- Local referenced sources (always local to PromptInput)
  const [referencedSources, setReferencedSources] = useState<
    (SourceDocumentUIPart & { id: string })[]
  >([]);

  // Keep a ref to files for cleanup on unmount (avoids stale closure)
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") {
        return true;
      }

      const patterns = accept
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return patterns.some((pattern) => {
        if (pattern.endsWith("/*")) {
          // e.g: image/* -> image/
          const prefix = pattern.slice(0, -1);
          return f.type.startsWith(prefix);
        }
        return f.type === pattern;
      });
    },
    [accept],
  );

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: "accept",
          message: t("ai.promptInput.errorAccept"),
        });
        return;
      }
      const withinSize = (f: File) => (maxFileSize ? f.size <= maxFileSize : true);
      const sized = accepted.filter(withinSize);
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: t("ai.promptInput.errorMaxFileSize"),
        });
        return;
      }

      setItems((prev) => {
        const capacity =
          typeof maxFiles === "number" ? Math.max(0, maxFiles - prev.length) : undefined;
        const capped = typeof capacity === "number" ? sized.slice(0, capacity) : sized;
        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: t("ai.promptInput.errorMaxFiles"),
          });
        }
        const next: (FileUIPart & { id: string })[] = [];
        for (const file of capped) {
          next.push({
            filename: file.name,
            id: nanoid(),
            mediaType: file.type,
            type: "file",
            url: URL.createObjectURL(file),
          });
        }
        return [...prev, ...next];
      });
    },
    [matchesAccept, maxFiles, maxFileSize, onError],
  );

  const removeLocal = useCallback(
    (id: string) =>
      setItems((prev) => {
        const found = prev.find((file) => file.id === id);
        if (found?.url) {
          URL.revokeObjectURL(found.url);
        }
        return prev.filter((file) => file.id !== id);
      }),
    [],
  );

  // Wrapper that validates files before calling provider's add
  const addWithProviderValidation = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: "accept",
          message: t("ai.promptInput.errorAccept"),
        });
        return;
      }
      const withinSize = (f: File) => (maxFileSize ? f.size <= maxFileSize : true);
      const sized = accepted.filter(withinSize);
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: t("ai.promptInput.errorMaxFileSize"),
        });
        return;
      }

      const currentCount = files.length;
      const capacity =
        typeof maxFiles === "number" ? Math.max(0, maxFiles - currentCount) : undefined;
      const capped = typeof capacity === "number" ? sized.slice(0, capacity) : sized;
      if (typeof capacity === "number" && sized.length > capacity) {
        onError?.({
          code: "max_files",
          message: t("ai.promptInput.errorMaxFiles"),
        });
      }

      if (capped.length > 0) {
        controller?.attachments.add(capped);
      }
    },
    [matchesAccept, maxFileSize, maxFiles, onError, files.length, controller],
  );

  const clearAttachments = useCallback(
    () =>
      usingProvider
        ? controller?.attachments.clear()
        : setItems((prev) => {
            for (const file of prev) {
              if (file.url) {
                URL.revokeObjectURL(file.url);
              }
            }
            return [];
          }),
    [usingProvider, controller],
  );

  const clearReferencedSources = useCallback(() => setReferencedSources([]), []);

  const add = usingProvider ? addWithProviderValidation : addLocal;
  const remove = usingProvider ? controller.attachments.remove : removeLocal;
  const openFileDialog = usingProvider
    ? controller.attachments.openFileDialog
    : openFileDialogLocal;

  const clear = useCallback(() => {
    clearAttachments();
    clearReferencedSources();
  }, [clearAttachments, clearReferencedSources]);

  // Let provider know about our hidden file input so external menus can call openFileDialog()
  useEffect(() => {
    if (!usingProvider) {
      return;
    }
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = "";
    }
  }, [files, syncHiddenInput]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    if (globalDrop) {
      // when global drop is on, let the document-level handler own drops
      return;
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(
    () => () => {
      if (!usingProvider) {
        for (const f of filesRef.current) {
          if (f.url) {
            URL.revokeObjectURL(f.url);
          }
        }
      }
    },
    [usingProvider],
  );

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        add(event.currentTarget.files);
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = "";
    },
    [add],
  );

  const attachmentsCtx = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear: clearAttachments,
      fileInputRef: inputRef,
      files: files.map((item) => ({ ...item, id: item.id })),
      openFileDialog,
      remove,
    }),
    [files, add, remove, clearAttachments, openFileDialog],
  );

  const submitState = useMemo<PromptInputSubmitStateContextValue>(
    () => ({
      canSubmit: hasText || files.length > 0,
      hasDedicatedStop,
      registerStop,
      setHasText: setHasLocalText,
    }),
    [hasText, files.length, hasDedicatedStop, registerStop],
  );

  const refsCtx = useMemo<ReferencedSourcesContext>(
    () => ({
      add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => {
        const array = Array.isArray(incoming) ? incoming : [incoming];
        setReferencedSources((prev) => [...prev, ...array.map((s) => ({ ...s, id: nanoid() }))]);
      },
      clear: clearReferencedSources,
      remove: (id: string) => {
        setReferencedSources((prev) => prev.filter((s) => s.id !== id));
      },
      sources: referencedSources,
    }),
    [referencedSources, clearReferencedSources],
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const text = usingProvider
        ? controller.textInput.value
        : (() => {
            const formData = new FormData(form);
            return (formData.get("message") as string) || "";
          })();

      // Nothing to send: no text AND no attachments. This runs BEFORE the reset
      // below — a later guard would still have wiped the composer. Only the
      // guard trims; the untrimmed `text` still reaches `onSubmit`, preserving
      // the existing payload semantics. An attachments-only submit (no text) is
      // legitimate and must still go through.
      if (text.trim().length === 0 && files.length === 0) {
        return;
      }

      // Reset form immediately after capturing text to avoid race condition
      // where user input during async blob conversion would be lost
      if (!usingProvider) {
        form.reset();
        // `form.reset()` fires no change event, so tell the submit affordance.
        setHasLocalText(false);
      }

      try {
        // Convert blob URLs to data URLs asynchronously
        const convertedFiles: FileUIPart[] = await Promise.all(
          files.map(async ({ id: _id, ...item }) => {
            if (item.url?.startsWith("blob:")) {
              const dataUrl = await convertBlobUrlToDataUrl(item.url);
              // If conversion failed, keep the original blob URL
              return {
                ...item,
                url: dataUrl ?? item.url,
              };
            }
            return item;
          }),
        );

        const result = onSubmit({ files: convertedFiles, text }, event);

        // Handle both sync and async onSubmit
        if (result instanceof Promise) {
          try {
            await result;
            clear();
            if (usingProvider) {
              controller.textInput.clear();
            }
          } catch {
            // Don't clear on error - user may want to retry
          }
        } else {
          // Sync function completed without throwing, clear inputs
          clear();
          if (usingProvider) {
            controller.textInput.clear();
          }
        }
      } catch {
        // Don't clear on error - user may want to retry
      }
    },
    [usingProvider, controller, files, onSubmit, clear],
  );

  // Render with or without local provider
  const inner = (
    <>
      <input
        accept={accept}
        aria-label={t("ai.promptInput.uploadFiles")}
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title={t("ai.promptInput.uploadFiles")}
        type="file"
      />
      <form className={cn("w-full", className)} onSubmit={handleSubmit} ref={formRef} {...props}>
        {/* The composer is a soft fill + focus ring, not a hard box (#194,
            research 02 §3a BTN-3 / 08 §C.1): the chat footer already draws a
            `border-t` (chat-shell.tsx), so the box border was redundant. */}
        <InputGroup variant={tone} className={cn("overflow-hidden", surfaceClassName)}>
          {children}
        </InputGroup>
      </form>
    </>
  );

  const withReferencedSources = (
    <LocalReferencedSourcesContext.Provider value={refsCtx}>
      <PromptInputSubmitStateContext.Provider value={submitState}>
        {inner}
      </PromptInputSubmitStateContext.Provider>
    </LocalReferencedSourcesContext.Provider>
  );

  // Always provide LocalAttachmentsContext so children get validated add function
  return (
    <LocalAttachmentsContext.Provider value={attachmentsCtx}>
      {withReferencedSources}
    </LocalAttachmentsContext.Provider>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn("contents", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder,
  ...props
}: PromptInputTextareaProps) => {
  const { t } = useLocale();
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();
  const submitState = useOptionalSubmitState();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      // Call the external onKeyDown handler first
      onKeyDown?.(e);

      // If the external handler prevented default, don't run internal logic
      if (e.defaultPrevented) {
        return;
      }

      if (e.key === "Enter") {
        if (isComposing || e.nativeEvent.isComposing) {
          return;
        }
        if (e.shiftKey) {
          return;
        }
        e.preventDefault();

        // Don't submit when the send control is unavailable. Query by data-slot,
        // NOT `button[type="submit"]`: PromptInputSubmit flips to type="button"
        // while generating, so the old selector matched nothing mid-stream and
        // `null?.disabled` (undefined, falsy) let Enter send a second message.
        const { form } = e.currentTarget;
        const submitControl = form?.querySelector<HTMLButtonElement>(
          `[data-slot="${SUBMIT_SLOT}"]`,
        );
        // `data-action` is the current contract (#351): "stop" blocks Enter,
        // "send" (including the running+typed flip) lets it through. Fall back
        // to the older `data-generating` flag for a consumer-supplied control
        // that still only sets that attribute.
        const action =
          submitControl?.dataset.action ??
          (submitControl?.dataset.generating === "true" ? "stop" : undefined);
        // `aria-disabled` is checked alongside the real `disabled` property: the
        // resting empty-composer state marks the control aria-disabled so it stays
        // FOCUSABLE (a real `disabled` button is skipped by the tab order and
        // announces nothing), while a consumer-supplied `disabled` is a genuine
        // DOM disable. Enter must be refused for both.
        if (
          submitControl?.disabled ||
          submitControl?.getAttribute("aria-disabled") === "true" ||
          action === "stop"
        ) {
          return;
        }

        form?.requestSubmit();
      }

      // Remove last attachment when Backspace is pressed and textarea is empty
      if (e.key === "Backspace" && e.currentTarget.value === "" && attachments.files.length > 0) {
        e.preventDefault();
        const lastAttachment = attachments.files.at(-1);
        if (lastAttachment) {
          attachments.remove(lastAttachment.id);
        }
      }
    },
    [onKeyDown, isComposing, attachments],
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      const items = event.clipboardData?.items;

      if (!items) {
        return;
      }

      const files: File[] = [];

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        event.preventDefault();
        attachments.add(files);
      }
    },
    [attachments],
  );

  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);

  const controlledProps = controller
    ? {
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(e.currentTarget.value);
          onChange?.(e);
        },
        value: controller.textInput.value,
      }
    : {
        // Uncontrolled: report only the empty↔non-empty transition so the submit
        // affordance can enable/disable. Boolean state ⇒ React bails out on
        // identical values, so this stays cheap per keystroke.
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          submitState?.setHasText(e.currentTarget.value.trim().length > 0);
          onChange?.(e);
        },
      };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-10", className)}
      name="message"
      onCompositionEnd={handleCompositionEnd}
      onCompositionStart={handleCompositionStart}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder ?? t("ai.promptInput.placeholder")}
      {...props}
      {...controlledProps}
    />
  );
};

export type PromptInputHeaderProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputHeader = ({ className, ...props }: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props}
  />
);

export type PromptInputFooterProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn("flex min-w-0 items-center gap-1", className)} {...props} />
);

export type PromptInputButtonTooltip =
  | string
  | {
      content: ReactNode;
      shortcut?: string;
      side?: ComponentProps<typeof TooltipContent>["side"];
    };

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton> & {
  tooltip?: PromptInputButtonTooltip;
};

/**
 * True when `node` renders any visible text (a non-blank string/number node,
 * at any nesting depth) rather than icon-only content (bare SVGs/icon
 * components). Adapts the same "inspect the children's shape" notion the
 * size heuristic below uses (`Children.count(...) > 1`) to the question that
 * actually matters for the accessible name: is there a visible label already,
 * not merely how many top-level children there are.
 */
const hasVisibleText = (node: ReactNode): boolean => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node).trim().length > 0;
  }
  if (Array.isArray(node)) {
    return node.some(hasVisibleText);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return hasVisibleText(node.props.children);
  }
  return false;
};

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  tooltip,
  "aria-label": ariaLabelProp,
  ...props
}: PromptInputButtonProps) => {
  const newSize = size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  const tooltipContent = tooltip
    ? typeof tooltip === "string"
      ? tooltip
      : tooltip.content
    : undefined;

  // Icon-only buttons (Attach, Voice, …) commonly carry ONLY a tooltip and no
  // visible text, so the tooltip is the only description of what the button
  // does — default the accessible name to it. A button that already has a
  // VISIBLE TEXT label must NOT have that label replaced by the tooltip (WCAG
  // 2.5.3 Label in Name) — the derived name is opt-in to icon-only buttons
  // only. An explicit, DEFINED `aria-label` still wins over the derived
  // default; an explicitly-passed `aria-label={undefined}` must NOT clobber
  // it, so we pull `aria-label` out of `props` above (it is applied, as the
  // final computed value, AFTER the `{...props}` spread below — the spread
  // can no longer reintroduce the `undefined` key over it).
  const isIconOnly = !hasVisibleText(props.children);
  const ariaLabel =
    ariaLabelProp ??
    (isIconOnly && typeof tooltipContent === "string" ? tooltipContent : undefined);

  const button = (
    <InputGroupButton
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
      aria-label={ariaLabel}
    />
  );

  if (!tooltip) {
    return button;
  }

  const shortcut = typeof tooltip === "string" ? undefined : tooltip.shortcut;
  const side = typeof tooltip === "string" ? "top" : (tooltip.side ?? "top");

  // Self-provide so the button works anywhere — a consumer rendering a bare
  // composer (a block, a story) shouldn't have to remember to mount a global
  // TooltipProvider. Mirrors the ThemeSwitcher self-provision convention.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={side}>
          {tooltipContent}
          {shortcut && <span className="ms-2 text-muted-foreground">{shortcut}</span>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<typeof DropdownMenuContent>;
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export type PromptInputActionMenuItemProps = ComponentProps<typeof DropdownMenuItem>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => <DropdownMenuItem className={cn(className)} {...props} />;

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

/**
 * Which action the merged primary control currently performs (#351). The
 * component owns the AFFORDANCE only — it always invokes `onSubmit` (via the
 * normal form submit) once the action is "send", never `onStop`. What a
 * mid-turn submit MEANS (queued, interleaved, dropped) is entirely up to the
 * app's own `onSubmit`/runtime — brand-ui asserts nothing about that (D5).
 */
export type PromptInputSubmitAction = "send" | "stop";

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
  /**
   * Glyph for the SEND action only — survives the send↔stop flip, so a
   * consumer's resting glyph (e.g. `Composer`'s circular arrow) is no longer
   * lost while generating with a non-empty composer. Prefer this over
   * `children`.
   */
  sendIcon?: ReactNode;
  /**
   * @deprecated Replaces the glyph for **every** status — ready, submitted,
   * streaming AND error — which is why generating/error affordances can
   * disappear even though the control is still live. Prefer `sendIcon`,
   * which only ever replaces the resting Send glyph.
   */
  children?: ReactNode;
};

/**
 * Merged primary-action contract (#351):
 *   1. `ready`/`undefined`/`error` → **Send** (unchanged).
 *   2. `submitted`/`streaming` + composer EMPTY → **Stop** (unchanged).
 *   3. `submitted`/`streaming` + composer NON-EMPTY → **Send** (the fix — a
 *      follow-up can always be composed and submitted mid-turn).
 *   4. A `PromptInputStop` mounted alongside → this control is ALWAYS Send;
 *      the dedicated control owns stopping (the composed "separate" shape).
 */
export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  sendIcon,
  disabled,
  ...props
}: PromptInputSubmitProps) => {
  const { t } = useLocale();
  const isGenerating = status === "submitted" || status === "streaming";
  const submitState = useOptionalSubmitState();

  const action: PromptInputSubmitAction =
    isGenerating && !submitState?.canSubmit && !submitState?.hasDedicatedStop ? "stop" : "send";

  // Auto-disable only the Send action at rest, and only inside a PromptInput
  // (a standalone submit has no context and keeps working). `error` must stay
  // clickable to retry, and the Stop action is never auto-disabled. An
  // explicit `disabled` prop always wins.
  //
  // NOTE this drives `aria-disabled`, not the native attribute — see the render.
  const autoDisabled =
    action === "send" && status !== "error" && submitState ? !submitState.canSubmit : false;

  let Icon = sendIcon ?? <CornerDownLeftIcon className="size-4" data-rtl-flip />;

  if (action === "stop") {
    Icon = status === "submitted" ? <Spinner /> : <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // `aria-disabled` (see the render) does not block activation the way the
      // native attribute does, so the handler has to.
      if (autoDisabled) {
        e.preventDefault();
        return;
      }
      if (action === "stop" && onStop) {
        e.preventDefault();
        onStop();
        return;
      }
      onClick?.(e);
    },
    [autoDisabled, action, onStop, onClick],
  );

  return (
    <InputGroupButton
      aria-label={action === "stop" ? t("ai.promptInput.stop") : t("ai.promptInput.submit")}
      /*
       * `aria-disabled`, NOT the native `disabled` attribute, for the RESTING
       * empty-composer state.
       *
       * Two reasons. (1) A focused control that becomes natively disabled is
       * removed from the focus order by the HTML focus-fixup rule, so focus
       * drops to <body> — after every keyboard-initiated send, since the
       * composer clears and the button goes not-ready in the same commit. That
       * silently strands keyboard and screen-reader users mid-conversation.
       * (2) `interaction-guidelines.md` says a submit stays enabled until the
       * request starts; aria-disabled keeps it a real, focusable tab stop that
       * still announces its state, while `handleClick` + `handleSubmit` do the
       * actual blocking.
       *
       * An explicit `disabled` prop is still honoured natively — that is the
       * consumer deliberately taking the control out of the tab order.
       */
      aria-disabled={autoDisabled || undefined}
      className={cn(autoDisabled && "cursor-not-allowed opacity-50 hover:bg-primary", className)}
      data-action={action}
      data-generating={action === "stop" ? "true" : undefined}
      data-slot={SUBMIT_SLOT}
      disabled={disabled}
      onClick={handleClick}
      size={size}
      type={autoDisabled || (action === "stop" && onStop) ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? (
        <span
          key={`${status ?? "ready"}-${action}`}
          className="flex animate-in fade-in-0 zoom-in-95 duration-fast ease-entrance"
        >
          {Icon}
        </span>
      )}
    </InputGroupButton>
  );
};

/** The `data-slot` `PromptInputStop` renders with. */
const STOP_SLOT = "prompt-input-stop";

export type PromptInputStopProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop: () => void;
  /** Glyph override; defaults to a square Stop icon. */
  children?: ReactNode;
};

/**
 * A dedicated Stop control — the composed answer to "two buttons" (#351;
 * never a `mode` prop, per `component-api.md`'s ban on behavioural-mode
 * props). Renders `null` unless the turn is running (`status` is `submitted`
 * or `streaming`). While at least one `PromptInputStop` is mounted inside the
 * same `PromptInput`, `PromptInputSubmit` stays the Send action in every
 * state — the dedicated control owns stopping instead.
 */
export const PromptInputStop = ({
  className,
  variant = "outline",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputStopProps) => {
  const { t } = useLocale();
  const submitState = useOptionalSubmitState();
  const isGenerating = status === "submitted" || status === "streaming";

  useEffect(() => {
    const unregister = submitState?.registerStop();
    return unregister;
  }, [submitState]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) {
        return;
      }
      onStop();
    },
    [onClick, onStop],
  );

  if (!isGenerating) {
    return null;
  }

  return (
    <InputGroupButton
      aria-label={t("ai.promptInput.stop")}
      className={cn(className)}
      data-slot={STOP_SLOT}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children ?? <SquareIcon className="size-4" />}
    </InputGroupButton>
  );
};

export type PromptInputSelectProps = ComponentProps<typeof Select>;

export const PromptInputSelect = (props: PromptInputSelectProps) => <Select {...props} />;

export type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

export const PromptInputSelectTrigger = ({
  className,
  ...props
}: PromptInputSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className,
    )}
    {...props}
  />
);

export type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>;

export const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps) => <SelectContent className={cn(className)} {...props} />;

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputSelectItem = ({ className, ...props }: PromptInputSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputSelectValue = ({ className, ...props }: PromptInputSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;

export const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardProps) => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

export type PromptInputHoverCardTriggerProps = ComponentProps<typeof HoverCardTrigger>;

export const PromptInputHoverCardTrigger = (props: PromptInputHoverCardTriggerProps) => (
  <HoverCardTrigger {...props} />
);

export type PromptInputHoverCardContentProps = ComponentProps<typeof HoverCardContent>;

export const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps) => <HoverCardContent align={align} {...props} />;

export type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabsList = ({ className, ...props }: PromptInputTabsListProps) => (
  <div className={cn(className)} {...props} />
);

export type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTab = ({ className, ...props }: PromptInputTabProps) => (
  <div className={cn(className)} {...props} />
);

export type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>;

export const PromptInputTabLabel = ({ className, ...props }: PromptInputTabLabelProps) => (
  // Content provided via children in props
  // oxlint-disable-next-line eslint-plugin-jsx-a11y(heading-has-content)
  <h3 className={cn("mb-2 px-3 font-medium text-muted-foreground text-xs", className)} {...props} />
);

export type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabBody = ({ className, ...props }: PromptInputTabBodyProps) => (
  <div className={cn("space-y-1", className)} {...props} />
);

export type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabItem = ({ className, ...props }: PromptInputTabItemProps) => (
  <div
    className={cn("flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent", className)}
    {...props}
  />
);

export type PromptInputCommandProps = ComponentProps<typeof Command>;

export const PromptInputCommand = ({ className, ...props }: PromptInputCommandProps) => (
  <Command className={cn(className)} {...props} />
);

export type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;

export const PromptInputCommandInput = ({ className, ...props }: PromptInputCommandInputProps) => (
  <CommandInput className={cn(className)} {...props} />
);

export type PromptInputCommandListProps = ComponentProps<typeof CommandList>;

export const PromptInputCommandList = ({ className, ...props }: PromptInputCommandListProps) => (
  <CommandList className={cn(className)} {...props} />
);

export type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;

export const PromptInputCommandEmpty = ({ className, ...props }: PromptInputCommandEmptyProps) => (
  <CommandEmpty className={cn(className)} {...props} />
);

export type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;

export const PromptInputCommandGroup = ({ className, ...props }: PromptInputCommandGroupProps) => (
  <CommandGroup className={cn(className)} {...props} />
);

export type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;

/**
 * A selectable row inside `PromptInputCommand` (e.g. an `@`-mention popup).
 *
 * `id`/`role`/`aria-selected` are assigned internally by the `cmdk` dependency
 * itself — one layer below this wrapper and below `@qlik-coe-emea/qlabs-components-ui`'s
 * own `CommandItem` — and applied AFTER any props you pass, so a
 * consumer-supplied `id`/`role`/`aria-selected` is silently overridden
 * (`CommandItem` warns about this in development; #365).
 *
 * To wire `aria-activedescendant` from an input rendered OUTSIDE this
 * `PromptInputCommand` tree (the composer textarea driving the popup), use
 * `PromptInputCommand`'s `onActiveItemIdChange` callback (inherited from
 * `@qlik-coe-emea/qlabs-components-ui`'s `Command`, since `PromptInputCommandProps =
 * ComponentProps<typeof Command>`) instead of reading the id back
 * positionally from the DOM:
 *
 * ```tsx
 * const [activeId, setActiveId] = useState<string>();
 * <textarea role="combobox" aria-expanded={open} aria-controls={listId}
 *           aria-activedescendant={activeId} />
 * <PromptInputCommand onActiveItemIdChange={setActiveId}>…</PromptInputCommand>
 * ```
 */
export const PromptInputCommandItem = ({ className, ...props }: PromptInputCommandItemProps) => (
  <CommandItem className={cn(className)} {...props} />
);

export type PromptInputCommandSeparatorProps = ComponentProps<typeof CommandSeparator>;

export const PromptInputCommandSeparator = ({
  className,
  ...props
}: PromptInputCommandSeparatorProps) => <CommandSeparator className={cn(className)} {...props} />;
