/**
 * Story fixtures synthesized at module scope, so no story needs a network
 * origin (`docs/CSP-AND-NETWORK.md`) or a binary file. Internal to this
 * package's stories — not exported from the barrel.
 */

/** A silent 8-bit mono PCM WAV of `seconds` length, as a data URL. */
export function silentWavDataUrl(seconds = 1.5, sampleRate = 8000): string {
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
 * A screenshot-like chart panel (axes, a latency line with a spike, a caption),
 * as an SVG data URL. Paints with CSS system colours only, so no raw colour
 * literal enters this package.
 */
export function placeholderChartDataUrl(caption: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">` +
    `<rect width="640" height="400" fill="Canvas"/>` +
    `<rect x="0.5" y="0.5" width="639" height="399" fill="none" stroke="GrayText" opacity="0.5"/>` +
    `<path d="M60 40 V320 H600" fill="none" stroke="GrayText" stroke-width="2"/>` +
    `<path d="M60 250 L160 240 L260 255 L360 235 L420 120 L480 140 L540 210 L600 215" fill="none" stroke="Highlight" stroke-width="4" stroke-linejoin="round"/>` +
    `<text x="330" y="370" font-family="sans-serif" font-size="22" text-anchor="middle" fill="CanvasText">${caption}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
