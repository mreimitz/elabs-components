import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";
import { THEME_META, type ThemeName } from "@qlik-coe-emea/qlabs-components-tokens";
import { cn } from "../../lib/cn";

/**
 * The library's default token-backed toast class names. Kept as a standalone
 * constant (rather than inline in the JSX) so `Toaster` can merge a
 * consumer's `toastOptions.classNames` INTO these defaults instead of
 * shallow-replacing them (#362) — each key is combined via `cn()` so a
 * consumer's override extends the default class string rather than
 * discarding it.
 */
const DEFAULT_TOAST_CLASS_NAMES = {
  toast:
    "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-ring-lg",
  description: "group-[.toast]:text-muted-foreground",
  actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
  cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
} as const;

/** Reads the active theme from the document `data-theme` attribute. */
function useDocumentThemeMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const read = () => {
      const t = el.getAttribute("data-theme") as ThemeName | null;
      setMode(t && THEME_META[t]?.dark ? "dark" : "light");
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return mode;
}

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

/**
 * Toast host. Mount once near the app root. Trigger toasts with the exported
 * `toast()`. Theme follows the active brand theme (via `data-theme`), so it
 * works with or without <ThemeProvider>.
 *
 * ## Customizing toast styling
 *
 * The Toaster wrapper renders with the classes `toaster group` by default.
 * These classes are **merged** with any consumer-supplied `className`, not
 * replaced, so that built-in styling (the `.group-[.toaster]:*` selectors
 * on individual toasts) continues to work.
 *
 * To override a built-in toast class, **mirror the variant prefix** when you
 * pass `toastOptions.classNames`. Built-in toast classes are variant-scoped
 * (e.g. `group-[.toaster]:bg-card`), so a bare utility override will be
 * outspecificity'd by the built-in and appear to do nothing. Instead, use:
 *
 * ```tsx
 * <Toaster
 *   toastOptions={{
 *     classNames: {
 *       toast: "group-[.toaster]:bg-primary",  // ✓ mirrors the prefix
 *     }
 *   }}
 * />
 * ```
 *
 * ## Theme handling
 *
 * The Toaster's `theme` prop is automatically set based on the active
 * `data-theme` attribute (qlik-bright → "light", qlik-dark/blueprint → "dark"),
 * so toasts visually track the app's theme by default. However, you may pass
 * `theme="light"` or `theme="dark"` directly to override this derivation if needed.
 */
export function Toaster({ className, toastOptions, ...rest }: ToasterProps) {
  const mode = useDocumentThemeMode();
  const userClassNames = toastOptions?.classNames;
  // Merge (not replace): every default key is extended with the consumer's
  // override via cn(); any extra keys the consumer passes (e.g. `success`,
  // `closeButton`) pass through untouched.
  const classNames = {
    ...userClassNames,
    toast: cn(DEFAULT_TOAST_CLASS_NAMES.toast, userClassNames?.toast),
    description: cn(DEFAULT_TOAST_CLASS_NAMES.description, userClassNames?.description),
    actionButton: cn(DEFAULT_TOAST_CLASS_NAMES.actionButton, userClassNames?.actionButton),
    cancelButton: cn(DEFAULT_TOAST_CLASS_NAMES.cancelButton, userClassNames?.cancelButton),
  };
  return (
    <SonnerToaster
      theme={mode}
      className={cn("toaster group", className)}
      toastOptions={{ ...toastOptions, classNames }}
      {...rest}
    />
  );
}

export { toast };
