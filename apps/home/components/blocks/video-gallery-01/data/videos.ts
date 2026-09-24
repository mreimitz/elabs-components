// registry: video-gallery-01 — copied 2026-09-24
/**
 * Sample videos for the gallery. The media is synthesized by `media-parts` — a
 * poster SVG, a short silent WAV standing in for the video file, a WebVTT
 * captions track — so the block renders offline with no binary fixtures and no
 * network origin. Point `src`, `poster` and `captions` at your own assets (and
 * fill `seconds` from your metadata) when you copy it.
 */
import { captionsTrack, posterArt, silentClip } from "../../media-parts/media-fixtures";

export type VideoCategory = "Product" | "Tutorials" | "Webinars";

export const VIDEO_CATEGORIES: readonly VideoCategory[] = ["Product", "Tutorials", "Webinars"];

export interface GalleryVideo {
  id: string;
  title: string;
  description: string;
  category: VideoCategory;
  /** Length in seconds — the tile badge and the dialog footer format it. */
  seconds: number;
  /** Display date. */
  published: string;
  /** Poster frame (any image URL). */
  poster: string;
  /** The video file (any URL the browser can play). */
  src: string;
  /** WebVTT captions — give every non-decorative video one. */
  captions?: string;
}

// Three clip lengths shared across the set keep the sample data small.
const CLIP = { short: silentClip(6), medium: silentClip(10), long: silentClip(15) };

function video(
  id: string,
  title: string,
  description: string,
  category: VideoCategory,
  length: keyof typeof CLIP,
  published: string,
  motif: "orbit" | "bars" | "grid",
): GalleryVideo {
  const seconds = { short: 6, medium: 10, long: 15 }[length];
  return {
    id,
    title,
    description,
    category,
    seconds,
    published,
    poster: posterArt(motif, id),
    src: CLIP[length],
    captions: captionsTrack(seconds, [`${title}.`, description]),
  };
}

export const VIDEOS: GalleryVideo[] = [
  video(
    "onboarding-tour",
    "Onboarding tour",
    "The first five minutes in the product: workspace, projects and where your data lands.",
    "Product",
    "long",
    "14 Aug 2026",
    "orbit",
  ),
  video(
    "release-notes-sept",
    "What’s new in September",
    "Saved views, the redesigned inspector and bulk actions on the grid.",
    "Product",
    "medium",
    "3 Sep 2026",
    "bars",
  ),
  video(
    "permissions-model",
    "How roles and permissions work",
    "Owners, editors and viewers — what each can see and change, and how sharing inherits.",
    "Product",
    "short",
    "22 Jul 2026",
    "grid",
  ),
  video(
    "first-dashboard",
    "Build your first dashboard",
    "Connect a source, add three metric cards and a chart, and share it with a link.",
    "Tutorials",
    "long",
    "9 Sep 2026",
    "bars",
  ),
  video(
    "import-csv",
    "Import a CSV cleanly",
    "Column mapping, type detection and how to fix the rows the importer flags.",
    "Tutorials",
    "medium",
    "27 Aug 2026",
    "grid",
  ),
  video(
    "keyboard-shortcuts",
    "Keyboard shortcuts that save an hour a week",
    "Command palette, quick filters and jumping between projects without the mouse.",
    "Tutorials",
    "short",
    "18 Aug 2026",
    "orbit",
  ),
  video(
    "webinar-forecasting",
    "Forecasting with confidence bands",
    "A 40-minute session on seasonal baselines, anomaly flags and what to show leadership.",
    "Webinars",
    "long",
    "1 Sep 2026",
    "grid",
  ),
  video(
    "webinar-agents",
    "Agents in the loop: where a person steps in",
    "Customer stories on approval gates, audit trails and keeping humans on the expensive path.",
    "Webinars",
    "medium",
    "11 Aug 2026",
    "orbit",
  ),
  video(
    "webinar-migration",
    "Migrating from spreadsheets",
    "Two teams walk through the move: what to keep, what to model and what to leave behind.",
    "Webinars",
    "short",
    "5 Jul 2026",
    "bars",
  ),
];
