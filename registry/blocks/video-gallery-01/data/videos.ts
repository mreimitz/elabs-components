/**
 * Sample videos for the gallery. The media is synthesized inline — a poster
 * SVG, a short silent WAV standing in for the video file, a WebVTT captions
 * track — so the block renders offline with no binary fixtures and no network
 * origin. Point `src`, `poster` and `captions` at your own assets (and fill
 * `seconds` from your metadata) when you copy it.
 */

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

/** A silent 8-bit mono PCM WAV of `seconds` length, as a data URL. */
// 3 kHz is the lowest sample rate Chromium decodes; shorter clips keep the data small.
function silentClip(seconds: number, sampleRate = 3000): string {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = new Uint8Array(44 + samples).fill(128); // 128 == silence (8-bit unsigned)
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/**
 * A 16:9 poster frame with a simple motif so the tiles read as different
 * videos (the tile names the video; the poster carries no text). Paints with
 * CSS system colours only — no raw colour literal.
 */
function poster(motif: "orbit" | "bars" | "grid"): string {
  const shape =
    motif === "orbit"
      ? `<circle cx="320" cy="180" r="110" fill="none" stroke="Canvas" stroke-width="3" opacity="0.5"/>` +
        `<circle cx="430" cy="180" r="14" fill="Canvas" opacity="0.7"/>`
      : motif === "bars"
        ? [0, 1, 2, 3, 4, 5]
            .map(
              (i) =>
                `<rect x="${160 + i * 60}" y="${260 - (i % 3) * 50 - 40}" width="36" height="${(i % 3) * 50 + 40}" fill="Canvas" opacity="0.45"/>`,
            )
            .join("")
        : [0, 1, 2, 3]
            .map(
              (i) =>
                `<line x1="${170 + i * 100}" y1="60" x2="${170 + i * 100}" y2="300" stroke="Canvas" stroke-width="2" opacity="0.4"/>` +
                `<line x1="120" y1="${80 + i * 60}" x2="520" y2="${80 + i * 60}" stroke="Canvas" stroke-width="2" opacity="0.4"/>`,
            )
            .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">` +
    `<rect width="640" height="360" fill="GrayText"/>` +
    shape +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A WebVTT file with one cue per line of `lines`, spread evenly over `seconds`. */
function captions(seconds: number, lines: string[]): string {
  const step = seconds / lines.length;
  const stamp = (t: number) => {
    const m = Math.floor(t / 60);
    const s = (t - m * 60).toFixed(3).padStart(6, "0");
    return `${String(m).padStart(2, "0")}:${s}`;
  };
  const cues = lines
    .map((text, i) => `${stamp(i * step)} --> ${stamp((i + 1) * step)}\n${text}`)
    .join("\n\n");
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n${cues}\n`)}`;
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
    poster: poster(motif),
    src: CLIP[length],
    captions: captions(seconds, [`${title}.`, description]),
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
