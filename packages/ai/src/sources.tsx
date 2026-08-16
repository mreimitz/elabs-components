"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { BookIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type SourcesProps = ComponentProps<"div">;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible className={cn("not-prose mb-4 text-success-text text-meta", className)} {...props} />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({ className, count, children, ...props }: SourcesTriggerProps) => (
  <CollapsibleTrigger className={cn("group flex items-center gap-2", className)} {...props}>
    {children ?? (
      <>
        <p className="font-medium">Used {count} sources</p>
        <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({ className, ...props }: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-3 flex w-fit flex-col gap-2",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
    {...props}
  />
);

export type SourceProps = ComponentProps<"a">;

export const Source = ({ href, title, children, className, ...props }: SourceProps) => (
  <a
    className={cn("flex items-center gap-2", className)}
    href={href}
    rel="noopener noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <BookIcon className="h-4 w-4" />
        <span className="block text-caption font-medium">{title}</span>
      </>
    )}
  </a>
);

export interface SourceListItem {
  href: string;
  title?: string;
}

export type SourceListProps = Omit<ComponentProps<typeof Sources>, "children"> & {
  /** The grounding sources, rendered as the named list. */
  sources: SourceListItem[];
  /** Extra rows appended after the named list (escape hatch). */
  children?: ReactNode;
};

/**
 * SourceList — the per-answer grounding footer (research 11 §B.4): a green
 * "Grounded in N sources" header + the named source list. Sugar over the fixed
 * `Sources`/`Source` primitives, reused by the context panel (research 09).
 */
export const SourceList = ({ sources, children, ...props }: SourceListProps) => (
  <Sources {...props}>
    <SourcesTrigger count={sources.length}>
      <p className="font-medium">
        Grounded in {sources.length} {sources.length === 1 ? "source" : "sources"}
      </p>
      <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
    </SourcesTrigger>
    <SourcesContent>
      {sources.map((source) => (
        <Source href={source.href} key={source.href} title={source.title} />
      ))}
      {children}
    </SourcesContent>
  </Sources>
);
