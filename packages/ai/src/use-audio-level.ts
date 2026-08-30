"use client";

import { useEffect, useState } from "react";

/**
 * The OPT-IN analyser-plumbing hook for `AudioVisualizer` (issue #21). It is a
 * separate export a consumer may ignore entirely — `AudioVisualizer` itself
 * never imports or calls this. brand-ui is a presentation layer (D5): this
 * hook never calls `getUserMedia` and never creates an `AudioContext` until a
 * `MediaStream` the CONSUMER already obtained is actually passed in.
 */

export interface UseAudioLevelOptions {
  /** `AnalyserNode.fftSize` — controls how many frequency bins `levels` has
   * (`fftSize / 2`). Must be a power of two in [32, 32768]. */
  fftSize?: number;
  /** `AnalyserNode.smoothingTimeConstant` (0–1) — the analyser's OWN frame-to-frame
   * smoothing, independent of `AudioVisualizer`'s reduced-motion smoothing. */
  smoothingTimeConstant?: number;
}

export interface UseAudioLevelResult {
  /** Normalized 0–1 frequency-bin samples for the current frame — feed this
   * directly to `<AudioVisualizer levels={levels} />`. Empty while `stream`
   * is `null`/`undefined` or the Web Audio API is unavailable. */
  levels: number[];
  /** The mean of `levels` — a single 0–1 scalar for a simple level meter. */
  level: number;
}

const DEFAULT_FFT_SIZE = 64;
const DEFAULT_SMOOTHING_TIME_CONSTANT = 0.6;

type AudioContextCtor = new () => AudioContext;

/** Feature-detects the Web Audio API — absent under SSR, in a test runner
 * with no Web Audio shim, and in older Safari (`webkitAudioContext`). */
function resolveAudioContextConstructor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Polls a `MediaStream` the caller already obtained (their own `getUserMedia`
 * call — this hook never requests one) via a Web Audio `AnalyserNode`, on a
 * `requestAnimationFrame` loop, and returns normalized levels.
 *
 * Pass `null`/`undefined` for `stream` (e.g. before the user grants mic
 * permission) and the hook is a no-op returning empty levels — safe to call
 * unconditionally, including with no stream ever provided at all.
 */
export function useAudioLevel(
  stream: MediaStream | null | undefined,
  options: UseAudioLevelOptions = {},
): UseAudioLevelResult {
  const { fftSize = DEFAULT_FFT_SIZE, smoothingTimeConstant = DEFAULT_SMOOTHING_TIME_CONSTANT } =
    options;
  const [levels, setLevels] = useState<number[]>([]);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream) {
      setLevels([]);
      setLevel(0);
      return undefined;
    }

    const AudioContextConstructor = resolveAudioContextConstructor();
    if (!AudioContextConstructor) {
      return undefined;
    }

    const audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const normalized = Array.from(buffer, (value) => value / 255);
      setLevels(normalized);
      setLevel(normalized.reduce((sum, value) => sum + value, 0) / (normalized.length || 1));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, [stream, fftSize, smoothingTimeConstant]);

  return { level, levels };
}
