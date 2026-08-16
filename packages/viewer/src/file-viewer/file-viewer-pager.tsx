"use client";

/**
 * `FileViewerPager` — previous / a page you can type into / next.
 *
 * A PART, not adapter chrome. The page lives in the provider (ADR 0026), so this
 * row can sit in the viewer's own toolbar, in an app's page header, or beside a
 * thumbnail rail, and every copy of it stays in step. While the page was
 * `useState` inside `PdfRenderer` there could only ever be one pager, inside the
 * canvas.
 *
 * ## Why this is not a `role="toolbar"`
 *
 * The role promises roving-tabindex arrow-key navigation, and the page field is
 * a TEXT INPUT — ArrowLeft/ArrowRight there move the caret. A toolbar that
 * swallowed them would make the number unusable to a keyboard reader, so this is
 * a plain named group of ordinary tab stops: the same call `FileViewerToolbar`
 * and `ViewToolbar` make, for the same reason.
 */

import { cn, IconButton, Input, useLocale } from "@qlik-coe-emea/qlabs-components-ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { forwardRef, useState, type HTMLAttributes } from "react";

import { useFileViewer } from "./file-viewer-context";

export type FileViewerPagerProps = HTMLAttributes<HTMLDivElement>;

export const FileViewerPager = forwardRef<HTMLDivElement, FileViewerPagerProps>(
  function FileViewerPager({ className, ...props }, ref) {
    const { state, actions } = useFileViewer();
    const { t, formatNumber } = useLocale();

    // The half-typed value, while the reader is typing it. `null` means "not
    // editing", so the field follows the document the rest of the time — a
    // citation that turns the page updates the number under the caret too.
    const [draft, setDraft] = useState<string | null>(null);

    const { pageNumber, pageCount } = state;

    // No pages, or none known yet: render nothing rather than an inert "1 of 0".
    // Chrome with nothing in it reads as a broken render (viewer-components.md).
    if (!state.capabilities.pages || pageCount === 0) return null;

    const commit = () => {
      if (draft === null) return;
      const parsed = Number.parseInt(draft, 10);
      setDraft(null);
      // A blank or nonsense entry is a reader changing their mind, not a
      // navigation — snap back to where they are instead of jumping to page 1.
      if (Number.isNaN(parsed)) return;
      actions.goToPage(parsed);
    };

    return (
      <div
        ref={ref}
        data-slot="file-viewer-pager"
        role="group"
        aria-label={t("viewer.pager.controls")}
        className={cn("flex shrink-0 items-center gap-1", className)}
        {...props}
      >
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("viewer.pager.previous")}
          icon={<ChevronLeftIcon aria-hidden="true" />}
          disabled={pageNumber <= 1}
          onClick={actions.previousPage}
        />
        <Input
          // Explicit: Radix's toolbar slot and several wrappers default an
          // unset `type` to `"button"`, which would silently turn the field
          // into a button the day this moves inside one.
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("viewer.pager.pageNumber")}
          value={draft ?? String(pageNumber)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              // Abandon the edit without navigating; focus stays put, so the
              // reader can try again without re-reaching the field.
              setDraft(null);
            }
          }}
          className="h-7 w-12 px-1 text-center tabular-nums"
        />
        <span className="text-meta text-muted-foreground whitespace-nowrap tabular-nums">
          {t("viewer.pager.of", { total: formatNumber(pageCount) })}
        </span>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("viewer.pager.next")}
          icon={<ChevronRightIcon aria-hidden="true" />}
          disabled={pageNumber >= pageCount}
          onClick={actions.nextPage}
        />
        {/* Paging repaints a canvas, which announces nothing on its own, and the
            field's own value change is not announced either. ONE live region for
            the group carries the whole sentence — `loading-states.md`'s rule that
            a region announces once, not per element. */}
        <span role="status" aria-live="polite" className="sr-only">
          {t("viewer.pager.status", {
            page: formatNumber(pageNumber),
            total: formatNumber(pageCount),
          })}
        </span>
      </div>
    );
  },
);
