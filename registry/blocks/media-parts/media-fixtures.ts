/**
 * Shared by every media block: sample media synthesized inline so a block
 * renders offline with no binary fixtures and no network origin — a short
 * silent WAV standing in for a video or a recording, a WebVTT captions track,
 * poster frames and "screenshots" drawn as SVG. Everything paints with CSS
 * system colours only (no raw colour literal), so it follows the viewer's
 * light or dark scheme. Point the `src` / `poster` / `captions` fields of a
 * block's data at your own assets when you copy it.
 */

/** A silent 8-bit mono PCM WAV of `seconds` length, as a data URL. */
// 3 kHz is the lowest sample rate Chromium decodes; shorter clips keep the data small.
export function silentClip(seconds: number, sampleRate = 3000): string {
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

/** A WebVTT file with one cue per line of `lines`, spread evenly over `seconds`. */
export function captionsTrack(seconds: number, lines: string[]): string {
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

/** The size a piece of art is drawn at. Every ratio here is width ÷ height. */
export interface ArtSize {
  width: number;
  height: number;
}

const svgUrl = (size: ArtSize, body: string, background = "ButtonFace") =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}">` +
      `<rect width="${size.width}" height="${size.height}" fill="${background}"/>` +
      body +
      `</svg>`,
  )}`;

/** FNV-1a — a stable 32-bit hash, so the same seed always draws the same picture. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — a small seeded generator. */
function seeded(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PosterMotif = "orbit" | "bars" | "grid" | "waves" | "skyline" | "harbour" | "field";

/**
 * A poster frame or photograph stand-in with a quiet engineering motif — thin
 * rules, a few tinted plates, registration marks — so tiles read as different
 * pictures without any text (the tile names the item). `seed` varies the
 * placement within a motif.
 */
export function posterArt(
  motif: PosterMotif,
  seed: string = motif,
  size: ArtSize = { width: 640, height: 360 },
): string {
  const { width: w, height: h } = size;
  const rnd = seeded(seed);
  const ink = "CanvasText";
  const tint = "Highlight";
  let body = "";
  if (motif === "orbit") {
    const cx = w * (0.4 + rnd() * 0.2);
    const cy = h * (0.45 + rnd() * 0.1);
    body =
      `<circle cx="${cx}" cy="${cy}" r="${h * 0.34}" fill="none" stroke="${ink}" stroke-width="1.5" opacity="0.35"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${h * 0.22}" fill="none" stroke="${ink}" stroke-width="1" stroke-dasharray="4 5" opacity="0.35"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${h * 0.09}" fill="${tint}" opacity="0.55"/>` +
      `<circle cx="${cx + h * 0.34}" cy="${cy}" r="9" fill="${ink}" opacity="0.6"/>` +
      `<line x1="${cx - h * 0.5}" y1="${cy}" x2="${cx + h * 0.5}" y2="${cy}" stroke="${ink}" stroke-width="1" opacity="0.25"/>`;
  } else if (motif === "bars") {
    const n = 7;
    const gap = w / (n + 2);
    body = Array.from({ length: n }, (_, i) => {
      const bh = h * (0.18 + rnd() * 0.5);
      const x = gap * (i + 1);
      const accent = i === Math.floor(n / 2);
      return (
        `<rect x="${x}" y="${h * 0.82 - bh}" width="${gap * 0.6}" height="${bh}" ` +
        `fill="${accent ? tint : ink}" opacity="${accent ? 0.55 : 0.22}"/>`
      );
    }).join("");
    body += `<line x1="${gap * 0.7}" y1="${h * 0.82}" x2="${w - gap * 0.7}" y2="${h * 0.82}" stroke="${ink}" stroke-width="1.5" opacity="0.4"/>`;
  } else if (motif === "grid") {
    const cols = 6;
    const rows = 4;
    const pitch = w / (cols + 1);
    body = `<g stroke="${ink}" stroke-width="1" opacity="0.22">`;
    for (let i = 1; i <= cols; i += 1)
      body += `<line x1="${i * pitch}" y1="${h * 0.12}" x2="${i * pitch}" y2="${h * 0.88}"/>`;
    for (let j = 1; j <= rows; j += 1)
      body += `<line x1="${pitch}" y1="${(h * j) / (rows + 1)}" x2="${w - pitch}" y2="${(h * j) / (rows + 1)}"/>`;
    body += `</g>`;
    for (let k = 0; k < 3; k += 1) {
      const c = 1 + Math.floor(rnd() * (cols - 1));
      const r = 1 + Math.floor(rnd() * (rows - 1));
      body += `<rect x="${c * pitch}" y="${(h * r) / (rows + 1)}" width="${pitch}" height="${h / (rows + 1)}" fill="${tint}" opacity="0.4"/>`;
    }
  } else if (motif === "waves") {
    body = Array.from({ length: 5 }, (_, i) => {
      const y = h * (0.3 + i * 0.12);
      const amp = h * (0.03 + rnd() * 0.05);
      let d = `M0 ${y}`;
      for (let x = 0; x < w; x += w / 4) {
        d += ` Q${x + w / 16} ${y - amp} ${x + w / 8} ${y}`;
        d += ` Q${x + (3 * w) / 16} ${y + amp} ${x + w / 4} ${y}`;
      }
      return `<path d="${d}" fill="none" stroke="${i === 2 ? tint : ink}" stroke-width="${i === 2 ? 2 : 1}" opacity="${i === 2 ? 0.6 : 0.28}"/>`;
    }).join("");
  } else if (motif === "skyline") {
    const n = 9;
    const bw = w / n;
    body = Array.from({ length: n }, (_, i) => {
      const bh = h * (0.2 + rnd() * 0.55);
      const accent = rnd() > 0.72;
      return (
        `<rect x="${i * bw + 3}" y="${h - bh}" width="${bw - 6}" height="${bh}" fill="${accent ? tint : ink}" opacity="${accent ? 0.45 : 0.2}"/>` +
        `<rect x="${i * bw + 3}" y="${h - bh}" width="${bw - 6}" height="${bh}" fill="none" stroke="${ink}" stroke-width="1" opacity="0.35"/>`
      );
    }).join("");
    body += `<line x1="0" y1="${h * 0.3}" x2="${w}" y2="${h * 0.3}" stroke="${ink}" stroke-width="1" stroke-dasharray="2 6" opacity="0.3"/>`;
  } else if (motif === "harbour") {
    const horizon = h * 0.58;
    body =
      `<rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="${tint}" opacity="0.18"/>` +
      `<line x1="0" y1="${horizon}" x2="${w}" y2="${horizon}" stroke="${ink}" stroke-width="1.5" opacity="0.45"/>`;
    for (let i = 0; i < 4; i += 1) {
      const x = w * (0.1 + rnd() * 0.8);
      const cw = 30 + rnd() * 70;
      body += `<rect x="${x}" y="${horizon - 22}" width="${cw}" height="22" fill="${ink}" opacity="0.3"/>`;
      body += `<line x1="${x + cw * 0.4}" y1="${horizon - 22}" x2="${x + cw * 0.4}" y2="${horizon - 22 - h * (0.15 + rnd() * 0.2)}" stroke="${ink}" stroke-width="2" opacity="0.5"/>`;
    }
    body += `<circle cx="${w * 0.78}" cy="${h * 0.24}" r="${h * 0.07}" fill="${tint}" opacity="0.5"/>`;
  } else {
    // field — a scatter of dots on a faint ruler, one cluster tinted.
    body = `<line x1="${w * 0.08}" y1="${h * 0.85}" x2="${w * 0.92}" y2="${h * 0.85}" stroke="${ink}" stroke-width="1" opacity="0.35"/>`;
    for (let i = 0; i < 46; i += 1) {
      const x = w * (0.1 + rnd() * 0.8);
      const y = h * (0.15 + rnd() * 0.62);
      const near = Math.hypot(x - w * 0.62, y - h * 0.42) < h * 0.2;
      body += `<circle cx="${x}" cy="${y}" r="${near ? 5 : 3.5}" fill="${near ? tint : ink}" opacity="${near ? 0.6 : 0.3}"/>`;
    }
  }
  return svgUrl(size, body);
}

export type ScreenshotMotif = "dashboard" | "table" | "map" | "flow" | "chat" | "timeline";

/**
 * A product screenshot stand-in: a window with a sidebar and a content area
 * whose furniture follows the motif — KPI tiles and bars, a data grid, a map
 * with pins, a node graph, a chat thread or a timeline. Drawn 16:10.
 */
export function screenshotArt(
  motif: ScreenshotMotif,
  seed: string = motif,
  size: ArtSize = { width: 800, height: 500 },
): string {
  const { width: w, height: h } = size;
  const rnd = seeded(seed);
  const ink = "CanvasText";
  const tint = "Highlight";
  const paper = "Canvas";
  const side = 150;
  const top = 44;
  let body =
    // The window: title bar, sidebar with nav rows, content ground.
    `<rect width="${w}" height="${h}" fill="${paper}"/>` +
    `<rect width="${w}" height="${top}" fill="${paper}"/>` +
    `<line x1="0" y1="${top}" x2="${w}" y2="${top}" stroke="${ink}" stroke-width="1" opacity="0.15"/>` +
    `<rect x="${side}" y="${top}" width="${w - side}" height="${h - top}" fill="ButtonFace" opacity="0.5"/>` +
    `<line x1="${side}" y1="${top}" x2="${side}" y2="${h}" stroke="${ink}" stroke-width="1" opacity="0.15"/>` +
    `<circle cx="20" cy="${top / 2}" r="5" fill="${ink}" opacity="0.25"/>` +
    `<circle cx="38" cy="${top / 2}" r="5" fill="${ink}" opacity="0.25"/>` +
    `<circle cx="56" cy="${top / 2}" r="5" fill="${ink}" opacity="0.25"/>` +
    `<rect x="${w / 2 - 110}" y="${top / 2 - 9}" width="220" height="18" rx="6" fill="${ink}" opacity="0.08"/>`;
  for (let i = 0; i < 7; i += 1) {
    const y = top + 18 + i * 30;
    body +=
      `<rect x="14" y="${y}" width="14" height="14" rx="3" fill="${i === 1 ? tint : ink}" opacity="${i === 1 ? 0.7 : 0.22}"/>` +
      `<rect x="36" y="${y + 3}" width="${60 + rnd() * 50}" height="8" rx="3" fill="${ink}" opacity="${i === 1 ? 0.5 : 0.18}"/>`;
  }
  const cx = side + 24;
  const cy = top + 24;
  const cw = w - side - 48;
  const ch = h - top - 48;
  // Page title and a toolbar.
  body +=
    `<rect x="${cx}" y="${cy}" width="180" height="14" rx="4" fill="${ink}" opacity="0.6"/>` +
    `<rect x="${cx + cw - 96}" y="${cy - 3}" width="96" height="22" rx="6" fill="${tint}" opacity="0.7"/>` +
    `<rect x="${cx + cw - 200}" y="${cy - 3}" width="92" height="22" rx="6" fill="none" stroke="${ink}" stroke-width="1" opacity="0.3"/>`;
  const by = cy + 36;
  const bh = ch - 36;
  if (motif === "dashboard") {
    const tiles = 4;
    const tw = (cw - (tiles - 1) * 12) / tiles;
    for (let i = 0; i < tiles; i += 1) {
      const x = cx + i * (tw + 12);
      body +=
        `<rect x="${x}" y="${by}" width="${tw}" height="78" rx="8" fill="${paper}" stroke="${ink}" stroke-opacity="0.15"/>` +
        `<rect x="${x + 12}" y="${by + 12}" width="${tw * 0.45}" height="7" rx="3" fill="${ink}" opacity="0.3"/>` +
        `<rect x="${x + 12}" y="${by + 30}" width="${tw * 0.55}" height="16" rx="4" fill="${ink}" opacity="0.7"/>` +
        `<rect x="${x + 12}" y="${by + 56}" width="${tw * 0.3}" height="7" rx="3" fill="${tint}" opacity="0.7"/>`;
    }
    const gy = by + 94;
    const gh = bh - 94;
    const lw = cw * 0.62;
    body += `<rect x="${cx}" y="${gy}" width="${lw}" height="${gh}" rx="8" fill="${paper}" stroke="${ink}" stroke-opacity="0.15"/>`;
    const n = 12;
    for (let i = 0; i < n; i += 1) {
      const bw = (lw - 40) / n;
      const v = gh * (0.2 + rnd() * 0.55);
      body += `<rect x="${cx + 20 + i * bw + 3}" y="${gy + gh - 20 - v}" width="${bw - 6}" height="${v}" fill="${i === 8 ? tint : ink}" opacity="${i === 8 ? 0.75 : 0.22}"/>`;
    }
    body += `<rect x="${cx + lw + 12}" y="${gy}" width="${cw - lw - 12}" height="${gh}" rx="8" fill="${paper}" stroke="${ink}" stroke-opacity="0.15"/>`;
    for (let i = 0; i < 5; i += 1) {
      const y = gy + 20 + i * ((gh - 30) / 5);
      body +=
        `<rect x="${cx + lw + 26}" y="${y}" width="${(cw - lw - 12) * 0.35}" height="7" rx="3" fill="${ink}" opacity="0.3"/>` +
        `<rect x="${cx + lw + 26}" y="${y + 12}" width="${(cw - lw - 12) * (0.25 + rnd() * 0.6)}" height="6" rx="3" fill="${tint}" opacity="0.6"/>`;
    }
  } else if (motif === "table") {
    body += `<rect x="${cx}" y="${by}" width="${cw}" height="${bh}" rx="8" fill="${paper}" stroke="${ink}" stroke-opacity="0.15"/>`;
    const cols = [0.06, 0.3, 0.52, 0.7, 0.86];
    body += `<line x1="${cx}" y1="${by + 34}" x2="${cx + cw}" y2="${by + 34}" stroke="${ink}" stroke-opacity="0.2"/>`;
    cols.forEach((c) => {
      body += `<rect x="${cx + cw * c}" y="${by + 13}" width="${cw * 0.1}" height="8" rx="3" fill="${ink}" opacity="0.45"/>`;
    });
    const rows = Math.floor((bh - 40) / 30);
    for (let r = 0; r < rows; r += 1) {
      const y = by + 34 + r * 30;
      body += `<line x1="${cx}" y1="${y + 30}" x2="${cx + cw}" y2="${y + 30}" stroke="${ink}" stroke-opacity="0.08"/>`;
      cols.forEach((c, i) => {
        const wv = cw * (i === 1 ? 0.16 : 0.06 + rnd() * 0.05);
        body += `<rect x="${cx + cw * c}" y="${y + 11}" width="${wv}" height="8" rx="3" fill="${ink}" opacity="${i === 1 ? 0.45 : 0.22}"/>`;
      });
      if (rnd() > 0.6)
        body += `<rect x="${cx + cw * 0.86}" y="${y + 8}" width="48" height="14" rx="7" fill="${tint}" opacity="0.5"/>`;
    }
  } else if (motif === "map") {
    body += `<rect x="${cx}" y="${by}" width="${cw}" height="${bh}" rx="8" fill="${tint}" opacity="0.12"/>`;
    for (let i = 0; i < 4; i += 1) {
      const x = cx + cw * (0.05 + rnd() * 0.6);
      const y = by + bh * (0.05 + rnd() * 0.5);
      body += `<ellipse cx="${x + cw * 0.15}" cy="${y + bh * 0.15}" rx="${cw * (0.1 + rnd() * 0.15)}" ry="${bh * (0.1 + rnd() * 0.15)}" fill="${paper}" opacity="0.9"/>`;
    }
    let d = `M${cx + cw * 0.1} ${by + bh * 0.7}`;
    for (let i = 1; i <= 5; i += 1)
      d += ` L${cx + cw * (0.1 + i * 0.16)} ${by + bh * (0.2 + rnd() * 0.55)}`;
    body += `<path d="${d}" fill="none" stroke="${tint}" stroke-width="3" stroke-dasharray="8 6" opacity="0.8"/>`;
    for (let i = 0; i < 6; i += 1) {
      const x = cx + cw * (0.1 + i * 0.16);
      const y = by + bh * (0.2 + rnd() * 0.55);
      body += `<circle cx="${x}" cy="${y}" r="9" fill="${paper}" stroke="${tint}" stroke-width="3"/>`;
    }
  } else if (motif === "flow") {
    body += `<rect x="${cx}" y="${by}" width="${cw}" height="${bh}" rx="8" fill="${paper}" stroke="${ink}" stroke-opacity="0.15"/>`;
    const nodes: [x: number, y: number][] = [
      [0.08, 0.5],
      [0.3, 0.25],
      [0.3, 0.75],
      [0.55, 0.5],
      [0.78, 0.3],
      [0.78, 0.7],
    ];
    const edges: [from: number, to: number][] = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [3, 5],
    ];
    const nw = cw * 0.15;
    const nh = 44;
    edges.forEach(([a, b]) => {
      const [ax, ay] = nodes[a] ?? [0, 0];
      const [bx, by2] = nodes[b] ?? [0, 0];
      const x1 = cx + cw * ax + nw / 2;
      const y1 = by + bh * ay;
      const x2 = cx + cw * bx - nw / 2;
      const y2 = by + bh * by2;
      body += `<path d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}" fill="none" stroke="${ink}" stroke-width="1.5" opacity="0.35"/>`;
    });
    nodes.forEach(([nx, ny], i) => {
      const x = cx + cw * nx - nw / 2;
      const y = by + bh * ny - nh / 2;
      body +=
        `<rect x="${x}" y="${y}" width="${nw}" height="${nh}" rx="8" fill="${paper}" stroke="${i === 3 ? tint : ink}" stroke-width="${i === 3 ? 2 : 1}" stroke-opacity="${i === 3 ? 0.9 : 0.35}"/>` +
        `<rect x="${x + 10}" y="${y + 12}" width="${nw * 0.5}" height="7" rx="3" fill="${ink}" opacity="0.5"/>` +
        `<rect x="${x + 10}" y="${y + 26}" width="${nw * 0.7}" height="6" rx="3" fill="${ink}" opacity="0.2"/>`;
    });
  } else if (motif === "chat") {
    for (let i = 0; i < 6; i += 1) {
      const mine = i % 2 === 1;
      const bwid = cw * (0.35 + rnd() * 0.25);
      const y = by + i * (bh / 6);
      const x = mine ? cx + cw - bwid : cx;
      body += `<rect x="${x}" y="${y}" width="${bwid}" height="${bh / 6 - 14}" rx="12" fill="${mine ? tint : paper}" opacity="${mine ? 0.7 : 1}" stroke="${ink}" stroke-opacity="${mine ? 0 : 0.15}"/>`;
      for (let l = 0; l < 2; l += 1)
        body += `<rect x="${x + 14}" y="${y + 14 + l * 14}" width="${bwid * (0.5 + rnd() * 0.4)}" height="7" rx="3" fill="${mine ? paper : ink}" opacity="${mine ? 0.85 : 0.3}"/>`;
    }
  } else {
    // timeline — a vertical rule with dated events.
    const lx = cx + 40;
    body += `<line x1="${lx}" y1="${by}" x2="${lx}" y2="${by + bh}" stroke="${ink}" stroke-width="1.5" opacity="0.3"/>`;
    for (let i = 0; i < 5; i += 1) {
      const y = by + 16 + i * (bh / 5);
      body +=
        `<circle cx="${lx}" cy="${y}" r="7" fill="${i === 2 ? tint : paper}" stroke="${i === 2 ? tint : ink}" stroke-width="2" stroke-opacity="${i === 2 ? 1 : 0.4}"/>` +
        `<rect x="${cx}" y="${y - 4}" width="24" height="8" rx="3" fill="${ink}" opacity="0.3"/>` +
        `<rect x="${lx + 24}" y="${y - 20}" width="${cw * (0.4 + rnd() * 0.4)}" height="${bh / 5 - 24}" rx="8" fill="${paper}" stroke="${ink}" stroke-opacity="0.15"/>` +
        `<rect x="${lx + 38}" y="${y - 8}" width="${cw * 0.25}" height="8" rx="3" fill="${ink}" opacity="0.5"/>` +
        `<rect x="${lx + 38}" y="${y + 6}" width="${cw * 0.35}" height="6" rx="3" fill="${ink}" opacity="0.2"/>`;
    }
  }
  return svgUrl(size, body, paper);
}

/** Square cover art for a recording — a tinted plate with a motif on it. */
export function coverArt(motif: PosterMotif, seed: string = motif): string {
  return posterArt(motif, seed, { width: 400, height: 400 });
}
