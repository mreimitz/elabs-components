/**
 * A mixed set — photographs, films and recordings from one event — all
 * synthesized by `media-parts` so the block renders offline. Point `src`,
 * `poster` and `captions` at your own assets when you copy it.
 */
import {
  captionsTrack,
  coverArt,
  posterArt,
  silentClip,
  type PosterMotif,
} from "@/components/media-parts/media-fixtures";

export type MediaKind = "image" | "video" | "audio";

interface ItemBase {
  id: string;
  title: string;
  caption: string;
  /** Display date. */
  taken: string;
}

export interface ImageItem extends ItemBase {
  kind: "image";
  src: string;
  alt: string;
  /** Width ÷ height, so the tile can reserve the box. */
  ratio: number;
}

export interface VideoItem extends ItemBase {
  kind: "video";
  src: string;
  poster: string;
  captions?: string;
  seconds: number;
}

export interface AudioItem extends ItemBase {
  kind: "audio";
  src: string;
  /** Cover art shown on the tile and above the waveform. */
  cover: string;
  seconds: number;
}

export type MediaItem = ImageItem | VideoItem | AudioItem;

const image = (
  id: string,
  title: string,
  caption: string,
  taken: string,
  motif: PosterMotif,
  ratio: number,
): ImageItem => ({
  id,
  kind: "image",
  title,
  caption,
  taken,
  alt: title,
  ratio,
  src: posterArt(
    motif,
    id,
    ratio >= 1 ? { width: 640, height: 640 / ratio } : { width: 480, height: 480 / ratio },
  ),
});

const video = (
  id: string,
  title: string,
  caption: string,
  taken: string,
  motif: PosterMotif,
  seconds: number,
  lines: string[],
): VideoItem => ({
  id,
  kind: "video",
  title,
  caption,
  taken,
  seconds,
  poster: posterArt(motif, id),
  src: silentClip(seconds),
  captions: captionsTrack(seconds, lines),
});

const audio = (
  id: string,
  title: string,
  caption: string,
  taken: string,
  motif: PosterMotif,
  seconds: number,
): AudioItem => ({
  id,
  kind: "audio",
  title,
  caption,
  taken,
  seconds,
  cover: coverArt(motif, id),
  src: silentClip(seconds),
});

export const ITEMS: MediaItem[] = [
  video(
    "keynote",
    "Opening keynote",
    "The first ten minutes: what changed on the docks this year, and what did not.",
    "12 Sep 2026",
    "harbour",
    14,
    ["Welcome to the harbour.", "Four ports, one view.", "Here is what changed."],
  ),
  image(
    "gate-4",
    "Gate 4 at first light",
    "The Bergen terminal before the morning queue.",
    "12 Sep 2026",
    "skyline",
    3 / 2,
  ),
  image(
    "desk",
    "The import desk",
    "The queue open on every screen by half past seven.",
    "12 Sep 2026",
    "grid",
    4 / 5,
  ),
  audio(
    "ingrid",
    "Ingrid Solberg, in conversation",
    "Twelve minutes on the 31-hour problem and the list that replaced the report.",
    "12 Sep 2026",
    "orbit",
    12,
  ),
  image(
    "yard",
    "The yard, from the crane",
    "Rows 14 to 22, the afternoon shift.",
    "12 Sep 2026",
    "bars",
    16 / 9,
  ),
  video(
    "driver-app",
    "The driver app, on the road",
    "Gate, window, paperwork — the three things a driver sees, filmed from the cab.",
    "13 Sep 2026",
    "waves",
    10,
    ["Gate seven, window nine to eleven.", "Paperwork is on the phone.", "Nothing else."],
  ),
  image(
    "panel",
    "The customs panel",
    "Leila Haddad and two brokers on where the documents stall.",
    "13 Sep 2026",
    "field",
    3 / 2,
  ),
  audio(
    "leila",
    "Leila Haddad on the audit",
    "Why the auditors read the trail and stopped asking.",
    "13 Sep 2026",
    "grid",
    9,
  ),
  image(
    "map-wall",
    "The map wall",
    "Every container between the four ports, live.",
    "13 Sep 2026",
    "harbour",
    1,
  ),
  video(
    "tour",
    "Terminal tour",
    "A two-minute walk from the gate to the desk.",
    "13 Sep 2026",
    "skyline",
    8,
    ["From the gate to the desk.", "Two minutes, one list."],
  ),
  image("night", "The last vessel", "Gothenburg, 22:40.", "13 Sep 2026", "waves", 16 / 9),
  audio("closing", "Closing remarks", "Mara Quist wraps the two days.", "13 Sep 2026", "field", 7),
];
