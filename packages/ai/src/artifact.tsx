"use client";

import { Button, Skeleton, useLocale } from "@elabs-ai/components-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { LucideIcon } from "lucide-react";
import { XIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { createContext, use, useMemo } from "react";

/**
 * Shared `loading` state (composition-patterns — lifted into the provider):
 * `Artifact` is the ONLY place that knows whether the body has arrived;
 * `ArtifactContent` reads the interface and renders its skeleton, while
 * `ArtifactHeader`/`ArtifactTitle` (ordinary children of `Artifact`) keep
 * rendering normally, untouched by the not-ready state.
 */
const ArtifactContext = createContext<{ loading: boolean }>({ loading: false });

export type ArtifactProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * The artifact body has not arrived yet (loading-states.md loading signal).
   * ArtifactContent renders a layout-shaped skeleton instead of its
   * children; ArtifactHeader/ArtifactTitle keep rendering as passed.
   * @default false
   */
  loading?: boolean;
};

export const Artifact = ({ className, loading = false, children, ...props }: ArtifactProps) => {
  const contextValue = useMemo(() => ({ loading }), [loading]);

  return (
    <ArtifactContext.Provider value={contextValue}>
      <div
        // KEEP this border (#194, research 08 §G.5): it is redundant on light
        // (the #187 page-ground recess + shadow already lift the frame), but under
        // high decoration the shadow is zeroed and the border becomes the
        // SOLE structural cue — the canonical "redundant-on-light, sole-cue-under-
        // decoration" KEEP example. Do not drop it in a border-noise pass.
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ArtifactContext.Provider>
  );
};

export type ArtifactHeaderProps = HTMLAttributes<HTMLDivElement>;

export const ArtifactHeader = ({ className, ...props }: ArtifactHeaderProps) => (
  <div
    className={cn("flex items-center justify-between border-b bg-muted/50 px-4 py-3", className)}
    {...props}
  />
);

export type ArtifactCloseProps = ComponentProps<typeof Button>;

export const ArtifactClose = ({
  className,
  children,
  size = "sm",
  variant = "ghost",
  ...props
}: ArtifactCloseProps) => {
  const { t } = useLocale();
  return (
    <Button
      className={cn("size-8 p-0 text-muted-foreground hover:text-foreground", className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children ?? <XIcon className="size-4" />}
      <span className="sr-only">{t("close")}</span>
    </Button>
  );
};

export type ArtifactTitleProps = HTMLAttributes<HTMLParagraphElement>;

export const ArtifactTitle = ({ className, ...props }: ArtifactTitleProps) => (
  <p className={cn("font-medium text-foreground text-sm", className)} {...props} />
);

export type ArtifactDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const ArtifactDescription = ({ className, ...props }: ArtifactDescriptionProps) => (
  <p className={cn("text-muted-foreground text-sm", className)} {...props} />
);

export type ArtifactActionsProps = HTMLAttributes<HTMLDivElement>;

export const ArtifactActions = ({ className, ...props }: ArtifactActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type ArtifactActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
  icon?: LucideIcon;
};

export const ArtifactAction = ({
  tooltip,
  label,
  icon: Icon,
  children,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: ArtifactActionProps) => {
  const button = (
    <Button
      className={cn("size-8 p-0 text-muted-foreground hover:text-foreground", className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export type ArtifactContentProps = HTMLAttributes<HTMLDivElement>;

export const ArtifactContent = ({ className, children, ...props }: ArtifactContentProps) => {
  const { loading } = use(ArtifactContext);
  const { t } = useLocale();

  return (
    <div className={cn("flex-1 overflow-auto p-4", className)} {...props}>
      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        children
      )}
    </div>
  );
};
