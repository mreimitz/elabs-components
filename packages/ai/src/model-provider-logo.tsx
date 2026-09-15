"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import { resolveThemeIsDark } from "@elabs-ai/components-tokens";
import { BotIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";

/**
 * Tracks the ACTIVE theme's own `color-scheme` (`resolveThemeIsDark`), not the
 * two shipped `light`/`dark` themes — a consumer-authored dark theme still
 * gets an inverted (visible) logo with no registration step (theming.md:
 * "Use semantic tokens, not `dark:` — `@custom-variant dark` covers only the
 * themes shipped HERE"). Mirrors `Toaster`'s `useDocumentThemeMode`
 * (`packages/ui/src/components/sonner/sonner.tsx`).
 */
function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const read = () => setIsDark(resolveThemeIsDark(el));
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/**
 * Where provider logos are fetched from by default.
 *
 * This is a REMOTE origin: a deployment with a restrictive `img-src` blocks it.
 * Self-host the SVGs and pass `src` (or set a `fallback`) — see
 * `docs/CSP-AND-NETWORK.md`.
 */
export const MODEL_PROVIDER_LOGO_BASE_URL = "https://models.dev/logos";

export type ModelProviderLogoProps = Omit<ComponentProps<"img">, "alt"> & {
  /**
   * Override the logo URL — point at a self-hosted or bundled asset when a CSP
   * blocks `models.dev`. Defaults to `${MODEL_PROVIDER_LOGO_BASE_URL}/<provider>.svg`.
   */
  src?: string;
  /**
   * Rendered when the logo fails to load (blocked, offline, or unknown
   * provider). Defaults to a neutral Lucide glyph, so the row never collapses
   * to a broken image.
   */
  fallback?: ReactNode;
  provider:
    | "moonshotai-cn"
    | "lucidquery"
    | "moonshotai"
    | "zai-coding-plan"
    | "alibaba"
    | "xai"
    | "vultr"
    | "nvidia"
    | "upstage"
    | "groq"
    | "github-copilot"
    | "mistral"
    | "vercel"
    | "nebius"
    | "deepseek"
    | "alibaba-cn"
    | "google-vertex-anthropic"
    | "venice"
    | "chutes"
    | "cortecs"
    | "github-models"
    | "togetherai"
    | "azure"
    | "baseten"
    | "huggingface"
    | "opencode"
    | "fastrouter"
    | "google"
    | "google-vertex"
    | "cloudflare-workers-ai"
    | "inception"
    | "wandb"
    | "openai"
    | "zhipuai-coding-plan"
    | "perplexity"
    | "openrouter"
    | "zenmux"
    | "v0"
    | "iflowcn"
    | "synthetic"
    | "deepinfra"
    | "zhipuai"
    | "submodel"
    | "zai"
    | "inference"
    | "requesty"
    | "morph"
    | "lmstudio"
    | "anthropic"
    | "aihubmix"
    | "fireworks-ai"
    | "modelscope"
    | "llama"
    | "scaleway"
    | "amazon-bedrock"
    | "cerebras"
    // oxlint-disable-next-line typescript-eslint(ban-types) -- intentional pattern for autocomplete-friendly string union
    | (string & {});
};

/**
 * The mark of an AI model provider (`anthropic`, `openai`, `google`, …), sized
 * for a row in a model list.
 *
 * **`ModelProviderLogo` vs `ServiceLogo` (`@elabs-ai/components-icons`).** An AI
 * provider mark with a zero-config remote default — name the provider and a logo
 * appears, no registration step — is this component. Any other third-party
 * service mark, resolved from a registry the app supplies and never fetched, is
 * `ServiceLogo`. The two are not interchangeable: `ServiceLogo` has no
 * per-instance `src` and no `onError`, and this one reaches a remote origin by
 * default (see `docs/CSP-AND-NETWORK.md`).
 */
export const ModelProviderLogo = ({
  provider,
  className,
  src,
  fallback,
  onError,
  ...props
}: ModelProviderLogoProps) => {
  const [failed, setFailed] = useState(false);
  const isDark = useIsDarkTheme();

  // A blocked/missing logo must not leave a broken-image glyph in the row.
  if (failed) {
    return (
      <>
        {fallback ?? (
          <BotIcon aria-label={`${provider} logo`} className={cn("size-3", className)} role="img" />
        )}
      </>
    );
  }

  return (
    <img
      {...props}
      alt={`${provider} logo`}
      className={cn("size-3", isDark && "invert", className)}
      height={12}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      // AFTER the spread, so the caller's `src` wins via the destructured
      // default rather than being silently overwritten.
      src={src ?? `${MODEL_PROVIDER_LOGO_BASE_URL}/${provider}.svg`}
      width={12}
    />
  );
};

export type ModelProviderLogoGroupProps = ComponentProps<"div">;

export const ModelProviderLogoGroup = ({ className, ...props }: ModelProviderLogoGroupProps) => {
  // Same active-theme signal as the single logo above (not the two shipped
  // `light`/`dark` themes) — the backdrop swaps to `--foreground` so a
  // transparent-background SVG still reads against a dark chip in ANY dark
  // theme a consumer registers.
  const isDark = useIsDarkTheme();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center -space-x-1 [&>img]:rounded-full [&>img]:p-px [&>img]:ring-1",
        isDark ? "[&>img]:bg-foreground" : "[&>img]:bg-background",
        className,
      )}
      {...props}
    />
  );
};
