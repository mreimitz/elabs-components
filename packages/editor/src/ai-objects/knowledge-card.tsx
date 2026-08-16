"use client";

/**
 * KnowledgeCard — renders a `:::knowledge{sources="notes/a.md, notes/b.md"}` directive
 * as a sourced-fact card.
 *
 * Anatomy:
 *   - Fact body (rendered markdown children of the directive).
 *   - Sources section: each comma-split path is handed to the consumer's `resolve`
 *     hook (`resolve(path) => { href, title } | null`). Resolved paths render as
 *     `<a>` links; unresolved paths render as plain `<span>` labels — graceful
 *     degradation, no errors thrown.
 *
 * The library never reads files. Domain logic (vault index, file system, API) lives
 * entirely in the consumer's `resolve` hook — the same principle as `resolveUrl` on
 * `MarkdownPreview` and `evaluate` on calc blocks.
 *
 * `KnowledgeCard` is standalone (no `resolve` → sources rendered as plain labels).
 * The `knowledgeDirective({ resolve })` factory wires the hook for directive use.
 */
import { Card, CardContent, CardFooter } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { BookOpen, FileText } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Resolver type (consumer-supplied; never bundled)                     */
/* ------------------------------------------------------------------ */

export interface KnowledgeSourceResolved {
  href: string;
  title?: string;
}

/**
 * Consumer-supplied resolver: path → link data, or `null` when the path cannot
 * be resolved (stale vault link, missing file, etc.). The card degrades
 * gracefully — the source renders as a plain label rather than a broken link.
 */
export type KnowledgeSourceResolver = (path: string) => KnowledgeSourceResolved | null;

/* ------------------------------------------------------------------ */
/* Sub-component: a single resolved/unresolved source row               */
/* ------------------------------------------------------------------ */

interface SourceRowProps {
  path: string;
  resolve?: KnowledgeSourceResolver;
}

function SourceRow({ path, resolve }: SourceRowProps) {
  const resolved = resolve ? resolve(path) : null;
  const display = resolved?.title ?? path;

  if (resolved) {
    return (
      <a
        href={resolved.href}
        rel="noopener noreferrer"
        target="_blank"
        // #399 — a source link is TEXT: on-surface `-text` rung, not the fill.
        className="flex min-w-0 items-center gap-1.5 text-meta text-primary-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={`Source: ${display}`}
      >
        <FileText className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{display}</span>
      </a>
    );
  }

  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground"
      aria-label={`Source (unresolved): ${display}`}
    >
      <FileText className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{display}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* KnowledgeCard                                                        */
/* ------------------------------------------------------------------ */

export interface KnowledgeCardProps extends HTMLAttributes<HTMLElement> {
  /**
   * Comma-separated source paths (e.g. `"notes/a.md, notes/b.md"`).
   * Each path is handed to `resolve`; unresolved paths render as plain labels.
   */
  sources?: string;
  /**
   * Consumer-supplied resolver. `undefined` → all sources render as plain labels
   * (safe default — never throws, never reads files).
   */
  resolve?: KnowledgeSourceResolver;
  /** The fact body (rendered markdown children of the directive). */
  children?: ReactNode;
}

export const KnowledgeCard = forwardRef<HTMLElement, KnowledgeCardProps>(function KnowledgeCard(
  { sources, resolve, children, className, ...props },
  ref,
) {
  const sourcePaths = sources
    ? sources
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <section
      ref={ref}
      aria-label="Knowledge fact"
      className={cn("not-prose", className)}
      {...props}
    >
      <Card className="border-s-4 border-s-info">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <BookOpen className="size-3.5 shrink-0 text-info-text" aria-hidden="true" />
            <span className="text-meta font-medium text-info-text">Knowledge</span>
          </div>
          <div className="text-body text-foreground">{children}</div>
        </CardContent>

        {sourcePaths.length > 0 ? (
          <CardFooter className="flex-col items-start gap-1 border-t border-border pt-3">
            <p className="text-meta font-medium text-muted-foreground">Sources</p>
            <ul className="flex w-full flex-col gap-1" aria-label="Sources">
              {sourcePaths.map((path) => (
                <li key={path} className="min-w-0">
                  <SourceRow path={path} resolve={resolve} />
                </li>
              ))}
            </ul>
          </CardFooter>
        ) : null}
      </Card>
    </section>
  );
});
