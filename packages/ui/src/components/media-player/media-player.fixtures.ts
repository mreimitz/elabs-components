/**
 * Story/test fixtures synthesized at module scope, so no story needs a network
 * origin (`docs/CSP-AND-NETWORK.md`) or a binary file. Not exported from the barrel.
 */

/** A silent 8-bit mono PCM WAV of `seconds` length, as a data URL. */
export function synthWavDataUrl(seconds = 20, sampleRate = 3000): string {
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
 * A 16:9 poster frame. SVG `currentColor`-free and literal-free: it paints with
 * CSS system colours so no raw hex enters a component-adjacent file.
 */
export function synthPosterSvgDataUrl(label = "Poster frame"): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">` +
    `<rect width="640" height="360" fill="GrayText"/>` +
    `<circle cx="320" cy="180" r="56" fill="Canvas" opacity="0.85"/>` +
    `<path d="M300 150 L350 180 L300 210 Z" fill="GrayText"/>` +
    `<text x="320" y="300" font-family="sans-serif" font-size="24" text-anchor="middle" fill="Canvas">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A WebVTT captions file as a data URL. */
export function synthVttDataUrl(
  cues: Array<[start: string, end: string, text: string]> = [
    ["00:00.000", "00:05.000", "[silence]"],
    ["00:05.000", "00:20.000", "[silence continues]"],
  ],
): string {
  const body = cues.map(([start, end, text]) => `${start} --> ${end}\n${text}`).join("\n\n");
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n${body}\n`)}`;
}

/**
 * A speech-like waveform shape, 0–1 — what an app would compute from the
 * decoded file (`AudioBuffer.getChannelData`) and pass as `peaks`. Phrases
 * of syllables with short pauses between them; deterministic.
 */
export function synthPeaks(count = 160): number[] {
  return Array.from({ length: count }, (_, i) => {
    const phrase = Math.floor(i / 20);
    const inPhrase = i % 20;
    if (inPhrase >= 17) return 0.04; // the pause between phrases
    const envelope = Math.sin((Math.PI * (inPhrase + 1)) / 18);
    const syllable = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.9 + phrase));
    return Number((0.12 + 0.85 * envelope * syllable).toFixed(3));
  });
}
