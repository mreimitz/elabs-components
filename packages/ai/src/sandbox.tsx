"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useLocale,
} from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import type { ToolUIPart } from "ai";
import { ChevronDownIcon, Code } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, use, useMemo } from "react";

import { getStatusBadge } from "./tool";

/**
 * Shared loading state (composition-patterns — lifted into the provider),
 * mirroring Artifact: Sandbox is the only place that knows whether the run
 * body has arrived; SandboxContent reads the interface and renders a
 * skeleton, while SandboxHeader (an ordinary child of Sandbox) keeps
 * rendering as passed.
 */
const SandboxContext = createContext<{ loading: boolean }>({ loading: false });

export type SandboxProps = ComponentProps<typeof Collapsible> & {
  /**
   * The run output has not arrived yet (loading-states.md loading signal).
   * SandboxContent renders a layout-shaped skeleton instead of its children;
   * SandboxHeader keeps rendering as passed.
   * @default false
   */
  loading?: boolean;
};

/** @deprecated Renamed to `SandboxProps`. */
export type SandboxRootProps = SandboxProps;

export const Sandbox = ({ className, loading = false, children, ...props }: SandboxProps) => {
  const contextValue = useMemo(() => ({ loading }), [loading]);

  return (
    <SandboxContext.Provider value={contextValue}>
      <Collapsible
        className={cn("not-prose group mb-4 w-full overflow-hidden rounded-md border", className)}
        defaultOpen
        {...props}
      >
        {children}
      </Collapsible>
    </SandboxContext.Provider>
  );
};

export interface SandboxHeaderProps {
  title?: string;
  state: ToolUIPart["state"];
  className?: string;
}

export const SandboxHeader = ({ className, title, state, ...props }: SandboxHeaderProps) => (
  <CollapsibleTrigger
    className={cn("flex w-full items-center justify-between gap-4 p-3", className)}
    {...props}
  >
    <div className="flex items-center gap-2">
      <Code className="size-4 text-muted-foreground" />
      <span className="font-medium text-sm">{title}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);

export type SandboxContentProps = ComponentProps<typeof CollapsibleContent>;

export const SandboxContent = ({ className, children, ...props }: SandboxContentProps) => {
  const { loading } = use(SandboxContext);
  const { t } = useLocale();

  return (
    <CollapsibleContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className,
      )}
      {...props}
    >
      {loading ? (
        <div className="space-y-2 p-3" role="status" aria-live="polite">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        children
      )}
    </CollapsibleContent>
  );
};

export type SandboxTabsProps = ComponentProps<typeof Tabs>;

export const SandboxTabs = ({ className, ...props }: SandboxTabsProps) => (
  <Tabs className={cn("w-full gap-0", className)} {...props} />
);

export type SandboxTabsBarProps = ComponentProps<"div">;

export const SandboxTabsBar = ({ className, ...props }: SandboxTabsBarProps) => (
  <div
    className={cn("flex w-full items-center border-border border-t border-b", className)}
    {...props}
  />
);

export type SandboxTabsListProps = ComponentProps<typeof TabsList>;

export const SandboxTabsList = ({ className, ...props }: SandboxTabsListProps) => (
  <TabsList
    className={cn("h-auto rounded-none border-0 bg-transparent p-0", className)}
    {...props}
  />
);

export type SandboxTabsTriggerProps = ComponentProps<typeof TabsTrigger>;

export const SandboxTabsTrigger = ({ className, ...props }: SandboxTabsTriggerProps) => (
  <TabsTrigger
    className={cn(
      "rounded-none border-0 border-transparent border-b-2 px-4 py-2 font-medium text-muted-foreground text-sm transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
      className,
    )}
    {...props}
  />
);

export type SandboxTabContentProps = ComponentProps<typeof TabsContent>;

export const SandboxTabContent = ({ className, ...props }: SandboxTabContentProps) => (
  <TabsContent className={cn("mt-0 text-sm", className)} {...props} />
);
