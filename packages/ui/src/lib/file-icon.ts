/**
 * One glyph per {@link FileCategory} — the single icon map for file-shaped UI.
 *
 * Supersedes two package-private maps that could not see each other:
 * `PRODUCED_ASSET_ICONS` (`@elabs/components-ai` file-tree, keyed by
 * the five-member `ContextAssetType`) and `mediaCategoryIcons` (same package,
 * attachments, keyed by six MIME buckets) — so the same `.csv` drew a table glyph
 * in one surface and a generic document glyph in the other.
 *
 * Lucide per `.claude/rules/icons.md`: these are generic UI glyphs, not product
 * vocabulary, so nothing here belongs in
 * `@elabs/components-icons`.
 *
 * Values only — this module holds component REFERENCES, it renders nothing.
 * Icons inherit color from `currentColor`; the category is never carried by hue
 * alone, so a caller must still supply a text label or an `aria-label` on the
 * control (WCAG 1.4.1).
 */

import {
  File,
  FileArchive,
  FileCode,
  FileDigit,
  FileImage,
  FileMusic,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideoCamera,
  type LucideIcon,
  Presentation,
} from "lucide-react";

import { type FileCategory, resolveFileKind } from "./file-kind";

/** The glyph for each coarse file shape. Exhaustive over {@link FileCategory}. */
export const FILE_CATEGORY_ICONS: Readonly<Record<FileCategory, LucideIcon>> = {
  image: FileImage,
  video: FileVideoCamera,
  audio: FileMusic,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  code: FileCode,
  text: FileType,
  data: FileDigit,
  archive: FileArchive,
  unknown: File,
};

/**
 * The glyph for a file, resolved from its name and (optionally) MIME.
 * Falls back to the generic file glyph rather than throwing.
 */
export function fileIconFor(name: string, mediaType?: string): LucideIcon {
  return FILE_CATEGORY_ICONS[resolveFileKind(name, mediaType).category];
}
